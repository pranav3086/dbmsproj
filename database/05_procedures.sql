-- Stored procedures: every change the application makes goes through one of these. Each
-- procedure checks who is calling (app_uid()), validates its input and enforces the allowed
-- state transitions. The API server runs each CALL inside a transaction, so a failure
-- (SIGNAL) rolls back everything the call did.
--
-- Results come back as a final SELECT: either table rows, or one JSON column named `result`.
USE a10_hospital;

DELIMITER $$

-- ═════════════════════════════ Access summary ═════════════════════════════
CREATE PROCEDURE get_my_access()
READS SQL DATA
BEGIN
  DECLARE v_uid CHAR(36) DEFAULT app_uid();
  SELECT IF(v_uid IS NULL, NULL, (
    SELECT JSON_OBJECT(
      'user_id', p.id,
      'email', p.email,
      'full_name', p.full_name,
      'is_active', p.is_active IS TRUE,
      'roles', COALESCE((SELECT CAST(CONCAT('[', GROUP_CONCAT(JSON_QUOTE(r.role) ORDER BY r.role), ']') AS JSON)
                         FROM user_roles r WHERE r.user_id = p.id), JSON_ARRAY()),
      'permissions', COALESCE((SELECT CAST(CONCAT('[', GROUP_CONCAT(JSON_QUOTE(s.permission) ORDER BY s.permission), ']') AS JSON)
                               FROM staff_permissions s WHERE s.user_id = p.id), JSON_ARRAY()),
      'doctor_id', (SELECT d.id FROM doctors d WHERE d.user_id = p.id),
      'doctor_application', (SELECT JSON_OBJECT('id', a.id, 'status', a.status, 'review_notes', a.review_notes,
                                                'credential_path', a.credential_path, 'created_at', a.created_at)
                             FROM doctor_applications a WHERE a.user_id = p.id)
    ) FROM profiles p WHERE p.id = v_uid
  )) AS result;
END$$

-- ═════════════════════════════ Scheduling ═════════════════════════════
-- Fills the temporary table tmp_slots with the free slots of the given doctors, starting on
-- hospital-local date p_from, for p_days days. A slot is free if it lies inside a working-hours
-- window, respects the booking lead time and horizon, and overlaps no active appointment.
CREATE PROCEDURE build_slots(p_doctor_ids JSON, p_from DATE, p_days INT)
READS SQL DATA
BEGIN
  DECLARE v_lead INT DEFAULT COALESCE(CAST(setting_text('booking_lead_minutes') AS SIGNED), 60);
  DECLARE v_horizon INT DEFAULT COALESCE(CAST(setting_text('booking_horizon_days') AS SIGNED), 60);
  DECLARE v_days INT DEFAULT LEAST(GREATEST(COALESCE(p_days, 1), 1), 62);
  DECLARE v_now DATETIME(3) DEFAULT UTC_TIMESTAMP(3);

  DROP TEMPORARY TABLE IF EXISTS tmp_slots;
  CREATE TEMPORARY TABLE tmp_slots (
    doctor_id CHAR(36) NOT NULL, starts_at DATETIME(3) NOT NULL, ends_at DATETIME(3) NOT NULL,
    PRIMARY KEY (doctor_id, starts_at)
  );
  INSERT IGNORE INTO tmp_slots (doctor_id, starts_at, ends_at)
  WITH RECURSIVE nums (n) AS (SELECT 0 UNION ALL SELECT n + 1 FROM nums WHERE n < 199),
  ids AS (SELECT DISTINCT j.id FROM JSON_TABLE(p_doctor_ids, '$[*]' COLUMNS (id CHAR(36) PATH '$')) j),
  days AS (SELECT DATE_ADD(p_from, INTERVAL n DAY) AS d FROM nums WHERE n < v_days),
  slots AS (
    SELECT a.doctor_id,
           from_local(TIMESTAMP(dy.d, a.start_time) + INTERVAL (k.n * a.slot_minutes) MINUTE) AS s,
           from_local(TIMESTAMP(dy.d, a.start_time) + INTERVAL ((k.n + 1) * a.slot_minutes) MINUTE) AS e
    FROM days dy
    JOIN doctor_availability a ON a.weekday = DAYOFWEEK(dy.d) - 1
    JOIN ids ON ids.id = a.doctor_id
    JOIN doctors doc ON doc.id = a.doctor_id AND doc.is_active
    JOIN nums k ON k.n < FLOOR(TIME_TO_SEC(TIMEDIFF(a.end_time, a.start_time)) / 60 / a.slot_minutes)
  )
  SELECT sl.doctor_id, sl.s, sl.e
  FROM slots sl
  WHERE sl.s > v_now + INTERVAL v_lead MINUTE
    AND sl.s < v_now + INTERVAL v_horizon DAY
    AND NOT EXISTS (
      SELECT 1 FROM appointments ap
      WHERE ap.doctor_id = sl.doctor_id AND ap.status IN ('requested', 'confirmed')
        AND ap.starts_at < sl.e AND ap.ends_at > sl.s
    );
END$$

CREATE PROCEDURE get_available_slots(p_doctor_id CHAR(36), p_from DATE, p_days INT)
READS SQL DATA
BEGIN
  CALL build_slots(JSON_ARRAY(p_doctor_id), p_from, COALESCE(p_days, 14));
  SELECT starts_at, ends_at FROM tmp_slots ORDER BY starts_at;
  DROP TEMPORARY TABLE IF EXISTS tmp_slots;
END$$

CREATE PROCEDURE get_next_slots(p_doctor_ids JSON)
READS SQL DATA
BEGIN
  DECLARE v_ids JSON DEFAULT (
    SELECT COALESCE(JSON_ARRAYAGG(j.id), JSON_ARRAY())
    FROM JSON_TABLE(p_doctor_ids, '$[*]' COLUMNS (pos FOR ORDINALITY, id CHAR(36) PATH '$')) j WHERE j.pos <= 60
  );
  CALL build_slots(v_ids, DATE(to_local(UTC_TIMESTAMP(3))), 21);
  SELECT j.id AS doctor_id, MIN(t.starts_at) AS next_starts_at
  FROM JSON_TABLE(v_ids, '$[*]' COLUMNS (id CHAR(36) PATH '$')) j
  LEFT JOIN tmp_slots t ON t.doctor_id = j.id
  GROUP BY j.id;
  DROP TEMPORARY TABLE IF EXISTS tmp_slots;
END$$

-- The end time of the slot that starts at p_starts_at, or NULL if that is not a free slot.
-- Uses the same rules as build_slots, for a single time.
CREATE FUNCTION free_slot_end(p_doctor_id CHAR(36), p_starts_at DATETIME(3)) RETURNS DATETIME(3)
READS SQL DATA
BEGIN
  DECLARE v_local DATETIME(3) DEFAULT to_local(p_starts_at);
  DECLARE v_time TIME DEFAULT TIME(v_local);
  DECLARE v_minutes INT DEFAULT NULL;
  DECLARE v_now DATETIME(3) DEFAULT UTC_TIMESTAMP(3);
  IF p_starts_at IS NULL OR MICROSECOND(p_starts_at) <> 0 OR SECOND(p_starts_at) <> 0 THEN RETURN NULL; END IF;
  IF p_starts_at <= v_now + INTERVAL COALESCE(CAST(setting_text('booking_lead_minutes') AS SIGNED), 60) MINUTE
     OR p_starts_at >= v_now + INTERVAL COALESCE(CAST(setting_text('booking_horizon_days') AS SIGNED), 60) DAY THEN
    RETURN NULL;
  END IF;
  SELECT a.slot_minutes INTO v_minutes
  FROM doctor_availability a
  JOIN doctors doc ON doc.id = a.doctor_id AND doc.is_active
  WHERE a.doctor_id = p_doctor_id
    AND a.weekday = DAYOFWEEK(v_local) - 1
    AND v_time >= a.start_time
    AND MOD(TIME_TO_SEC(TIMEDIFF(v_time, a.start_time)), a.slot_minutes * 60) = 0
    AND ADDTIME(v_time, SEC_TO_TIME(a.slot_minutes * 60)) <= a.end_time
  LIMIT 1;
  IF v_minutes IS NULL THEN RETURN NULL; END IF;
  IF EXISTS (
    SELECT 1 FROM appointments ap
    WHERE ap.doctor_id = p_doctor_id AND ap.status IN ('requested', 'confirmed')
      AND ap.starts_at < p_starts_at + INTERVAL v_minutes MINUTE AND ap.ends_at > p_starts_at
  ) THEN
    RETURN NULL;
  END IF;
  RETURN p_starts_at + INTERVAL v_minutes MINUTE;
END$$

-- ═════════════════════════════ Appointments ═════════════════════════════
-- Shared by book_appointment and reschedule_appointment; returns the new id in p_new_id.
CREATE PROCEDURE book_appointment_core(
  p_doctor_id CHAR(36), p_starts_at DATETIME(3), p_reason TEXT, p_patient_name TEXT, p_patient_phone TEXT,
  p_rescheduled_from CHAR(36), OUT p_new_id CHAR(36)
)
MODIFIES SQL DATA
BEGIN
  DECLARE v_uid CHAR(36) DEFAULT require_user();
  DECLARE v_doc_user CHAR(36);
  DECLARE v_dept CHAR(36) DEFAULT NULL;
  DECLARE v_ends DATETIME(3);
  DECLARE v_full_name VARCHAR(120);
  DECLARE v_email VARCHAR(254);
  DECLARE v_phone VARCHAR(20);
  DECLARE v_id CHAR(36) DEFAULT UUID();
  DECLARE v_ref VARCHAR(20) DEFAULT make_reference('APT');
  -- The unique keys on (doctor_id, active_doctor_slot) are the final guard against double-booking.
  DECLARE EXIT HANDLER FOR 1062
    SIGNAL SQLSTATE '45001' SET MESSAGE_TEXT = 'That time is no longer available. Please choose another slot.';

  IF NOT has_role('patient') THEN CALL deny('Only patient accounts can book appointments.'); END IF;
  IF CHAR_LENGTH(p_reason) > 500 THEN CALL fail('Please keep the reason under 500 characters.'); END IF;
  IF NULLIF(TRIM(p_patient_phone), '') IS NOT NULL AND NOT REGEXP_LIKE(TRIM(p_patient_phone), '^[0-9+() -]{6,20}$') THEN
    CALL fail('Please provide a valid phone number.');
  END IF;

  -- Locking the doctor row serialises concurrent bookings for the same doctor.
  SELECT user_id, department_id INTO v_doc_user, v_dept FROM doctors WHERE id = p_doctor_id AND is_active FOR UPDATE;
  IF v_dept IS NULL THEN CALL fail('This doctor is not accepting appointments.'); END IF;

  SET v_ends = free_slot_end(p_doctor_id, p_starts_at);
  IF v_ends IS NULL THEN
    SIGNAL SQLSTATE '45001' SET MESSAGE_TEXT = 'That time is no longer available. Please choose another slot.';
  END IF;

  SELECT full_name, email, phone INTO v_full_name, v_email, v_phone FROM profiles WHERE id = v_uid;

  INSERT INTO appointments (
    id, reference, patient_id, doctor_id, department_id, starts_at, ends_at, status, reason,
    patient_name, patient_phone, patient_email, rescheduled_from, created_by
  ) VALUES (
    v_id, v_ref, v_uid, p_doctor_id, v_dept, p_starts_at, v_ends, 'requested', NULLIF(TRIM(p_reason), ''),
    LEFT(COALESCE(NULLIF(TRIM(p_patient_name), ''), NULLIF(v_full_name, ''), v_email), 120),
    COALESCE(NULLIF(TRIM(p_patient_phone), ''), v_phone), v_email, p_rescheduled_from, v_uid
  );
  INSERT INTO appointment_events (appointment_id, from_status, to_status, actor_id, note)
  VALUES (v_id, NULL, 'requested', v_uid, IF(p_rescheduled_from IS NOT NULL, 'Rescheduled booking', NULL));

  CALL notify(v_uid, 'appointment_requested', 'Appointment request received',
    CONCAT('Your appointment request ', v_ref, ' for ', format_local(p_starts_at), ' has been received and is awaiting confirmation.'),
    CONCAT('/patient/appointments/', v_id), TRUE);
  IF v_doc_user IS NOT NULL THEN
    CALL notify(v_doc_user, 'appointment_requested', 'New appointment request',
      CONCAT('A new appointment request (', v_ref, ') is waiting for your review.'), '/doctor/appointments', FALSE);
  END IF;
  SET p_new_id = v_id;
END$$

CREATE PROCEDURE book_appointment(
  p_doctor_id CHAR(36), p_starts_at DATETIME(3), p_reason TEXT, p_patient_name TEXT, p_patient_phone TEXT
)
MODIFIES SQL DATA
BEGIN
  DECLARE v_id CHAR(36);
  CALL book_appointment_core(p_doctor_id, p_starts_at, p_reason, p_patient_name, p_patient_phone, NULL, v_id);
  SELECT * FROM appointments WHERE id = v_id;
END$$

CREATE FUNCTION patient_can_change(p_status VARCHAR(20), p_starts_at DATETIME(3)) RETURNS BOOLEAN
READS SQL DATA
BEGIN
  RETURN p_status IN ('requested', 'confirmed')
     AND p_starts_at > UTC_TIMESTAMP(3) + INTERVAL COALESCE(CAST(setting_text('cancellation_cutoff_hours') AS SIGNED), 2) HOUR;
END$$

CREATE PROCEDURE reschedule_appointment(p_appointment_id CHAR(36), p_new_starts_at DATETIME(3))
MODIFIES SQL DATA
BEGIN
  DECLARE v_uid CHAR(36) DEFAULT require_user();
  DECLARE v_found BOOLEAN DEFAULT FALSE;
  DECLARE v_doctor CHAR(36);
  DECLARE v_status VARCHAR(20);
  DECLARE v_starts DATETIME(3);
  DECLARE v_reason TEXT;
  DECLARE v_name TEXT;
  DECLARE v_phone TEXT;
  DECLARE v_new CHAR(36);
  DECLARE v_new_ref VARCHAR(20);

  SELECT TRUE, doctor_id, status, starts_at, reason, patient_name, patient_phone
    INTO v_found, v_doctor, v_status, v_starts, v_reason, v_name, v_phone
  FROM appointments WHERE id = p_appointment_id AND patient_id = v_uid FOR UPDATE;
  IF NOT v_found THEN CALL not_found('Appointment not found.'); END IF;
  IF NOT patient_can_change(v_status, v_starts) THEN
    CALL fail('This appointment can no longer be rescheduled online. Please contact the hospital.');
  END IF;

  CALL book_appointment_core(v_doctor, p_new_starts_at, v_reason, v_name, v_phone, p_appointment_id, v_new);
  SELECT reference INTO v_new_ref FROM appointments WHERE id = v_new;
  UPDATE appointments SET status = 'cancelled', cancel_reason = CONCAT('Rescheduled to ', v_new_ref) WHERE id = p_appointment_id;
  INSERT INTO appointment_events (appointment_id, from_status, to_status, actor_id, note)
  VALUES (p_appointment_id, v_status, 'cancelled', v_uid, CONCAT('Rescheduled to ', v_new_ref));
  SELECT * FROM appointments WHERE id = v_new;
END$$

CREATE PROCEDURE update_appointment_status(p_appointment_id CHAR(36), p_status VARCHAR(20), p_note TEXT)
MODIFIES SQL DATA
BEGIN
  DECLARE v_uid CHAR(36) DEFAULT require_user();
  DECLARE v_found BOOLEAN DEFAULT FALSE;
  DECLARE v_patient CHAR(36);
  DECLARE v_doctor CHAR(36);
  DECLARE v_from VARCHAR(20);
  DECLARE v_starts DATETIME(3);
  DECLARE v_ref VARCHAR(20);
  DECLARE v_is_doctor BOOLEAN;
  DECLARE v_is_staff BOOLEAN;
  DECLARE v_allowed BOOLEAN DEFAULT FALSE;

  SELECT TRUE, patient_id, doctor_id, status, starts_at, reference
    INTO v_found, v_patient, v_doctor, v_from, v_starts, v_ref
  FROM appointments WHERE id = p_appointment_id FOR UPDATE;
  IF NOT v_found THEN CALL not_found('Appointment not found.'); END IF;
  IF p_status NOT IN ('requested', 'confirmed', 'cancelled', 'completed', 'no_show') THEN CALL fail('Invalid status.'); END IF;
  SET v_is_doctor = v_doctor <=> my_doctor_id();
  SET v_is_staff = has_permission('appointments') OR is_admin();

  IF v_patient = v_uid AND p_status = 'cancelled' THEN
    SET v_allowed = patient_can_change(v_from, v_starts);
    IF NOT v_allowed THEN
      CALL fail('This appointment can no longer be cancelled online. Please contact the hospital.');
    END IF;
  ELSEIF v_is_doctor OR v_is_staff THEN
    SET v_allowed = CASE
      WHEN v_from = 'requested' THEN p_status IN ('confirmed', 'cancelled')
      WHEN v_from = 'confirmed' THEN p_status IN ('cancelled', 'no_show') OR (p_status = 'completed' AND v_is_doctor)
      ELSE FALSE END;
    IF v_allowed AND p_status IN ('completed', 'no_show') AND v_starts > UTC_TIMESTAMP(3) THEN
      CALL fail(CONCAT('An appointment can only be marked ', REPLACE(p_status, '_', '-'), ' after its start time.'));
    END IF;
  ELSE
    CALL deny('You do not have permission to change this appointment.');
  END IF;

  IF NOT v_allowed THEN
    CALL fail(CONCAT('An appointment cannot move from ', v_from, ' to ', p_status, '.'));
  END IF;

  UPDATE appointments
  SET status = p_status, cancel_reason = IF(p_status = 'cancelled', NULLIF(TRIM(p_note), ''), cancel_reason)
  WHERE id = p_appointment_id;
  INSERT INTO appointment_events (appointment_id, from_status, to_status, actor_id, note)
  VALUES (p_appointment_id, v_from, p_status, v_uid, NULLIF(TRIM(p_note), ''));

  IF p_status IN ('confirmed', 'cancelled') THEN
    CALL notify(v_patient, CONCAT('appointment_', p_status),
      IF(p_status = 'confirmed', 'Appointment confirmed', 'Appointment cancelled'),
      CONCAT('Your appointment ', v_ref, ' on ', format_local(v_starts), ' is now ', p_status, '.'),
      CONCAT('/patient/appointments/', p_appointment_id), TRUE);
  END IF;
  SELECT * FROM appointments WHERE id = p_appointment_id;
END$$

CREATE PROCEDURE save_consultation_notes(p_appointment_id CHAR(36), p_notes TEXT)
MODIFIES SQL DATA
BEGIN
  DECLARE v_uid CHAR(36) DEFAULT require_user();
  DECLARE v_patient CHAR(36);
  DECLARE v_doctor CHAR(36) DEFAULT NULL;
  DECLARE v_status VARCHAR(20);

  SELECT patient_id, doctor_id, status INTO v_patient, v_doctor, v_status FROM appointments WHERE id = p_appointment_id;
  IF v_doctor IS NULL OR NOT (v_doctor <=> my_doctor_id()) THEN
    CALL deny('Only the treating doctor can record consultation notes.');
  END IF;
  IF v_status NOT IN ('confirmed', 'completed') THEN
    CALL fail('Notes can be recorded for confirmed or completed appointments only.');
  END IF;
  INSERT INTO consultations (appointment_id, patient_id, doctor_id, notes, created_by)
  VALUES (p_appointment_id, v_patient, v_doctor, COALESCE(p_notes, ''), v_uid) AS new
  ON DUPLICATE KEY UPDATE notes = new.notes;
  SELECT * FROM consultations WHERE appointment_id = p_appointment_id;
END$$

-- ═════════════════════════════ Prescriptions ═════════════════════════════
CREATE PROCEDURE write_prescription_items(p_prescription_id CHAR(36), p_items JSON)
MODIFIES SQL DATA
BEGIN
  IF p_items IS NULL OR JSON_TYPE(p_items) <> 'ARRAY' OR JSON_LENGTH(p_items) = 0 THEN
    CALL fail('Add at least one medication.');
  END IF;
  IF JSON_LENGTH(p_items) > 20 THEN CALL fail('A prescription can contain at most 20 items.'); END IF;
  IF EXISTS (
    SELECT 1 FROM JSON_TABLE(p_items, '$[*]' COLUMNS (
      medication_name TEXT PATH '$.medication_name', dosage TEXT PATH '$.dosage',
      frequency TEXT PATH '$.frequency', duration TEXT PATH '$.duration', instructions TEXT PATH '$.instructions')) j
    WHERE CHAR_LENGTH(TRIM(COALESCE(j.medication_name, ''))) NOT BETWEEN 1 AND 160
       OR CHAR_LENGTH(TRIM(COALESCE(j.dosage, ''))) NOT BETWEEN 1 AND 80
       OR CHAR_LENGTH(TRIM(COALESCE(j.frequency, ''))) NOT BETWEEN 1 AND 80
       OR CHAR_LENGTH(TRIM(COALESCE(j.duration, ''))) NOT BETWEEN 1 AND 80
       OR CHAR_LENGTH(COALESCE(j.instructions, '')) > 500
  ) THEN
    CALL fail('Each medication needs a name, dosage, frequency and duration.');
  END IF;

  DELETE FROM prescription_items WHERE prescription_id = p_prescription_id;
  INSERT INTO prescription_items (
    prescription_id, medicine_id, medication_name, dosage, frequency, duration, instructions, quantity, position
  )
  SELECT p_prescription_id, m.id, TRIM(j.medication_name), TRIM(j.dosage), TRIM(j.frequency), TRIM(j.duration),
         NULLIF(TRIM(j.instructions), ''),
         IF(REGEXP_LIKE(COALESCE(j.quantity, ''), '^[0-9]{1,4}$'), CAST(j.quantity AS UNSIGNED), NULL),
         j.pos - 1
  FROM JSON_TABLE(p_items, '$[*]' COLUMNS (
    pos FOR ORDINALITY,
    medicine_id VARCHAR(64) PATH '$.medicine_id',
    medication_name TEXT PATH '$.medication_name', dosage TEXT PATH '$.dosage',
    frequency TEXT PATH '$.frequency', duration TEXT PATH '$.duration',
    instructions TEXT PATH '$.instructions', quantity VARCHAR(20) PATH '$.quantity')) j
  LEFT JOIN medicines m ON m.id = j.medicine_id;
END$$

-- Creates a new prescription, or updates one of the caller's drafts (p_id). p_issue finalises it.
CREATE PROCEDURE save_prescription(
  p_id CHAR(36), p_patient_id CHAR(36), p_appointment_id CHAR(36), p_notes TEXT, p_items JSON, p_issue BOOLEAN
)
MODIFIES SQL DATA
BEGIN
  DECLARE v_uid CHAR(36) DEFAULT require_user();
  DECLARE v_doctor CHAR(36) DEFAULT my_doctor_id();
  DECLARE v_rx CHAR(36) DEFAULT p_id;
  DECLARE v_status VARCHAR(20) DEFAULT NULL;
  DECLARE v_ref VARCHAR(20);

  IF v_doctor IS NULL THEN CALL deny('Only approved doctors can write prescriptions.'); END IF;
  IF NOT doctor_can_access_patient(p_patient_id) THEN CALL deny('This patient is not under your care.'); END IF;
  IF p_appointment_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM appointments WHERE id = p_appointment_id AND patient_id = p_patient_id AND doctor_id = v_doctor
  ) THEN
    CALL fail('The selected consultation does not belong to this patient.');
  END IF;
  IF CHAR_LENGTH(p_notes) > 2000 THEN CALL fail('Please keep the notes under 2000 characters.'); END IF;

  IF p_id IS NULL THEN
    SET v_rx = UUID();
    INSERT INTO prescriptions (id, reference, patient_id, doctor_id, appointment_id, consultation_id, notes, created_by)
    VALUES (v_rx, make_reference('RX'), p_patient_id, v_doctor, p_appointment_id,
            (SELECT c.id FROM consultations c WHERE c.appointment_id = p_appointment_id),
            NULLIF(TRIM(p_notes), ''), v_uid);
  ELSE
    SELECT status INTO v_status FROM prescriptions WHERE id = p_id AND doctor_id = v_doctor FOR UPDATE;
    IF v_status IS NULL THEN CALL not_found('Prescription not found.'); END IF;
    IF v_status <> 'draft' THEN CALL fail('Issued prescriptions can only be changed through an amendment.'); END IF;
    UPDATE prescriptions SET notes = NULLIF(TRIM(p_notes), ''), appointment_id = p_appointment_id WHERE id = p_id;
  END IF;

  CALL write_prescription_items(v_rx, p_items);

  IF p_issue THEN
    UPDATE prescriptions SET status = 'issued', issued_at = UTC_TIMESTAMP(3) WHERE id = v_rx;
    SELECT reference INTO v_ref FROM prescriptions WHERE id = v_rx;
    CALL notify(p_patient_id, 'prescription_issued', 'New prescription available',
      CONCAT('A prescription (', v_ref, ') has been issued to your account.'), CONCAT('/patient/prescriptions/', v_rx), TRUE);
  END IF;
  SELECT * FROM prescriptions WHERE id = v_rx;
END$$

CREATE PROCEDURE amend_prescription(p_id CHAR(36), p_reason TEXT, p_notes TEXT, p_items JSON)
MODIFIES SQL DATA
BEGIN
  DECLARE v_uid CHAR(36) DEFAULT require_user();
  DECLARE v_status VARCHAR(20) DEFAULT NULL;
  DECLARE v_patient CHAR(36);
  DECLARE v_doctor CHAR(36);
  DECLARE v_appt CHAR(36);
  DECLARE v_consult CHAR(36);
  DECLARE v_version INT;
  DECLARE v_ref VARCHAR(20);
  DECLARE v_new CHAR(36) DEFAULT UUID();

  IF CHAR_LENGTH(TRIM(COALESCE(p_reason, ''))) < 5 THEN CALL fail('Please record a reason for the amendment.'); END IF;
  SELECT status, patient_id, doctor_id, appointment_id, consultation_id, version, reference
    INTO v_status, v_patient, v_doctor, v_appt, v_consult, v_version, v_ref
  FROM prescriptions WHERE id = p_id AND doctor_id <=> my_doctor_id() FOR UPDATE;
  IF v_status IS NULL THEN CALL deny('Only the prescribing doctor can amend this prescription.'); END IF;
  IF v_status <> 'issued' THEN CALL fail('Only issued prescriptions can be amended.'); END IF;

  UPDATE prescriptions SET status = 'superseded' WHERE id = p_id;
  INSERT INTO prescriptions (
    id, reference, patient_id, doctor_id, appointment_id, consultation_id, status, notes, version, supersedes_id,
    amendment_reason, issued_at, created_by
  ) VALUES (
    v_new, make_reference('RX'), v_patient, v_doctor, v_appt, v_consult, 'issued', NULLIF(TRIM(p_notes), ''),
    v_version + 1, p_id, TRIM(p_reason), UTC_TIMESTAMP(3), v_uid
  );
  CALL write_prescription_items(v_new, p_items);
  CALL notify(v_patient, 'prescription_amended', 'Prescription updated',
    CONCAT('Prescription ', v_ref, ' has been amended by your doctor.'), CONCAT('/patient/prescriptions/', v_new), TRUE);
  SELECT * FROM prescriptions WHERE id = v_new;
END$$

CREATE PROCEDURE cancel_prescription(p_id CHAR(36), p_reason TEXT)
MODIFIES SQL DATA
BEGIN
  DECLARE v_uid CHAR(36) DEFAULT require_user();
  DECLARE v_status VARCHAR(20) DEFAULT NULL;
  SELECT status INTO v_status FROM prescriptions WHERE id = p_id AND doctor_id <=> my_doctor_id() FOR UPDATE;
  IF v_status IS NULL THEN CALL deny('Only the prescribing doctor can cancel this prescription.'); END IF;
  IF v_status NOT IN ('draft', 'issued') THEN CALL fail('This prescription can no longer be cancelled.'); END IF;
  UPDATE prescriptions SET status = 'cancelled', amendment_reason = NULLIF(TRIM(p_reason), '') WHERE id = p_id;
  SELECT * FROM prescriptions WHERE id = p_id;
END$$

-- ═════════════════════════════ Lab reports ═════════════════════════════
CREATE FUNCTION lab_transition_allowed(p_from VARCHAR(20), p_to VARCHAR(20)) RETURNS BOOLEAN
DETERMINISTIC NO SQL
BEGIN
  RETURN CASE p_from
    WHEN 'ordered' THEN p_to IN ('ordered', 'collected', 'in_progress', 'final', 'cancelled')
    WHEN 'collected' THEN p_to IN ('collected', 'in_progress', 'final', 'cancelled')
    WHEN 'in_progress' THEN p_to IN ('in_progress', 'final', 'cancelled')
    WHEN 'final' THEN p_to = 'amended'
    WHEN 'amended' THEN p_to = 'amended'
    ELSE FALSE END;
END$$

CREATE PROCEDURE save_lab_report(p_report JSON)
MODIFIES SQL DATA
BEGIN
  DECLARE v_uid CHAR(36) DEFAULT require_user();
  DECLARE v_id CHAR(36) DEFAULT jtext(p_report, 'id');
  DECLARE v_patient CHAR(36) DEFAULT jtext(p_report, 'patient_id');
  DECLARE v_status VARCHAR(20) DEFAULT COALESCE(jtext(p_report, 'status'), 'ordered');
  DECLARE v_doctor CHAR(36) DEFAULT my_doctor_id();
  DECLARE v_prev VARCHAR(20) DEFAULT NULL;
  DECLARE v_test TEXT DEFAULT jtext(p_report, 'test_name');
  DECLARE v_summary TEXT DEFAULT NULLIF(jtext(p_report, 'summary'), '');
  DECLARE v_ref VARCHAR(20);

  IF v_status NOT IN ('ordered', 'collected', 'in_progress', 'final', 'amended', 'cancelled') THEN CALL fail('Invalid status.'); END IF;
  IF v_id IS NOT NULL THEN
    SELECT patient_id, status INTO v_patient, v_prev FROM lab_reports WHERE id = v_id FOR UPDATE;
    IF v_prev IS NULL THEN CALL not_found('Report not found.'); END IF;
  END IF;
  IF v_patient IS NULL OR NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_patient) THEN CALL fail('Select a patient.'); END IF;
  IF NOT (doctor_can_access_patient(v_patient) OR has_permission('lab_records')) THEN
    CALL deny('You are not authorised to manage this patient''s lab records.');
  END IF;
  IF CHAR_LENGTH(COALESCE(v_test, '')) < 2 THEN CALL fail('Enter the test name.'); END IF;
  IF CHAR_LENGTH(v_test) > 160 OR CHAR_LENGTH(v_summary) > 2000 THEN CALL fail('Some details are too long.'); END IF;
  IF v_prev IS NOT NULL AND NOT lab_transition_allowed(v_prev, v_status) THEN
    CALL fail(CONCAT('A report cannot move from ', v_prev, ' to ', v_status, '. Final reports must be amended.'));
  END IF;

  IF v_id IS NULL THEN
    SET v_id = UUID();
    INSERT INTO lab_reports (
      id, reference, patient_id, doctor_id, department_id, appointment_id, test_name, laboratory, collected_at,
      resulted_at, status, summary, created_by
    ) VALUES (
      v_id, make_reference('LAB'), v_patient, v_doctor,
      (SELECT department_id FROM doctors WHERE id = v_doctor),
      (SELECT a.id FROM appointments a WHERE a.id = jtext(p_report, 'appointment_id') AND a.patient_id = v_patient),
      v_test,
      COALESCE(NULLIF(jtext(p_report, 'laboratory'), ''), 'A10 Diagnostics Laboratory'),
      jtime(p_report, 'collected_at'),
      IF(v_status IN ('final', 'amended'), COALESCE(jtime(p_report, 'resulted_at'), UTC_TIMESTAMP(3)), jtime(p_report, 'resulted_at')),
      v_status, v_summary, v_uid
    );
  ELSE
    UPDATE lab_reports SET
      test_name = v_test,
      laboratory = COALESCE(NULLIF(jtext(p_report, 'laboratory'), ''), laboratory),
      collected_at = jtime(p_report, 'collected_at'),
      resulted_at = IF(v_status IN ('final', 'amended'), COALESCE(jtime(p_report, 'resulted_at'), resulted_at, UTC_TIMESTAMP(3)),
                       jtime(p_report, 'resulted_at')),
      status = v_status,
      summary = v_summary
    WHERE id = v_id;
  END IF;

  IF JSON_TYPE(JSON_EXTRACT(p_report, '$.results')) = 'ARRAY' THEN
    DELETE FROM lab_results WHERE report_id = v_id;
    INSERT INTO lab_results (report_id, analyte, value, unit, reference_range, position)
    SELECT v_id, TRIM(j.analyte), COALESCE(TRIM(j.value), ''), NULLIF(TRIM(j.unit), ''), NULLIF(TRIM(j.reference_range), ''),
           ROW_NUMBER() OVER (ORDER BY j.pos) - 1
    FROM JSON_TABLE(JSON_EXTRACT(p_report, '$.results'), '$[*]' COLUMNS (
      pos FOR ORDINALITY, analyte VARCHAR(160) PATH '$.analyte', value VARCHAR(160) PATH '$.value',
      unit VARCHAR(40) PATH '$.unit', reference_range VARCHAR(160) PATH '$.reference_range')) j
    WHERE CHAR_LENGTH(TRIM(COALESCE(j.analyte, ''))) > 0;
  END IF;

  IF v_status IN ('final', 'amended') AND NOT (v_prev <=> v_status) THEN
    SELECT reference INTO v_ref FROM lab_reports WHERE id = v_id;
    CALL notify(v_patient, CONCAT('lab_report_', v_status),
      IF(v_status = 'final', 'Lab report available', 'Lab report updated'),
      CONCAT('A laboratory report (', v_ref, ') is available in your patient portal.'), CONCAT('/patient/lab-reports/', v_id), TRUE);
  END IF;
  SELECT * FROM lab_reports WHERE id = v_id;
END$$

CREATE PROCEDURE set_lab_report_document(p_report_id CHAR(36), p_path VARCHAR(400))
MODIFIES SQL DATA
BEGIN
  DECLARE v_uid CHAR(36) DEFAULT require_user();
  DECLARE v_patient CHAR(36) DEFAULT NULL;
  SELECT patient_id INTO v_patient FROM lab_reports WHERE id = p_report_id FOR UPDATE;
  IF v_patient IS NULL THEN CALL not_found('Report not found.'); END IF;
  IF NOT (doctor_can_access_patient(v_patient) OR has_permission('lab_records')) THEN
    CALL deny('You are not authorised to manage this report.');
  END IF;
  IF p_path IS NOT NULL AND LEFT(p_path, 74) <> CONCAT(v_patient, '/', p_report_id, '/') THEN
    CALL fail('Invalid document location.');
  END IF;
  UPDATE lab_reports SET document_path = p_path WHERE id = p_report_id;
  SELECT * FROM lab_reports WHERE id = p_report_id;
END$$

-- ═════════════════════════════ Patient records (clinical access) ═════════════════════════════
CREATE PROCEDURE search_patients(p_query TEXT, p_limit INT)
READS SQL DATA
BEGIN
  DECLARE v_doctor CHAR(36) DEFAULT my_doctor_id();
  DECLARE v_staff BOOLEAN DEFAULT has_permission('patient_admin') OR has_permission('lab_records');
  DECLARE v_q VARCHAR(100) DEFAULT LEFT(TRIM(COALESCE(p_query, '')), 100);
  DECLARE v_limit INT DEFAULT LEAST(GREATEST(COALESCE(p_limit, 25), 1), 50);

  SELECT p.id, p.full_name, p.email, p.phone, p.date_of_birth,
         MAX(a.starts_at) AS last_appointment_at, COUNT(a.id) AS appointment_count
  FROM profiles p
  LEFT JOIN appointments a ON a.patient_id = p.id AND a.status <> 'cancelled'
       AND (v_doctor IS NULL OR a.doctor_id = v_doctor)
  WHERE EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = p.id AND r.role = 'patient')
    AND (
      (v_doctor IS NOT NULL AND EXISTS (
        SELECT 1 FROM appointments x WHERE x.patient_id = p.id AND x.doctor_id = v_doctor AND x.status <> 'cancelled'))
      OR (v_staff AND CHAR_LENGTH(v_q) >= 2)
    )
    -- LOCATE() is a plain substring test (case-insensitive under this collation), so the
    -- search term needs no LIKE-wildcard escaping.
    AND (v_q = '' OR LOCATE(v_q, p.full_name) > 0 OR LOCATE(v_q, p.email) > 0 OR LOCATE(v_q, COALESCE(p.phone, '')) > 0)
  GROUP BY p.id
  ORDER BY MAX(a.starts_at) IS NULL, MAX(a.starts_at) DESC, p.full_name
  LIMIT v_limit;
END$$

CREATE PROCEDURE get_patient_chart(p_patient_id CHAR(36))
MODIFIES SQL DATA
BEGIN
  DECLARE v_uid CHAR(36) DEFAULT require_user();
  DECLARE v_doctor CHAR(36) DEFAULT my_doctor_id();
  DECLARE v_clinical BOOLEAN DEFAULT doctor_can_access_patient(p_patient_id);
  DECLARE v_admin_view BOOLEAN DEFAULT has_permission('patient_admin');
  DECLARE v_lab_view BOOLEAN DEFAULT has_permission('lab_records');
  DECLARE v_scope VARCHAR(20);

  IF NOT (v_clinical OR v_admin_view OR v_lab_view) THEN
    CALL deny('You are not authorised to view this patient record.');
  END IF;
  SET v_scope = CASE WHEN v_clinical THEN 'clinical' WHEN v_admin_view THEN 'administrative' ELSE 'laboratory' END;
  CALL write_audit('view_patient_chart', 'profiles', p_patient_id, JSON_OBJECT('scope', v_scope));

  SELECT JSON_OBJECT(
    'scope', v_scope,
    'profile', (SELECT JSON_OBJECT('id', p.id, 'full_name', p.full_name, 'email', p.email, 'phone', p.phone,
        'date_of_birth', p.date_of_birth, 'blood_group', p.blood_group, 'address', IF(v_scope <> 'laboratory', p.address, NULL),
        'emergency_contact_name', p.emergency_contact_name, 'emergency_contact_phone', p.emergency_contact_phone,
        'is_sample', p.is_sample IS TRUE)
      FROM profiles p WHERE p.id = p_patient_id),
    'appointments', IF(v_scope IN ('clinical', 'administrative'), COALESCE((
      SELECT CAST(CONCAT('[', GROUP_CONCAT(JSON_OBJECT('id', a.id, 'reference', a.reference, 'starts_at', a.starts_at, 'status', a.status,
               'reason', IF(v_clinical, a.reason, NULL), 'doctor_name', d.full_name, 'department_name', dp.name)
             ORDER BY a.starts_at DESC), ']') AS JSON)
      FROM appointments a JOIN doctors d ON d.id = a.doctor_id JOIN departments dp ON dp.id = a.department_id
      WHERE a.patient_id = p_patient_id AND (v_admin_view OR a.doctor_id = v_doctor)), JSON_ARRAY()), JSON_ARRAY()),
    'consultations', IF(v_clinical, COALESCE((
      SELECT CAST(CONCAT('[', GROUP_CONCAT(JSON_OBJECT('id', c.id, 'appointment_id', c.appointment_id, 'notes', c.notes, 'updated_at', c.updated_at)
             ORDER BY c.updated_at DESC), ']') AS JSON)
      FROM consultations c WHERE c.patient_id = p_patient_id AND c.doctor_id = v_doctor), JSON_ARRAY()), JSON_ARRAY()),
    'prescriptions', IF(v_clinical, COALESCE((
      SELECT CAST(CONCAT('[', GROUP_CONCAT(JSON_OBJECT('id', r.id, 'reference', r.reference, 'status', r.status, 'issued_at', r.issued_at,
               'created_at', r.created_at, 'doctor_name', d.full_name, 'version', r.version,
               'items', COALESCE((SELECT CAST(CONCAT('[', GROUP_CONCAT(JSON_QUOTE(i.medication_name) ORDER BY i.position), ']') AS JSON)
                                  FROM prescription_items i WHERE i.prescription_id = r.id), JSON_ARRAY()))
             ORDER BY r.created_at DESC), ']') AS JSON)
      FROM prescriptions r JOIN doctors d ON d.id = r.doctor_id
      WHERE r.patient_id = p_patient_id AND (r.status <> 'draft' OR r.doctor_id = v_doctor)), JSON_ARRAY()), JSON_ARRAY()),
    'lab_reports', IF(v_clinical OR v_lab_view, COALESCE((
      SELECT CAST(CONCAT('[', GROUP_CONCAT(JSON_OBJECT('id', l.id, 'reference', l.reference, 'test_name', l.test_name, 'status', l.status,
               'resulted_at', l.resulted_at, 'collected_at', l.collected_at, 'is_sample', l.is_sample IS TRUE) ORDER BY l.created_at DESC), ']') AS JSON)
      FROM lab_reports l WHERE l.patient_id = p_patient_id), JSON_ARRAY()), JSON_ARRAY()),
    'observations', IF(v_clinical, COALESCE((
      SELECT CAST(CONCAT('[', GROUP_CONCAT(JSON_OBJECT('id', o.id, 'observed_at', o.observed_at, 'observation_type', o.observation_type,
               'value', o.value, 'unit', o.unit, 'context', o.context) ORDER BY o.observed_at DESC), ']') AS JSON)
      FROM observation_records o WHERE o.patient_id = p_patient_id), JSON_ARRAY()), JSON_ARRAY())
  ) AS result;
END$$

CREATE PROCEDURE save_observation(p_id CHAR(36), p_values JSON)
MODIFIES SQL DATA
BEGIN
  DECLARE v_uid CHAR(36) DEFAULT require_user();
  DECLARE v_patient CHAR(36);
  DECLARE v_observer CHAR(36);
  DECLARE v_id CHAR(36) DEFAULT p_id;
  DECLARE v_type TEXT DEFAULT jtext(p_values, 'observation_type');
  DECLARE v_value TEXT DEFAULT jtext(p_values, 'value');

  IF p_id IS NULL THEN
    SET v_patient = jtext(p_values, 'patient_id');
    IF NOT (jtext(p_values, 'observer_id') <=> v_uid) OR NOT doctor_can_access_patient(v_patient) THEN
      CALL deny('You can only record observations for patients in your care.');
    END IF;
  ELSE
    SELECT patient_id, observer_id INTO v_patient, v_observer FROM observation_records WHERE id = p_id FOR UPDATE;
    IF NOT (v_observer <=> v_uid) OR NOT doctor_can_access_patient(v_patient) THEN
      CALL deny('You can only change observations you recorded.');
    END IF;
    IF (jhas(p_values, 'patient_id') AND NOT (jtext(p_values, 'patient_id') <=> v_patient))
       OR (jhas(p_values, 'observer_id') AND NOT (jtext(p_values, 'observer_id') <=> v_observer)) THEN
      CALL deny('Observation ownership cannot be changed.');
    END IF;
  END IF;
  IF p_id IS NULL OR jhas(p_values, 'observation_type') OR jhas(p_values, 'value') THEN
    IF CHAR_LENGTH(COALESCE(v_type, '')) NOT BETWEEN 2 AND 80 OR CHAR_LENGTH(COALESCE(v_value, '')) NOT BETWEEN 1 AND 500 THEN
      CALL fail('Enter the observation type and value.');
    END IF;
  END IF;

  IF p_id IS NULL THEN
    SET v_id = UUID();
    INSERT INTO observation_records (id, patient_id, appointment_id, observed_at, observer_id, observation_type, value, unit, context)
    VALUES (v_id, v_patient,
            (SELECT a.id FROM appointments a WHERE a.id = jtext(p_values, 'appointment_id') AND a.patient_id = v_patient),
            COALESCE(jtime(p_values, 'observed_at'), UTC_TIMESTAMP(3)), v_uid, v_type, v_value,
            LEFT(NULLIF(jtext(p_values, 'unit'), ''), 40), LEFT(NULLIF(jtext(p_values, 'context'), ''), 1000));
  ELSE
    UPDATE observation_records SET
      observation_type = IF(jhas(p_values, 'observation_type'), v_type, observation_type),
      value = IF(jhas(p_values, 'value'), v_value, value),
      unit = IF(jhas(p_values, 'unit'), LEFT(NULLIF(jtext(p_values, 'unit'), ''), 40), unit),
      context = IF(jhas(p_values, 'context'), LEFT(NULLIF(jtext(p_values, 'context'), ''), 1000), context),
      observed_at = IF(jhas(p_values, 'observed_at'), COALESCE(jtime(p_values, 'observed_at'), observed_at), observed_at)
    WHERE id = p_id;
  END IF;
  SELECT * FROM observation_records WHERE id = v_id;
END$$

-- ═════════════════════════════ Pharmacy ═════════════════════════════
CREATE FUNCTION order_transition_allowed(p_from VARCHAR(20), p_to VARCHAR(20)) RETURNS BOOLEAN
DETERMINISTIC NO SQL
BEGIN
  RETURN CASE p_from
    WHEN 'placed' THEN p_to IN ('processing', 'cancelled')
    WHEN 'pending_review' THEN p_to IN ('approved', 'rejected', 'cancelled')
    WHEN 'approved' THEN p_to IN ('processing', 'cancelled')
    WHEN 'processing' THEN p_to IN ('dispatched', 'cancelled')
    WHEN 'dispatched' THEN p_to = 'delivered'
    ELSE FALSE END;
END$$

CREATE PROCEDURE place_order(
  p_items JSON, p_delivery_address TEXT, p_contact_phone TEXT, p_notes TEXT, p_prescription_id CHAR(36)
)
MODIFIES SQL DATA
BEGIN
  DECLARE v_uid CHAR(36) DEFAULT require_user();
  DECLARE v_id CHAR(36) DEFAULT UUID();
  DECLARE v_ref VARCHAR(20) DEFAULT make_reference('ORD');
  DECLARE v_subtotal DECIMAL(10,2);
  DECLARE v_fee DECIMAL(10,2);
  DECLARE v_needs_rx BOOLEAN;
  DECLARE v_bad_name VARCHAR(200) DEFAULT NULL;
  DECLARE v_bad_stock INT;
  DECLARE v_lines INT;
  DECLARE v_found INT;
  DECLARE v_status VARCHAR(20);
  DECLARE v_free_over DECIMAL(10,2) DEFAULT COALESCE(CAST(setting_text('pharmacy_free_delivery_over') AS DECIMAL(10,2)), 999);

  IF NOT has_role('patient') THEN CALL deny('Only patient accounts can order medication.'); END IF;
  IF p_items IS NULL OR JSON_TYPE(p_items) <> 'ARRAY' OR JSON_LENGTH(p_items) = 0 THEN CALL fail('Your cart is empty.'); END IF;
  IF JSON_LENGTH(p_items) > 20 THEN CALL fail('Please order at most 20 different items at once.'); END IF;
  IF CHAR_LENGTH(TRIM(COALESCE(p_delivery_address, ''))) NOT BETWEEN 5 AND 400 THEN CALL fail('Enter a delivery address.'); END IF;
  IF NOT REGEXP_LIKE(TRIM(COALESCE(p_contact_phone, '')), '^[0-9+() -]{6,20}$') THEN CALL fail('Please provide a valid phone number.'); END IF;
  IF CHAR_LENGTH(p_notes) > 500 THEN CALL fail('Please keep the notes under 500 characters.'); END IF;

  DROP TEMPORARY TABLE IF EXISTS cart_lines;
  CREATE TEMPORARY TABLE cart_lines (medicine_id CHAR(36), quantity INT);
  INSERT INTO cart_lines
  SELECT j.medicine_id, SUM(j.quantity)
  FROM JSON_TABLE(p_items, '$[*]' COLUMNS (medicine_id VARCHAR(64) PATH '$.medicine_id', quantity INT PATH '$.quantity' NULL ON ERROR)) j
  GROUP BY j.medicine_id;
  IF EXISTS (SELECT 1 FROM cart_lines WHERE medicine_id IS NULL OR quantity IS NULL OR quantity < 1 OR quantity > 20) THEN
    CALL fail('Each item quantity must be between 1 and 20.');
  END IF;
  -- (A TEMPORARY table may appear only once per statement in MySQL, hence two counts.)
  SELECT COUNT(*) INTO v_lines FROM cart_lines;
  -- Locks the stock rows (in primary-key order) until the transaction ends.
  SELECT COUNT(*) INTO v_found FROM medicines m JOIN cart_lines c ON c.medicine_id = m.id FOR UPDATE;
  IF v_found <> v_lines THEN CALL fail('One or more items could not be found.'); END IF;
  SELECT m.name INTO v_bad_name FROM medicines m JOIN cart_lines c ON c.medicine_id = m.id WHERE NOT m.is_active LIMIT 1;
  IF v_bad_name IS NOT NULL THEN CALL fail(CONCAT(v_bad_name, ' is no longer available.')); END IF;
  SELECT m.name, m.stock INTO v_bad_name, v_bad_stock FROM medicines m JOIN cart_lines c ON c.medicine_id = m.id WHERE m.stock < c.quantity LIMIT 1;
  IF v_bad_name IS NOT NULL THEN CALL fail(CONCAT('Only ', v_bad_stock, ' of ', v_bad_name, ' left in stock.')); END IF;

  SELECT SUM(m.price * c.quantity), MAX(m.requires_prescription) INTO v_subtotal, v_needs_rx
  FROM medicines m JOIN cart_lines c ON c.medicine_id = m.id;

  IF v_needs_rx AND (p_prescription_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM prescriptions WHERE id = p_prescription_id AND patient_id = v_uid AND status = 'issued'
  )) THEN
    CALL fail('Prescription-only items need a current prescription from your account.');
  END IF;

  SET v_fee = IF(v_subtotal >= v_free_over, 0, COALESCE(CAST(setting_text('pharmacy_delivery_fee') AS DECIMAL(10,2)), 49));
  SET v_status = IF(v_needs_rx, 'pending_review', 'placed');
  INSERT INTO medication_orders (
    id, reference, patient_id, prescription_id, status, subtotal, delivery_fee, total, payment_method,
    delivery_address, contact_phone, notes
  ) VALUES (
    v_id, v_ref, v_uid, IF(v_needs_rx, p_prescription_id, NULL), v_status, v_subtotal, v_fee, v_subtotal + v_fee,
    'cash_on_delivery', TRIM(p_delivery_address), TRIM(p_contact_phone), NULLIF(TRIM(p_notes), '')
  );
  INSERT INTO medication_order_items (order_id, medicine_id, name, unit_price, quantity, line_total, requires_prescription)
  SELECT v_id, m.id, CONCAT(m.name, COALESCE(CONCAT(' ', m.strength), '')), m.price, c.quantity, m.price * c.quantity, m.requires_prescription
  FROM cart_lines c JOIN medicines m ON m.id = c.medicine_id;

  -- medicines_stock_movement (03_triggers.sql) records an inventory movement per row.
  SET @stock_movement_reason = 'Reserved for order', @stock_movement_order = v_id;
  UPDATE medicines m JOIN cart_lines c ON c.medicine_id = m.id SET m.stock = m.stock - c.quantity;
  SET @stock_movement_reason = NULL, @stock_movement_order = NULL;
  DROP TEMPORARY TABLE IF EXISTS cart_lines;

  INSERT INTO order_events (order_id, from_status, to_status, actor_id) VALUES (v_id, NULL, v_status, v_uid);
  CALL notify(v_uid, 'order_placed', 'Order received',
    CONCAT('We have received your medication order ', v_ref, '.'), CONCAT('/patient/orders/', v_id), TRUE);
  SELECT * FROM medication_orders WHERE id = v_id;
END$$

CREATE PROCEDURE update_order_status(p_order_id CHAR(36), p_status VARCHAR(20), p_note TEXT)
MODIFIES SQL DATA
BEGIN
  DECLARE v_uid CHAR(36) DEFAULT require_user();
  DECLARE v_staff BOOLEAN DEFAULT has_permission('pharmacy') OR is_admin();
  DECLARE v_from VARCHAR(20) DEFAULT NULL;
  DECLARE v_patient CHAR(36);
  DECLARE v_ref VARCHAR(20);

  SELECT status, patient_id, reference INTO v_from, v_patient, v_ref FROM medication_orders WHERE id = p_order_id FOR UPDATE;
  IF v_from IS NULL THEN CALL not_found('Order not found.'); END IF;

  IF v_patient = v_uid AND NOT v_staff THEN
    IF p_status <> 'cancelled' OR v_from NOT IN ('placed', 'pending_review', 'approved') THEN
      CALL fail('This order can no longer be cancelled online.');
    END IF;
  ELSEIF NOT v_staff THEN
    CALL deny('You do not have permission to update this order.');
  ELSEIF NOT order_transition_allowed(v_from, p_status) THEN
    CALL fail(CONCAT('An order cannot move from ', v_from, ' to ', p_status, '.'));
  END IF;
  IF p_status = 'rejected' AND CHAR_LENGTH(TRIM(COALESCE(p_note, ''))) < 3 THEN
    CALL fail('Please record why the order was rejected.');
  END IF;

  IF p_status IN ('cancelled', 'rejected') THEN
    SET @stock_movement_reason = CONCAT('Released from ', p_status, ' order'), @stock_movement_order = p_order_id;
    UPDATE medicines m JOIN medication_order_items i ON i.medicine_id = m.id AND i.order_id = p_order_id
    SET m.stock = m.stock + i.quantity;
    SET @stock_movement_reason = NULL, @stock_movement_order = NULL;
  END IF;

  UPDATE medication_orders SET status = p_status,
    review_note = IF(v_staff, COALESCE(NULLIF(TRIM(p_note), ''), review_note), review_note),
    reviewer_id = IF(v_staff, v_uid, reviewer_id)
  WHERE id = p_order_id;
  INSERT INTO order_events (order_id, from_status, to_status, actor_id, note)
  VALUES (p_order_id, v_from, p_status, v_uid, NULLIF(TRIM(p_note), ''));
  CALL notify(v_patient, CONCAT('order_', p_status), 'Order update',
    CONCAT('Your medication order ', v_ref, ' is now ', REPLACE(p_status, '_', ' '), '.'), CONCAT('/patient/orders/', p_order_id), TRUE);
  SELECT * FROM medication_orders WHERE id = p_order_id;
END$$

CREATE PROCEDURE adjust_stock(p_medicine_id CHAR(36), p_change INT, p_reason TEXT)
MODIFIES SQL DATA
BEGIN
  DECLARE v_uid CHAR(36) DEFAULT require_user();
  DECLARE v_stock INT DEFAULT NULL;
  IF NOT (has_permission('pharmacy') OR is_admin()) THEN CALL deny('You do not have permission to adjust stock.'); END IF;
  IF COALESCE(p_change, 0) = 0 OR CHAR_LENGTH(TRIM(COALESCE(p_reason, ''))) < 3 THEN CALL fail('Enter a quantity and a reason.'); END IF;
  SELECT stock INTO v_stock FROM medicines WHERE id = p_medicine_id FOR UPDATE;
  IF v_stock IS NULL THEN CALL fail('Medicine not found.'); END IF;
  IF v_stock + p_change < 0 THEN CALL fail('Stock cannot go below zero.'); END IF;
  SET @stock_movement_reason = LEFT(TRIM(p_reason), 255), @stock_movement_order = NULL;
  UPDATE medicines SET stock = stock + p_change WHERE id = p_medicine_id;
  SET @stock_movement_reason = NULL;
  SELECT * FROM medicines WHERE id = p_medicine_id;
END$$

-- Catalogue create/update. Stock is set once on creation; afterwards only adjust_stock and
-- orders change it.
CREATE PROCEDURE save_medicine(p_id CHAR(36), p_values JSON)
MODIFIES SQL DATA
BEGIN
  DECLARE v_uid CHAR(36) DEFAULT require_user();
  DECLARE v_id CHAR(36) DEFAULT COALESCE(p_id, UUID());
  DECLARE v_stock INT DEFAULT COALESCE(CAST(jtext(p_values, 'stock') AS SIGNED), 0);
  IF NOT (has_permission('pharmacy') OR is_admin()) THEN CALL deny('You do not have permission to manage medicines.'); END IF;
  IF p_id IS NOT NULL AND jhas(p_values, 'stock') THEN
    CALL deny('Stock changes must go through a recorded inventory adjustment.');
  END IF;
  IF p_id IS NULL THEN
    IF v_stock < 0 THEN CALL fail('Stock cannot go below zero.'); END IF;
    INSERT INTO medicines (id, slug, name, generic_name, category, form, strength, pack_size, description, price,
                           requires_prescription, is_active, stock)
    VALUES (v_id, jtext(p_values, 'slug'), jtext(p_values, 'name'), NULLIF(jtext(p_values, 'generic_name'), ''),
            jtext(p_values, 'category'), COALESCE(NULLIF(jtext(p_values, 'form'), ''), 'Tablet'),
            NULLIF(jtext(p_values, 'strength'), ''), NULLIF(jtext(p_values, 'pack_size'), ''),
            COALESCE(jtext(p_values, 'description'), ''), CAST(jtext(p_values, 'price') AS DECIMAL(10,2)),
            COALESCE(jbool(p_values, 'requires_prescription'), FALSE),
            COALESCE(jbool(p_values, 'is_active'), TRUE), v_stock);
    IF v_stock > 0 THEN
      INSERT INTO inventory_movements (medicine_id, `change`, reason, actor_id) VALUES (v_id, v_stock, 'Initial stock', v_uid);
    END IF;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM medicines WHERE id = p_id) THEN CALL not_found('Medicine not found.'); END IF;
    UPDATE medicines SET
      slug = IF(jhas(p_values, 'slug'), jtext(p_values, 'slug'), slug),
      name = IF(jhas(p_values, 'name'), jtext(p_values, 'name'), name),
      generic_name = IF(jhas(p_values, 'generic_name'), NULLIF(jtext(p_values, 'generic_name'), ''), generic_name),
      category = IF(jhas(p_values, 'category'), jtext(p_values, 'category'), category),
      form = IF(jhas(p_values, 'form'), COALESCE(NULLIF(jtext(p_values, 'form'), ''), form), form),
      strength = IF(jhas(p_values, 'strength'), NULLIF(jtext(p_values, 'strength'), ''), strength),
      pack_size = IF(jhas(p_values, 'pack_size'), NULLIF(jtext(p_values, 'pack_size'), ''), pack_size),
      description = IF(jhas(p_values, 'description'), COALESCE(jtext(p_values, 'description'), ''), description),
      price = IF(jhas(p_values, 'price'), CAST(jtext(p_values, 'price') AS DECIMAL(10,2)), price),
      requires_prescription = IF(jhas(p_values, 'requires_prescription'), jbool(p_values, 'requires_prescription'), requires_prescription),
      is_active = IF(jhas(p_values, 'is_active'), jbool(p_values, 'is_active'), is_active)
    WHERE id = p_id;
  END IF;
  SELECT * FROM medicines WHERE id = v_id;
END$$

-- ═════════════════════════════ Donations ═════════════════════════════
CREATE PROCEDURE create_donation(
  p_cause_id CHAR(36), p_amount DECIMAL(12,2), p_donor_name TEXT, p_donor_email TEXT, p_is_anonymous BOOLEAN, p_message TEXT
)
MODIFIES SQL DATA
BEGIN
  DECLARE v_uid CHAR(36) DEFAULT app_uid();
  DECLARE v_mode VARCHAR(40) DEFAULT COALESCE(setting_text('payments_mode'), 'demo');
  DECLARE v_email VARCHAR(254) DEFAULT LOWER(NULLIF(TRIM(p_donor_email), ''));
  DECLARE v_id CHAR(36) DEFAULT UUID();
  DECLARE v_ref VARCHAR(20) DEFAULT make_reference('DON');
  DECLARE v_status VARCHAR(20);

  IF NOT EXISTS (SELECT 1 FROM donation_causes WHERE id = p_cause_id AND is_active) THEN CALL fail('Please choose a donation cause.'); END IF;
  IF p_amount IS NULL OR p_amount < 1 OR p_amount > 1000000 THEN CALL fail('Enter an amount between 1 and 10,00,000.'); END IF;
  IF v_email IS NOT NULL AND NOT REGEXP_LIKE(v_email, '^[^@[:space:]]+@[^@[:space:]]+\\.[^@[:space:]]+$') THEN
    CALL fail('Enter a valid email address.');
  END IF;
  IF v_email IS NULL AND v_uid IS NULL THEN CALL fail('Enter an email address for your confirmation.'); END IF;
  SET v_email = COALESCE(v_email, (SELECT email FROM profiles WHERE id = v_uid));
  IF (SELECT COUNT(*) FROM donations WHERE donor_email = v_email AND created_at > UTC_TIMESTAMP(3) - INTERVAL 1 HOUR) >= 5 THEN
    CALL fail('Too many donation attempts. Please try again later.');
  END IF;

  -- In demo mode nothing is charged. In live mode the row stays 'pending' until the payment
  -- provider's webhook is verified server-side.
  SET v_status = IF(v_mode = 'demo', 'simulated', 'pending');
  INSERT INTO donations (id, reference, cause_id, donor_id, donor_name, donor_email, is_anonymous, amount, message, status, provider)
  VALUES (v_id, v_ref, p_cause_id, v_uid, LEFT(NULLIF(TRIM(p_donor_name), ''), 120), v_email, COALESCE(p_is_anonymous, FALSE),
          ROUND(p_amount, 2), LEFT(NULLIF(TRIM(p_message), ''), 500), v_status, v_mode);

  IF v_uid IS NOT NULL THEN
    CALL notify(v_uid, 'donation_recorded', 'Thank you for your support',
      IF(v_status = 'simulated', CONCAT('Your demonstration donation ', v_ref, ' was recorded. No money was collected.'),
         CONCAT('Your donation ', v_ref, ' has been recorded and is awaiting payment confirmation.')),
      '/patient/donations', TRUE);
  END IF;
  SELECT JSON_OBJECT('id', id, 'reference', reference, 'status', status, 'amount', amount, 'currency', currency) AS result
  FROM donations WHERE id = v_id;
END$$

CREATE PROCEDURE get_donation_receipt(p_reference TEXT)
READS SQL DATA
BEGIN
  SELECT (
    SELECT JSON_OBJECT('reference', d.reference, 'amount', d.amount, 'currency', d.currency, 'status', d.status,
      'created_at', d.created_at, 'cause', c.title, 'donor_name', IF(d.is_anonymous, NULL, d.donor_name),
      'is_anonymous', d.is_anonymous IS TRUE, 'provider', d.provider)
    FROM donations d JOIN donation_causes c ON c.id = d.cause_id
    WHERE d.reference = UPPER(TRIM(p_reference)) AND d.created_at > UTC_TIMESTAMP(3) - INTERVAL 30 DAY
  ) AS result;
END$$

-- ═════════════════════════════ Contact ═════════════════════════════
CREATE PROCEDURE submit_contact_message(p_name TEXT, p_email TEXT, p_subject TEXT, p_message TEXT, p_consent BOOLEAN)
MODIFIES SQL DATA
BEGIN
  DECLARE v_id CHAR(36) DEFAULT UUID();
  DECLARE v_email VARCHAR(254) DEFAULT LOWER(TRIM(COALESCE(p_email, '')));
  IF NOT COALESCE(p_consent, FALSE) THEN CALL fail('Please confirm we may use your details to respond.'); END IF;
  IF CHAR_LENGTH(TRIM(COALESCE(p_name, ''))) NOT BETWEEN 2 AND 120 THEN CALL fail('Please enter your name.'); END IF;
  IF NOT REGEXP_LIKE(v_email, '^[^@[:space:]]+@[^@[:space:]]+\\.[^@[:space:]]+$') THEN CALL fail('Enter a valid email address.'); END IF;
  IF CHAR_LENGTH(TRIM(COALESCE(p_subject, ''))) NOT BETWEEN 2 AND 160 THEN CALL fail('Please enter a subject.'); END IF;
  IF CHAR_LENGTH(TRIM(COALESCE(p_message, ''))) NOT BETWEEN 10 AND 4000 THEN CALL fail('Please write a message of at least 10 characters.'); END IF;
  IF (SELECT COUNT(*) FROM contact_messages WHERE email = v_email AND created_at > UTC_TIMESTAMP(3) - INTERVAL 10 MINUTE) >= 3
     OR (SELECT COUNT(*) FROM contact_messages WHERE created_at > UTC_TIMESTAMP(3) - INTERVAL 1 MINUTE) >= 30 THEN
    CALL fail('We have received several messages from you recently. Please try again in a few minutes.');
  END IF;
  INSERT INTO contact_messages (id, name, email, subject, message, consent)
  VALUES (v_id, TRIM(p_name), v_email, TRIM(p_subject), TRIM(p_message), TRUE);
  SELECT JSON_OBJECT('id', v_id) AS result;
END$$

CREATE PROCEDURE update_contact_status(p_id CHAR(36), p_status VARCHAR(20))
MODIFIES SQL DATA
BEGIN
  IF NOT is_admin() THEN CALL deny('Administrators only.'); END IF;
  IF p_status NOT IN ('new', 'in_progress', 'closed') THEN CALL fail('Invalid status.'); END IF;
  UPDATE contact_messages SET status = p_status WHERE id = p_id;
  SELECT NULL AS result;
END$$

-- ═════════════════════════════ Directory management ═════════════════════════════
CREATE PROCEDURE save_department(p_id CHAR(36), p_values JSON)
MODIFIES SQL DATA
BEGIN
  DECLARE v_id CHAR(36) DEFAULT COALESCE(p_id, UUID());
  IF NOT is_admin() THEN CALL deny('Only administrators can manage departments.'); END IF;
  IF p_id IS NULL THEN
    INSERT INTO departments (id, slug, name, summary, description, icon, image_url, services, phone_extension, sort_order, is_active)
    VALUES (v_id, jtext(p_values, 'slug'), jtext(p_values, 'name'), COALESCE(jtext(p_values, 'summary'), ''),
            COALESCE(jtext(p_values, 'description'), ''), COALESCE(NULLIF(jtext(p_values, 'icon'), ''), 'stethoscope'),
            NULLIF(jtext(p_values, 'image_url'), ''), COALESCE(JSON_EXTRACT(p_values, '$.services'), JSON_ARRAY()),
            NULLIF(jtext(p_values, 'phone_extension'), ''), COALESCE(CAST(jtext(p_values, 'sort_order') AS SIGNED), 100),
            COALESCE(jbool(p_values, 'is_active'), TRUE));
  ELSE
    IF NOT EXISTS (SELECT 1 FROM departments WHERE id = p_id) THEN CALL not_found('Department not found.'); END IF;
    UPDATE departments SET
      slug = IF(jhas(p_values, 'slug'), jtext(p_values, 'slug'), slug),
      name = IF(jhas(p_values, 'name'), jtext(p_values, 'name'), name),
      summary = IF(jhas(p_values, 'summary'), COALESCE(jtext(p_values, 'summary'), ''), summary),
      description = IF(jhas(p_values, 'description'), COALESCE(jtext(p_values, 'description'), ''), description),
      icon = IF(jhas(p_values, 'icon'), COALESCE(NULLIF(jtext(p_values, 'icon'), ''), icon), icon),
      image_url = IF(jhas(p_values, 'image_url'), NULLIF(jtext(p_values, 'image_url'), ''), image_url),
      services = IF(jhas(p_values, 'services'), COALESCE(JSON_EXTRACT(p_values, '$.services'), JSON_ARRAY()), services),
      phone_extension = IF(jhas(p_values, 'phone_extension'), NULLIF(jtext(p_values, 'phone_extension'), ''), phone_extension),
      sort_order = IF(jhas(p_values, 'sort_order'), COALESCE(CAST(jtext(p_values, 'sort_order') AS SIGNED), sort_order), sort_order),
      is_active = IF(jhas(p_values, 'is_active'), jbool(p_values, 'is_active'), is_active)
    WHERE id = p_id;
  END IF;
  SELECT * FROM departments WHERE id = v_id;
END$$

-- Administrators manage the whole directory entry; a doctor may edit only their own
-- presentation fields (bio, languages, photo, consultation length).
CREATE PROCEDURE save_doctor(p_id CHAR(36), p_values JSON)
MODIFIES SQL DATA
BEGIN
  DECLARE v_uid CHAR(36) DEFAULT require_user();
  DECLARE v_id CHAR(36) DEFAULT COALESCE(p_id, UUID());
  DECLARE v_admin BOOLEAN DEFAULT is_admin();
  DECLARE v_owner CHAR(36);

  IF p_id IS NULL THEN
    IF NOT v_admin THEN CALL deny('Only administrators can add directory entries.'); END IF;
    INSERT INTO doctors (id, slug, full_name, department_id, speciality, qualifications, years_experience, consultation_fee,
                         qualifications_verified, licence_verified, is_active, bio, languages, photo_url, consultation_minutes)
    VALUES (v_id, jtext(p_values, 'slug'), jtext(p_values, 'full_name'), jtext(p_values, 'department_id'), jtext(p_values, 'speciality'),
            COALESCE(JSON_EXTRACT(p_values, '$.qualifications'), JSON_ARRAY()),
            CAST(NULLIF(jtext(p_values, 'years_experience'), '') AS SIGNED), CAST(NULLIF(jtext(p_values, 'consultation_fee'), '') AS DECIMAL(10,2)),
            COALESCE(jbool(p_values, 'qualifications_verified'), FALSE),
            COALESCE(jbool(p_values, 'licence_verified'), FALSE),
            COALESCE(jbool(p_values, 'is_active'), TRUE),
            COALESCE(jtext(p_values, 'bio'), ''), COALESCE(JSON_EXTRACT(p_values, '$.languages'), JSON_ARRAY()),
            NULLIF(jtext(p_values, 'photo_url'), ''), COALESCE(CAST(jtext(p_values, 'consultation_minutes') AS SIGNED), 20));
  ELSE
    SELECT user_id INTO v_owner FROM doctors WHERE id = p_id FOR UPDATE;
    IF NOT v_admin THEN
      IF NOT (v_owner <=> v_uid AND has_role('doctor')) THEN CALL deny('You can only edit your own profile.'); END IF;
      IF EXISTS (SELECT 1 FROM JSON_TABLE(JSON_KEYS(p_values), '$[*]' COLUMNS (k VARCHAR(64) PATH '$')) j
                 WHERE j.k NOT IN ('bio', 'languages', 'photo_url', 'consultation_minutes')) THEN
        CALL deny('Verified directory fields can only be changed by an administrator.');
      END IF;
    END IF;
    UPDATE doctors SET
      full_name = IF(jhas(p_values, 'full_name'), jtext(p_values, 'full_name'), full_name),
      department_id = IF(jhas(p_values, 'department_id'), jtext(p_values, 'department_id'), department_id),
      speciality = IF(jhas(p_values, 'speciality'), jtext(p_values, 'speciality'), speciality),
      qualifications = IF(jhas(p_values, 'qualifications'), COALESCE(JSON_EXTRACT(p_values, '$.qualifications'), JSON_ARRAY()), qualifications),
      years_experience = IF(jhas(p_values, 'years_experience'), CAST(NULLIF(jtext(p_values, 'years_experience'), '') AS SIGNED), years_experience),
      consultation_fee = IF(jhas(p_values, 'consultation_fee'), CAST(NULLIF(jtext(p_values, 'consultation_fee'), '') AS DECIMAL(10,2)), consultation_fee),
      qualifications_verified = IF(jhas(p_values, 'qualifications_verified'), jbool(p_values, 'qualifications_verified'), qualifications_verified),
      licence_verified = IF(jhas(p_values, 'licence_verified'), jbool(p_values, 'licence_verified'), licence_verified),
      is_active = IF(jhas(p_values, 'is_active'), jbool(p_values, 'is_active'), is_active),
      bio = IF(jhas(p_values, 'bio'), COALESCE(jtext(p_values, 'bio'), ''), bio),
      languages = IF(jhas(p_values, 'languages'), COALESCE(JSON_EXTRACT(p_values, '$.languages'), JSON_ARRAY()), languages),
      photo_url = IF(jhas(p_values, 'photo_url'), NULLIF(jtext(p_values, 'photo_url'), ''), photo_url),
      consultation_minutes = IF(jhas(p_values, 'consultation_minutes'), CAST(jtext(p_values, 'consultation_minutes') AS SIGNED), consultation_minutes)
    WHERE id = p_id;
  END IF;
  SELECT * FROM doctors WHERE id = v_id;
END$$

CREATE PROCEDURE add_availability(p_values JSON)
MODIFIES SQL DATA
BEGIN
  DECLARE v_id CHAR(36) DEFAULT UUID();
  DECLARE v_doctor CHAR(36) DEFAULT jtext(p_values, 'doctor_id');
  IF NOT (v_doctor <=> my_doctor_id() OR is_admin()) THEN CALL deny('You can only manage your own working hours.'); END IF;
  INSERT INTO doctor_availability (id, doctor_id, weekday, start_time, end_time, slot_minutes)
  VALUES (v_id, v_doctor, CAST(jtext(p_values, 'weekday') AS SIGNED), CAST(jtext(p_values, 'start_time') AS TIME),
          CAST(jtext(p_values, 'end_time') AS TIME), COALESCE(CAST(jtext(p_values, 'slot_minutes') AS SIGNED), 20));
  SELECT * FROM doctor_availability WHERE id = v_id;
END$$

CREATE PROCEDURE remove_availability(p_id CHAR(36))
MODIFIES SQL DATA
BEGIN
  DECLARE v_doctor CHAR(36) DEFAULT NULL;
  SELECT doctor_id INTO v_doctor FROM doctor_availability WHERE id = p_id;
  IF v_doctor IS NOT NULL THEN
    IF NOT (v_doctor <=> my_doctor_id() OR is_admin()) THEN CALL deny('You can only manage your own working hours.'); END IF;
    DELETE FROM doctor_availability WHERE id = p_id;
  END IF;
  SELECT NULL AS result;
END$$

-- ═════════════════════════════ Profiles ═════════════════════════════
-- Mass-assignment guard: only the listed personal fields may be changed by their owner.
CREATE PROCEDURE update_my_profile(p_values JSON)
MODIFIES SQL DATA
BEGIN
  DECLARE v_uid CHAR(36) DEFAULT require_user();
  DECLARE v_phone TEXT DEFAULT NULLIF(jtext(p_values, 'phone'), '');
  DECLARE v_ec_phone TEXT DEFAULT NULLIF(jtext(p_values, 'emergency_contact_phone'), '');
  DECLARE v_dob TEXT DEFAULT NULLIF(jtext(p_values, 'date_of_birth'), '');

  IF EXISTS (SELECT 1 FROM JSON_TABLE(JSON_KEYS(p_values), '$[*]' COLUMNS (k VARCHAR(64) PATH '$')) j
             WHERE j.k NOT IN ('full_name', 'phone', 'date_of_birth', 'address', 'emergency_contact_name',
                               'emergency_contact_phone', 'blood_group')) THEN
    CALL deny('You cannot change protected profile fields.');
  END IF;
  IF (jhas(p_values, 'phone') AND v_phone IS NOT NULL AND NOT REGEXP_LIKE(v_phone, '^[0-9+() -]{6,20}$'))
     OR (jhas(p_values, 'emergency_contact_phone') AND v_ec_phone IS NOT NULL AND NOT REGEXP_LIKE(v_ec_phone, '^[0-9+() -]{6,20}$')) THEN
    CALL fail('Please provide a valid phone number.');
  END IF;
  IF jhas(p_values, 'date_of_birth') AND v_dob IS NOT NULL AND NOT REGEXP_LIKE(v_dob, '^[0-9]{4}-[0-9]{2}-[0-9]{2}$') THEN
    CALL fail('Enter a valid date of birth.');
  END IF;
  IF CHAR_LENGTH(jtext(p_values, 'full_name')) > 120 OR CHAR_LENGTH(jtext(p_values, 'address')) > 400
     OR CHAR_LENGTH(jtext(p_values, 'emergency_contact_name')) > 120 THEN
    CALL fail('Some details are too long.');
  END IF;

  UPDATE profiles SET
    full_name = IF(jhas(p_values, 'full_name'), COALESCE(jtext(p_values, 'full_name'), ''), full_name),
    phone = IF(jhas(p_values, 'phone'), v_phone, phone),
    date_of_birth = IF(jhas(p_values, 'date_of_birth'), CAST(v_dob AS DATE), date_of_birth),
    address = IF(jhas(p_values, 'address'), NULLIF(jtext(p_values, 'address'), ''), address),
    emergency_contact_name = IF(jhas(p_values, 'emergency_contact_name'), NULLIF(jtext(p_values, 'emergency_contact_name'), ''), emergency_contact_name),
    emergency_contact_phone = IF(jhas(p_values, 'emergency_contact_phone'), v_ec_phone, emergency_contact_phone),
    blood_group = IF(jhas(p_values, 'blood_group'), NULLIF(jtext(p_values, 'blood_group'), ''), blood_group)
  WHERE id = v_uid;
  SELECT * FROM profiles WHERE id = v_uid;
END$$

CREATE PROCEDURE mark_notifications_read()
MODIFIES SQL DATA
BEGIN
  UPDATE notifications SET read_at = UTC_TIMESTAMP(3) WHERE user_id = app_uid() AND read_at IS NULL;
  SELECT NULL AS result;
END$$

-- ═════════════════════════════ Doctor verification & staff ═════════════════════════════
CREATE PROCEDURE set_application_credential(p_path VARCHAR(400))
MODIFIES SQL DATA
BEGIN
  DECLARE v_uid CHAR(36) DEFAULT require_user();
  IF LEFT(p_path, 37) <> CONCAT(v_uid, '/') THEN CALL fail('Invalid document location.'); END IF;
  UPDATE doctor_applications SET credential_path = p_path WHERE user_id = v_uid AND status = 'pending';
  IF ROW_COUNT() = 0 THEN CALL fail('No pending application found.'); END IF;
  SELECT JSON_OBJECT('ok', TRUE) AS result;
END$$

CREATE PROCEDURE review_doctor_application(p_application_id CHAR(36), p_decision VARCHAR(20), p_notes TEXT, p_department_id CHAR(36))
MODIFIES SQL DATA
BEGIN
  DECLARE v_uid CHAR(36) DEFAULT require_user();
  DECLARE v_user CHAR(36);
  DECLARE v_status VARCHAR(20) DEFAULT NULL;
  DECLARE v_name VARCHAR(120);
  DECLARE v_dept CHAR(36);
  DECLARE v_speciality VARCHAR(120);
  DECLARE v_quals JSON;
  DECLARE v_licence VARCHAR(60);
  DECLARE v_years INT;
  DECLARE v_doctor_id CHAR(36) DEFAULT NULL;

  IF NOT is_admin() THEN CALL deny('Only administrators can review applications.'); END IF;
  IF p_decision NOT IN ('approved', 'rejected') THEN CALL fail('Choose approve or reject.'); END IF;
  SELECT user_id, status, full_name, department_id, speciality, qualifications, licence_number, years_experience
    INTO v_user, v_status, v_name, v_dept, v_speciality, v_quals, v_licence, v_years
  FROM doctor_applications WHERE id = p_application_id FOR UPDATE;
  IF v_status IS NULL THEN CALL not_found('Application not found.'); END IF;
  IF v_status <> 'pending' THEN CALL fail('This application has already been reviewed.'); END IF;
  IF p_decision = 'rejected' AND CHAR_LENGTH(TRIM(COALESCE(p_notes, ''))) < 5 THEN
    CALL fail('Please record a reason for the rejection.');
  END IF;

  IF p_decision = 'approved' THEN
    SET v_dept = COALESCE(p_department_id, v_dept);
    IF v_dept IS NULL THEN CALL fail('Assign a department before approving.'); END IF;
    SET v_doctor_id = UUID();
    INSERT INTO doctors (
      id, user_id, slug, full_name, department_id, speciality, qualifications, qualifications_verified,
      licence_number, licence_verified, years_experience
    ) VALUES (
      v_doctor_id, v_user,
      CONCAT(TRIM(BOTH '-' FROM REGEXP_REPLACE(LOWER(v_name), '[^a-z0-9]+', '-')), '-', LEFT(REPLACE(p_application_id, '-', ''), 6)),
      v_name, v_dept, v_speciality, v_quals, TRUE, v_licence, TRUE, v_years
    );
    INSERT IGNORE INTO user_roles (user_id, role, granted_by) VALUES (v_user, 'doctor', v_uid);
  END IF;

  UPDATE doctor_applications SET status = p_decision, reviewer_id = v_uid, reviewed_at = UTC_TIMESTAMP(3),
    review_notes = NULLIF(TRIM(p_notes), ''), department_id = COALESCE(IF(p_decision = 'approved', v_dept, NULL), department_id)
  WHERE id = p_application_id;

  CALL notify(v_user, CONCAT('doctor_application_', p_decision),
    IF(p_decision = 'approved', 'Your doctor account is approved', 'Update on your doctor application'),
    IF(p_decision = 'approved', 'Your professional details have been verified. You can now sign in to the doctor portal.',
       'Your application could not be approved at this time. Sign in to see the reviewer''s note.'),
    IF(p_decision = 'approved', '/doctor/dashboard', '/verification-pending'), TRUE);
  SELECT JSON_OBJECT('status', p_decision, 'doctor_id', v_doctor_id) AS result;
END$$

CREATE PROCEDURE create_employee_invitation(p_email TEXT, p_permissions JSON)
MODIFIES SQL DATA
BEGIN
  DECLARE v_uid CHAR(36) DEFAULT require_user();
  DECLARE v_id CHAR(36) DEFAULT UUID();
  DECLARE v_token CHAR(36) DEFAULT UUID();
  DECLARE v_email VARCHAR(254) DEFAULT LOWER(TRIM(COALESCE(p_email, '')));
  IF NOT is_admin() THEN CALL deny('Only administrators can invite staff.'); END IF;
  IF p_permissions IS NULL OR JSON_LENGTH(p_permissions) = 0 THEN CALL fail('Select at least one permission.'); END IF;
  IF EXISTS (SELECT 1 FROM JSON_TABLE(p_permissions, '$[*]' COLUMNS (v VARCHAR(40) PATH '$')) j
             WHERE j.v NOT IN ('appointments', 'patient_admin', 'lab_records', 'pharmacy') OR j.v IS NULL) THEN
    CALL fail('Unknown permission.');
  END IF;
  IF NOT REGEXP_LIKE(v_email, '^[^@[:space:]]+@[^@[:space:]]+\\.[^@[:space:]]+$') THEN CALL fail('Enter a valid email address.'); END IF;

  UPDATE employee_invitations SET revoked_at = UTC_TIMESTAMP(3)
  WHERE email = v_email AND accepted_at IS NULL AND revoked_at IS NULL;
  INSERT INTO employee_invitations (id, email, permissions, token, invited_by) VALUES (v_id, v_email, p_permissions, v_token, v_uid);
  INSERT INTO email_outbox (to_email, template, subject, body)
  VALUES (v_email, 'staff_invitation', 'A10 Hospital — You have been invited to the staff portal',
    CONCAT('You have been invited to join the A10 Hospital staff portal. Create your account using this link (valid for 7 days): ',
           COALESCE(setting_text('site_url'), ''), '/signup?invite=', v_token));
  SELECT * FROM employee_invitations WHERE id = v_id;
END$$

CREATE PROCEDURE revoke_employee_invitation(p_id CHAR(36))
MODIFIES SQL DATA
BEGIN
  IF NOT is_admin() THEN CALL deny('Only administrators can revoke invitations.'); END IF;
  UPDATE employee_invitations SET revoked_at = UTC_TIMESTAMP(3) WHERE id = p_id AND accepted_at IS NULL;
  SELECT NULL AS result;
END$$

-- Public lookup used to pre-fill the staff sign-up form. Reveals only the invited email.
CREATE PROCEDURE get_invitation(p_token CHAR(36))
READS SQL DATA
BEGIN
  SELECT (
    SELECT JSON_OBJECT('email', email, 'permissions', permissions, 'expires_at', expires_at)
    FROM employee_invitations
    WHERE token = p_token AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > UTC_TIMESTAMP(3)
  ) AS result;
END$$

-- For people who already have an account and then receive an invitation.
CREATE PROCEDURE accept_employee_invitation(p_token CHAR(36))
MODIFIES SQL DATA
BEGIN
  DECLARE v_uid CHAR(36) DEFAULT require_user();
  DECLARE v_id CHAR(36) DEFAULT NULL;
  DECLARE v_by CHAR(36);
  DECLARE v_perms JSON;
  SELECT id, invited_by, permissions INTO v_id, v_by, v_perms FROM employee_invitations
  WHERE token = p_token AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > UTC_TIMESTAMP(3)
    AND email = (SELECT email FROM profiles WHERE id = v_uid)
  FOR UPDATE;
  IF v_id IS NULL THEN CALL fail('This invitation is invalid, expired, or addressed to a different email.'); END IF;
  INSERT IGNORE INTO user_roles (user_id, role, granted_by) VALUES (v_uid, 'staff', v_by);
  INSERT IGNORE INTO staff_permissions (user_id, permission, granted_by)
  SELECT v_uid, j.v, v_by FROM JSON_TABLE(v_perms, '$[*]' COLUMNS (v VARCHAR(30) PATH '$')) j;
  UPDATE employee_invitations SET accepted_at = UTC_TIMESTAMP(3), accepted_by = v_uid WHERE id = v_id;
  SELECT JSON_OBJECT('ok', TRUE) AS result;
END$$

CREATE PROCEDURE admin_set_staff_permissions(p_user_id CHAR(36), p_permissions JSON)
MODIFIES SQL DATA
BEGIN
  DECLARE v_uid CHAR(36) DEFAULT require_user();
  DECLARE v_perms JSON DEFAULT COALESCE(p_permissions, JSON_ARRAY());
  IF NOT is_admin() THEN CALL deny('Only administrators can change staff access.'); END IF;
  IF EXISTS (SELECT 1 FROM JSON_TABLE(v_perms, '$[*]' COLUMNS (v VARCHAR(40) PATH '$')) j
             WHERE j.v NOT IN ('appointments', 'patient_admin', 'lab_records', 'pharmacy') OR j.v IS NULL) THEN
    CALL fail('Unknown permission.');
  END IF;
  DELETE FROM staff_permissions WHERE user_id = p_user_id AND NOT JSON_CONTAINS(v_perms, JSON_QUOTE(permission));
  IF JSON_LENGTH(v_perms) = 0 THEN
    DELETE FROM user_roles WHERE user_id = p_user_id AND role = 'staff';
  ELSE
    INSERT IGNORE INTO user_roles (user_id, role, granted_by) VALUES (p_user_id, 'staff', v_uid);
    INSERT IGNORE INTO staff_permissions (user_id, permission, granted_by)
    SELECT p_user_id, j.v, v_uid FROM JSON_TABLE(v_perms, '$[*]' COLUMNS (v VARCHAR(30) PATH '$')) j;
  END IF;
  SELECT NULL AS result;
END$$

CREATE PROCEDURE admin_set_active(p_user_id CHAR(36), p_active BOOLEAN)
MODIFIES SQL DATA
BEGIN
  DECLARE v_uid CHAR(36) DEFAULT require_user();
  IF NOT is_admin() THEN CALL deny('Only administrators can change account status.'); END IF;
  IF p_user_id = v_uid THEN CALL fail('You cannot deactivate your own account.'); END IF;
  UPDATE profiles SET is_active = p_active WHERE id = p_user_id;
  CALL write_audit(IF(p_active, 'reactivate_user', 'deactivate_user'), 'profiles', p_user_id, NULL);
  SELECT NULL AS result;
END$$

-- Provision the first administrator (run as root, never granted to the application):
--   CALL a10_hospital.bootstrap_admin('you@example.org');
CREATE PROCEDURE bootstrap_admin(p_email TEXT)
MODIFIES SQL DATA
BEGIN
  DECLARE v_id CHAR(36) DEFAULT NULL;
  SELECT id INTO v_id FROM profiles WHERE email = LOWER(TRIM(p_email));
  IF v_id IS NULL THEN CALL fail('No account with that email. Sign up first, then run this again.'); END IF;
  INSERT IGNORE INTO user_roles (user_id, role) VALUES (v_id, 'admin');
END$$

-- ═════════════════════════════ Dashboards ═════════════════════════════
CREATE PROCEDURE admin_overview()
READS SQL DATA
BEGIN
  DECLARE v_today DATE DEFAULT DATE(to_local(UTC_TIMESTAMP(3)));
  DECLARE v_now DATETIME(3) DEFAULT UTC_TIMESTAMP(3);
  IF NOT is_admin() THEN CALL deny('Administrators only.'); END IF;
  SELECT JSON_OBJECT(
    'users_by_role', (SELECT COALESCE(JSON_OBJECTAGG(role, n), JSON_OBJECT()) FROM (SELECT role, COUNT(*) n FROM user_roles GROUP BY role) x),
    'pending_doctor_applications', (SELECT COUNT(*) FROM doctor_applications WHERE status = 'pending'),
    'appointments_today', (SELECT COUNT(*) FROM appointments WHERE DATE(to_local(starts_at)) = v_today AND status <> 'cancelled'),
    'appointments_upcoming', (SELECT COUNT(*) FROM appointments WHERE starts_at > v_now AND status IN ('requested', 'confirmed')),
    'appointments_requested', (SELECT COUNT(*) FROM appointments WHERE status = 'requested' AND starts_at > v_now),
    'appointments_by_day', (
      WITH RECURSIVE g (i) AS (SELECT 0 UNION ALL SELECT i + 1 FROM g WHERE i < 13)
      SELECT CAST(CONCAT('[', GROUP_CONCAT(JSON_OBJECT('day', DATE_FORMAT(v_today - INTERVAL 6 DAY + INTERVAL g.i DAY, '%Y-%m-%d'), 'count', (
          SELECT COUNT(*) FROM appointments a
          WHERE DATE(to_local(a.starts_at)) = v_today - INTERVAL 6 DAY + INTERVAL g.i DAY AND a.status <> 'cancelled')) ORDER BY g.i), ']') AS JSON)
      FROM g),
    'orders_by_status', (SELECT COALESCE(JSON_OBJECTAGG(status, n), JSON_OBJECT()) FROM (SELECT status, COUNT(*) n FROM medication_orders GROUP BY status) x),
    'donations', (SELECT JSON_OBJECT('count', COUNT(*),
                    'simulated_total', COALESCE(SUM(IF(status = 'simulated', amount, 0)), 0),
                    'paid_total', COALESCE(SUM(IF(status = 'paid', amount, 0)), 0)) FROM donations),
    'new_contact_messages', (SELECT COUNT(*) FROM contact_messages WHERE status = 'new'),
    'low_stock', (SELECT COUNT(*) FROM medicines WHERE is_active AND stock < 20),
    'queued_emails', (SELECT COUNT(*) FROM email_outbox WHERE status = 'queued')
  ) AS result;
END$$

DELIMITER ;
