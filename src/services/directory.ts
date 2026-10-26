import { db } from '@/lib/backend'
import type { Filter } from '@/lib/backend/types'
import type { Availability, Department, Doctor, Slot } from '@/types/models'
import { hospitalDateKey } from '@/lib/utils'

export async function listDepartments(search = '') {
  const { rows } = await db().select<Department>('v_departments', {
    filters: [{ col: 'is_active', op: 'eq', value: true }],
    search: search ? { cols: ['name', 'summary'], term: search } : undefined,
    order: [{ col: 'sort_order' }, { col: 'name' }],
  })
  return rows
}

export async function getDepartment(slug: string) {
  const { rows } = await db().select<Department>('v_departments', { filters: [{ col: 'slug', op: 'eq', value: slug }], limit: 1 })
  return rows[0] ?? null
}

export interface DoctorQuery {
  search?: string
  department?: string
  minExperience?: number
  availableOnly?: boolean
  sort?: 'name' | 'experience' | 'fee'
  page?: number
  pageSize?: number
}

export async function listDoctors(q: DoctorQuery = {}) {
  const filters: Filter[] = [{ col: 'is_active', op: 'eq', value: true }]
  if (q.department) filters.push({ col: 'department_slug', op: 'eq', value: q.department })
  if (q.minExperience) filters.push({ col: 'years_experience', op: 'gte', value: q.minExperience })
  if (q.availableOnly) filters.push({ col: 'has_availability', op: 'eq', value: true })
  const pageSize = q.pageSize ?? 12
  const order =
    q.sort === 'experience' ? [{ col: 'years_experience', asc: false }, { col: 'full_name' }]
    : q.sort === 'fee' ? [{ col: 'consultation_fee', asc: true }, { col: 'full_name' }]
    : [{ col: 'full_name' }]
  return db().select<Doctor>('v_doctors', {
    filters,
    search: q.search ? { cols: ['full_name', 'speciality', 'department_name'], term: q.search } : undefined,
    order,
    limit: pageSize,
    offset: ((q.page ?? 1) - 1) * pageSize,
    count: true,
  })
}

export async function getDoctor(slugOrId: string) {
  const col = /^[0-9a-f-]{36}$/.test(slugOrId) ? 'id' : 'slug'
  const { rows } = await db().select<Doctor>('v_doctors', { filters: [{ col, op: 'eq', value: slugOrId }], limit: 1 })
  return rows[0] ?? null
}

export async function getAvailability(doctorId: string) {
  const { rows } = await db().select<Availability>('doctor_availability', {
    filters: [{ col: 'doctor_id', op: 'eq', value: doctorId }],
    order: [{ col: 'weekday' }, { col: 'start_time' }],
  })
  return rows
}

export function getSlots(doctorId: string, fromKey = hospitalDateKey(), days = 14) {
  return db().rpcRows<Slot>('get_available_slots', { p_doctor_id: doctorId, p_from: fromKey, p_days: days })
}

export async function getNextSlots(doctorIds: string[]) {
  if (!doctorIds.length) return {} as Record<string, string | null>
  const rows = await db().rpcRows<{ doctor_id: string; next_starts_at: string | null }>('get_next_slots', { p_doctor_ids: doctorIds })
  return Object.fromEntries(rows.map((r) => [r.doctor_id, r.next_starts_at]))
}

export async function getPublicSettings() {
  const { rows } = await db().select<{ key: string; value: unknown }>('settings', { filters: [{ col: 'is_public', op: 'eq', value: true }] })
  return Object.fromEntries(rows.map((r) => [r.key, r.value])) as Record<string, string | number>
}
