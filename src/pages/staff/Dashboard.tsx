import { useQuery } from '@tanstack/react-query'
import { CalendarClock, ClipboardList, FlaskConical, Package, Users, Warehouse } from 'lucide-react'
import { Link } from 'react-router'
import { useAuth } from '@/app/auth'
import { Badge, StatusBadge } from '@/components/common/Badge'
import { PageHeader, StatCard } from '@/components/common/Layout'
import { EmptyState } from '@/components/common/States'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { addDaysKey, formatDate, formatTime, hospitalDateKey, hospitalDayStartIso, titleCase } from '@/lib/utils'
import { listAppointments } from '@/services/appointments'
import { listLabReports } from '@/services/clinical'
import { listMedicines, listOrders } from '@/services/pharmacy'

export default function StaffDashboard() {
  useDocumentTitle('Staff dashboard')
  const { access, can } = useAuth()
  const today = hospitalDateKey()
  const appts = useQuery({ queryKey: ['appointments', 'staff-today', today], queryFn: () => listAppointments({ from: hospitalDayStartIso(today), to: hospitalDayStartIso(addDaysKey(today, 1)), limit: 100 }), enabled: can('appointments') })
  const requests = useQuery({ queryKey: ['appointments', 'staff-requests'], queryFn: () => listAppointments({ scope: 'upcoming', statuses: ['requested'], limit: 1 }), enabled: can('appointments') })
  const labs = useQuery({ queryKey: ['lab-reports', 'staff-open'], queryFn: () => listLabReports({ statuses: ['ordered', 'collected', 'in_progress'] }), enabled: can('lab_records') })
  const orders = useQuery({ queryKey: ['orders', 'staff-open'], queryFn: () => listOrders({ statuses: ['placed', 'pending_review', 'approved', 'processing'] }), enabled: can('pharmacy') })
  const lowStock = useQuery({ queryKey: ['medicines', 'low'], queryFn: async () => (await listMedicines({ limit: 200 })).rows.filter((m) => m.stock < 20), enabled: can('pharmacy') })

  return (
    <>
      <PageHeader eyebrow={formatDate(new Date(), { weekday: 'long' })} title={`Hello, ${access?.full_name?.split(' ')[0] || 'there'}`} description="Your operational tools, based on the permissions assigned to you." />
      <div className="mb-8 flex flex-wrap gap-2">{access?.permissions.length ? access.permissions.map((p) => <Badge key={p} tone="mint">{titleCase(p)}</Badge>) : <Badge tone="warning">No permissions assigned</Badge>}</div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {can('appointments') && <StatCard label="Appointments today" value={appts.data?.rows.filter((a) => a.status !== 'cancelled').length ?? '–'} icon={<CalendarClock className="h-4.5 w-4.5" />} to="/staff/appointments" tone="forest" />}
        {can('appointments') && <StatCard label="Pending requests" value={requests.data?.count ?? '–'} icon={<ClipboardList className="h-4.5 w-4.5" />} to="/staff/appointments" tone="warning" />}
        {can('lab_records') && <StatCard label="Lab records open" value={labs.data?.length ?? '–'} icon={<FlaskConical className="h-4.5 w-4.5" />} to="/staff/lab-records" />}
        {can('pharmacy') && <StatCard label="Orders to process" value={orders.data?.length ?? '–'} icon={<Package className="h-4.5 w-4.5" />} to="/staff/orders" tone="warning" />}
        {can('pharmacy') && <StatCard label="Low-stock items" value={lowStock.data?.length ?? '–'} icon={<Warehouse className="h-4.5 w-4.5" />} to="/staff/medicines" />}
        {(can('patient_admin') || can('lab_records')) && <StatCard label="Patient lookup" value={<Users className="h-7 w-7" />} to="/staff/patients" />}
      </div>
      {!access?.permissions.length && <EmptyState className="mt-8" title="No tools assigned yet" description="An administrator needs to grant you permissions before staff tools appear." />}
      {can('appointments') && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">Today’s schedule</h2>
          {!appts.data?.rows.length ? <EmptyState title="No appointments today" /> : (
            <ul className="card divide-y divide-line">
              {appts.data.rows.map((a) => <li key={a.id} className="flex items-center gap-4 p-4"><span className="w-20 font-semibold text-forest">{formatTime(a.starts_at)}</span><div className="min-w-0 flex-1"><p className="font-medium">{a.patient_name}</p><p className="text-[13px] text-muted">{a.doctor_name} · {a.department_name}</p></div><StatusBadge status={a.status} /></li>)}
            </ul>
          )}
        </section>
      )}
      {can('pharmacy') && !!orders.data?.length && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">Orders awaiting action</h2>
          <ul className="card divide-y divide-line">
            {orders.data.slice(0, 6).map((o) => <li key={o.id}><Link to={`/staff/orders/${o.id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-mint-50/60"><div><p className="font-medium text-forest">{o.reference}</p><p className="text-[13px] text-muted">{o.patient_name} · {formatDate(o.created_at)}</p></div><StatusBadge status={o.status} /></Link></li>)}
          </ul>
        </section>
      )}
    </>
  )
}
