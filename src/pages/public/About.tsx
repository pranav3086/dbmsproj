import { useQuery } from '@tanstack/react-query'
import { ArrowRight, BedDouble, Compass, Eye, FlaskConical, HandHeart, HeartHandshake, Lightbulb, Microscope, Pill, ShieldCheck, Stethoscope, Users } from 'lucide-react'
import { Link } from 'react-router'
import { SampleBadge } from '@/components/common/Badge'
import { ButtonLink } from '@/components/common/Button'
import { DeptIcon } from '@/components/common/DeptIcon'
import { Reveal, Stagger, StaggerItem } from '@/components/common/Layout'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { listDepartments } from '@/services/directory'

const values = [
  { icon: HeartHandshake, title: 'Compassion', text: 'We treat every person with dignity, patience and respect.' },
  { icon: ShieldCheck, title: 'Integrity', text: 'We are honest about what we know, what we do not, and what comes next.' },
  { icon: Lightbulb, title: 'Thoughtful innovation', text: 'We adopt technology when it makes care safer, clearer or kinder.' },
  { icon: Users, title: 'Partnership', text: 'Patients and families are part of the team and every decision.' },
]
const facilities = [
  { icon: Stethoscope, title: 'Outpatient clinics', text: 'Calm consultation suites for specialist and general appointments.', img: '/images/reception.webp' },
  { icon: BedDouble, title: 'Inpatient wards', text: 'Comfortable, well-lit rooms designed around rest and recovery.', img: '/images/ward.webp' },
  { icon: Microscope, title: 'Diagnostics & laboratory', text: 'Imaging and laboratory services that report directly to your record.', img: '/images/laboratory.webp' },
  { icon: Pill, title: 'Pharmacy', text: 'Pharmacist-reviewed dispensing with home delivery options.', img: '/images/pharmacy.webp' },
]

export default function About() {
  useDocumentTitle('About us')
  const departments = useQuery({ queryKey: ['departments', ''], queryFn: () => listDepartments() })
  return (
    <>
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute -right-40 -top-32 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,var(--color-mint-100),transparent_68%)]" />
        <div className="container-page relative grid gap-12 py-14 sm:py-20 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <Reveal>
            <p className="eyebrow">About A10 Hospital</p>
            <h1 className="display-xl mt-4">Exceptional care, thoughtfully delivered.</h1>
            <p className="lead mt-6 max-w-xl">A10 Hospital is built around a simple idea: excellent medicine should also feel human. We combine specialist expertise with calm spaces, clear communication and connected digital services.</p>
            <SampleBadge className="mt-6" label="Sample institutional copy — verify before launch" />
          </Reveal>
          <Reveal delay={0.1}>
            <img src="/images/bedside.webp" alt="A doctor speaking with a patient at the bedside" className="h-[460px] w-full rounded-[32px] object-cover shadow-[var(--shadow-lift)]" />
          </Reveal>
        </div>
      </section>

      <section className="border-y border-line bg-mist/70 py-20">
        <div className="container-page grid gap-6 md:grid-cols-2">
          <Reveal className="card p-8">
            <Compass className="h-7 w-7 text-mint-600" />
            <h2 className="mt-4 text-2xl font-semibold">Our mission</h2>
            <p className="mt-3 text-[15.5px] leading-relaxed text-muted-strong">To provide safe, evidence-based and compassionate care that respects each patient’s time, privacy and choices — and to make every step of that care easy to understand.</p>
          </Reveal>
          <Reveal delay={0.08} className="card p-8">
            <Eye className="h-7 w-7 text-mint-600" />
            <h2 className="mt-4 text-2xl font-semibold">Our vision</h2>
            <p className="mt-3 text-[15.5px] leading-relaxed text-muted-strong">A hospital experience where people feel informed and supported, where specialists work as one team, and where technology quietly removes friction from care.</p>
          </Reveal>
        </div>
      </section>

      <section className="py-20 sm:py-24">
        <div className="container-page">
          <Reveal className="max-w-2xl">
            <p className="eyebrow">Core values</p>
            <h2 className="display-lg mt-3">What guides us every day</h2>
          </Reveal>
          <Stagger className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {values.map((v) => (
              <StaggerItem key={v.title} className="card p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-mint-100 text-mint-600"><v.icon className="h-5 w-5" /></span>
                <h3 className="mt-4 text-base font-semibold">{v.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{v.text}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      <section className="bg-forest py-20 text-white sm:py-24">
        <div className="container-page grid gap-12 lg:grid-cols-2 lg:items-center">
          <Reveal>
            <p className="eyebrow !text-mint-300">Patient-centred care</p>
            <h2 className="mt-3 text-3xl font-semibold !text-white sm:text-4xl">You are at the centre of every decision.</h2>
          </Reveal>
          <Reveal delay={0.08} className="space-y-4 text-[15.5px] leading-relaxed text-white/75">
            <p>We explain options in plain language, share results through your secure portal, and make sure you know who is responsible for each part of your care.</p>
            <p>Clinical records are created and amended only by authorised professionals, with every significant change recorded — so your history stays accurate and trustworthy.</p>
          </Reveal>
        </div>
      </section>

      <section className="py-20 sm:py-24">
        <div className="container-page">
          <Reveal className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <p className="eyebrow">Departments & services</p>
              <h2 className="display-lg mt-3">Specialist teams under one roof</h2>
            </div>
            <ButtonLink to="/departments" variant="secondary" iconRight={<ArrowRight className="h-4 w-4" />}>Explore departments</ButtonLink>
          </Reveal>
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {departments.data?.map((d) => (
              <Link key={d.id} to={`/departments/${d.slug}`} className="flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3.5 text-sm font-medium text-forest transition-colors hover:border-mint-400 hover:bg-mint-50">
                <DeptIcon name={d.icon} className="h-4.5 w-4.5 text-mint-600" />{d.name}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-mist/70 py-20 sm:py-24">
        <div className="container-page">
          <Reveal className="max-w-2xl">
            <p className="eyebrow">Facilities</p>
            <h2 className="display-lg mt-3">Spaces designed for comfort and clarity</h2>
          </Reveal>
          <Stagger className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {facilities.map((f) => (
              <StaggerItem key={f.title} className="card overflow-hidden">
                <img src={f.img} alt="" loading="lazy" className="h-40 w-full object-cover" />
                <div className="p-5">
                  <f.icon className="h-5 w-5 text-mint-600" />
                  <h3 className="mt-3 font-semibold">{f.title}</h3>
                  <p className="mt-1 text-sm text-muted">{f.text}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      <section className="py-20 sm:py-24">
        <div className="container-page grid gap-12 lg:grid-cols-2 lg:items-center">
          <Reveal><img src="/images/care-team.webp" alt="A clinician in a white coat holding a stethoscope" loading="lazy" className="h-[420px] w-full rounded-[28px] object-cover" /></Reveal>
          <Reveal delay={0.08}>
            <p className="eyebrow">Our healthcare team</p>
            <h2 className="display-lg mt-3">Clinicians, nurses and specialists working as one</h2>
            <p className="lead mt-5">Every doctor offering appointments through A10 is verified by our administration team before gaining clinical access. Browse profiles to see specialities, languages and availability.</p>
            <ButtonLink to="/doctors" className="mt-7" iconRight={<ArrowRight className="h-4 w-4" />}>Find a doctor</ButtonLink>
          </Reveal>
        </div>
      </section>

      <section id="community" className="pb-8">
        <div className="container-page">
          <Reveal className="grid gap-8 rounded-[32px] bg-mint-100 p-8 sm:p-12 lg:grid-cols-[1.4fr_1fr] lg:items-center">
            <div>
              <p className="eyebrow"><HandHeart className="h-4 w-4" />Community outreach</p>
              <h2 className="mt-3 text-3xl font-semibold">Caring beyond our walls</h2>
              <p className="mt-3 max-w-xl text-muted-strong">Through screening camps, health-awareness sessions and a patient support fund, we aim to make good care more accessible. Programme details shown on this site are samples to be confirmed.</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
              <ButtonLink to="/donations" size="lg">Support our work</ButtonLink>
              <ButtonLink to="/contact" size="lg" variant="secondary">Get in touch</ButtonLink>
            </div>
          </Reveal>
          <p className="mt-6 flex items-center gap-2 text-[13px] text-muted"><FlaskConical className="h-3.5 w-3.5" />No accreditations, awards or outcome statistics are claimed on this page.</p>
        </div>
      </section>
    </>
  )
}
