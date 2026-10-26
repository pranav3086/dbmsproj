import { ShieldCheck } from 'lucide-react'
import { motion } from 'motion/react'
import type { ReactNode } from 'react'

export function AuthShell({ title, subtitle, children, aside }: { title: string; subtitle?: ReactNode; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute -left-32 top-10 h-96 w-96 rounded-full bg-mint-100 blur-3xl" />
      <div className="container-page relative grid gap-10 py-10 sm:py-14 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} className="order-2 hidden lg:order-1 lg:block">
          <div className="sticky top-28 overflow-hidden rounded-[28px] border border-line bg-forest">
            <img src="/images/diagnostics-review.webp" alt="A clinician reviewing results with a colleague" className="h-[420px] w-full object-cover opacity-90" />
            <div className="p-8 text-white">
              <p className="font-display text-2xl font-semibold leading-snug text-white">Your care, records and appointments — in one calm, secure place.</p>
              <ul className="mt-5 space-y-2.5 text-[14.5px] text-white/75">
                <li className="flex gap-2.5"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-mint-300" />Access to records is limited by role and enforced in the database.</li>
                <li className="flex gap-2.5"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-mint-300" />Healthcare professionals are verified before clinical access.</li>
              </ul>
              {aside}
            </div>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.06, ease: [0.22, 1, 0.36, 1] }} className="order-1 mx-auto w-full max-w-[520px] lg:order-2">
          <h1 className="display-lg">{title}</h1>
          {subtitle && <p className="mt-2 text-[15.5px] text-muted">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </motion.div>
      </div>
    </div>
  )
}

export function FormAlert({ tone = 'error', children }: { tone?: 'error' | 'success' | 'info'; children: ReactNode }) {
  const styles = {
    error: 'border-error/25 bg-[#fdf3f2] text-[#9b3b3b]',
    success: 'border-success/25 bg-[#eef8f2] text-success',
    info: 'border-mint-300 bg-mint-50 text-forest',
  }
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-[var(--radius-control)] border px-4 py-3 text-sm ${styles[tone]}`}>
      {children}
    </div>
  )
}
