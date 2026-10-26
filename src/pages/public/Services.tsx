import { ArrowRight, BellRing, CalendarClock, FileText, FlaskConical, HandHeart, Package, Pill, ScrollText, Siren, UserRound } from 'lucide-react'
import { Link } from 'react-router'
import { ButtonLink } from '@/components/common/Button'
import { PageHeader, Reveal, Stagger, StaggerItem } from '@/components/common/Layout'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useSettings } from '@/hooks/useSettings'

const services = [
  { icon: CalendarClock, title: 'Outpatient appointments', text: 'Book, reschedule or cancel consultations online, within the hospital’s cancellation window.', to: '/appointments/book', cta: 'Book now' },
  { icon: ScrollText, title: 'Digital prescriptions', text: 'Prescriptions issued by your doctor appear in your portal with dosage and instructions.', to: '/patient/prescriptions', cta: 'View prescriptions' },
  { icon: FlaskConical, title: 'Lab reports', text: 'Finalised laboratory reports are released securely to your account.', to: '/patient/lab-reports', cta: 'View reports' },
  { icon: Pill, title: 'Pharmacy & delivery', text: 'Order medication online; prescription-only items are reviewed by a pharmacist before dispensing.', to: '/pharmacy', cta: 'Browse pharmacy' },
  { icon: Package, title: 'Order tracking', text: 'Follow each order from placement to delivery with a clear status timeline.', to: '/patient/orders', cta: 'My orders' },
  { icon: BellRing, title: 'Notifications', text: 'Updates about appointments, results and orders — without clinical details in emails.', to: '/patient/dashboard', cta: 'Open portal' },
  { icon: UserRound, title: 'Your profile', text: 'Keep contact details and emergency contacts up to date for smoother visits.', to: '/patient/profile', cta: 'Update profile' },
  { icon: HandHeart, title: 'Patient support', text: 'Our patient support fund helps eligible patients with the cost of care.', to: '/donations', cta: 'Learn more' },
]

export default function Services() {
  useDocumentTitle('Patient services')
  const { data: s } = useSettings()
  return (
    <div className="container-page py-12 sm:py-16">
      <PageHeader eyebrow="Patient services" title="Support for every step of your care" description="From booking to results and medication, manage your care through the A10 patient portal." breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Patient services' }]} actions={<ButtonLink to="/signup">Create a patient account</ButtonLink>} />
      <Stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {services.map((x) => (
          <StaggerItem key={x.title}>
            <Link to={x.to} className="card card-hover group flex h-full flex-col p-6">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-mint-100 text-mint-600"><x.icon className="h-5 w-5" /></span>
              <h2 className="mt-4 text-base font-semibold">{x.title}</h2>
              <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted">{x.text}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-mint-700">{x.cta}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
            </Link>
          </StaggerItem>
        ))}
      </Stagger>
      <Reveal className="mt-12 grid gap-6 rounded-[var(--radius-panel)] border border-error/20 bg-[#fdf6f5] p-7 md:grid-cols-[auto_1fr] md:items-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-error/10 text-error"><Siren className="h-6 w-6" /></span>
        <div>
          <h2 className="text-lg font-semibold">Emergencies</h2>
          <p className="mt-1 text-[15px] text-muted-strong">Online services are not for urgent care. In an emergency call <strong>{s?.emergency_phone ?? '112'}</strong> or go to the nearest emergency department.</p>
        </div>
      </Reveal>
      <Reveal className="mt-6 flex items-start gap-3 rounded-[var(--radius-card)] border border-line bg-mist p-6 text-sm text-muted-strong">
        <FileText className="mt-0.5 h-5 w-5 shrink-0 text-mint-600" />
        <p>Need copies of records or help with the portal? <Link to="/contact" className="font-semibold text-mint-700 underline">Contact the patient services team</Link>.</p>
      </Reveal>
    </div>
  )
}
