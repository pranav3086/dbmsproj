import { useQuery } from '@tanstack/react-query'
import { CalendarClock, HandHeart, Inbox, Mail, Package, ShieldCheck, Users, Warehouse } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { PageHeader, StatCard } from '@/components/common/Layout'
import { ErrorState, LoadingSkeleton } from '@/components/common/States'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { formatCalendarDate, formatMoney, hospitalDateKey, titleCase } from '@/lib/utils'
import { adminOverview } from '@/services/account'

export default function AdminDashboard() {
  useDocumentTitle('Administration')
  const o = useQuery({ queryKey: ['admin-overview'], queryFn: adminOverview })
  if (o.isLoading) return <LoadingSkeleton variant="detail" rows={8} />
  if (o.error || !o.data) return <ErrorState error={o.error} onRetry={() => o.refetch()} />
  const d = o.data
  const today = hospitalDateKey()
  const byDay = d.appointments_by_day.map((x) => ({ ...x, label: formatCalendarDate(x.day).replace(/ \d{4}$/, ''), isToday: x.day === today }))
  const orders = Object.entries(d.orders_by_status).map(([status, count]) => ({ status: titleCase(status), count }))
  return (
    <>
      <PageHeader title="Operations overview" description="A summary of activity across the hospital platform." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Pending doctor verifications" value={d.pending_doctor_applications} icon={<ShieldCheck className="h-4.5 w-4.5" />} to="/admin/doctors" tone={d.pending_doctor_applications ? 'warning' : 'mint'} />
        <StatCard label="Appointments today" value={d.appointments_today} icon={<CalendarClock className="h-4.5 w-4.5" />} to="/admin/appointments" tone="forest" />
        <StatCard label="Awaiting confirmation" value={d.appointments_requested} icon={<CalendarClock className="h-4.5 w-4.5" />} to="/admin/appointments" />
        <StatCard label="Users" value={Object.values(d.users_by_role).reduce((a, b) => a + b, 0)} hint={Object.entries(d.users_by_role).map(([r, n]) => `${n} ${r}`).join(' · ')} icon={<Users className="h-4.5 w-4.5" />} to="/admin/users" />
        <StatCard label="New messages" value={d.new_contact_messages} icon={<Inbox className="h-4.5 w-4.5" />} to="/admin/messages" />
        <StatCard label="Low-stock medicines" value={d.low_stock} icon={<Warehouse className="h-4.5 w-4.5" />} to="/admin/medicines" />
        <StatCard label="Donations recorded" value={d.donations.count} hint={`${formatMoney(d.donations.simulated_total)} simulated · ${formatMoney(d.donations.paid_total)} paid`} icon={<HandHeart className="h-4.5 w-4.5" />} to="/admin/donations" />
        <StatCard label="Queued emails" value={d.queued_emails} hint="Awaiting delivery worker" icon={<Mail className="h-4.5 w-4.5" />} to="/admin/outbox" />
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <section className="card p-6">
          <h2 className="text-base font-semibold">Appointments (last 7 days and next 7)</h2>
          <p className="text-[13px] text-muted">Excludes cancellations</p>
          <div className="mt-4 h-64" role="img" aria-label="Bar chart of appointments per day">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byDay} margin={{ left: -20, right: 8 }}>
                <CartesianGrid vertical={false} stroke="#e2ebe5" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#718078' }} tickLine={false} axisLine={false} interval={1} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#718078' }} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: '#f1faf5' }} contentStyle={{ borderRadius: 12, border: '1px solid #e2ebe5' }} />
                <Bar dataKey="count" name="Appointments" fill="#399b73" radius={[6, 6, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="card p-6">
          <h2 className="flex items-center gap-2 text-base font-semibold"><Package className="h-4 w-4 text-mint-600" />Orders by status</h2>
          {orders.length ? (
            <ul className="mt-4 space-y-3">
              {orders.map((x) => {
                const max = Math.max(...orders.map((y) => y.count))
                return (
                  <li key={x.status}>
                    <div className="flex justify-between text-sm"><span className="text-muted-strong">{x.status}</span><span className="font-semibold tabular-nums text-forest">{x.count}</span></div>
                    <div className="mt-1 h-2 rounded-full bg-mint-50"><div className="h-2 rounded-full bg-mint-500" style={{ width: `${(x.count / max) * 100}%` }} /></div>
                  </li>
                )
              })}
            </ul>
          ) : <p className="mt-4 text-sm text-muted">No orders yet.</p>}
        </section>
      </div>
    </>
  )
}
