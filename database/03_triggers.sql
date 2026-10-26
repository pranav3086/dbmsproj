-- Triggers: new-account bootstrap and integrity rules that CHECK constraints cannot express.
-- (Row audit triggers are generated separately in 04_audit_triggers.sql.)
USE a10_hospital;

DELIMITER $$

-- ───────────────────────────── New-user bootstrap ─────────────────────────────
-- Metadata supplied at sign-up is user-controlled, so it can only ever lead to
-- (a) a patient role, (b) a *pending* doctor application, or (c) staff access backed by a
-- valid, unexpired invitation addressed to this exact email. Never to admin.
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth_users
FOR EACH ROW
BEGIN
  DECLARE m JSON DEFAULT COALESCE(NEW.raw_user_meta_data, JSON_OBJECT());
  DECLARE v_type VARCHAR(20) DEFAULT COALESCE(jtext(m, 'account_type'), 'patient');
  DECLARE v_phone TEXT DEFAULT NULLIF(jtext(m, 'phone'), '');
  DECLARE v_dob_text TEXT DEFAULT jtext(m, 'date_of_birth');
  DECLARE v_dob DATE DEFAULT NULL;
  DECLARE v_name VARCHAR(120) DEFAULT LEFT(COALESCE(jtext(m, 'full_name'), ''), 120);
  DECLARE v_years TEXT DEFAULT jtext(m, 'years_experience');
  DECLARE v_quals JSON;
  DECLARE v_dept CHAR(36);
  DECLARE v_inv_id CHAR(36);
  DECLARE v_inv_by CHAR(36);
  DECLARE v_inv_perms JSON;

  IF v_phone IS NOT NULL AND NOT REGEXP_LIKE(v_phone, '^[0-9+() -]{6,20}$') THEN SET v_phone = NULL; END IF;
  IF REGEXP_LIKE(COALESCE(v_dob_text, ''), '^[0-9]{4}-[0-9]{2}-[0-9]{2}$') THEN
    SET v_dob = STR_TO_DATE(v_dob_text, '%Y-%m-%d');
    IF v_dob < '1900-01-01' OR v_dob > UTC_DATE() THEN SET v_dob = NULL; END IF;
  END IF;

  INSERT INTO profiles (id, email, full_name, phone, date_of_birth)
  VALUES (NEW.id, LOWER(NEW.email), v_name, v_phone, v_dob);

  IF v_type = 'doctor' THEN
    SELECT id INTO v_dept FROM departments WHERE id = jtext(m, 'department_id');
    SELECT COALESCE(JSON_ARRAYAGG(LEFT(q.v, 120)), JSON_ARRAY()) INTO v_quals
    FROM JSON_TABLE(
      IF(JSON_TYPE(JSON_EXTRACT(m, '$.qualifications')) = 'ARRAY', JSON_EXTRACT(m, '$.qualifications'), JSON_ARRAY()),
      '$[*]' COLUMNS (v VARCHAR(500) PATH '$')
    ) q;
    INSERT INTO doctor_applications (
      user_id, full_name, email, phone, licence_number, qualifications, speciality, department_id, years_experience
    ) VALUES (
      NEW.id, v_name, LOWER(NEW.email), v_phone, LEFT(COALESCE(jtext(m, 'licence_number'), ''), 60), v_quals,
      LEFT(COALESCE(jtext(m, 'speciality'), ''), 80), v_dept,
      IF(REGEXP_LIKE(COALESCE(v_years, ''), '^[0-9]{1,2}$'), CAST(v_years AS UNSIGNED), NULL)
    );
  ELSEIF v_type = 'staff' THEN
    SELECT id, invited_by, permissions INTO v_inv_id, v_inv_by, v_inv_perms
    FROM employee_invitations
    WHERE token = jtext(m, 'invite_token') AND email = LOWER(NEW.email)
      AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > UTC_TIMESTAMP(3)
    LIMIT 1;
    IF v_inv_id IS NOT NULL THEN
      INSERT INTO user_roles (user_id, role, granted_by) VALUES (NEW.id, 'staff', v_inv_by);
      INSERT IGNORE INTO staff_permissions (user_id, permission, granted_by)
      SELECT NEW.id, p.v, v_inv_by FROM JSON_TABLE(v_inv_perms, '$[*]' COLUMNS (v VARCHAR(30) PATH '$')) p;
      UPDATE employee_invitations SET accepted_at = UTC_TIMESTAMP(3), accepted_by = NEW.id WHERE id = v_inv_id;
    END IF;
  ELSE
    INSERT INTO user_roles (user_id, role) VALUES (NEW.id, 'patient');
  END IF;
END$$

CREATE TRIGGER on_auth_user_email_changed AFTER UPDATE ON auth_users
FOR EACH ROW
BEGIN
  IF NOT (NEW.email <=> OLD.email) THEN
    UPDATE profiles SET email = LOWER(NEW.email) WHERE id = NEW.id;
  END IF;
END$$

-- ───────────────────────────── Integrity rules ─────────────────────────────
-- CHECK constraints cannot call CURDATE(), so "not in the future" is a trigger.
CREATE TRIGGER profiles_dob_insert BEFORE INSERT ON profiles
FOR EACH ROW
BEGIN
  IF NEW.date_of_birth > UTC_DATE() THEN CALL fail('Date of birth cannot be in the future.'); END IF;
END$$

CREATE TRIGGER profiles_dob_update BEFORE UPDATE ON profiles
FOR EACH ROW
BEGIN
  IF NEW.date_of_birth > UTC_DATE() THEN CALL fail('Date of birth cannot be in the future.'); END IF;
END$$

-- Prevent overlapping availability windows for the same doctor and weekday.
CREATE TRIGGER availability_no_overlap_insert BEFORE INSERT ON doctor_availability
FOR EACH ROW
BEGIN
  IF EXISTS (
    SELECT 1 FROM doctor_availability a
    WHERE a.doctor_id = NEW.doctor_id AND a.weekday = NEW.weekday
      AND a.start_time < NEW.end_time AND a.end_time > NEW.start_time
  ) THEN
    CALL fail('This window overlaps existing working hours on the same day.');
  END IF;
END$$

CREATE TRIGGER availability_no_overlap_update BEFORE UPDATE ON doctor_availability
FOR EACH ROW
BEGIN
  IF EXISTS (
    SELECT 1 FROM doctor_availability a
    WHERE a.doctor_id = NEW.doctor_id AND a.weekday = NEW.weekday AND a.id <> NEW.id
      AND a.start_time < NEW.end_time AND a.end_time > NEW.start_time
  ) THEN
    CALL fail('This window overlaps existing working hours on the same day.');
  END IF;
END$$

-- Stock can only change together with a recorded inventory movement: procedures that change
-- stock set @stock_movement_reason first, and this trigger writes the movement row.
CREATE TRIGGER medicines_stock_movement AFTER UPDATE ON medicines
FOR EACH ROW
BEGIN
  IF NEW.stock <> OLD.stock THEN
    IF @stock_movement_reason IS NULL THEN
      CALL deny('Stock changes must go through a recorded inventory adjustment.');
    END IF;
    INSERT INTO inventory_movements (medicine_id, `change`, reason, order_id, actor_id)
    VALUES (NEW.id, NEW.stock - OLD.stock, @stock_movement_reason, @stock_movement_order, app_uid());
  END IF;
END$$

DELIMITER ;
