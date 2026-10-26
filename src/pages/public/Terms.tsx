import { LegalPage, Section } from './Legal'

export default function Terms() {
  return (
    <LegalPage title="Terms of Use">
      <Section title="Not for emergencies">
        <p>Online booking, messaging and the patient portal are not suitable for urgent or emergency care. In an emergency, call your local emergency number or go to the nearest emergency department.</p>
      </Section>
      <Section title="Accounts">
        <p>Keep your password private and tell us if you suspect unauthorised access. Professional accounts are subject to verification before clinical features are enabled.</p>
      </Section>
      <Section title="Appointments">
        <p>Appointment requests are subject to confirmation. You can cancel or reschedule online until the cut-off time shown on your appointment.</p>
      </Section>
      <Section title="Pharmacy and donations">
        <p>Prescription-only medicines are dispensed only after verification of a valid prescription by a pharmacist. In demonstration builds, orders use a simulated pay-on-delivery workflow and donations are simulated — no money is collected.</p>
      </Section>
      <Section title="Information on this site">
        <p>Content is general information and not a substitute for advice from a qualified professional. Sample content is labelled as such.</p>
      </Section>
    </LegalPage>
  )
}
