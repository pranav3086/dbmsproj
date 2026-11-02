-- A10 Hospital: the 8 tables from the ER diagram.
-- Run in the MySQL shell with:  SOURCE database/schema.sql;
-- WARNING: drops and recreates the a10_hospital database.

DROP DATABASE IF EXISTS a10_hospital;
CREATE DATABASE a10_hospital CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE a10_hospital;

-- 1. Department: a clinical department of the hospital
CREATE TABLE departments (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  slug        VARCHAR(60)  NOT NULL UNIQUE,
  name        VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  services    VARCHAR(500),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE
);

-- 2. Doctor: belongs to one department
CREATE TABLE doctors (
  id                   INT AUTO_INCREMENT PRIMARY KEY,
  full_name            VARCHAR(100) NOT NULL,
  speciality           VARCHAR(100) NOT NULL,
  years_experience     INT NOT NULL DEFAULT 0,
  consultation_fee     DECIMAL(10,2) NOT NULL,
  consultation_minutes INT NOT NULL DEFAULT 15,
  department_id        INT NOT NULL,
  CONSTRAINT chk_doctor_experience CHECK (years_experience >= 0),
  CONSTRAINT chk_doctor_fee        CHECK (consultation_fee >= 0),
  CONSTRAINT chk_doctor_minutes    CHECK (consultation_minutes > 0),
  CONSTRAINT fk_doctor_department  FOREIGN KEY (department_id) REFERENCES departments(id)
);

-- 3. Patient: a registered user who receives care
CREATE TABLE patients (
  id                      INT AUTO_INCREMENT PRIMARY KEY,
  email                   VARCHAR(150) NOT NULL UNIQUE,
  full_name               VARCHAR(100) NOT NULL,
  phone                   VARCHAR(20),
  date_of_birth           DATE,
  blood_group             ENUM('A+','A-','B+','B-','AB+','AB-','O+','O-'),
  address                 VARCHAR(255),
  emergency_contact_name  VARCHAR(100),
  emergency_contact_phone VARCHAR(20)
);

-- 4. Appointment: a booked visit between one patient and one doctor
CREATE TABLE appointments (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  reference     VARCHAR(20) NOT NULL UNIQUE,
  starts_at     DATETIME NOT NULL,
  ends_at       DATETIME NOT NULL,
  status        ENUM('booked','completed','cancelled','no_show') NOT NULL DEFAULT 'booked',
  reason        VARCHAR(255),
  patient_id    INT NOT NULL,
  doctor_id     INT NOT NULL,
  department_id INT NOT NULL,
  CONSTRAINT chk_appointment_time      CHECK (ends_at > starts_at),
  CONSTRAINT fk_appointment_patient    FOREIGN KEY (patient_id)    REFERENCES patients(id),
  CONSTRAINT fk_appointment_doctor     FOREIGN KEY (doctor_id)     REFERENCES doctors(id),
  CONSTRAINT fk_appointment_department FOREIGN KEY (department_id) REFERENCES departments(id)
);

-- 5. Medicine: a product in the hospital pharmacy catalogue
CREATE TABLE medicines (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  slug                  VARCHAR(80)  NOT NULL UNIQUE,
  name                  VARCHAR(100) NOT NULL,
  category              VARCHAR(60)  NOT NULL,
  strength              VARCHAR(40),
  price                 DECIMAL(10,2) NOT NULL,
  stock                 INT NOT NULL DEFAULT 0,
  requires_prescription BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT chk_medicine_price CHECK (price >= 0),
  CONSTRAINT chk_medicine_stock CHECK (stock >= 0)
);

-- 6. Prescription: medicines a doctor issues to a patient.
--    It is amended by issuing a new version that points at the old one (supersedes_id).
CREATE TABLE prescriptions (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  reference      VARCHAR(20) NOT NULL UNIQUE,
  status         ENUM('active','superseded','cancelled') NOT NULL DEFAULT 'active',
  version        INT NOT NULL DEFAULT 1,
  issued_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  patient_id     INT NOT NULL,
  doctor_id      INT NOT NULL,
  appointment_id INT,
  supersedes_id  INT,
  CONSTRAINT chk_prescription_version   CHECK (version >= 1),
  CONSTRAINT fk_prescription_patient     FOREIGN KEY (patient_id)     REFERENCES patients(id),
  CONSTRAINT fk_prescription_doctor      FOREIGN KEY (doctor_id)      REFERENCES doctors(id),
  CONSTRAINT fk_prescription_appointment FOREIGN KEY (appointment_id) REFERENCES appointments(id),
  CONSTRAINT fk_prescription_supersedes  FOREIGN KEY (supersedes_id)  REFERENCES prescriptions(id)
);

-- 7. Prescription item: one medicine line on a prescription (weak entity: deleted with its prescription)
CREATE TABLE prescription_items (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  medication_name VARCHAR(100) NOT NULL,
  dosage          VARCHAR(60)  NOT NULL,
  frequency       VARCHAR(60)  NOT NULL,
  duration        VARCHAR(60)  NOT NULL,
  quantity        INT NOT NULL,
  prescription_id INT NOT NULL,
  medicine_id     INT,
  CONSTRAINT chk_item_quantity CHECK (quantity > 0),
  CONSTRAINT fk_item_prescription FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE CASCADE,
  CONSTRAINT fk_item_medicine     FOREIGN KEY (medicine_id)     REFERENCES medicines(id)
);

-- 8. Medication order: a patient's pharmacy order, optionally backed by a prescription
CREATE TABLE medication_orders (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  reference        VARCHAR(20) NOT NULL UNIQUE,
  status           ENUM('placed','packed','dispatched','delivered','cancelled') NOT NULL DEFAULT 'placed',
  subtotal         DECIMAL(10,2) NOT NULL,
  delivery_fee     DECIMAL(10,2) NOT NULL DEFAULT 0,
  total            DECIMAL(10,2) NOT NULL,
  delivery_address VARCHAR(255) NOT NULL,
  patient_id       INT NOT NULL,
  prescription_id  INT,
  CONSTRAINT chk_order_amounts CHECK (subtotal >= 0 AND delivery_fee >= 0),
  CONSTRAINT chk_order_total   CHECK (total = subtotal + delivery_fee),
  CONSTRAINT fk_order_patient      FOREIGN KEY (patient_id)      REFERENCES patients(id),
  CONSTRAINT fk_order_prescription FOREIGN KEY (prescription_id) REFERENCES prescriptions(id)
);
