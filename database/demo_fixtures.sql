-- DEMO ONLY — synthetic records for the demo accounts. Runs as root after the demo accounts
-- exist (created through the normal sign-up trigger). Every row is is_sample = TRUE.
-- Never run against a production database.
USE a10_hospital;

DROP PROCEDURE IF EXISTS load_demo_fixtures;

DELIMITER $$
CREATE PROCEDURE load_demo_fixtures()
MODIFIES SQL DATA
BEGIN
  DECLARE v_patient CHAR(36) DEFAULT (SELECT id FROM profiles WHERE email = 'patient@a10.example');
  DECLARE v_patient2 CHAR(36) DEFAULT (SELECT id FROM profiles WHERE email = 'patient2@a10.example');
  DECLARE v_doc_user CHAR(36) DEFAULT (SELECT id FROM profiles WHERE email = 'doctor@a10.example');
  DECLARE v_gp_user CHAR(36) DEFAULT (SELECT id FROM profiles WHERE email = 'gp@a10.example');
  DECLARE v_staff CHAR(36) DEFAULT (SELECT id FROM profiles WHERE email = 'staff@a10.example');
  DECLARE v_pharm CHAR(36) DEFAULT (SELECT id FROM profiles WHERE email = 'pharmacy@a10.example');
  DECLARE v_admin CHAR(36) DEFAULT (SELECT id FROM profiles WHERE email = 'admin@a10.example');
  DECLARE v_cardio CHAR(36) DEFAULT (SELECT id FROM doctors WHERE slug = 'ananya-sample');
  DECLARE v_gp CHAR(36) DEFAULT (SELECT id FROM doctors WHERE slug = 'sana-prototype');
  DECLARE v_cardio_dept CHAR(36) DEFAULT (SELECT department_id FROM doctors WHERE slug = 'ananya-sample');
  DECLARE v_gp_dept CHAR(36) DEFAULT (SELECT department_id FROM doctors WHERE slug = 'sana-prototype');
  DECLARE v_today DATE DEFAULT DATE(to_local(UTC_TIMESTAMP(3)));
  DECLARE v_next_mon DATE;
  DECLARE v_next_wed DATE;
  DECLARE a1, a2, a3, a4, a5, a6 CHAR(36);
  DECLARE rx1, rx2, lab1, lab2, lab3, o1, o2 CHAR(36);

  -- First Monday / Wednesday at least 3 days ahead (DAYOFWEEK: 1 = Sunday).
  SET v_next_mon = v_today + INTERVAL 3 DAY + INTERVAL MOD(9 - DAYOFWEEK(v_today + INTERVAL 3 DAY), 7) DAY;
  SET v_next_wed = v_today + INTERVAL 3 DAY + INTERVAL MOD(11 - DAYOFWEEK(v_today + INTERVAL 3 DAY), 7) DAY;
  SET a1 = UUID(), a2 = UUID(), a3 = UUID(), a4 = UUID(), a5 = UUID(), a6 = UUID();
  SET rx1 = UUID(), rx2 = UUID(), lab1 = UUID(), lab2 = UUID(), lab3 = UUID(), o1 = UUID(), o2 = UUID();

  UPDATE profiles SET is_sample = TRUE WHERE email LIKE '%@a10.example';
  UPDATE profiles SET phone = '+91 90000 00001', date_of_birth = '1991-04-12', blood_group = 'O+',
    address = '12 Sample Street, Demo Nagar (fictional address)', emergency_contact_name = 'Kiran Sample',
    emergency_contact_phone = '+91 90000 00009'
  WHERE id = v_patient;
  UPDATE profiles SET phone = '+91 90000 00002', date_of_birth = '1984-09-30' WHERE id = v_patient2;

  -- Roles that cannot be self-assigned are granted here, as an administrator would.
  INSERT IGNORE INTO user_roles (user_id, role) VALUES (v_doc_user, 'doctor'), (v_gp_user, 'doctor'), (v_admin, 'admin'),
    (v_staff, 'staff'), (v_pharm, 'staff');
  INSERT IGNORE INTO staff_permissions (user_id, permission) VALUES
    (v_staff, 'appointments'), (v_staff, 'patient_admin'), (v_staff, 'lab_records'), (v_pharm, 'pharmacy');
  UPDATE doctors SET user_id = v_doc_user WHERE id = v_cardio;
  UPDATE doctors SET user_id = v_gp_user WHERE id = v_gp;

  -- Appointments
  INSERT INTO appointments (id, reference, patient_id, doctor_id, department_id, starts_at, ends_at, status, reason, patient_name, patient_phone, patient_email, cancel_reason, is_sample) VALUES
    (a1, 'APT-DEMO0001', v_patient, v_cardio, v_cardio_dept, from_local(TIMESTAMP(v_today - INTERVAL 20 DAY, '10:00')), from_local(TIMESTAMP(v_today - INTERVAL 20 DAY, '10:20')),
     'completed', 'Routine follow-up (sample)', 'Riya Sample', '+91 90000 00001', 'patient@a10.example', NULL, TRUE),
    (a2, 'APT-DEMO0002', v_patient, v_gp, v_gp_dept, from_local(TIMESTAMP(v_today - INTERVAL 45 DAY, '11:00')), from_local(TIMESTAMP(v_today - INTERVAL 45 DAY, '11:20')),
     'completed', 'Fever and sore throat (sample)', 'Riya Sample', '+91 90000 00001', 'patient@a10.example', NULL, TRUE),
    (a3, 'APT-DEMO0003', v_patient, v_cardio, v_cardio_dept, from_local(TIMESTAMP(v_next_mon, '10:00')), from_local(TIMESTAMP(v_next_mon, '10:20')),
     'confirmed', 'Review of test results (sample)', 'Riya Sample', '+91 90000 00001', 'patient@a10.example', NULL, TRUE),
    (a4, 'APT-DEMO0004', v_patient, v_gp, v_gp_dept, from_local(TIMESTAMP(v_next_wed, '11:00')), from_local(TIMESTAMP(v_next_wed, '11:20')),
     'requested', 'Annual health check (sample)', 'Riya Sample', '+91 90000 00001', 'patient@a10.example', NULL, TRUE),
    (a5, 'APT-DEMO0005', v_patient, v_gp, v_gp_dept, from_local(TIMESTAMP(v_today - INTERVAL 8 DAY, '09:40')), from_local(TIMESTAMP(v_today - INTERVAL 8 DAY, '10:00')),
     'cancelled', 'Cough (sample)', 'Riya Sample', NULL, 'patient@a10.example', 'Patient unable to attend (sample)', TRUE),
    (a6, 'APT-DEMO0006', v_patient2, v_cardio, v_cardio_dept, from_local(TIMESTAMP(v_next_wed, '09:40')), from_local(TIMESTAMP(v_next_wed, '10:00')),
     'requested', 'Chest discomfort on exertion (sample)', 'Arjun Example', '+91 90000 00002', 'patient2@a10.example', NULL, TRUE),
    (UUID(), 'APT-DEMO0007', v_patient2, v_cardio, v_cardio_dept, from_local(TIMESTAMP(v_today - INTERVAL 10 DAY, '09:00')), from_local(TIMESTAMP(v_today - INTERVAL 10 DAY, '09:20')),
     'completed', 'Blood pressure review (sample)', 'Arjun Example', '+91 90000 00002', 'patient2@a10.example', NULL, TRUE);

  INSERT INTO appointment_events (appointment_id, from_status, to_status, actor_id, note)
  SELECT id, NULL, 'requested', patient_id, 'Sample history' FROM appointments WHERE is_sample;
  INSERT INTO appointment_events (appointment_id, from_status, to_status, actor_id)
  SELECT id, 'requested', status, patient_id FROM appointments WHERE is_sample AND status <> 'requested';

  INSERT INTO consultations (appointment_id, patient_id, doctor_id, notes, created_by, is_sample)
  VALUES (a1, v_patient, v_cardio, 'SAMPLE NOTE — synthetic content for demonstration only. Follow-up visit; patient reports feeling well. Plan: continue current medication, review results at next visit.', v_doc_user, TRUE);

  -- Prescriptions (synthetic — not medical advice)
  INSERT INTO prescriptions (id, reference, patient_id, doctor_id, appointment_id, status, notes, issued_at, created_by, is_sample)
  VALUES (rx1, 'RX-DEMO0001', v_patient, v_cardio, a1, 'issued', 'Sample prescription for demonstration only.', from_local(TIMESTAMP(v_today - INTERVAL 20 DAY, '10:25')), v_doc_user, TRUE),
         (rx2, 'RX-DEMO0002', v_patient, v_gp, a2, 'issued', 'Sample prescription for demonstration only.', from_local(TIMESTAMP(v_today - INTERVAL 45 DAY, '11:25')), v_gp_user, TRUE);
  INSERT INTO prescription_items (prescription_id, medicine_id, medication_name, dosage, frequency, duration, instructions, quantity, position) VALUES
    (rx1, (SELECT id FROM medicines WHERE slug = 'atorvastatin-10-mg'), 'Atorvastatin 10 mg', '1 tablet', 'Once daily at night', '30 days', 'Sample instruction', 30, 0),
    (rx1, (SELECT id FROM medicines WHERE slug = 'amlodipine-5-mg'), 'Amlodipine 5 mg', '1 tablet', 'Once daily', '30 days', NULL, 30, 1),
    (rx2, (SELECT id FROM medicines WHERE slug = 'paracetamol-500-mg'), 'Paracetamol 500 mg', '1 tablet', 'Up to three times a day if needed', '3 days', 'Sample instruction', 9, 0);

  -- Lab reports (synthetic values, no interpretation or reference ranges)
  INSERT INTO lab_reports (id, reference, patient_id, doctor_id, department_id, appointment_id, test_name, collected_at, resulted_at, status, summary, created_by, is_sample) VALUES
    (lab1, 'LAB-DEMO0001', v_patient, v_cardio, v_cardio_dept, a1, 'Lipid profile (sample)',
     from_local(TIMESTAMP(v_today - INTERVAL 21 DAY, '08:30')), from_local(TIMESTAMP(v_today - INTERVAL 20 DAY, '16:00')), 'final',
     'SAMPLE REPORT — synthetic values for demonstration. Not a real result and not medical advice.', v_doc_user, TRUE),
    (lab2, 'LAB-DEMO0002', v_patient, v_gp, v_gp_dept, NULL, 'Complete blood count (sample)',
     from_local(TIMESTAMP(v_today - INTERVAL 46 DAY, '09:00')), from_local(TIMESTAMP(v_today - INTERVAL 45 DAY, '15:00')), 'final',
     'SAMPLE REPORT — synthetic values for demonstration.', v_gp_user, TRUE),
    (lab3, 'LAB-DEMO0003', v_patient, v_cardio, v_cardio_dept, NULL, 'HbA1c (sample)',
     from_local(TIMESTAMP(v_today - INTERVAL 1 DAY, '08:15')), NULL, 'in_progress', NULL, v_staff, TRUE);
  INSERT INTO lab_results (report_id, analyte, value, unit, position) VALUES
    (lab1, 'Total cholesterol', '182', 'mg/dL', 0), (lab1, 'HDL cholesterol', '48', 'mg/dL', 1),
    (lab1, 'LDL cholesterol', '110', 'mg/dL', 2), (lab1, 'Triglycerides', '120', 'mg/dL', 3),
    (lab2, 'Haemoglobin', '13.1', 'g/dL', 0), (lab2, 'White cell count', '7.2', '× 10⁹/L', 1), (lab2, 'Platelets', '250', '× 10⁹/L', 2);

  INSERT INTO observation_records (patient_id, appointment_id, observed_at, observer_id, observation_type, value, unit, context, is_sample) VALUES
    (v_patient, a1, from_local(TIMESTAMP(v_today - INTERVAL 20 DAY, '10:05')), v_doc_user, 'Blood pressure', '124/80', 'mmHg', 'Seated, sample reading', TRUE),
    (v_patient, a1, from_local(TIMESTAMP(v_today - INTERVAL 20 DAY, '10:06')), v_doc_user, 'Heart rate', '72', 'bpm', 'Sample reading', TRUE),
    (v_patient, a1, from_local(TIMESTAMP(v_today - INTERVAL 20 DAY, '10:07')), v_doc_user, 'Weight', '64', 'kg', NULL, TRUE);

  -- Orders
  INSERT INTO medication_orders (id, reference, patient_id, status, subtotal, delivery_fee, total, delivery_address, contact_phone, is_sample, created_at)
  VALUES (o1, 'ORD-DEMO0001', v_patient, 'delivered', 150, 49, 199, '12 Sample Street, Demo Nagar (fictional)', '+91 90000 00001', TRUE, UTC_TIMESTAMP(3) - INTERVAL 30 DAY);
  INSERT INTO medication_order_items (order_id, medicine_id, name, unit_price, quantity, line_total)
  SELECT o1, id, CONCAT(name, ' ', strength), price, 1, price FROM medicines WHERE slug IN ('paracetamol-500-mg', 'vitamin-d3-1000-iu');
  UPDATE medication_orders o
  JOIN (SELECT SUM(line_total) AS s FROM medication_order_items WHERE order_id = o1) t
  SET o.subtotal = t.s, o.total = 49 + t.s WHERE o.id = o1;
  INSERT INTO order_events (order_id, from_status, to_status, actor_id, created_at) VALUES
    (o1, NULL, 'placed', v_patient, UTC_TIMESTAMP(3) - INTERVAL 30 DAY),
    (o1, 'placed', 'processing', v_pharm, UTC_TIMESTAMP(3) - INTERVAL 29 DAY - INTERVAL 20 HOUR),
    (o1, 'processing', 'dispatched', v_pharm, UTC_TIMESTAMP(3) - INTERVAL 29 DAY),
    (o1, 'dispatched', 'delivered', v_pharm, UTC_TIMESTAMP(3) - INTERVAL 28 DAY);

  INSERT INTO medication_orders (id, reference, patient_id, prescription_id, status, subtotal, delivery_fee, total, delivery_address, contact_phone, is_sample)
  VALUES (o2, 'ORD-DEMO0002', v_patient, rx1, 'pending_review', 240, 49, 289, '12 Sample Street, Demo Nagar (fictional)', '+91 90000 00001', TRUE);
  INSERT INTO medication_order_items (order_id, medicine_id, name, unit_price, quantity, line_total, requires_prescription)
  SELECT o2, id, CONCAT(name, ' ', strength), price, 2, price * 2, TRUE FROM medicines WHERE slug = 'atorvastatin-10-mg';
  INSERT INTO order_events (order_id, from_status, to_status, actor_id) VALUES (o2, NULL, 'pending_review', v_patient);

  -- Donations & communications
  INSERT INTO donations (reference, cause_id, donor_id, donor_name, donor_email, amount, status, provider, message, is_sample)
  VALUES ('DON-DEMO0001', (SELECT id FROM donation_causes WHERE slug = 'patient-support-fund'), v_patient, 'Riya Sample',
          'patient@a10.example', 1000, 'simulated', 'demo', 'Sample donation — no money was collected.', TRUE);
  INSERT INTO contact_messages (name, email, subject, message, consent)
  VALUES ('Sample Visitor', 'visitor@a10.example', 'Parking information (sample)', 'This is a sample enquiry used to demonstrate the admin inbox.', TRUE);
  INSERT INTO notifications (user_id, kind, title, body, link) VALUES
    (v_patient, 'lab_report_final', 'Lab report available', 'A laboratory report (LAB-DEMO0001) is available in your patient portal.', CONCAT('/patient/lab-reports/', lab1)),
    (v_patient, 'appointment_confirmed', 'Appointment confirmed', 'Your appointment APT-DEMO0003 has been confirmed.', CONCAT('/patient/appointments/', a3));
END$$
DELIMITER ;

CALL load_demo_fixtures();
DROP PROCEDURE load_demo_fixtures;
