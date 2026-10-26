-- Helper functions: caller identity, role and permission checks, notifications and audit.
--
-- How the database knows who is calling
--   MySQL has no row-level security, so identity is carried in a session variable. For every
--   request the API server runs   SET @app_session_token = '<browser session token>'
--   and app_uid() resolves it against auth_sessions. The application account cannot read
--   auth_sessions, so it cannot pick an identity: it can only present a token it was given at
--   sign-in. Every view and procedure decides access from app_uid().
USE a10_hospital;

DELIMITER $$

-- ───────────────────────────── Identity ─────────────────────────────
CREATE FUNCTION app_uid() RETURNS CHAR(36)
READS SQL DATA
SQL SECURITY DEFINER
BEGIN
  IF @app_session_token IS NULL OR @app_session_token = '' THEN
    RETURN NULL;
  END IF;
  RETURN (
    SELECT s.user_id FROM auth_sessions s
    WHERE s.token_hash = SHA2(@app_session_token, 256) AND s.expires_at > UTC_TIMESTAMP(3)
  );
END$$

CREATE FUNCTION has_role(p_role VARCHAR(20)) RETURNS BOOLEAN
READS SQL DATA
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles r
    JOIN profiles p ON p.id = r.user_id
    WHERE r.user_id = app_uid() AND r.role = p_role AND p.is_active
  );
END$$

CREATE FUNCTION is_admin() RETURNS BOOLEAN
READS SQL DATA
BEGIN
  RETURN has_role('admin');
END$$

CREATE FUNCTION has_permission(p_permission VARCHAR(30)) RETURNS BOOLEAN
READS SQL DATA
BEGIN
  RETURN has_role('staff') AND EXISTS (
    SELECT 1 FROM staff_permissions sp WHERE sp.user_id = app_uid() AND sp.permission = p_permission
  );
END$$

-- The doctors.id of the signed-in doctor, or NULL.
CREATE FUNCTION my_doctor_id() RETURNS CHAR(36)
READS SQL DATA
BEGIN
  IF NOT has_role('doctor') THEN RETURN NULL; END IF;
  RETURN (SELECT d.id FROM doctors d WHERE d.user_id = app_uid() AND d.is_active);
END$$

-- Clinical access policy: an approved doctor may access a patient's records once the
-- patient has a (non-cancelled) appointment with that doctor.
CREATE FUNCTION doctor_can_access_patient(p_patient_id CHAR(36)) RETURNS BOOLEAN
READS SQL DATA
BEGIN
  DECLARE v_doctor CHAR(36) DEFAULT my_doctor_id();
  RETURN v_doctor IS NOT NULL AND EXISTS (
    SELECT 1 FROM appointments a
    WHERE a.patient_id = p_patient_id AND a.doctor_id = v_doctor AND a.status <> 'cancelled'
  );
END$$

-- ───────────────────────────── Small utilities ─────────────────────────────
CREATE FUNCTION setting_text(p_key VARCHAR(80)) RETURNS TEXT
READS SQL DATA
BEGIN
  RETURN (SELECT JSON_UNQUOTE(value) FROM settings WHERE `key` = p_key);
END$$

-- India has no daylight saving, so a fixed UTC offset is exact. MySQL on Windows ships
-- without named time-zone tables, which is why the offset is stored rather than the IANA name.
CREATE FUNCTION hospital_offset() RETURNS VARCHAR(6)
READS SQL DATA
BEGIN
  RETURN COALESCE(setting_text('timezone_offset'), '+05:30');
END$$

CREATE FUNCTION to_local(p_ts DATETIME(3)) RETURNS DATETIME(3)
READS SQL DATA
BEGIN
  RETURN CONVERT_TZ(p_ts, '+00:00', hospital_offset());
END$$

CREATE FUNCTION from_local(p_ts DATETIME(3)) RETURNS DATETIME(3)
READS SQL DATA
BEGIN
  RETURN CONVERT_TZ(p_ts, hospital_offset(), '+00:00');
END$$

CREATE FUNCTION format_local(p_ts DATETIME(3)) RETURNS VARCHAR(40)
READS SQL DATA
BEGIN
  RETURN DATE_FORMAT(to_local(p_ts), '%a %d %b %Y, %h:%i %p');
END$$

CREATE FUNCTION make_reference(p_prefix VARCHAR(8)) RETURNS VARCHAR(20)
NO SQL
BEGIN
  RETURN CONCAT(p_prefix, '-', HEX(RANDOM_BYTES(4)));
END$$

CREATE FUNCTION is_uuid(p TEXT) RETURNS BOOLEAN
DETERMINISTIC NO SQL
BEGIN
  RETURN p IS NOT NULL AND REGEXP_LIKE(p, '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', 'i');
END$$

-- Reads a JSON string member, trimmed; JSON null and missing members become NULL.
CREATE FUNCTION jtext(p_doc JSON, p_key VARCHAR(64)) RETURNS TEXT
DETERMINISTIC NO SQL
BEGIN
  DECLARE v JSON DEFAULT JSON_EXTRACT(p_doc, CONCAT('$.', p_key));
  IF v IS NULL OR JSON_TYPE(v) = 'NULL' THEN RETURN NULL; END IF;
  RETURN TRIM(JSON_UNQUOTE(v));
END$$

-- Converts an ISO-8601 timestamp from the client ("2026-10-27T04:30:00.000Z") to UTC DATETIME.
CREATE FUNCTION jtime(p_doc JSON, p_key VARCHAR(64)) RETURNS DATETIME(3)
DETERMINISTIC NO SQL
BEGIN
  DECLARE v TEXT DEFAULT jtext(p_doc, p_key);
  IF v IS NULL OR v = '' THEN RETURN NULL; END IF;
  RETURN CAST(REPLACE(REPLACE(LEFT(v, 23), 'T', ' '), 'Z', '') AS DATETIME(3));
END$$

-- Reads a JSON boolean member (true/false, 1/0 or "true"/"false"); missing or null → NULL.
CREATE FUNCTION jbool(p_doc JSON, p_key VARCHAR(64)) RETURNS BOOLEAN
DETERMINISTIC NO SQL
BEGIN
  DECLARE v TEXT DEFAULT LOWER(jtext(p_doc, p_key));
  IF v IS NULL THEN RETURN NULL; END IF;
  RETURN v IN ('true', '1');
END$$

-- True when the JSON document has the member (even if its value is null).
CREATE FUNCTION jhas(p_doc JSON, p_key VARCHAR(64)) RETURNS BOOLEAN
DETERMINISTIC NO SQL
BEGIN
  RETURN JSON_CONTAINS_PATH(p_doc, 'one', CONCAT('$.', p_key));
END$$

-- ───────────────────────────── Errors ─────────────────────────────
-- SQLSTATE 42501 = not authorised, P0002 = not found, 45000 = rule violation (shown to the user).
CREATE PROCEDURE fail(p_message VARCHAR(128))
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = p_message;
END$$

CREATE PROCEDURE deny(p_message VARCHAR(128))
BEGIN
  SIGNAL SQLSTATE '42501' SET MESSAGE_TEXT = p_message;
END$$

CREATE PROCEDURE not_found(p_message VARCHAR(128))
BEGIN
  SIGNAL SQLSTATE 'P0002' SET MESSAGE_TEXT = p_message;
END$$

CREATE FUNCTION require_user() RETURNS CHAR(36)
READS SQL DATA
BEGIN
  DECLARE v_uid CHAR(36) DEFAULT app_uid();
  IF v_uid IS NULL THEN
    SIGNAL SQLSTATE '28000' SET MESSAGE_TEXT = 'Please sign in to continue.';
  END IF;
  RETURN v_uid;
END$$

-- ───────────────────────────── Audit ─────────────────────────────
CREATE PROCEDURE write_audit(p_action VARCHAR(60), p_entity VARCHAR(60), p_entity_id VARCHAR(80), p_details JSON)
MODIFIES SQL DATA
BEGIN
  INSERT INTO audit_logs (actor_id, action, entity, entity_id, details)
  VALUES (app_uid(), p_action, p_entity, p_entity_id, COALESCE(p_details, JSON_OBJECT()));
END$$

-- Used by the generated audit triggers (04_audit_triggers.sql): records the changed columns
-- and the before/after row images; an UPDATE that changes nothing is not logged.
CREATE PROCEDURE audit_change(p_op VARCHAR(10), p_table VARCHAR(60), p_id VARCHAR(80), p_old JSON, p_new JSON)
MODIFIES SQL DATA
BEGIN
  DECLARE v_changed JSON DEFAULT JSON_ARRAY();
  DECLARE v_keys JSON;
  DECLARE v_key VARCHAR(64);
  DECLARE i INT DEFAULT 0;
  IF p_op = 'update' THEN
    SET v_keys = JSON_KEYS(p_new);
    WHILE i < JSON_LENGTH(v_keys) DO
      SET v_key = JSON_UNQUOTE(JSON_EXTRACT(v_keys, CONCAT('$[', i, ']')));
      IF v_key <> 'updated_at' AND NOT (JSON_EXTRACT(p_old, CONCAT('$.', v_key)) <=> JSON_EXTRACT(p_new, CONCAT('$.', v_key))) THEN
        SET v_changed = JSON_ARRAY_APPEND(v_changed, '$', v_key);
      END IF;
      SET i = i + 1;
    END WHILE;
    IF JSON_LENGTH(v_changed) = 0 THEN
      SET v_changed = NULL;
    END IF;
  END IF;
  IF p_op <> 'update' OR v_changed IS NOT NULL THEN
    INSERT INTO audit_logs (actor_id, action, entity, entity_id, details)
    VALUES (app_uid(), p_op, p_table, p_id,
      JSON_OBJECT('changed', IF(p_op = 'update', v_changed, NULL), 'old', p_old, 'new', p_new));
  END IF;
END$$

-- ───────────────────────────── Notifications ─────────────────────────────
-- Writes an in-app notification and queues an email. Callers keep bodies free of clinical
-- detail: the message says *that* something happened, the portal shows *what*.
CREATE PROCEDURE notify(p_user_id CHAR(36), p_kind VARCHAR(60), p_title VARCHAR(160), p_body TEXT, p_link VARCHAR(255), p_email BOOLEAN)
MODIFIES SQL DATA
BEGIN
  DECLARE v_email VARCHAR(254);
  IF p_user_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, kind, title, body, link) VALUES (p_user_id, p_kind, p_title, p_body, p_link);
    IF p_email THEN
      SELECT email INTO v_email FROM profiles WHERE id = p_user_id;
      IF v_email IS NOT NULL THEN
        INSERT INTO email_outbox (user_id, to_email, template, subject, body)
        VALUES (p_user_id, v_email, p_kind, CONCAT('A10 Hospital — ', p_title),
                CONCAT(p_body, '\n\nSign in to your A10 Hospital account to view the details.'));
      END IF;
    END IF;
  END IF;
END$$

-- ───────────────────────────── Private storage rules ─────────────────────────────
CREATE FUNCTION can_read_object(p_bucket VARCHAR(20), p_name VARCHAR(400)) RETURNS BOOLEAN
READS SQL DATA
BEGIN
  DECLARE v_uid CHAR(36) DEFAULT app_uid();
  DECLARE v_owner VARCHAR(400) DEFAULT SUBSTRING_INDEX(p_name, '/', 1);
  DECLARE v_report VARCHAR(400) DEFAULT SUBSTRING_INDEX(SUBSTRING_INDEX(p_name, '/', 2), '/', -1);
  IF v_uid IS NULL OR NOT is_uuid(v_owner) THEN RETURN FALSE; END IF;
  IF p_bucket = 'credentials' THEN
    RETURN v_owner = v_uid OR is_admin();
  ELSEIF p_bucket = 'lab-reports' THEN
    RETURN doctor_can_access_patient(v_owner)
        OR has_permission('lab_records')
        OR (v_owner = v_uid AND EXISTS (
              SELECT 1 FROM lab_reports r WHERE r.id = v_report AND r.patient_id = v_owner AND r.status IN ('final', 'amended')));
  END IF;
  RETURN FALSE;
END$$

CREATE FUNCTION can_write_object(p_bucket VARCHAR(20), p_name VARCHAR(400)) RETURNS BOOLEAN
READS SQL DATA
BEGIN
  DECLARE v_uid CHAR(36) DEFAULT app_uid();
  DECLARE v_owner VARCHAR(400) DEFAULT SUBSTRING_INDEX(p_name, '/', 1);
  DECLARE v_report VARCHAR(400) DEFAULT SUBSTRING_INDEX(SUBSTRING_INDEX(p_name, '/', 2), '/', -1);
  IF v_uid IS NULL OR NOT is_uuid(v_owner) THEN RETURN FALSE; END IF;
  IF p_bucket = 'credentials' THEN
    RETURN v_owner = v_uid AND EXISTS (SELECT 1 FROM doctor_applications a WHERE a.user_id = v_uid AND a.status = 'pending');
  ELSEIF p_bucket = 'lab-reports' THEN
    RETURN EXISTS (SELECT 1 FROM lab_reports r WHERE r.id = v_report AND r.patient_id = v_owner)
       AND (doctor_can_access_patient(v_owner) OR has_permission('lab_records'));
  END IF;
  RETURN FALSE;
END$$

DELIMITER ;
