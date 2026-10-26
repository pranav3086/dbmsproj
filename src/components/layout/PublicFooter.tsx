import { Mail, MapPin, Phone, Siren } from 'lucide-react'
import { Link } from 'react-router'
import { Logo } from '@/components/common/Logo'
import { PLACEHOLDER_NOTE, useSettings } from '@/hooks/useSettings'
import { isDemo } from '@/lib/config'

const columns = [
  { title: 'Care', links: [['Find a Doctor', '/doctors'], ['Specialities', '/departments'], ['Book an Appointment', '/appointments/book'], ['Diagnostics & Lab', '/departments/diagnostics']] },
  { title: 'Services', links: [['Patient Services', '/services'], ['Pharmacy', '/pharmacy'], ['Donations', '/donations'], ['Patient Portal', '/signin']] },
  { title: 'Hospital', links: [['About Us', '/about'], ['Contact', '/contact'], ['Privacy Notice', '/privacy'], ['Terms of Use', '/terms']] },
]

export function PublicFooter() {
  const { data: s } = useSettings()
  return (
    <footer className="relative mt-24 overflow-hidden bg-forest text-white">
      <div aria-hidden className="pointer-events-none absolute -right-40 -top-40 h-[420px] w-[420px] rounded-full bg-mint-400/10 blur-3xl" />
      <div className="container-page relative grid gap-12 py-16 lg:grid-cols-[1.3fr_2fr]">
        <div>
          <Logo inverted />
          <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-white/70">Exceptional Care. Thoughtfully Delivered. A patient-first private hospital experience — from booking to recovery.</p>
          <ul className="mt-7 space-y-3 text-sm text-white/80">
            <li className="flex items-center gap-3"><Phone className="h-4 w-4 text-mint-300" />{s?.contact_phone ?? '—'}</li>
            <li className="flex items-center gap-3"><Mail className="h-4 w-4 text-mint-300" />{s?.contact_email ?? '—'}</li>
            <li className="flex items-center gap-3"><MapPin className="h-4 w-4 text-mint-300" />{s?.address ?? '—'}</li>
          </ul>
          <p className="mt-3 text-xs text-white/45">{PLACEHOLDER_NOTE}</p>
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          {columns.map((c) => (
            <div key={c.title}>
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-mint-300">{c.title}</h2>
              <ul className="mt-4 space-y-2.5">
                {c.links.map(([label, to]) => (
                  <li key={to}><Link to={to} className="rounded text-[15px] text-white/75 transition-colors hover:text-white">{label}</Link></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-3 py-6 text-[13px] text-white/55 md:flex-row md:items-center md:justify-between">
          <p className="flex items-start gap-2"><Siren className="mt-0.5 h-4 w-4 shrink-0 text-mint-300" />In a medical emergency, call {s?.emergency_phone ?? '112'} or go to the nearest emergency department. Do not use online booking or forms for urgent care.</p>
          <p className="shrink-0">© {new Date().getFullYear()} A10 Hospital{isDemo && ' · Demonstration build with sample data'}</p>
        </div>
      </div>
    </footer>
  )
}
