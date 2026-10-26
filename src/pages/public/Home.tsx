import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight, CalendarCheck2, CalendarPlus, ClipboardCheck, FlaskConical, HandHeart, HeartHandshake, MapPin, Phone, Pill,
  ScrollText, ShieldCheck, Sparkles, Stethoscope, UserRoundSearch,
} from 'lucide-react'
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { useRef } from 'react'
import { Link } from 'react-router'
import { ButtonLink } from '@/components/common/Button'
import { Reveal, Stagger, StaggerItem } from '@/components/common/Layout'
import { LoadingSkeleton } from '@/components/common/States'
import { DepartmentCard, DoctorCard } from '@/components/domain/Cards'
import { PLACEHOLDER_NOTE, useSettings } from '@/hooks/useSettings'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { getNextSlots, listDepartments, listDoctors } from '@/services/directory'

function Hero() {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const imgY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 60])
  const item = (i: number) => ({ initial: reduce ? false : { opacity: 0, y: 22 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.8, delay: 0.08 * i, ease: [0.22, 1, 0.36, 1] as const } })
  return (
    <section ref={ref} className="relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute -right-48 -top-40 h-[620px] w-[620px] rounded-full bg-[radial-gradient(circle_at_center,var(--color-mint-100),transparent_68%)]" />
      <div aria-hidden className="pointer-events-none absolute -left-40 bottom-0 h-[380px] w-[380px] rounded-full bg-[radial-gradient(circle_at_center,var(--color-mint-50),transparent_70%)]" />
      <div className="container-page relative grid items-center gap-12 pb-16 pt-10 sm:pt-14 lg:grid-cols-[1.08fr_1fr] lg:gap-14 lg:pb-24 lg:pt-16">
        <div>
          <motion.p {...item(0)} className="eyebrow"><Sparkles className="h-3.5 w-3.5" /> Exceptional Care. Thoughtfully Delivered.</motion.p>
          <motion.h1 {...item(1)} className="display-xl mt-5">
            Healthcare that puts <span className="relative whitespace-nowrap text-mint-600">you<svg aria-hidden viewBox="0 0 120 12" className="absolute -bottom-1.5 left-0 h-3 w-full text-mint-300" preserveAspectRatio="none"><path d="M2 9c30-6 80-8 116-3" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" /></svg></span> first.
          </motion.h1>
          <motion.p {...item(2)} className="lead mt-6 max-w-xl">
            A10 Hospital brings specialist consultations, diagnostics and pharmacy together in one calm, connected experience — so you can book in minutes and keep every record close at hand.
          </motion.p>
          <motion.div {...item(3)} className="mt-9 flex flex-col gap-3 sm:flex-row">
            <ButtonLink to="/appointments/book" size="lg" icon={<CalendarPlus className="h-4.5 w-4.5" />}>Book an Appointment</ButtonLink>
            <ButtonLink to="/doctors" size="lg" variant="secondary" iconRight={<ArrowRight className="h-4 w-4" />}>Meet Our Doctors</ButtonLink>
          </motion.div>
          <motion.ul {...item(4)} className="mt-10 grid max-w-xl grid-cols-1 gap-3 text-sm text-muted-strong sm:grid-cols-3">
            {[
              [ShieldCheck, 'Verified clinicians'],
              [CalendarCheck2, 'Real-time availability'],
              [ScrollText, 'Records in one portal'],
            ].map(([Icon, label]) => (
              <li key={label as string} className="flex items-center gap-2"><Icon className="h-4.5 w-4.5 text-mint-500" />{label as string}</li>
            ))}
          </motion.ul>
        </div>
        <motion.div initial={reduce ? false : { opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }} className="relative">
          <div className="relative overflow-hidden rounded-[32px] border border-line shadow-[var(--shadow-lift)]">
            <motion.img style={{ y: imgY }} src="/images/hero-consultation.webp" alt="A doctor in conversation with a patient during a consultation" className="h-[440px] w-full scale-110 object-cover sm:h-[540px]" fetchPriority="high" />
            <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-forest/30 via-transparent to-transparent" />
          </div>
          <motion.div initial={reduce ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.5, ease: [0.22, 1, 0.36, 1] }} className="absolute -bottom-6 left-4 right-4 rounded-[22px] border border-white/60 bg-white/95 p-5 shadow-[var(--shadow-lift)] backdrop-blur sm:-left-8 sm:right-auto sm:w-[320px]">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-mint-100 text-mint-600"><CalendarCheck2 className="h-5 w-5" /></span>
              <div>
                <p className="text-[13px] text-muted">Book in three steps</p>
                <p className="font-display font-semibold text-forest">Speciality → Doctor → Time</p>
              </div>
            </div>
            <Link to="/appointments/book" className="mt-4 flex items-center justify-between rounded-xl bg-mint-50 px-4 py-3 text-sm font-medium text-forest transition-colors hover:bg-mint-100">
              See available times <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
          <motion.div initial={reduce ? false : { opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.7 }} className="absolute -right-2 top-6 hidden items-center gap-2 rounded-2xl border border-white/70 bg-white/95 px-4 py-3 shadow-[var(--shadow-soft)] sm:flex">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-mint-500" />
            <span className="text-[13px] font-medium text-forest">Online booking open</span>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}

function SectionHeading({ eyebrow, title, text, action }: { eyebrow: string; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <Reveal className="mb-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl">
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="display-lg mt-3">{title}</h2>
        {text && <p className="lead mt-4">{text}</p>}
      </div>
      {action}
    </Reveal>
  )
}

const pillars = [
  { icon: HeartHandshake, title: 'Unhurried, attentive care', text: 'Consultations planned around enough time to listen, explain and agree next steps together.' },
  { icon: ShieldCheck, title: 'Privacy by design', text: 'Your records are visible only to you and the clinicians involved in your care — enforced at the database level.' },
  { icon: Stethoscope, title: 'Connected specialists', text: 'Departments, diagnostics and pharmacy share one record, so follow-ups feel seamless.' },
]

export default function Home() {
  useDocumentTitle('')
  const { data: settings } = useSettings()
  const departments = useQuery({ queryKey: ['departments', ''], queryFn: () => listDepartments() })
  const doctors = useQuery({ queryKey: ['doctors', 'featured'], queryFn: () => listDoctors({ availableOnly: true, sort: 'experience', pageSize: 4 }) })
  const ids = doctors.data?.rows.map((d) => d.id) ?? []
  const slots = useQuery({ queryKey: ['next-slots', ids], queryFn: () => getNextSlots(ids), enabled: ids.length > 0 })

  return (
    <>
      <Hero />

      <section className="border-y border-line bg-mist/70 py-16 sm:py-20">
        <div className="container-page grid gap-10 lg:grid-cols-[0.9fr_1.6fr] lg:items-center">
          <Reveal>
            <p className="eyebrow">Our approach</p>
            <h2 className="mt-3 text-[1.8rem] font-semibold leading-tight sm:text-4xl">Care that feels personal, from the first booking onwards.</h2>
          </Reveal>
          <Stagger className="grid gap-4 sm:grid-cols-3">
            {pillars.map((p) => (
              <StaggerItem key={p.title} className="card p-6">
                <p.icon className="h-6 w-6 text-mint-600" />
                <h3 className="mt-4 text-base font-semibold">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{p.text}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      <section className="py-20 sm:py-28">
        <div className="container-page">
          <SectionHeading eyebrow="Specialities" title="Expertise across every stage of life" text="Explore our departments to see the services offered and the doctors available for appointments." action={<ButtonLink to="/departments" variant="secondary" iconRight={<ArrowRight className="h-4 w-4" />}>All specialities</ButtonLink>} />
          {departments.isLoading ? <LoadingSkeleton variant="cards" rows={6} /> : (
            <Stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {departments.data?.slice(0, 6).map((d) => <StaggerItem key={d.id}><DepartmentCard department={d} /></StaggerItem>)}
            </Stagger>
          )}
        </div>
      </section>

      <section className="bg-mist/70 py-20 sm:py-28">
        <div className="container-page">
          <SectionHeading eyebrow="Our doctors" title="Meet the people behind your care" text="Profiles show verified specialities, consultation details and live appointment availability." action={<ButtonLink to="/doctors" variant="secondary" iconRight={<ArrowRight className="h-4 w-4" />}>Find a doctor</ButtonLink>} />
          {doctors.isLoading ? <LoadingSkeleton variant="cards" rows={4} className="lg:grid-cols-4" /> : (
            <Stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {doctors.data?.rows.map((d) => <StaggerItem key={d.id}><DoctorCard doctor={d} nextSlot={slots.data ? slots.data[d.id] ?? null : undefined} /></StaggerItem>)}
            </Stagger>
          )}
          <p className="mt-6 text-[13px] text-muted">Profiles marked “Sample profile” are fictional demonstration content, not real hospital employees.</p>
        </div>
      </section>

      <section className="py-20 sm:py-28">
        <div className="container-page grid gap-14 lg:grid-cols-2 lg:items-center">
          <Reveal className="relative">
            <img src="/images/care-checkup.webp" alt="A clinician measuring a patient's blood pressure" loading="lazy" className="h-[460px] w-full rounded-[28px] object-cover" />
            <div className="absolute -bottom-5 right-5 rounded-2xl bg-forest px-5 py-4 text-white shadow-[var(--shadow-lift)]">
              <p className="text-[12px] uppercase tracking-[0.14em] text-mint-300">Your confirmation</p>
              <p className="font-display text-lg font-semibold">Reference, time & status</p>
            </div>
          </Reveal>
          <div>
            <SectionHeading eyebrow="Appointments" title="Booking that takes minutes, not phone calls" />
            <ol className="space-y-5">
              {[
                [UserRoundSearch, 'Choose a speciality and doctor', 'Browse departments and compare doctors by availability, experience and language.'],
                [CalendarCheck2, 'Pick a time that suits you', 'Only genuinely free slots are shown, in hospital time. Your slot is re-checked as you confirm.'],
                [ClipboardCheck, 'Review and confirm', 'You receive a reference instantly; the care team confirms your request, and every update appears in your portal.'],
              ].map(([Icon, title, text], i) => (
                <Reveal key={title as string} delay={i * 0.08} as="li" className="flex gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-mint-100 font-display font-bold text-forest">{i + 1}</span>
                  <div>
                    <h3 className="flex items-center gap-2 text-base font-semibold"><Icon className="h-4 w-4 text-mint-600" />{title as string}</h3>
                    <p className="mt-1 text-[15px] text-muted">{text as string}</p>
                  </div>
                </Reveal>
              ))}
            </ol>
            <ButtonLink to="/appointments/book" size="lg" className="mt-9" icon={<CalendarPlus className="h-4.5 w-4.5" />}>Book an Appointment</ButtonLink>
          </div>
        </div>
      </section>

      <section className="bg-mist/70 py-20 sm:py-28">
        <div className="container-page">
          <SectionHeading eyebrow="Patient services" title="Everything around your visit, in one place" />
          <Stagger className="grid gap-5 md:grid-cols-3">
            {[
              { icon: ScrollText, title: 'Patient portal', text: 'View appointments, prescriptions and released lab reports securely.', to: '/services', cta: 'Explore services', img: '/images/reception.webp' },
              { icon: Pill, title: 'Pharmacy & prescriptions', text: 'Order medication for delivery. Prescription-only items are verified by a pharmacist first.', to: '/pharmacy', cta: 'Visit the pharmacy', img: '/images/pharmacy.webp' },
              { icon: FlaskConical, title: 'Diagnostics & laboratory', text: 'Sample collection, imaging and testing, with reports released to your portal when finalised.', to: '/departments/diagnostics', cta: 'About diagnostics', img: '/images/laboratory.webp' },
            ].map((s) => (
              <StaggerItem key={s.title}>
                <Link to={s.to} className="card card-hover group flex h-full flex-col overflow-hidden">
                  <div className="overflow-hidden"><img src={s.img} alt="" loading="lazy" className="h-48 w-full object-cover transition-transform duration-700 ease-[var(--ease-out-soft)] group-hover:scale-105" /></div>
                  <div className="flex flex-1 flex-col p-6">
                    <s.icon className="h-6 w-6 text-mint-600" />
                    <h3 className="mt-3 text-lg font-semibold">{s.title}</h3>
                    <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted">{s.text}</p>
                    <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-mint-700">{s.cta}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
                  </div>
                </Link>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      <section className="py-20 sm:py-28">
        <div className="container-page">
          <Reveal className="relative overflow-hidden rounded-[32px] bg-forest">
            <img src="/images/community.webp" alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-25" />
            <div className="relative grid gap-8 p-8 sm:p-12 lg:grid-cols-[1.4fr_1fr] lg:items-end lg:p-16">
              <div>
                <p className="eyebrow !text-mint-300"><HandHeart className="h-4 w-4" />Community support</p>
                <h2 className="mt-3 text-3xl font-semibold !text-white sm:text-[2.6rem] sm:leading-tight">Help us extend care to those who need it most.</h2>
                <p className="mt-4 max-w-xl text-white/75">Donations support patients facing financial hardship, children’s care and community health programmes.</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
                <ButtonLink to="/donations" variant="mint" size="lg">Make a donation</ButtonLink>
                <ButtonLink to="/about#community" size="lg" className="border border-white/25 bg-transparent shadow-none hover:bg-white/10">Our community work</ButtonLink>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="pb-8">
        <div className="container-page grid gap-6 lg:grid-cols-3">
          <Reveal className="card p-7 lg:col-span-2">
            <p className="eyebrow">Visit & contact</p>
            <h2 className="mt-3 text-2xl font-semibold">We’re here to help</h2>
            <div className="mt-6 grid gap-5 sm:grid-cols-3">
              <div><Phone className="h-5 w-5 text-mint-600" /><p className="mt-2 text-sm text-muted">Phone</p><p className="font-medium text-forest">{settings?.contact_phone ?? '—'}</p></div>
              <div><MapPin className="h-5 w-5 text-mint-600" /><p className="mt-2 text-sm text-muted">Address</p><p className="font-medium text-forest">{settings?.address ?? '—'}</p></div>
              <div><CalendarCheck2 className="h-5 w-5 text-mint-600" /><p className="mt-2 text-sm text-muted">Hours</p><p className="font-medium text-forest">{settings?.opening_hours ?? '—'}</p></div>
            </div>
            <p className="mt-5 text-xs text-muted">{PLACEHOLDER_NOTE}</p>
          </Reveal>
          <Reveal delay={0.08} className="flex flex-col justify-between rounded-[var(--radius-card)] bg-mint-100 p-7">
            <div>
              <h2 className="text-2xl font-semibold">Ready when you are</h2>
              <p className="mt-2 text-muted-strong">Find the right specialist and choose a time that works for you.</p>
            </div>
            <div className="mt-6 grid gap-2">
              <ButtonLink to="/appointments/book" icon={<CalendarPlus className="h-4 w-4" />}>Book an Appointment</ButtonLink>
              <ButtonLink to="/contact" variant="secondary">Contact us</ButtonLink>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  )
}
