-- Sample data for the 8 tables. Run after schema.sql:  SOURCE database/seed.sql;
-- All people below are fictional.
USE a10_hospital;

INSERT INTO departments (slug, name, description, services, is_active) VALUES
('cardiology',    'Cardiology',    'Heart and blood vessel care',          'ECG, Echocardiography, Stress test',     TRUE),
('orthopaedics',  'Orthopaedics',  'Bones, joints and sports injuries',    'Fracture care, Joint replacement, Physio', TRUE),
('paediatrics',   'Paediatrics',   'Care for infants, children and teens', 'Vaccination, Growth checks',             TRUE),
('dermatology',   'Dermatology',   'Skin, hair and nail conditions',       'Acne care, Allergy testing',             TRUE),
('general-medicine', 'General Medicine', 'Everyday illness and check-ups', 'Health check-up, Fever clinic',         TRUE),
('neurology',     'Neurology',     'Brain, spine and nerve disorders',     'EEG, Headache clinic',                   FALSE);

INSERT INTO doctors (full_name, speciality, years_experience, consultation_fee, consultation_minutes, department_id) VALUES
('Dr. Ananya Rao',     'Interventional Cardiologist', 14, 900.00, 20, 1),
('Dr. Vikram Menon',   'Cardiologist',                 8, 700.00, 15, 1),
('Dr. Farhan Qureshi', 'Orthopaedic Surgeon',         12, 800.00, 20, 2),
('Dr. Meera Iyer',     'Paediatrician',               10, 600.00, 15, 3),
('Dr. Kavya Nair',     'Dermatologist',                6, 650.00, 15, 4),
('Dr. Rohan Das',      'General Physician',           18, 500.00, 10, 5),
('Dr. Sneha Kulkarni', 'General Physician',            4, 400.00, 10, 5),
('Dr. Arjun Pillai',   'Neurologist',                 15, 1000.00, 30, 6);

INSERT INTO patients (email, full_name, phone, date_of_birth, blood_group, address, emergency_contact_name, emergency_contact_phone) VALUES
('rahul.sharma@example.com', 'Rahul Sharma', '9876500001', '1990-04-12', 'B+',  '12 MG Road, Bengaluru',      'Priya Sharma', '9876500101'),
('aisha.khan@example.com',   'Aisha Khan',   '9876500002', '1985-09-23', 'O+',  '7 Park Street, Kolkata',     'Imran Khan',   '9876500102'),
('karthik.r@example.com',    'Karthik R',    '9876500003', '2015-01-30', 'A+',  '45 Anna Nagar, Chennai',     'Lakshmi R',    '9876500103'),
('neha.gupta@example.com',   'Neha Gupta',   '9876500004', '1998-06-05', 'AB-', '3 Sector 15, Noida',         'Amit Gupta',   '9876500104'),
('joseph.d@example.com',     'Joseph D''Souza', '9876500005', '1972-12-18', 'O-', '21 Panjim Road, Goa',      'Maria D''Souza', '9876500105'),
('divya.patel@example.com',  'Divya Patel',  '9876500006', '2001-03-14', 'A-',  '9 CG Road, Ahmedabad',       'Ravi Patel',   '9876500106');

INSERT INTO appointments (reference, starts_at, ends_at, status, reason, patient_id, doctor_id, department_id) VALUES
('APT-1001', '2026-10-20 10:00:00', '2026-10-20 10:20:00', 'completed', 'Chest pain on exertion',   1, 1, 1),
('APT-1002', '2026-10-21 11:00:00', '2026-10-21 11:20:00', 'completed', 'Knee pain after running',  4, 3, 2),
('APT-1003', '2026-10-22 09:30:00', '2026-10-22 09:45:00', 'completed', 'Routine vaccination',      3, 4, 3),
('APT-1004', '2026-10-23 16:00:00', '2026-10-23 16:10:00', 'completed', 'Fever and cough',          2, 6, 5),
('APT-1005', '2026-10-24 12:00:00', '2026-10-24 12:15:00', 'no_show',   'Skin rash',                6, 5, 4),
('APT-1006', '2026-10-26 15:00:00', '2026-10-26 15:10:00', 'cancelled', 'Annual check-up',          5, 7, 5),
('APT-1007', '2026-11-02 10:30:00', '2026-11-02 10:50:00', 'booked',    'Follow-up after ECG',      1, 1, 1),
('APT-1008', '2026-11-03 14:00:00', '2026-11-03 14:15:00', 'booked',    'Acne treatment',           6, 5, 4);

INSERT INTO medicines (slug, name, category, strength, price, stock, requires_prescription) VALUES
('paracetamol-500',  'Paracetamol',  'Pain relief',     '500 mg', 25.00, 500, FALSE),
('amoxicillin-500',  'Amoxicillin',  'Antibiotic',      '500 mg', 120.00, 200, TRUE),
('atorvastatin-10',  'Atorvastatin', 'Cardiac',         '10 mg',  95.00, 150, TRUE),
('aspirin-75',       'Aspirin',      'Cardiac',         '75 mg',  30.00, 300, FALSE),
('ibuprofen-400',    'Ibuprofen',    'Pain relief',     '400 mg', 40.00, 250, FALSE),
('cetirizine-10',    'Cetirizine',   'Allergy',         '10 mg',  20.00, 400, FALSE),
('azithromycin-500', 'Azithromycin', 'Antibiotic',      '500 mg', 110.00, 120, TRUE),
('vitamin-d3-60k',   'Vitamin D3',   'Supplement',      '60000 IU', 60.00, 180, FALSE);

-- Prescription 3 amends prescription 1 (version 2), so prescription 1 is marked superseded.
INSERT INTO prescriptions (reference, status, version, issued_at, patient_id, doctor_id, appointment_id, supersedes_id) VALUES
('RX-2001', 'superseded', 1, '2026-10-20 10:25:00', 1, 1, 1, NULL),
('RX-2002', 'active',     1, '2026-10-21 11:25:00', 4, 3, 2, NULL),
('RX-2003', 'active',     2, '2026-10-21 09:00:00', 1, 1, 1, 1),
('RX-2004', 'active',     1, '2026-10-23 16:15:00', 2, 6, 4, NULL);

INSERT INTO prescription_items (medication_name, dosage, frequency, duration, quantity, prescription_id, medicine_id) VALUES
('Atorvastatin', '1 tablet',  'Once at night',   '30 days', 30, 1, 3),
('Aspirin',      '1 tablet',  'Once daily',      '30 days', 30, 1, 4),
('Ibuprofen',    '1 tablet',  'Twice daily after food', '5 days', 10, 2, 5),
('Atorvastatin', '1 tablet',  'Once at night',   '60 days', 60, 3, 3),
('Aspirin',      '1 tablet',  'Once daily',      '60 days', 60, 3, 4),
('Paracetamol',  '1 tablet',  'Every 6 hours if fever', '3 days', 12, 4, 1),
('Azithromycin', '1 tablet',  'Once daily',      '3 days',  3, 4, 7),
('Steam inhalation', '10 minutes', 'Twice daily', '5 days', 10, 4, NULL);

INSERT INTO medication_orders (reference, status, subtotal, delivery_fee, total, delivery_address, patient_id, prescription_id) VALUES
('ORD-3001', 'delivered',  7500.00, 0.00,  7500.00, '12 MG Road, Bengaluru',  1, 3),
('ORD-3002', 'dispatched',  400.00, 40.00,  440.00, '3 Sector 15, Noida',     4, 2),
('ORD-3003', 'placed',      630.00, 40.00,  670.00, '7 Park Street, Kolkata', 2, 4),
('ORD-3004', 'packed',      120.00, 40.00,  160.00, '9 CG Road, Ahmedabad',   6, NULL);
