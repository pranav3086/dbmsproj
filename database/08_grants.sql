-- Privileges of the application's MySQL account (created by scripts/db-setup.mjs).
--
-- The account can:
--   * SELECT from the security views in a10_api (rows filtered per user), and
--   * EXECUTE the public stored procedures below.
-- It has NO privileges on the a10_hospital tables, so it cannot read or change a row except
-- through a view's access rule or a procedure's checks. Internal helpers (notify, write_audit,
-- build_slots, bootstrap_admin, …) are not granted at all.

GRANT SELECT ON a10_api.* TO 'a10_app'@'%';

-- Session & directory
GRANT EXECUTE ON PROCEDURE a10_hospital.get_my_access TO 'a10_app'@'%';
GRANT EXECUTE ON PROCEDURE a10_hospital.get_available_slots TO 'a10_app'@'%';
GRANT EXECUTE ON PROCEDURE a10_hospital.get_next_slots TO 'a10_app'@'%';
GRANT EXECUTE ON PROCEDURE a10_hospital.update_my_profile TO 'a10_app'@'%';
GRANT EXECUTE ON PROCEDURE a10_hospital.mark_notifications_read TO 'a10_app'@'%';
GRANT EXECUTE ON PROCEDURE a10_hospital.save_doctor TO 'a10_app'@'%';
GRANT EXECUTE ON PROCEDURE a10_hospital.save_department TO 'a10_app'@'%';
GRANT EXECUTE ON PROCEDURE a10_hospital.add_availability TO 'a10_app'@'%';
GRANT EXECUTE ON PROCEDURE a10_hospital.remove_availability TO 'a10_app'@'%';

-- Appointments & clinical
GRANT EXECUTE ON PROCEDURE a10_hospital.book_appointment TO 'a10_app'@'%';
GRANT EXECUTE ON PROCEDURE a10_hospital.reschedule_appointment TO 'a10_app'@'%';
GRANT EXECUTE ON PROCEDURE a10_hospital.update_appointment_status TO 'a10_app'@'%';
GRANT EXECUTE ON PROCEDURE a10_hospital.save_consultation_notes TO 'a10_app'@'%';
GRANT EXECUTE ON PROCEDURE a10_hospital.save_prescription TO 'a10_app'@'%';
GRANT EXECUTE ON PROCEDURE a10_hospital.amend_prescription TO 'a10_app'@'%';
GRANT EXECUTE ON PROCEDURE a10_hospital.cancel_prescription TO 'a10_app'@'%';
GRANT EXECUTE ON PROCEDURE a10_hospital.save_lab_report TO 'a10_app'@'%';
GRANT EXECUTE ON PROCEDURE a10_hospital.set_lab_report_document TO 'a10_app'@'%';
GRANT EXECUTE ON PROCEDURE a10_hospital.search_patients TO 'a10_app'@'%';
GRANT EXECUTE ON PROCEDURE a10_hospital.get_patient_chart TO 'a10_app'@'%';
GRANT EXECUTE ON PROCEDURE a10_hospital.save_observation TO 'a10_app'@'%';

-- Pharmacy
GRANT EXECUTE ON PROCEDURE a10_hospital.place_order TO 'a10_app'@'%';
GRANT EXECUTE ON PROCEDURE a10_hospital.update_order_status TO 'a10_app'@'%';
GRANT EXECUTE ON PROCEDURE a10_hospital.adjust_stock TO 'a10_app'@'%';
GRANT EXECUTE ON PROCEDURE a10_hospital.save_medicine TO 'a10_app'@'%';

-- Donations & contact
GRANT EXECUTE ON PROCEDURE a10_hospital.create_donation TO 'a10_app'@'%';
GRANT EXECUTE ON PROCEDURE a10_hospital.get_donation_receipt TO 'a10_app'@'%';
GRANT EXECUTE ON PROCEDURE a10_hospital.submit_contact_message TO 'a10_app'@'%';
GRANT EXECUTE ON PROCEDURE a10_hospital.update_contact_status TO 'a10_app'@'%';

-- Doctor verification, staff and administration
GRANT EXECUTE ON PROCEDURE a10_hospital.set_application_credential TO 'a10_app'@'%';
GRANT EXECUTE ON PROCEDURE a10_hospital.review_doctor_application TO 'a10_app'@'%';
GRANT EXECUTE ON PROCEDURE a10_hospital.create_employee_invitation TO 'a10_app'@'%';
GRANT EXECUTE ON PROCEDURE a10_hospital.revoke_employee_invitation TO 'a10_app'@'%';
GRANT EXECUTE ON PROCEDURE a10_hospital.get_invitation TO 'a10_app'@'%';
GRANT EXECUTE ON PROCEDURE a10_hospital.accept_employee_invitation TO 'a10_app'@'%';
GRANT EXECUTE ON PROCEDURE a10_hospital.admin_set_staff_permissions TO 'a10_app'@'%';
GRANT EXECUTE ON PROCEDURE a10_hospital.admin_set_active TO 'a10_app'@'%';
GRANT EXECUTE ON PROCEDURE a10_hospital.admin_overview TO 'a10_app'@'%';

-- Authentication, storage and the development mailbox (used by the API server)
GRANT EXECUTE ON PROCEDURE a10_hospital.auth_sign_up TO 'a10_app'@'%';
GRANT EXECUTE ON PROCEDURE a10_hospital.auth_find_user TO 'a10_app'@'%';
GRANT EXECUTE ON PROCEDURE a10_hospital.auth_confirm_email TO 'a10_app'@'%';
GRANT EXECUTE ON PROCEDURE a10_hospital.auth_set_password TO 'a10_app'@'%';
GRANT EXECUTE ON PROCEDURE a10_hospital.auth_issue_token TO 'a10_app'@'%';
GRANT EXECUTE ON PROCEDURE a10_hospital.auth_consume_token TO 'a10_app'@'%';
GRANT EXECUTE ON PROCEDURE a10_hospital.auth_create_session TO 'a10_app'@'%';
GRANT EXECUTE ON PROCEDURE a10_hospital.auth_end_session TO 'a10_app'@'%';
GRANT EXECUTE ON PROCEDURE a10_hospital.auth_whoami TO 'a10_app'@'%';
GRANT EXECUTE ON PROCEDURE a10_hospital.storage_put TO 'a10_app'@'%';
GRANT EXECUTE ON PROCEDURE a10_hospital.storage_get TO 'a10_app'@'%';
GRANT EXECUTE ON PROCEDURE a10_hospital.dev_send_mail TO 'a10_app'@'%';
GRANT EXECUTE ON PROCEDURE a10_hospital.dev_list_mailbox TO 'a10_app'@'%';
