-- Example queries to show in the review. Paste them one at a time into the MySQL shell.
USE a10_hospital;

-- Structure
SHOW TABLES;
DESCRIBE appointments;
SHOW CREATE TABLE prescription_items;

-- Doctors with their department (JOIN)
SELECT d.full_name, d.speciality, dep.name AS department, d.consultation_fee
FROM doctors d JOIN departments dep ON dep.id = d.department_id
ORDER BY dep.name;

-- Upcoming appointments with patient and doctor names
SELECT a.reference, a.starts_at, p.full_name AS patient, d.full_name AS doctor, a.status
FROM appointments a
JOIN patients p ON p.id = a.patient_id
JOIN doctors d  ON d.id = a.doctor_id
WHERE a.status = 'booked'
ORDER BY a.starts_at;

-- Number of doctors per department, including departments with none (LEFT JOIN + GROUP BY)
SELECT dep.name, COUNT(d.id) AS doctors
FROM departments dep LEFT JOIN doctors d ON d.department_id = dep.id
GROUP BY dep.id, dep.name;

-- Each prescription with its medicine lines
SELECT rx.reference, rx.version, rx.status, i.medication_name, i.dosage, i.frequency, i.quantity
FROM prescriptions rx JOIN prescription_items i ON i.prescription_id = rx.id
ORDER BY rx.reference;

-- Which prescription each amended version replaced (self join)
SELECT new_rx.reference AS new_version, old_rx.reference AS replaces
FROM prescriptions new_rx JOIN prescriptions old_rx ON old_rx.id = new_rx.supersedes_id;

-- Total spent on pharmacy orders per patient (aggregate + HAVING)
SELECT p.full_name, COUNT(o.id) AS orders, SUM(o.total) AS total_spent
FROM patients p JOIN medication_orders o ON o.patient_id = p.id
WHERE o.status <> 'cancelled'
GROUP BY p.id, p.full_name
HAVING SUM(o.total) > 200;

-- Medicines never prescribed (subquery)
SELECT name, strength FROM medicines
WHERE id NOT IN (SELECT medicine_id FROM prescription_items WHERE medicine_id IS NOT NULL);

-- Doctors who charge more than the average fee (subquery with an aggregate)
SELECT full_name, consultation_fee FROM doctors
WHERE consultation_fee > (SELECT AVG(consultation_fee) FROM doctors)
ORDER BY consultation_fee DESC;

-- Patients who have never placed a pharmacy order (correlated subquery)
SELECT p.full_name, p.email FROM patients p
WHERE NOT EXISTS (SELECT 1 FROM medication_orders o WHERE o.patient_id = p.id);

-- Inserting values
INSERT INTO patients (email, full_name, phone, date_of_birth, blood_group, address)
VALUES ('sanjay.v@example.com', 'Sanjay Verma', '9876500007', '1995-08-01', 'B-', '5 Civil Lines, Jaipur');

INSERT INTO appointments (reference, starts_at, ends_at, reason, patient_id, doctor_id, department_id)
VALUES ('APT-1009', '2026-11-05 11:00:00', '2026-11-05 11:10:00', 'Headache', LAST_INSERT_ID(), 6, 5);

-- Updating and deleting
UPDATE appointments SET status = 'completed' WHERE reference = 'APT-1007';
UPDATE medicines SET stock = stock - 10 WHERE slug = 'paracetamol-500';
DELETE FROM appointments WHERE reference = 'APT-1009';

-- Constraints in action (each of these is rejected)
INSERT INTO doctors (full_name, speciality, consultation_fee, department_id) VALUES ('Dr. Test', 'Test', 100, 99);   -- foreign key
INSERT INTO patients (email, full_name) VALUES ('rahul.sharma@example.com', 'Duplicate');                         -- unique email
INSERT INTO medicines (slug, name, category, price) VALUES ('bad', 'Bad', 'Test', -5);                              -- check price >= 0

-- Functions, procedures, cursors and triggers (database/plsql.sql)
SHOW FUNCTION STATUS WHERE Db = 'a10_hospital';
SHOW PROCEDURE STATUS WHERE Db = 'a10_hospital';
SHOW TRIGGERS;

SELECT full_name, fn_patient_age(date_of_birth) AS age FROM patients;
SELECT full_name, fn_doctor_earnings(id) AS earnings FROM doctors ORDER BY earnings DESC;
SELECT fn_delivery_fee(400) AS small_order, fn_delivery_fee(7500) AS large_order;

CALL sp_book_appointment(2, 6, '2026-11-10 10:00:00', 'Follow-up for fever', @apt);
SELECT @apt;
CALL sp_amend_prescription('RX-2004', @rx);
SELECT reference, status, version, supersedes_id FROM prescriptions;
CALL sp_place_order(@rx, '7 Park Street, Kolkata', @ord);                -- cursor over the medicine lines
SELECT * FROM medication_orders WHERE reference = @ord;
CALL sp_department_report();                                             -- cursor over the departments

-- Triggers in action (each of these is rejected)
CALL sp_book_appointment(3, 6, '2026-11-10 10:05:00', 'Clash', @x);      -- clashes with the booking above
CALL sp_book_appointment(3, 8, '2026-11-12 10:00:00', 'Headache', @x);   -- Neurology is not active
UPDATE appointments SET status = 'booked' WHERE reference = 'APT-1001';  -- already completed
CALL sp_amend_prescription('RX-2001', @x);                               -- already superseded
