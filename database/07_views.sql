-- Security views — row-level security for MySQL.
--
-- MySQL has no row-level security policies, so the a10_api database exposes one view per
-- table, with the SAME NAME as the table, whose WHERE clause is the access rule. The views run
-- with their definer's rights (SQL SECURITY DEFINER), and the application's MySQL account is
-- granted SELECT on these views only — never on the a10_hospital tables underneath. So
--   SELECT * FROM a10_api.appointments
-- returns only the rows the signed-in user may see, whatever the query asks for.
-- The v_* views are read models for the UI, built on top of the secured views.
USE a10_api;

-- ───────────────────────────── Settings & identity ─────────────────────────────
CREATE SQL SECURITY DEFINER VIEW settings AS
SELECT s.* FROM a10_hospital.settings s
WHERE s.is_public OR a10_hospital.is_admin();

CREATE SQL SECURITY DEFINER VIEW profiles AS
SELECT p.* FROM a10_hospital.profiles p
WHERE p.id = a10_hospital.app_uid()
   OR a10_hospital.is_admin()
   OR a10_hospital.has_permission('patient_admin')
   OR a10_hospital.doctor_can_access_patient(p.id);

CREATE SQL SECURITY DEFINER VIEW user_roles AS
SELECT r.* FROM a10_hospital.user_roles r
WHERE r.user_id = a10_hospital.app_uid() OR a10_hospital.is_admin();

CREATE SQL SECURITY DEFINER VIEW staff_permissions AS
SELECT s.* FROM a10_hospital.staff_permissions s
WHERE s.user_id = a10_hospital.app_uid() OR a10_hospital.is_admin();

CREATE SQL SECURITY DEFINER VIEW employee_invitations AS
SELECT i.* FROM a10_hospital.employee_invitations i
WHERE a10_hospital.is_admin();

-- ───────────────────────────── Directory ─────────────────────────────
CREATE SQL SECURITY DEFINER VIEW departments AS
SELECT d.* FROM a10_hospital.departments d
WHERE d.is_active OR a10_hospital.is_admin();

CREATE SQL SECURITY DEFINER VIEW doctors AS
SELECT d.* FROM a10_hospital.doctors d
WHERE d.is_active OR a10_hospital.is_admin() OR d.user_id = a10_hospital.app_uid();

CREATE SQL SECURITY DEFINER VIEW doctor_availability AS
SELECT a.* FROM a10_hospital.doctor_availability a;

CREATE SQL SECURITY DEFINER VIEW doctor_applications AS
SELECT a.* FROM a10_hospital.doctor_applications a
WHERE a.user_id = a10_hospital.app_uid() OR a10_hospital.is_admin();

-- ───────────────────────────── Appointments ─────────────────────────────
CREATE SQL SECURITY DEFINER VIEW appointments AS
SELECT a.id, a.reference, a.patient_id, a.doctor_id, a.department_id, a.starts_at, a.ends_at, a.status, a.reason,
       a.patient_name, a.patient_phone, a.patient_email, a.cancel_reason, a.rescheduled_from, a.created_by,
       a.is_sample, a.created_at, a.updated_at
FROM a10_hospital.appointments a
WHERE a.patient_id = a10_hospital.app_uid()
   OR a.doctor_id = a10_hospital.my_doctor_id()
   OR a10_hospital.has_permission('appointments')
   OR a10_hospital.has_permission('patient_admin')
   OR a10_hospital.is_admin();

CREATE SQL SECURITY DEFINER VIEW appointment_events AS
SELECT e.* FROM a10_hospital.appointment_events e
WHERE EXISTS (SELECT 1 FROM a10_api.appointments a WHERE a.id = e.appointment_id);

-- ───────────────────────────── Clinical ─────────────────────────────
-- Patients see released records; doctors see patients in their care.
-- Administrators are deliberately *not* granted clinical read access.
CREATE SQL SECURITY DEFINER VIEW consultations AS
SELECT c.* FROM a10_hospital.consultations c
WHERE c.doctor_id = a10_hospital.my_doctor_id();

CREATE SQL SECURITY DEFINER VIEW prescriptions AS
SELECT r.* FROM a10_hospital.prescriptions r
WHERE (r.patient_id = a10_hospital.app_uid() AND r.status IN ('issued', 'superseded'))
   OR a10_hospital.doctor_can_access_patient(r.patient_id)
   OR (a10_hospital.has_permission('pharmacy') AND r.status = 'issued'
       AND EXISTS (SELECT 1 FROM a10_hospital.medication_orders o WHERE o.prescription_id = r.id));

CREATE SQL SECURITY DEFINER VIEW prescription_items AS
SELECT i.* FROM a10_hospital.prescription_items i
WHERE EXISTS (SELECT 1 FROM a10_api.prescriptions p WHERE p.id = i.prescription_id);

CREATE SQL SECURITY DEFINER VIEW lab_reports AS
SELECT l.* FROM a10_hospital.lab_reports l
WHERE (l.patient_id = a10_hospital.app_uid() AND l.status IN ('final', 'amended'))
   OR a10_hospital.doctor_can_access_patient(l.patient_id)
   OR a10_hospital.has_permission('lab_records');

CREATE SQL SECURITY DEFINER VIEW lab_results AS
SELECT x.* FROM a10_hospital.lab_results x
WHERE EXISTS (SELECT 1 FROM a10_api.lab_reports r WHERE r.id = x.report_id);

CREATE SQL SECURITY DEFINER VIEW observation_records AS
SELECT o.* FROM a10_hospital.observation_records o
WHERE a10_hospital.doctor_can_access_patient(o.patient_id);

-- ───────────────────────────── Pharmacy ─────────────────────────────
CREATE SQL SECURITY DEFINER VIEW medicines AS
SELECT m.* FROM a10_hospital.medicines m
WHERE m.is_active OR a10_hospital.is_admin() OR a10_hospital.has_permission('pharmacy');

CREATE SQL SECURITY DEFINER VIEW medication_orders AS
SELECT o.* FROM a10_hospital.medication_orders o
WHERE o.patient_id = a10_hospital.app_uid() OR a10_hospital.has_permission('pharmacy') OR a10_hospital.is_admin();

CREATE SQL SECURITY DEFINER VIEW medication_order_items AS
SELECT i.* FROM a10_hospital.medication_order_items i
WHERE EXISTS (SELECT 1 FROM a10_api.medication_orders o WHERE o.id = i.order_id);

CREATE SQL SECURITY DEFINER VIEW order_events AS
SELECT e.* FROM a10_hospital.order_events e
WHERE EXISTS (SELECT 1 FROM a10_api.medication_orders o WHERE o.id = e.order_id);

CREATE SQL SECURITY DEFINER VIEW inventory_movements AS
SELECT m.* FROM a10_hospital.inventory_movements m
WHERE a10_hospital.is_admin() OR a10_hospital.has_permission('pharmacy');

-- ───────────────────────────── Donations & communications ─────────────────────────────
CREATE SQL SECURITY DEFINER VIEW donation_causes AS
SELECT c.* FROM a10_hospital.donation_causes c
WHERE c.is_active OR a10_hospital.is_admin();

CREATE SQL SECURITY DEFINER VIEW donations AS
SELECT d.* FROM a10_hospital.donations d
WHERE d.donor_id = a10_hospital.app_uid() OR a10_hospital.is_admin();

CREATE SQL SECURITY DEFINER VIEW contact_messages AS
SELECT m.* FROM a10_hospital.contact_messages m
WHERE a10_hospital.is_admin();

CREATE SQL SECURITY DEFINER VIEW notifications AS
SELECT n.* FROM a10_hospital.notifications n
WHERE n.user_id = a10_hospital.app_uid();

CREATE SQL SECURITY DEFINER VIEW email_outbox AS
SELECT e.* FROM a10_hospital.email_outbox e
WHERE e.user_id = a10_hospital.app_uid() OR a10_hospital.is_admin();

CREATE SQL SECURITY DEFINER VIEW audit_logs AS
SELECT l.* FROM a10_hospital.audit_logs l
WHERE a10_hospital.is_admin();

-- ═════════════════════════════ Read models for the UI ═════════════════════════════
-- Built on the secured views above, so the same row rules apply.

CREATE SQL SECURITY DEFINER VIEW v_doctors AS
SELECT d.id, d.user_id, d.slug, d.full_name, d.department_id, dp.name AS department_name, dp.slug AS department_slug,
       d.speciality, d.qualifications, d.qualifications_verified, d.licence_verified, d.years_experience, d.bio,
       d.languages, d.consultation_fee, d.consultation_minutes, d.photo_url, d.is_active, d.is_sample,
       EXISTS (SELECT 1 FROM a10_hospital.doctor_availability a WHERE a.doctor_id = d.id) AS has_availability,
       d.created_at
FROM a10_api.doctors d
JOIN a10_api.departments dp ON dp.id = d.department_id;

CREATE SQL SECURITY DEFINER VIEW v_departments AS
SELECT dp.*, (SELECT COUNT(*) FROM a10_hospital.doctors d WHERE d.department_id = dp.id AND d.is_active) AS doctor_count
FROM a10_api.departments dp;

CREATE SQL SECURITY DEFINER VIEW v_appointments AS
SELECT a.*, d.full_name AS doctor_name, d.slug AS doctor_slug, d.speciality AS doctor_speciality,
       dp.name AS department_name
FROM a10_api.appointments a
JOIN a10_hospital.doctors d ON d.id = a.doctor_id
JOIN a10_hospital.departments dp ON dp.id = a.department_id;

CREATE SQL SECURITY DEFINER VIEW v_prescriptions AS
SELECT r.*, d.full_name AS doctor_name, dp.name AS department_name, p.full_name AS patient_name,
       a.reference AS appointment_reference,
       (SELECT COUNT(*) FROM a10_hospital.prescription_items i WHERE i.prescription_id = r.id) AS item_count,
       (SELECT COALESCE(GROUP_CONCAT(i.medication_name ORDER BY i.position SEPARATOR ', '), '')
          FROM a10_hospital.prescription_items i WHERE i.prescription_id = r.id) AS medications
FROM a10_api.prescriptions r
JOIN a10_hospital.doctors d ON d.id = r.doctor_id
JOIN a10_hospital.departments dp ON dp.id = d.department_id
LEFT JOIN a10_api.profiles p ON p.id = r.patient_id
LEFT JOIN a10_api.appointments a ON a.id = r.appointment_id;

CREATE SQL SECURITY DEFINER VIEW v_lab_reports AS
SELECT l.*, d.full_name AS doctor_name, dp.name AS department_name, p.full_name AS patient_name,
       (SELECT COUNT(*) FROM a10_hospital.lab_results x WHERE x.report_id = l.id) AS result_count
FROM a10_api.lab_reports l
LEFT JOIN a10_hospital.doctors d ON d.id = l.doctor_id
LEFT JOIN a10_hospital.departments dp ON dp.id = l.department_id
LEFT JOIN a10_api.profiles p ON p.id = l.patient_id;

CREATE SQL SECURITY DEFINER VIEW v_observations AS
SELECT o.*, p.full_name AS patient_name, ob.full_name AS observer_name
FROM a10_api.observation_records o
LEFT JOIN a10_api.profiles p ON p.id = o.patient_id
LEFT JOIN a10_hospital.profiles ob ON ob.id = o.observer_id;

CREATE SQL SECURITY DEFINER VIEW v_orders AS
SELECT o.*, p.full_name AS patient_name, rx.reference AS prescription_reference,
       (SELECT COALESCE(SUM(i.quantity), 0) FROM a10_hospital.medication_order_items i WHERE i.order_id = o.id) AS item_count
FROM a10_api.medication_orders o
LEFT JOIN a10_api.profiles p ON p.id = o.patient_id
LEFT JOIN a10_api.prescriptions rx ON rx.id = o.prescription_id;

CREATE SQL SECURITY DEFINER VIEW v_donations AS
SELECT dn.*, c.title AS cause_title
FROM a10_api.donations dn
JOIN a10_hospital.donation_causes c ON c.id = dn.cause_id;

CREATE SQL SECURITY DEFINER VIEW v_doctor_applications AS
SELECT a.*, dp.name AS department_name
FROM a10_api.doctor_applications a
LEFT JOIN a10_hospital.departments dp ON dp.id = a.department_id;

CREATE SQL SECURITY DEFINER VIEW v_users AS
SELECT p.id, p.email, p.full_name, p.phone, p.is_active, p.is_sample, p.created_at,
       COALESCE((SELECT CAST(CONCAT('[', GROUP_CONCAT(JSON_QUOTE(r.role) ORDER BY r.role), ']') AS JSON)
                 FROM a10_api.user_roles r WHERE r.user_id = p.id), JSON_ARRAY()) AS roles,
       COALESCE((SELECT CAST(CONCAT('[', GROUP_CONCAT(JSON_QUOTE(s.permission) ORDER BY s.permission), ']') AS JSON)
                 FROM a10_api.staff_permissions s WHERE s.user_id = p.id), JSON_ARRAY()) AS permissions
FROM a10_api.profiles p;

CREATE SQL SECURITY DEFINER VIEW v_audit_logs AS
SELECT l.id, l.actor_id, p.full_name AS actor_name, p.email AS actor_email, l.action, l.entity, l.entity_id,
       JSON_REMOVE(l.details, '$.old', '$.new') AS summary, l.created_at
FROM a10_api.audit_logs l
LEFT JOIN a10_hospital.profiles p ON p.id = l.actor_id;
