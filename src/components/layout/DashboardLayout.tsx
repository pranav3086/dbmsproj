import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bell, BookOpenCheck, Building2, CalendarClock, CalendarPlus, ClipboardList, FileText, FlaskConical, HandHeart, HeartPulse,
  Inbox, LayoutDashboard, LogOut, Mail, Menu, Package, Pill, ScrollText, ShieldCheck, Stethoscope, UserCog, UserRound, Users, Warehouse,
  type LucideIcon,
} from 'lucide-react'
import { motion } from 'motion/react'
import { Popover } from 'radix-ui'
import { Suspense, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { useAuth } from '@/app/auth'
import { Drawer } from '@/components/common/Dialog'
import { Avatar } from '@/components/common/Layout'
import { Logo } from '@/components/common/Logo'
import { LoadingSkeleton } from '@/components/common/States'
import { cn, relativeTime } from '@/lib/utils'
import { listNotifications, markAllNotificationsRead } from '@/services/account'
import type { Access } from '@/types/models'
import { DemoBanner } from './DemoBanner'
import { PageTransition } from './PublicLayout'

export type Portal = 'patient' | 'doctor' | 'staff' | 'admin'
interface NavItem { to: string; label: string; icon: LucideIcon; end?: boolean }

export function navFor(portal: Portal, access: Access | null): NavItem[] {
  switch (portal) {
    case 'patient':
      return [
        { to: '/patient/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/patient/appointments', label: 'My appointments', icon: CalendarClock },
        { to: '/appointments/book', label: 'Book appointment', icon: CalendarPlus },
        { to: '/patient/prescriptions', label: 'Prescriptions', icon: ScrollText },
        { to: '/patient/lab-reports', label: 'Lab reports', icon: FlaskConical },
        { to: '/patient/pharmacy', label: 'Order medication', icon: Pill },
        { to: '/patient/orders', label: 'My orders', icon: Package },
        { to: '/patient/donations', label: 'My donations', icon: HandHeart },
        { to: '/patient/profile', label: 'Profile', icon: UserRound },
      ]
    case 'doctor':
      return [
        { to: '/doctor/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/doctor/appointments', label: 'Appointments', icon: CalendarClock },
        { to: '/doctor/patients', label: 'Patient records', icon: Users },
        { to: '/doctor/prescriptions', label: 'Prescriptions', icon: ScrollText },
        { to: '/doctor/lab-records', label: 'Lab records', icon: FlaskConical },
        { to: '/doctor/observations', label: 'Observations', icon: HeartPulse },
        { to: '/doctor/profile', label: 'Profile & availability', icon: UserCog },
      ]
    case 'staff': {
      const p = access?.permissions ?? []
      return [
        { to: '/staff/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        ...(p.includes('appointments') ? [{ to: '/staff/appointments', label: 'Appointments', icon: CalendarClock }] : []),
        ...(p.includes('patient_admin') || p.includes('lab_records') ? [{ to: '/staff/patients', label: 'Patient records', icon: Users }] : []),
        ...(p.includes('lab_records') ? [{ to: '/staff/lab-records', label: 'Lab records', icon: FlaskConical }] : []),
        ...(p.includes('pharmacy') ? [{ to: '/staff/orders', label: 'Medication orders', icon: Package }, { to: '/staff/medicines', label: 'Inventory', icon: Warehouse }] : []),
      ]
    }
    case 'admin':
      return [
        { to: '/admin/dashboard', label: 'Overview', icon: LayoutDashboard },
        { to: '/admin/doctors', label: 'Doctors & verification', icon: ShieldCheck },
        { to: '/admin/users', label: 'Users & staff', icon: Users },
        { to: '/admin/appointments', label: 'Appointments', icon: CalendarClock },
        { to: '/admin/departments', label: 'Departments', icon: Building2 },
        { to: '/admin/medicines', label: 'Medicines', icon: Pill },
        { to: '/admin/orders', label: 'Orders', icon: Package },
        { to: '/admin/donations', label: 'Donations', icon: HandHeart },
        { to: '/admin/messages', label: 'Messages', icon: Inbox },
        { to: '/admin/outbox', label: 'Email outbox', icon: Mail },
        { to: '/admin/audit', label: 'Audit log', icon: BookOpenCheck },
      ]
  }
}

const portalMeta: Record<Portal, { label: string; icon: LucideIcon; home: string }> = {
  patient: { label: 'Patient portal', icon: HeartPulse, home: '/patient/dashboard' },
  doctor: { label: 'Clinical portal', icon: Stethoscope, home: '/doctor/dashboard' },
  staff: { label: 'Staff portal', icon: ClipboardList, home: '/staff/dashboard' },
  admin: { label: 'Administration', icon: FileText, home: '/admin/dashboard' },
}

function SidebarNav({ portal, access, onNavigate }: { portal: Portal; access: Access | null; onNavigate?: () => void }) {
  const items = navFor(portal, access)
  const others = (access?.roles ?? []).filter((r) => r !== portal) as Portal[]
  return (
    <nav aria-label={portalMeta[portal].label} className="flex flex-col gap-0.5">
      {items.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.end} onClick={onNavigate} className={({ isActive }) => cn('relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-[14.5px] font-medium transition-colors', isActive ? 'text-forest' : 'text-muted-strong hover:bg-mint-50 hover:text-forest')}>
          {({ isActive }) => (
            <>
              {isActive && <motion.span layoutId={`side-${portal}`} className="absolute inset-0 rounded-xl bg-mint-100" transition={{ type: 'spring', stiffness: 480, damping: 40 }} />}
              <item.icon className={cn('relative h-[18px] w-[18px]', isActive ? 'text-mint-600' : 'text-muted')} />
              <span className="relative">{item.label}</span>
            </>
          )}
        </NavLink>
      ))}
      {others.length > 0 && (
        <div className="mt-6 border-t border-line pt-4">
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Switch portal</p>
          {others.map((o) => {
            const M = portalMeta[o]
            return (
              <Link key={o} to={M.home} onClick={onNavigate} className="flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm text-muted-strong hover:bg-mint-50 hover:text-forest">
                <M.icon className="h-4 w-4" /> {M.label}
              </Link>
            )
          })}
        </div>
      )}
    </nav>
  )
}

function NotificationBell() {
  const qc = useQueryClient()
  const { data = [] } = useQuery({ queryKey: ['notifications'], queryFn: () => listNotifications(), refetchInterval: 60_000 })
  const unread = data.filter((n) => !n.read_at).length
  const markRead = useMutation({ mutationFn: markAllNotificationsRead, onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) })
  return (
    <Popover.Root onOpenChange={(o) => !o && unread > 0 && markRead.mutate()}>
      <Popover.Trigger className="relative flex h-10 w-10 items-center justify-center rounded-xl text-forest transition-colors hover:bg-mint-50" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
        <Bell className="h-5 w-5" />
        {unread > 0 && <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] font-bold text-white">{unread}</span>}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={8} className="z-50 w-[min(380px,calc(100vw-24px))] rounded-[var(--radius-card)] border border-line bg-white shadow-[var(--shadow-lift)] data-[state=open]:animate-[menu-in_200ms_var(--ease-out-soft)]">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="font-display font-semibold text-forest">Notifications</p>
            {unread > 0 && <span className="text-xs text-muted">{unread} unread</span>}
          </div>
          <ul className="max-h-96 divide-y divide-line overflow-y-auto">
            {data.length === 0 && <li className="px-4 py-10 text-center text-sm text-muted">You’re all caught up.</li>}
            {data.map((n) => (
              <li key={n.id}>
                <Popover.Close asChild>
                  <Link to={n.link ?? '#'} className={cn('block px-4 py-3 transition-colors hover:bg-mint-50', !n.read_at && 'bg-mint-50/50')}>
                    <p className="flex items-center gap-2 text-sm font-medium text-forest">{!n.read_at && <span className="h-1.5 w-1.5 rounded-full bg-mint-500" />}{n.title}</p>
                    <p className="mt-0.5 text-[13px] text-muted">{n.body}</p>
                    <p className="mt-1 text-[11.5px] text-muted/80">{relativeTime(n.created_at)}</p>
                  </Link>
                </Popover.Close>
              </li>
            ))}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

export function DashboardLayout({ portal }: { portal: Portal }) {
  const { access, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  useEffect(() => setOpen(false), [pathname])
  const meta = portalMeta[portal]

  return (
    <div className="flex min-h-dvh flex-col bg-mist">
      <DemoBanner />
      <div className="flex flex-1">
        <aside className="no-print sticky top-0 hidden h-dvh w-[268px] shrink-0 flex-col border-r border-line bg-white px-4 py-5 lg:flex">
          <Logo className="px-2" />
          <div className="mx-2 mt-6 mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted"><meta.icon className="h-3.5 w-3.5" />{meta.label}</div>
          <div className="flex-1 overflow-y-auto"><SidebarNav portal={portal} access={access} /></div>
          <div className="mt-4 rounded-2xl border border-line bg-mist p-3">
            <div className="flex items-center gap-3">
              <Avatar name={access?.full_name || access?.email || '?'} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-forest">{access?.full_name || 'Account'}</p>
                <p className="truncate text-xs text-muted">{access?.email}</p>
              </div>
              <button onClick={() => void signOut()} className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-white hover:text-error" aria-label="Sign out"><LogOut className="h-4 w-4" /></button>
            </div>
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="no-print sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-line bg-white/90 px-4 backdrop-blur-md sm:px-6">
            <div className="flex items-center gap-2">
              <button onClick={() => setOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-xl text-forest hover:bg-mint-50 lg:hidden" aria-label="Open navigation"><Menu className="h-5 w-5" /></button>
              <div className="lg:hidden"><Logo compact /></div>
              <Link to="/" className="hidden rounded text-sm text-muted transition-colors hover:text-forest lg:block">← Back to website</Link>
            </div>
            <div className="flex items-center gap-1">
              <NotificationBell />
              <Link to={`/${portal === 'admin' ? 'admin/dashboard' : portal + '/dashboard'}`} className="hidden sm:block"><Avatar name={access?.full_name || access?.email || '?'} size="sm" /></Link>
            </div>
          </header>
          <main id="main" className="flex-1 px-4 py-7 sm:px-6 lg:px-10 lg:py-9">
            <div className="mx-auto max-w-[1200px]">
              <Suspense fallback={<LoadingSkeleton variant="detail" rows={6} />}>
                <PageTransition><Outlet /></PageTransition>
              </Suspense>
            </div>
          </main>
        </div>
      </div>
      <Drawer open={open} onOpenChange={setOpen} side="left" title={meta.label} className="max-w-[300px]" footer={
        <button onClick={() => void signOut()} className="flex w-full items-center justify-center gap-2 rounded-xl border border-line py-3 text-sm font-medium text-error"><LogOut className="h-4 w-4" />Sign out</button>
      }>
        <div className="p-3"><SidebarNav portal={portal} access={access} onNavigate={() => setOpen(false)} /></div>
      </Drawer>
    </div>
  )
}
