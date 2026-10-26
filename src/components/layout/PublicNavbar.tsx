import { CalendarPlus, ChevronDown, FlaskConical, HandHeart, LayoutDashboard, LogOut, Menu, Pill, Stethoscope } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { DropdownMenu } from 'radix-ui'
import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router'
import { homeFor, useAuth } from '@/app/auth'
import { ButtonLink } from '@/components/common/Button'
import { Drawer } from '@/components/common/Dialog'
import { Avatar } from '@/components/common/Layout'
import { Logo } from '@/components/common/Logo'
import { cn } from '@/lib/utils'

const primary = [
  { to: '/', label: 'Home', end: true },
  { to: '/about', label: 'About Us' },
  { to: '/doctors', label: 'Find a Doctor' },
  { to: '/departments', label: 'Specialities' },
]
const services = [
  { to: '/services', label: 'Patient Services', desc: 'Outpatient care, records and support', icon: Stethoscope },
  { to: '/pharmacy', label: 'Pharmacy', desc: 'Order medication for home delivery', icon: Pill },
  { to: '/departments/diagnostics', label: 'Diagnostics & Lab', desc: 'Testing with results in your portal', icon: FlaskConical },
  { to: '/donations', label: 'Donations', desc: 'Support patients and community care', icon: HandHeart },
]
const trailing = [{ to: '/contact', label: 'Contact' }]

function DesktopLink({ to, label, end }: { to: string; label: string; end?: boolean }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => cn('relative rounded-lg px-3 py-2 text-[14.5px] font-medium transition-colors', isActive ? 'text-forest' : 'text-muted-strong hover:text-forest')}>
      {({ isActive }) => (
        <>
          {label}
          {isActive && <motion.span layoutId="nav-indicator" className="absolute inset-x-3 -bottom-0.5 h-[2px] rounded-full bg-mint-500" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
        </>
      )}
    </NavLink>
  )
}

export function PublicNavbar() {
  const { status, access, signOut } = useAuth()
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const servicesActive = services.some((s) => location.pathname.startsWith(s.to))

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  useEffect(() => setOpen(false), [location.pathname])

  return (
    <header className={cn('sticky top-0 z-40 transition-[background-color,box-shadow,border-color] duration-300', scrolled ? 'border-b border-line/80 bg-white/90 shadow-[0_6px_24px_-18px_rgb(22_61_48/0.35)] backdrop-blur-md' : 'border-b border-transparent bg-white')}>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-forest focus:px-4 focus:py-2 focus:text-white">Skip to content</a>
      <div className="container-page flex h-[72px] items-center justify-between gap-4">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-0.5 lg:flex">
          {primary.map((l) => <DesktopLink key={l.to} {...l} />)}
          <DropdownMenu.Root modal={false}>
            <DropdownMenu.Trigger className={cn('group relative flex items-center gap-1 rounded-lg px-3 py-2 text-[14.5px] font-medium outline-none transition-colors data-[state=open]:text-forest', servicesActive ? 'text-forest' : 'text-muted-strong hover:text-forest')}>
              Services <ChevronDown className="h-4 w-4 transition-transform duration-300 group-data-[state=open]:rotate-180" />
              {servicesActive && <motion.span layoutId="nav-indicator" className="absolute inset-x-3 -bottom-0.5 h-[2px] rounded-full bg-mint-500" />}
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content align="center" sideOffset={12} className="z-50 w-[420px] origin-top rounded-[var(--radius-panel)] border border-line bg-white p-2 shadow-[var(--shadow-lift)] data-[state=open]:animate-[menu-in_220ms_var(--ease-out-soft)]">
                {services.map((s) => (
                  <DropdownMenu.Item key={s.to} asChild>
                    <Link to={s.to} className="flex items-start gap-3 rounded-2xl p-3 outline-none transition-colors data-[highlighted]:bg-mint-50">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-mint-100 text-mint-600"><s.icon className="h-5 w-5" /></span>
                      <span>
                        <span className="block text-sm font-semibold text-forest">{s.label}</span>
                        <span className="block text-[13px] text-muted">{s.desc}</span>
                      </span>
                    </Link>
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
          {trailing.map((l) => <DesktopLink key={l.to} {...l} />)}
        </nav>
        <div className="flex items-center gap-2">
          {status === 'signed-in' && access ? (
            <DropdownMenu.Root modal={false}>
              <DropdownMenu.Trigger className="hidden items-center gap-2 rounded-xl py-1 pl-1 pr-2 outline-none transition-colors hover:bg-mint-50 focus-visible:shadow-[var(--shadow-ring)] sm:flex" aria-label="Account menu">
                <Avatar name={access.full_name || access.email} size="sm" />
                <ChevronDown className="h-4 w-4 text-muted" />
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content align="end" sideOffset={8} className="z-50 w-60 rounded-2xl border border-line bg-white p-1.5 shadow-[var(--shadow-lift)]">
                  <div className="px-3 py-2">
                    <p className="truncate text-sm font-semibold text-forest">{access.full_name || 'Your account'}</p>
                    <p className="truncate text-xs text-muted">{access.email}</p>
                  </div>
                  <DropdownMenu.Separator className="my-1 h-px bg-line" />
                  <DropdownMenu.Item asChild>
                    <Link to={homeFor(access)} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm outline-none data-[highlighted]:bg-mint-50"><LayoutDashboard className="h-4 w-4" /> My portal</Link>
                  </DropdownMenu.Item>
                  <DropdownMenu.Item onSelect={() => void signOut()} className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm text-error outline-none data-[highlighted]:bg-error/5">
                    <LogOut className="h-4 w-4" /> Sign out
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          ) : (
            <Link to="/signin" className="hidden rounded-lg px-3 py-2 text-[14.5px] font-medium text-forest transition-colors hover:bg-mint-50 sm:block">Sign in</Link>
          )}
          <ButtonLink to="/appointments/book" className="hidden sm:inline-flex" icon={<CalendarPlus className="h-4 w-4" />}>Book an Appointment</ButtonLink>
          <button onClick={() => setOpen(true)} className="flex h-11 w-11 items-center justify-center rounded-xl text-forest transition-colors hover:bg-mint-50 lg:hidden" aria-label="Open menu" aria-expanded={open}>
            <Menu className="h-6 w-6" />
          </button>
        </div>
      </div>

      <Drawer open={open} onOpenChange={setOpen} title="Menu" footer={
        <div className="grid gap-2">
          <ButtonLink to="/appointments/book" size="lg" icon={<CalendarPlus className="h-4 w-4" />}>Book an Appointment</ButtonLink>
          {status === 'signed-in' && access ? (
            <div className="grid grid-cols-2 gap-2">
              <ButtonLink to={homeFor(access)} variant="secondary">My portal</ButtonLink>
              <button onClick={() => void signOut()} className="h-11 rounded-[var(--radius-control)] border border-line-strong text-sm font-medium text-error">Sign out</button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <ButtonLink to="/signin" variant="secondary">Sign in</ButtonLink>
              <ButtonLink to="/signup" variant="soft">Create account</ButtonLink>
            </div>
          )}
        </div>
      }>
        <nav aria-label="Mobile" className="p-3">
          <AnimatePresence>
            {[...primary, ...services.map((s) => ({ to: s.to, label: s.label, end: false })), ...trailing].map((l, i) => (
              <motion.div key={l.to} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.04 * i + 0.08, duration: 0.35 }}>
                <NavLink to={l.to} end={(l as { end?: boolean }).end} className={({ isActive }) => cn('flex min-h-12 items-center rounded-xl px-4 text-[16px] font-medium transition-colors', isActive ? 'bg-mint-100 text-forest' : 'text-ink hover:bg-mint-50')}>
                  {l.label}
                </NavLink>
              </motion.div>
            ))}
          </AnimatePresence>
        </nav>
      </Drawer>
    </header>
  )
}
