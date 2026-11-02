-- A10 Hospital: functions, procedures, cursors and triggers on the 8 tables.
-- Run in the MySQL shell after schema.sql and seed.sql with:  SOURCE database/plsql.sql;
-- (npm run db:setup loads it automatically.)
USE a10_hospital;

DROP FUNCTION  IF EXISTS fn_patient_age;
DROP FUNCTION  IF EXISTS fn_delivery_fee;
DROP FUNCTION  IF EXISTS fn_doctor_earnings;
DROP PROCEDURE IF EXISTS sp_book_appointment;
DROP PROCEDURE IF EXISTS sp_amend_prescription;
DROP PROCEDURE IF EXISTS sp_place_order;
DROP PROCEDURE IF EXISTS sp_department_report;
DROP TRIGGER   IF EXISTS trg_appointment_before_insert;
DROP TRIGGER   IF EXISTS trg_appointment_before_update;
DROP TRIGGER   IF EXISTS trg_prescription_before_insert;
DROP TRIGGER   IF EXISTS trg_order_before_insert;

DELIMITER $$

-- ═════════════════════════════ Functions ═════════════════════════════

-- Age in whole years from a date of birth (NULL if the date is unknown).
CREATE FUNCTION fn_patient_age(p_dob DATE)
RETURNS INT
NOT DETERMINISTIC NO SQL
BEGIN
  IF p_dob IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN TIMESTAMPDIFF(YEAR, p_dob, CURDATE());
END$$

-- Pharmacy delivery charge: free for orders above Rs 1000, otherwise a flat Rs 40.
CREATE FUNCTION fn_delivery_fee(p_subtotal DECIMAL(10,2))
RETURNS DECIMAL(10,2)
DETERMINISTIC NO SQL
BEGIN
  IF p_subtotal > 1000 THEN
    RETURN 0.00;
  END IF;
  RETURN 40.00;
END$$

-- Consultation fees a doctor has earned from completed appointments.
CREATE FUNCTION fn_doctor_earnings(p_doctor_id INT)
RETURNS DECIMAL(10,2)
READS SQL DATA
BEGIN
  DECLARE v_total DECIMAL(10,2);
  SELECT COALESCE(SUM(d.consultation_fee), 0) INTO v_total
  FROM appointments a JOIN doctors d ON d.id = a.doctor_id
  WHERE a.doctor_id = p_doctor_id AND a.status = 'completed';
  RETURN v_total;
END$$

-- ═════════════════════════════ Procedures ═════════════════════════════

-- Books an appointment. The end time comes from the doctor's consultation length and the
-- department from the doctor. Rejects past times and slots that clash with the doctor's
-- other booked appointments. Returns the new reference (e.g. APT-1009) in p_reference.
CREATE PROCEDURE sp_book_appointment(
  IN  p_patient_id INT,
  IN  p_doctor_id  INT,
  IN  p_starts_at  DATETIME,
  IN  p_reason     VARCHAR(255),
  OUT p_reference  VARCHAR(20))
BEGIN
  DECLARE v_minutes INT;
  DECLARE v_department_id INT;
  DECLARE v_ends_at DATETIME;

  SELECT consultation_minutes, department_id INTO v_minutes, v_department_id
  FROM doctors WHERE id = p_doctor_id;
  IF v_minutes IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No such doctor';
  END IF;
  IF p_starts_at <= NOW() THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Appointments must be booked in the future';
  END IF;

  SET v_ends_at = p_starts_at + INTERVAL v_minutes MINUTE;
  IF EXISTS (SELECT 1 FROM appointments
             WHERE doctor_id = p_doctor_id AND status = 'booked'
               AND starts_at < v_ends_at AND ends_at > p_starts_at) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'The doctor already has an appointment at that time';
  END IF;

  SELECT CONCAT('APT-', COALESCE(MAX(CAST(SUBSTRING(reference, 5) AS UNSIGNED)), 1000) + 1)
  INTO p_reference FROM appointments;

  INSERT INTO appointments (reference, starts_at, ends_at, reason, patient_id, doctor_id, department_id)
  VALUES (p_reference, p_starts_at, v_ends_at, p_reason, p_patient_id, p_doctor_id, v_department_id);
END$$

-- Amends a prescription: issues a new version with a copy of its medicine lines and marks
-- the old one superseded, all in one transaction. Returns the new reference in p_new_reference.
CREATE PROCEDURE sp_amend_prescription(
  IN  p_reference     VARCHAR(20),
  OUT p_new_reference VARCHAR(20))
BEGIN
  DECLARE v_old_id INT;
  DECLARE v_new_id INT;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;
  SELECT id INTO v_old_id FROM prescriptions WHERE reference = p_reference FOR UPDATE;
  IF v_old_id IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No such prescription';
  END IF;

  SELECT CONCAT('RX-', MAX(CAST(SUBSTRING(reference, 4) AS UNSIGNED)) + 1)
  INTO p_new_reference FROM prescriptions;

  -- trg_prescription_before_insert checks the old version is active and sets the version number.
  INSERT INTO prescriptions (reference, patient_id, doctor_id, appointment_id, supersedes_id)
  SELECT p_new_reference, patient_id, doctor_id, appointment_id, id
  FROM prescriptions WHERE id = v_old_id;
  SET v_new_id = LAST_INSERT_ID();

  INSERT INTO prescription_items (medication_name, dosage, frequency, duration, quantity, prescription_id, medicine_id)
  SELECT medication_name, dosage, frequency, duration, quantity, v_new_id, medicine_id
  FROM prescription_items WHERE prescription_id = v_old_id;

  UPDATE prescriptions SET status = 'superseded' WHERE id = v_old_id;
  COMMIT;
END$$

-- Places a pharmacy order for an active prescription. A CURSOR walks through the
-- prescription's medicine lines: for each one it checks the stock, adds price x quantity to
-- the subtotal and takes the quantity out of stock. If any medicine is short, the whole order
-- is rolled back. Lines with no catalogue medicine (e.g. steam inhalation) are skipped.
CREATE PROCEDURE sp_place_order(
  IN  p_prescription_ref VARCHAR(20),
  IN  p_address          VARCHAR(255),
  OUT p_order_reference  VARCHAR(20))
BEGIN
  DECLARE v_prescription_id INT;
  DECLARE v_patient_id INT;
  DECLARE v_status VARCHAR(20);
  DECLARE v_subtotal DECIMAL(10,2) DEFAULT 0;
  DECLARE v_medicine_id INT;
  DECLARE v_quantity INT;
  DECLARE v_price DECIMAL(10,2);
  DECLARE v_stock INT;
  DECLARE v_name VARCHAR(100);
  DECLARE v_done BOOLEAN DEFAULT FALSE;

  DECLARE item_cursor CURSOR FOR
    SELECT medicine_id, quantity FROM prescription_items
    WHERE prescription_id = v_prescription_id AND medicine_id IS NOT NULL;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = TRUE;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;
  SELECT id, patient_id, status INTO v_prescription_id, v_patient_id, v_status
  FROM prescriptions WHERE reference = p_prescription_ref;
  IF v_prescription_id IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No such prescription';
  END IF;
  IF v_status <> 'active' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only an active prescription can be ordered';
  END IF;

  OPEN item_cursor;
  read_loop: LOOP
    FETCH item_cursor INTO v_medicine_id, v_quantity;
    IF v_done THEN
      LEAVE read_loop;
    END IF;

    SELECT name, price, stock INTO v_name, v_price, v_stock
    FROM medicines WHERE id = v_medicine_id FOR UPDATE;
    IF v_stock < v_quantity THEN
      SET @msg = CONCAT('Not enough stock of ', v_name, ' (', v_stock, ' left, ', v_quantity, ' needed)');
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = @msg;
    END IF;

    SET v_subtotal = v_subtotal + v_price * v_quantity;
    UPDATE medicines SET stock = stock - v_quantity WHERE id = v_medicine_id;
  END LOOP;
  CLOSE item_cursor;

  SELECT CONCAT('ORD-', MAX(CAST(SUBSTRING(reference, 5) AS UNSIGNED)) + 1)
  INTO p_order_reference FROM medication_orders;

  -- trg_order_before_insert fills in total = subtotal + delivery_fee.
  INSERT INTO medication_orders (reference, subtotal, delivery_fee, delivery_address, patient_id, prescription_id)
  VALUES (p_order_reference, v_subtotal, fn_delivery_fee(v_subtotal), p_address, v_patient_id, v_prescription_id);
  COMMIT;
END$$

-- Department report. A CURSOR goes through the departments one by one and, for each,
-- counts its doctors and appointments and adds up its doctors' earnings (fn_doctor_earnings).
CREATE PROCEDURE sp_department_report()
BEGIN
  DECLARE v_id INT;
  DECLARE v_name VARCHAR(100);
  DECLARE v_active BOOLEAN;
  DECLARE v_done BOOLEAN DEFAULT FALSE;

  DECLARE dept_cursor CURSOR FOR SELECT id, name, is_active FROM departments ORDER BY name;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = TRUE;

  DROP TEMPORARY TABLE IF EXISTS tmp_department_report;
  CREATE TEMPORARY TABLE tmp_department_report (
    department   VARCHAR(100),
    active       VARCHAR(3),
    doctors      INT,
    appointments INT,
    earnings     DECIMAL(10,2)
  );

  OPEN dept_cursor;
  dept_loop: LOOP
    FETCH dept_cursor INTO v_id, v_name, v_active;
    IF v_done THEN
      LEAVE dept_loop;
    END IF;

    INSERT INTO tmp_department_report
    SELECT v_name, IF(v_active, 'Yes', 'No'),
           (SELECT COUNT(*) FROM doctors WHERE department_id = v_id),
           (SELECT COUNT(*) FROM appointments WHERE department_id = v_id),
           (SELECT COALESCE(SUM(fn_doctor_earnings(id)), 0) FROM doctors WHERE department_id = v_id);
  END LOOP;
  CLOSE dept_cursor;

  SELECT * FROM tmp_department_report;
  DROP TEMPORARY TABLE tmp_department_report;
END$$

-- ═════════════════════════════ Triggers ═════════════════════════════

-- A new appointment must be in the doctor's own department, and that department must be open.
CREATE TRIGGER trg_appointment_before_insert
BEFORE INSERT ON appointments
FOR EACH ROW
BEGIN
  DECLARE v_doctor_department INT;
  DECLARE v_active BOOLEAN;

  SELECT department_id INTO v_doctor_department FROM doctors WHERE id = NEW.doctor_id;
  IF v_doctor_department <> NEW.department_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'The doctor does not work in that department';
  END IF;

  SELECT is_active INTO v_active FROM departments WHERE id = NEW.department_id;
  IF NOT v_active THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'That department is not taking appointments';
  END IF;
END$$

-- Appointment status can only move forward from 'booked'
-- (booked -> completed / cancelled / no_show); a finished appointment can't be changed back.
CREATE TRIGGER trg_appointment_before_update
BEFORE UPDATE ON appointments
FOR EACH ROW
BEGIN
  IF NEW.status <> OLD.status AND OLD.status <> 'booked' THEN
    SET @msg = CONCAT('Appointment ', OLD.reference, ' is already ', OLD.status, ' and cannot be changed to ', NEW.status);
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = @msg;
  END IF;
END$$

-- A new version of a prescription must replace an active prescription of the same patient,
-- and gets the next version number automatically.
CREATE TRIGGER trg_prescription_before_insert
BEFORE INSERT ON prescriptions
FOR EACH ROW
BEGIN
  DECLARE v_status VARCHAR(20);
  DECLARE v_version INT;
  DECLARE v_patient_id INT;

  IF NEW.supersedes_id IS NOT NULL THEN
    SELECT status, version, patient_id INTO v_status, v_version, v_patient_id
    FROM prescriptions WHERE id = NEW.supersedes_id;
    IF v_status <> 'active' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only an active prescription can be amended';
    END IF;
    IF v_patient_id <> NEW.patient_id THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'The new version must be for the same patient';
    END IF;
    SET NEW.version = v_version + 1;
  END IF;
END$$

-- The order total is always computed as subtotal + delivery fee, and an order that cites a
-- prescription must use an active prescription of the same patient.
CREATE TRIGGER trg_order_before_insert
BEFORE INSERT ON medication_orders
FOR EACH ROW
BEGIN
  DECLARE v_status VARCHAR(20);
  DECLARE v_patient_id INT;

  SET NEW.total = NEW.subtotal + NEW.delivery_fee;

  IF NEW.prescription_id IS NOT NULL THEN
    SELECT status, patient_id INTO v_status, v_patient_id
    FROM prescriptions WHERE id = NEW.prescription_id;
    IF v_patient_id <> NEW.patient_id THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'That prescription belongs to another patient';
    END IF;
    IF v_status <> 'active' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only an active prescription can be ordered';
    END IF;
  END IF;
END$$

DELIMITER ;
