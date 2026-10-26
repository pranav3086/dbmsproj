import { ArrowUpRight, BadgeCheck, CalendarClock, CalendarPlus, Clock, Languages } from 'lucide-react'
import { Link } from 'react-router'
import { SampleBadge, StatusBadge } from '@/components/common/Badge'
import { ButtonLink } from '@/components/common/Button'
import { DeptIcon } from '@/components/common/DeptIcon'
import { Avatar } from '@/components/common/Layout'
import { cn, formatDate, formatDateTime, formatMoney } from '@/lib/utils'
import type { Appointment, Department, Doctor } from '@/types/models'

export function DoctorCard({ doctor, nextSlot, layout = 'grid' }: { doctor: Doctor; nextSlot?: string | null; layout?: 'grid' | 'list' }) {
  return (
    <article className={cn('card card-hover group flex h-full gap-5 p-5', layout === 'grid' ? 'flex-col' : 'flex-col sm:flex-row sm:items-center')}>
      <div className="flex items-start gap-4 sm:flex-1">
        <Avatar name={doctor.full_name} src={doctor.photo_url} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {doctor.is_sample && <SampleBadge label="Sample profile" />}
            {doctor.licence_verified && <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-success"><BadgeCheck className="h-3.5 w-3.5" />Verified</span>}
          </div>
          <h3 className="mt-1.5 truncate text-[17px] font-semibold">
            <Link to={`/doctors/${doctor.slug}`} className="rounded hover:text-mint-700">{doctor.full_name}</Link>
          </h3>
          <p className="text-sm text-mint-700">{doctor.speciality}</p>
          <p className="text-[13px] text-muted">{doctor.department_name}</p>
        </div>
      </div>
      <dl className={cn('grid gap-2 text-[13px] text-muted-strong', layout === 'list' && 'sm:w-56')}>
        {doctor.qualifications.length > 0 && <div className="truncate"><dt className="sr-only">Qualifications</dt><dd>{doctor.qualifications.join(', ')}</dd></div>}
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {doctor.years_experience !== null && <span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-mint-500" />{doctor.years_experience} yrs experience</span>}
          {doctor.consultation_fee !== null && <span>Fee {formatMoney(doctor.consultation_fee)}</span>}
        </div>
        {doctor.languages.length > 0 && <span className="inline-flex items-center gap-1.5"><Languages className="h-3.5 w-3.5 text-mint-500" />{doctor.languages.join(', ')}</span>}
        <span className={cn('inline-flex items-center gap-1.5 font-medium', nextSlot ? 'text-forest' : 'text-muted')}>
          <CalendarClock className="h-3.5 w-3.5 text-mint-500" />
          {nextSlot === undefined ? 'Checking availability…' : nextSlot ? `Next available: ${formatDateTime(nextSlot)}` : 'No online slots in the next 3 weeks'}
        </span>
      </dl>
      <div className={cn('mt-auto grid grid-cols-2 gap-2', layout === 'list' && 'sm:mt-0 sm:w-64')}>
        <ButtonLink to={`/doctors/${doctor.slug}`} variant="secondary" size="sm">View profile</ButtonLink>
        <ButtonLink to={`/appointments/book?doctor=${doctor.slug}`} size="sm" icon={<CalendarPlus className="h-3.5 w-3.5" />} aria-label={`Book an appointment with ${doctor.full_name}`}>Book</ButtonLink>
      </div>
    </article>
  )
}

export function DepartmentCard({ department, className }: { department: Department; className?: string }) {
  return (
    <Link to={`/departments/${department.slug}`} className={cn('card card-hover group relative flex h-full flex-col overflow-hidden p-6', className)}>
      <div className="flex items-start justify-between">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-mint-100 text-mint-600 transition-colors duration-300 group-hover:bg-forest group-hover:text-mint-300">
          <DeptIcon name={department.icon} className="h-6 w-6" />
        </span>
        <ArrowUpRight className="h-5 w-5 text-muted transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-forest" />
      </div>
      <h3 className="mt-5 text-lg font-semibold">{department.name}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">{department.summary}</p>
      <p className="mt-auto pt-5 text-[13px] font-medium text-mint-700">{department.doctor_count} {department.doctor_count === 1 ? 'doctor' : 'doctors'}</p>
    </Link>
  )
}

export function AppointmentCard({ appt, to }: { appt: Appointment; to: string }) {
  return (
    <Link to={to} className="card card-hover flex items-center gap-4 p-4">
      <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-mint-100 text-forest">
        <span className="text-[11px] font-semibold uppercase tracking-wide">{formatDate(appt.starts_at, { month: 'short', day: undefined, year: undefined })}</span>
        <span className="font-display text-2xl font-bold leading-none">{formatDate(appt.starts_at, { day: 'numeric', month: undefined, year: undefined })}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-semibold text-forest">{appt.doctor_name}</p>
          <StatusBadge status={appt.status} />
          {appt.is_sample && <SampleBadge />}
        </div>
        <p className="truncate text-sm text-muted">{appt.department_name} · {formatDateTime(appt.starts_at)}</p>
        <p className="text-xs text-muted">Ref {appt.reference}</p>
      </div>
    </Link>
  )
}
