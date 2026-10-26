import { db } from '@/lib/backend'
import type { Filter } from '@/lib/backend/types'
import type { Appointment, AppointmentEvent, AppointmentStatus } from '@/types/models'

export interface AppointmentQuery {
  scope?: 'upcoming' | 'past' | 'cancelled' | 'all'
  statuses?: AppointmentStatus[]
  doctorId?: string
  patientId?: string
  from?: string
  to?: string
  search?: string
  limit?: number
  offset?: number
}

export async function listAppointments(q: AppointmentQuery = {}) {
  const filters: Filter[] = []
  const now = new Date().toISOString()
  if (q.scope === 'upcoming') {
    filters.push({ col: 'starts_at', op: 'gte', value: now }, { col: 'status', op: 'in', value: ['requested', 'confirmed'] })
  } else if (q.scope === 'past') {
    filters.push({ col: 'status', op: 'in', value: ['requested', 'confirmed', 'completed', 'no_show'] }, { col: 'starts_at', op: 'lt', value: now })
  } else if (q.scope === 'cancelled') {
    filters.push({ col: 'status', op: 'eq', value: 'cancelled' })
  }
  if (q.statuses?.length) filters.push({ col: 'status', op: 'in', value: q.statuses })
  if (q.doctorId) filters.push({ col: 'doctor_id', op: 'eq', value: q.doctorId })
  if (q.patientId) filters.push({ col: 'patient_id', op: 'eq', value: q.patientId })
  if (q.from) filters.push({ col: 'starts_at', op: 'gte', value: q.from })
  if (q.to) filters.push({ col: 'starts_at', op: 'lt', value: q.to })
  return db().select<Appointment>('v_appointments', {
    filters,
    search: q.search ? { cols: ['reference', 'doctor_name', 'department_name', 'patient_name'], term: q.search } : undefined,
    order: [{ col: 'starts_at', asc: q.scope === 'upcoming' || q.scope === undefined ? true : false }],
    limit: q.limit ?? 50,
    offset: q.offset,
    count: true,
  })
}

export async function getAppointment(id: string) {
  const { rows } = await db().select<Appointment>('v_appointments', { filters: [{ col: 'id', op: 'eq', value: id }], limit: 1 })
  return rows[0] ?? null
}

export async function getAppointmentEvents(id: string) {
  const { rows } = await db().select<AppointmentEvent>('appointment_events', {
    filters: [{ col: 'appointment_id', op: 'eq', value: id }],
    order: [{ col: 'created_at' }, { col: 'id' }],
  })
  return rows
}

export function bookAppointment(input: { doctorId: string; startsAt: string; reason?: string; patientName?: string; patientPhone?: string }) {
  return db().rpc<Appointment>('book_appointment', {
    p_doctor_id: input.doctorId,
    p_starts_at: input.startsAt,
    p_reason: input.reason || null,
    p_patient_name: input.patientName || null,
    p_patient_phone: input.patientPhone || null,
  })
}

export function rescheduleAppointment(id: string, startsAt: string) {
  return db().rpc<Appointment>('reschedule_appointment', { p_appointment_id: id, p_new_starts_at: startsAt })
}

export function updateAppointmentStatus(id: string, status: AppointmentStatus, note?: string) {
  return db().rpc<Appointment>('update_appointment_status', { p_appointment_id: id, p_status: status, p_note: note || null })
}

export function saveConsultationNotes(appointmentId: string, notes: string) {
  return db().rpc('save_consultation_notes', { p_appointment_id: appointmentId, p_notes: notes })
}

export async function getConsultation(appointmentId: string) {
  const { rows } = await db().select<{ id: string; notes: string; updated_at: string }>('consultations', {
    filters: [{ col: 'appointment_id', op: 'eq', value: appointmentId }],
    limit: 1,
  })
  return rows[0] ?? null
}
