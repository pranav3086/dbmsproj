-- Authentication, sessions, private file storage and the development mailbox.
-- Passwords are hashed with scrypt by the API server before they reach these procedures;
-- the database stores only the hash.
USE a10_hospital;

DELIMITER $$

-- ───────────────────────────── Accounts ─────────────────────────────
CREATE PROCEDURE auth_sign_up(p_email VARCHAR(254), p_password_hash VARCHAR(255), p_metadata JSON)
MODIFIES SQL DATA
BEGIN
  DECLARE v_email VARCHAR(254) DEFAULT LOWER(TRIM(p_email));
  DECLARE v_id CHAR(36) DEFAULT NULL;
  SELECT id INTO v_id FROM auth_users WHERE email = v_email;
  IF v_id IS NOT NULL THEN
    SELECT JSON_OBJECT('id', v_id, 'existed', TRUE) AS result;
  ELSE
    SET v_id = UUID();
    -- The AFTER INSERT trigger (on_auth_user_created) creates the profile and the role.
    INSERT INTO auth_users (id, email, password_hash, raw_user_meta_data)
    VALUES (v_id, v_email, p_password_hash, COALESCE(p_metadata, JSON_OBJECT()));
    SELECT JSON_OBJECT('id', v_id, 'existed', FALSE) AS result;
  END IF;
END$$

CREATE PROCEDURE auth_find_user(p_email VARCHAR(254))
READS SQL DATA
BEGIN
  SELECT id, email, password_hash, email_confirmed_at FROM auth_users WHERE email = LOWER(TRIM(p_email));
END$$

CREATE PROCEDURE auth_confirm_email(p_user_id CHAR(36))
MODIFIES SQL DATA
BEGIN
  UPDATE auth_users SET email_confirmed_at = COALESCE(email_confirmed_at, UTC_TIMESTAMP(3)) WHERE id = p_user_id;
  SELECT NULL AS result;
END$$

CREATE PROCEDURE auth_set_password(p_user_id CHAR(36), p_password_hash VARCHAR(255))
MODIFIES SQL DATA
BEGIN
  UPDATE auth_users SET password_hash = p_password_hash WHERE id = p_user_id;
  -- Changing the password signs out every other session.
  DELETE FROM auth_sessions WHERE user_id = p_user_id AND NOT (token_hash <=> SHA2(@app_session_token, 256));
  SELECT NULL AS result;
END$$

-- ───────────────────────────── One-time tokens ─────────────────────────────
CREATE PROCEDURE auth_issue_token(p_user_id CHAR(36), p_kind VARCHAR(20), p_token_hash CHAR(64))
MODIFIES SQL DATA
BEGIN
  INSERT INTO auth_tokens (token_hash, user_id, kind, expires_at)
  VALUES (p_token_hash, p_user_id, p_kind, UTC_TIMESTAMP(3) + INTERVAL 1 HOUR);
  SELECT NULL AS result;
END$$

CREATE PROCEDURE auth_consume_token(p_token_hash CHAR(64), p_kind VARCHAR(20))
MODIFIES SQL DATA
BEGIN
  DECLARE v_user CHAR(36) DEFAULT NULL;
  SELECT user_id INTO v_user FROM auth_tokens
  WHERE token_hash = p_token_hash AND kind = p_kind AND used_at IS NULL AND expires_at > UTC_TIMESTAMP(3)
  FOR UPDATE;
  IF v_user IS NULL THEN CALL fail('This link is invalid or has expired. Please request a new one.'); END IF;
  UPDATE auth_tokens SET used_at = UTC_TIMESTAMP(3) WHERE token_hash = p_token_hash;
  SELECT id AS user_id, email FROM auth_users WHERE id = v_user;
END$$

-- ───────────────────────────── Sessions ─────────────────────────────
CREATE PROCEDURE auth_create_session(p_user_id CHAR(36), p_token_hash CHAR(64), p_hours INT)
MODIFIES SQL DATA
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth_users WHERE id = p_user_id AND email_confirmed_at IS NOT NULL) THEN
    CALL fail('Please verify your email address before signing in.');
  END IF;
  DELETE FROM auth_sessions WHERE expires_at < UTC_TIMESTAMP(3);
  INSERT INTO auth_sessions (token_hash, user_id, expires_at)
  VALUES (p_token_hash, p_user_id, UTC_TIMESTAMP(3) + INTERVAL LEAST(GREATEST(p_hours, 1), 720) HOUR);
  SELECT NULL AS result;
END$$

CREATE PROCEDURE auth_end_session()
MODIFIES SQL DATA
BEGIN
  DELETE FROM auth_sessions WHERE token_hash = SHA2(@app_session_token, 256);
  SELECT NULL AS result;
END$$

-- Who the current session token belongs to (empty result when signed out).
CREATE PROCEDURE auth_whoami()
READS SQL DATA
BEGIN
  SELECT u.id AS user_id, u.email, u.password_hash
  FROM auth_users u WHERE u.id = app_uid() AND u.email_confirmed_at IS NOT NULL;
END$$

-- ───────────────────────────── Private storage ─────────────────────────────
CREATE PROCEDURE storage_put(p_bucket VARCHAR(20), p_name VARCHAR(400), p_mime VARCHAR(120), p_data LONGBLOB)
MODIFIES SQL DATA
BEGIN
  IF NOT can_write_object(p_bucket, p_name) THEN CALL deny('You do not have permission to upload this file.'); END IF;
  IF LENGTH(p_data) > 10485760 THEN CALL fail('Files must be 10 MB or smaller.'); END IF;
  INSERT INTO stored_objects (bucket, name, mime, size, data, owner)
  VALUES (p_bucket, p_name, p_mime, LENGTH(p_data), p_data, app_uid()) AS new
  ON DUPLICATE KEY UPDATE mime = new.mime, size = new.size, data = new.data;
  SELECT NULL AS result;
END$$

CREATE PROCEDURE storage_get(p_bucket VARCHAR(20), p_name VARCHAR(400))
READS SQL DATA
BEGIN
  IF NOT can_read_object(p_bucket, p_name) THEN CALL deny('This document is not available.'); END IF;
  SELECT mime, data FROM stored_objects WHERE bucket = p_bucket AND name = p_name;
END$$

-- ───────────────────────────── Development mailbox ─────────────────────────────
CREATE PROCEDURE dev_send_mail(p_to VARCHAR(254), p_subject VARCHAR(255), p_body TEXT, p_link VARCHAR(500))
MODIFIES SQL DATA
BEGIN
  INSERT INTO dev_mailbox (to_email, subject, body, link) VALUES (LOWER(p_to), p_subject, p_body, p_link);
  SELECT NULL AS result;
END$$

CREATE PROCEDURE dev_list_mailbox()
READS SQL DATA
BEGIN
  SELECT JSON_OBJECT(
    'auth', COALESCE((SELECT CAST(CONCAT('[', GROUP_CONCAT(JSON_OBJECT('id', m.id, 'to_email', m.to_email, 'subject', m.subject,
               'body', m.body, 'link', m.link, 'created_at', m.created_at) ORDER BY m.id DESC), ']') AS JSON)
             FROM (SELECT * FROM dev_mailbox ORDER BY id DESC LIMIT 100) m), JSON_ARRAY()),
    'outbox', COALESCE((SELECT CAST(CONCAT('[', GROUP_CONCAT(JSON_OBJECT('id', o.id, 'to_email', o.to_email, 'subject', o.subject,
               'body', o.body, 'status', o.status, 'created_at', o.created_at) ORDER BY o.created_at DESC), ']') AS JSON)
             FROM (SELECT * FROM email_outbox ORDER BY created_at DESC LIMIT 100) o), JSON_ARRAY())
  ) AS result;
END$$

DELIMITER ;
