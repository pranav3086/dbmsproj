import { db } from '@/lib/backend'
import type { Filter } from '@/lib/backend/types'
import type {
  LabReport,
  LabResult,
  LabStatus,
  Observation,
  PatientChart,
  PatientSearchRow,
  Prescription,
  PrescriptionItem,
  PrescriptionStatus,
} from '@/types/models'

// ── Prescriptions
export async function listPrescriptions(q: { patientId?: string; doctorId?: string; statuses?: PrescriptionStatus[]; search?: string; limit?: number } = {}) {
  const filters: Filter[] = []
  if (q.patientId) filters.push({ col: 'patient_id', op: 'eq', value: q.patientId })
  if (q.doctorId) filters.push({ col: 'doctor_id', op: 'eq', value: q.doctorId })
  if (q.statuses?.length) filters.push({ col: 'status', op: 'in', value: q.statuses })
  const { rows } = await db().select<Prescription>('v_prescriptions', {
    filters,
    search: q.search ? { cols: ['reference', 'medications', 'doctor_name', 'patient_name'], term: q.search } : undefined,
    order: [{ col: 'created_at', asc: false }],
    limit: q.limit ?? 100,
  })
  return rows
}

export async function getPrescription(id: string) {
  const { rows } = await db().select<Prescription>('v_prescriptions', { filters: [{ col: 'id', op: 'eq', value: id }], limit: 1 })
  if (!rows[0]) return null
  const items = await db().select<PrescriptionItem>('prescription_items', {
    filters: [{ col: 'prescription_id', op: 'eq', value: id }],
    order: [{ col: 'position' }],
  })
  return { ...rows[0], items: items.rows }
}

export type RxItemInput = Pick<PrescriptionItem, 'medication_name' | 'dosage' | 'frequency' | 'duration'> & {
  medicine_id?: string | null
  instructions?: string | null
  quantity?: number | null
}

export function savePrescription(input: { id?: string | null; patientId: string; appointmentId?: string | null; notes?: string; items: RxItemInput[]; issue: boolean }) {
  return db().rpc<Prescription>('save_prescription', {
    p_id: input.id ?? null,
    p_patient_id: input.patientId,
    p_appointment_id: input.appointmentId || null,
    p_notes: input.notes || null,
    p_items: input.items,
    p_issue: input.issue,
  })
}

export function amendPrescription(id: string, reason: string, notes: string, items: RxItemInput[]) {
  return db().rpc<Prescription>('amend_prescription', { p_id: id, p_reason: reason, p_notes: notes || null, p_items: items })
}

export function cancelPrescription(id: string, reason: string) {
  return db().rpc<Prescription>('cancel_prescription', { p_id: id, p_reason: reason })
}

// ── Lab reports
export async function listLabReports(q: { patientId?: string; statuses?: LabStatus[]; search?: string; limit?: number } = {}) {
  const filters: Filter[] = []
  if (q.patientId) filters.push({ col: 'patient_id', op: 'eq', value: q.patientId })
  if (q.statuses?.length) filters.push({ col: 'status', op: 'in', value: q.statuses })
  const { rows } = await db().select<LabReport>('v_lab_reports', {
    filters,
    search: q.search ? { cols: ['reference', 'test_name', 'patient_name', 'doctor_name'], term: q.search } : undefined,
    order: [{ col: 'updated_at', asc: false }],
    limit: q.limit ?? 100,
  })
  return rows
}

export async function getLabReport(id: string) {
  const { rows } = await db().select<LabReport>('v_lab_reports', { filters: [{ col: 'id', op: 'eq', value: id }], limit: 1 })
  if (!rows[0]) return null
  const results = await db().select<LabResult>('lab_results', { filters: [{ col: 'report_id', op: 'eq', value: id }], order: [{ col: 'position' }] })
  return { ...rows[0], results: results.rows }
}

export interface LabReportInput {
  id?: string
  patient_id?: string
  appointment_id?: string | null
  test_name: string
  laboratory?: string
  collected_at?: string | null
  resulted_at?: string | null
  status: LabStatus
  summary?: string | null
  results: { analyte: string; value: string; unit?: string | null; reference_range?: string | null }[]
}

export function saveLabReport(input: LabReportInput) {
  return db().rpc<LabReport>('save_lab_report', { p_report: input })
}

export async function attachLabDocument(report: Pick<LabReport, 'id' | 'patient_id'>, file: File) {
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80)
  const path = `${report.patient_id}/${report.id}/${Date.now()}-${safe}`
  await db().storage.upload('lab-reports', path, file)
  return db().rpc('set_lab_report_document', { p_report_id: report.id, p_path: path })
}

export function labDocumentUrl(path: string) {
  return db().storage.signedUrl('lab-reports', path)
}

// ── Observations
export async function listObservations(q: { patientId?: string; search?: string; limit?: number } = {}) {
  const filters: Filter[] = []
  if (q.patientId) filters.push({ col: 'patient_id', op: 'eq', value: q.patientId })
  const { rows } = await db().select<Observation>('v_observations', {
    filters,
    search: q.search ? { cols: ['patient_name', 'observation_type', 'value'], term: q.search } : undefined,
    order: [{ col: 'observed_at', asc: false }],
    limit: q.limit ?? 100,
  })
  return rows
}

export function createObservation(input: { patient_id: string; observer_id: string; appointment_id?: string | null; observed_at: string; observation_type: string; value: string; unit?: string | null; context?: string | null }) {
  return db().insert<Observation>('observation_records', input)
}

export function updateObservation(id: string, values: Partial<Pick<Observation, 'observation_type' | 'value' | 'unit' | 'context' | 'observed_at'>>) {
  return db().update<Observation>('observation_records', values, [{ col: 'id', op: 'eq', value: id }])
}

// ── Patient records (authorised server-side search; never bulk-loaded)
export function searchPatients(query: string, limit = 25) {
  return db().rpcRows<PatientSearchRow>('search_patients', { p_query: query, p_limit: limit })
}

export function getPatientChart(patientId: string) {
  return db().rpc<PatientChart>('get_patient_chart', { p_patient_id: patientId })
}
