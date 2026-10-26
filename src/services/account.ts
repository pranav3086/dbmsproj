import { db } from '@/lib/backend'
import type { Filter } from '@/lib/backend/types'
import type {
  Access,
  Availability,
  Doctor,
  DoctorApplication,
  Donation,
  DonationCause,
  Notification,
  Profile,
  StaffPermission,
  UserRow,
} from '@/types/models'

// ── Session-scoped access
export const getMyAccess = () => db().rpc<Access | null>('get_my_access')

export async function getMyProfile(userId: string) {
  const { rows } = await db().select<Profile>('profiles', { filters: [{ col: 'id', op: 'eq', value: userId }], limit: 1 })
  return rows[0] ?? null
}

export async function updateMyProfile(userId: string, values: Partial<Pick<Profile, 'full_name' | 'phone' | 'date_of_birth' | 'address' | 'emergency_contact_name' | 'emergency_contact_phone' | 'blood_group'>>) {
  const rows = await db().update<Profile>('profiles', values, [{ col: 'id', op: 'eq', value: userId }])
  return rows[0]
}

// ── Notifications
export async function listNotifications(limit = 30) {
  const { rows } = await db().select<Notification>('notifications', { order: [{ col: 'created_at', asc: false }], limit })
  return rows
}
export const markAllNotificationsRead = () => db().rpc('mark_notifications_read')

// ── Doctor self-service
export async function updateMyDoctorProfile(doctorId: string, values: Partial<Pick<Doctor, 'bio' | 'languages' | 'photo_url' | 'consultation_minutes'>>) {
  return db().update<Doctor>('doctors', values, [{ col: 'id', op: 'eq', value: doctorId }])
}
export function addAvailability(values: Omit<Availability, 'id'>) {
  return db().insert<Availability>('doctor_availability', values)
}
export function removeAvailability(id: string) {
  return db().remove('doctor_availability', [{ col: 'id', op: 'eq', value: id }])
}
export async function uploadCredential(userId: string, file: File) {
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80)
  const path = `${userId}/${Date.now()}-${safe}`
  await db().storage.upload('credentials', path, file)
  await db().rpc('set_application_credential', { p_path: path })
  return path
}
export const credentialUrl = (path: string) => db().storage.signedUrl('credentials', path)

// ── Donations
export async function listCauses() {
  const { rows } = await db().select<DonationCause>('donation_causes', { filters: [{ col: 'is_active', op: 'eq', value: true }], order: [{ col: 'sort_order' }] })
  return rows
}
export function createDonation(input: { causeId: string; amount: number; donorName?: string; donorEmail?: string; anonymous: boolean; message?: string }) {
  return db().rpc<{ id: string; reference: string; status: string; amount: number; currency: string }>('create_donation', {
    p_cause_id: input.causeId,
    p_amount: input.amount,
    p_donor_name: input.donorName || null,
    p_donor_email: input.donorEmail || null,
    p_is_anonymous: input.anonymous,
    p_message: input.message || null,
  })
}
export const getDonationReceipt = (reference: string) =>
  db().rpc<{ reference: string; amount: number; currency: string; status: string; created_at: string; cause: string; donor_name: string | null; is_anonymous: boolean; provider: string } | null>('get_donation_receipt', { p_reference: reference })
export async function listDonations(q: { donorId?: string; limit?: number } = {}) {
  const filters: Filter[] = []
  if (q.donorId) filters.push({ col: 'donor_id', op: 'eq', value: q.donorId })
  const { rows } = await db().select<Donation>('v_donations', { filters, order: [{ col: 'created_at', asc: false }], limit: q.limit ?? 100 })
  return rows
}

// ── Contact
export const submitContactMessage = (v: { name: string; email: string; subject: string; message: string; consent: boolean }) =>
  db().rpc('submit_contact_message', { p_name: v.name, p_email: v.email, p_subject: v.subject, p_message: v.message, p_consent: v.consent })

// ── Staff invitations (public lookup)
export const getInvitation = (token: string) =>
  db().rpc<{ email: string; permissions: StaffPermission[]; expires_at: string } | null>('get_invitation', { p_token: token })
export const acceptInvitation = (token: string) => db().rpc('accept_employee_invitation', { p_token: token })

// ── Administration
export const adminOverview = () => db().rpc<{
  users_by_role: Record<string, number>
  pending_doctor_applications: number
  appointments_today: number
  appointments_upcoming: number
  appointments_requested: number
  appointments_by_day: { day: string; count: number }[]
  orders_by_status: Record<string, number>
  donations: { count: number; simulated_total: number; paid_total: number }
  new_contact_messages: number
  low_stock: number
  queued_emails: number
}>('admin_overview')

export async function listUsers(q: { search?: string; role?: string; offset?: number; limit?: number } = {}) {
  return db().select<UserRow>('v_users', {
    search: q.search ? { cols: ['full_name', 'email'], term: q.search } : undefined,
    order: [{ col: 'created_at', asc: false }],
    limit: q.limit ?? 25,
    offset: q.offset,
    count: true,
  })
}
export const setStaffPermissions = (userId: string, permissions: StaffPermission[]) =>
  db().rpc('admin_set_staff_permissions', { p_user_id: userId, p_permissions: permissions })
export const setUserActive = (userId: string, active: boolean) => db().rpc('admin_set_active', { p_user_id: userId, p_active: active })

export async function listApplications(status?: string) {
  const { rows } = await db().select<DoctorApplication>('v_doctor_applications', {
    filters: status ? [{ col: 'status', op: 'eq', value: status }] : [],
    order: [{ col: 'created_at', asc: false }],
  })
  return rows
}
export const reviewApplication = (id: string, decision: 'approved' | 'rejected', notes: string, departmentId?: string | null) =>
  db().rpc('review_doctor_application', { p_application_id: id, p_decision: decision, p_notes: notes || null, p_department_id: departmentId || null })

export async function listInvitations() {
  const { rows } = await db().select<{ id: string; email: string; permissions: StaffPermission[]; expires_at: string; accepted_at: string | null; revoked_at: string | null; created_at: string }>(
    'employee_invitations', { order: [{ col: 'created_at', asc: false }], limit: 50 })
  return rows
}
export const createInvitation = (email: string, permissions: StaffPermission[]) =>
  db().rpc<{ token: string }>('create_employee_invitation', { p_email: email, p_permissions: permissions })
export const revokeInvitation = (id: string) => db().rpc('revoke_employee_invitation', { p_id: id })

export async function listContactMessages() {
  const { rows } = await db().select<{ id: string; name: string; email: string; subject: string; message: string; status: string; created_at: string }>(
    'contact_messages', { order: [{ col: 'created_at', asc: false }], limit: 100 })
  return rows
}
export const updateContactStatus = (id: string, status: string) => db().rpc('update_contact_status', { p_id: id, p_status: status })

export async function listAuditLogs(q: { entity?: string; search?: string; limit?: number; offset?: number } = {}) {
  return db().select<{ id: number; actor_name: string | null; actor_email: string | null; action: string; entity: string; entity_id: string | null; summary: Record<string, unknown>; created_at: string }>(
    'v_audit_logs', {
      filters: q.entity ? [{ col: 'entity', op: 'eq', value: q.entity }] : [],
      search: q.search ? { cols: ['actor_email', 'action', 'entity', 'entity_id'], term: q.search } : undefined,
      order: [{ col: 'created_at', asc: false }],
      limit: q.limit ?? 50,
      offset: q.offset,
      count: true,
    })
}

export async function listOutbox() {
  const { rows } = await db().select<{ id: string; to_email: string; template: string; subject: string; body: string; status: string; created_at: string }>(
    'email_outbox', { order: [{ col: 'created_at', asc: false }], limit: 100 })
  return rows
}
