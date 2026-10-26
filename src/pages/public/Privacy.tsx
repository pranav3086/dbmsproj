import { LegalPage, Section } from './Legal'

export default function Privacy() {
  return (
    <LegalPage title="Privacy Notice">
      <Section title="What we collect">
        <p>Account details (name, email, phone), information you choose to add to your profile, appointment bookings, and clinical records created by authorised healthcare professionals involved in your care.</p>
      </Section>
      <Section title="How access is controlled">
        <p>Patients can see only their own records. Doctors can see records of patients who have booked with them. Staff see only the operational information their role requires. These rules are enforced by the database itself, not just the website.</p>
        <p>Viewing of patient charts and changes to clinical, administrative and role data are recorded in an audit log.</p>
      </Section>
      <Section title="Emails and notifications">
        <p>Notification emails say that something has changed (for example, “a lab report is available”) without including clinical details. Sign in to view the details.</p>
      </Section>
      <Section title="Your choices">
        <p>You can update your profile at any time and contact us to ask about your information. This template does not claim compliance with any specific law or certification; the hospital must complete its own legal and privacy assessment before launch.</p>
      </Section>
    </LegalPage>
  )
}
