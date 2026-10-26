export type AppRole = 'patient' | 'doctor' | 'staff' | 'admin'
export type StaffPermission = 'appointments' | 'patient_admin' | 'lab_records' | 'pharmacy'
export type AppointmentStatus = 'requested' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'
export type PrescriptionStatus = 'draft' | 'issued' | 'superseded' | 'cancelled'
export type LabStatus = 'ordered' | 'collected' | 'in_progress' | 'final' | 'amended' | 'cancelled'
export type OrderStatus = 'placed' | 'pending_review' | 'approved' | 'processing' | 'dispatched' | 'delivered' | 'cancelled' | 'rejected'
export type DonationStatus = 'pending' | 'simulated' | 'paid' | 'failed' | 'refunded'

export interface Access {
  user_id: string
  email: string
  full_name: string
  is_active: boolean
  roles: AppRole[]
  permissions: StaffPermission[]
  doctor_id: string | null
  doctor_application: { id: string; status: 'pending' | 'approved' | 'rejected'; review_notes: string | null; credential_path: string | null; created_at: string } | null
}

export interface Department {
  id: string
  slug: string
  name: string
  summary: string
  description: string
  icon: string
  image_url: string | null
  services: string[]
  phone_extension: string | null
  sort_order: number
  is_active: boolean
  is_sample: boolean
  doctor_count: number
}

export interface Doctor {
  id: string
  user_id: string | null
  slug: string
  full_name: string
  department_id: string
  department_name: string
  department_slug: string
  speciality: string
  qualifications: string[]
  qualifications_verified: boolean
  licence_verified: boolean
  years_experience: number | null
  bio: string
  languages: string[]
  consultation_fee: number | null
  consultation_minutes: number
  photo_url: string | null
  is_active: boolean
  is_sample: boolean
  has_availability: boolean
}

export interface Availability {
  id: string
  doctor_id: string
  weekday: number
  start_time: string
  end_time: string
  slot_minutes: number
}

export interface Slot {
  starts_at: string
  ends_at: string
}

export interface Profile {
  id: string
  email: string
  full_name: string
  phone: string | null
  date_of_birth: string | null
  address: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  blood_group: string | null
  is_active: boolean
  is_sample: boolean
  created_at: string
}

export interface Appointment {
  id: string
  reference: string
  patient_id: string
  doctor_id: string
  department_id: string
  starts_at: string
  ends_at: string
  status: AppointmentStatus
  reason: string | null
  patient_name: string
  patient_phone: string | null
  patient_email: string | null
  cancel_reason: string | null
  rescheduled_from: string | null
  is_sample: boolean
  created_at: string
  doctor_name: string
  doctor_slug: string
  doctor_speciality: string
  department_name: string
}

export interface AppointmentEvent {
  id: number
  appointment_id: string
  from_status: AppointmentStatus | null
  to_status: AppointmentStatus
  note: string | null
  created_at: string
}

export interface Prescription {
  id: string
  reference: string
  patient_id: string
  doctor_id: string
  appointment_id: string | null
  status: PrescriptionStatus
  notes: string | null
  version: number
  supersedes_id: string | null
  amendment_reason: string | null
  issued_at: string | null
  created_at: string
  is_sample: boolean
  doctor_name: string
  department_name: string
  patient_name: string | null
  appointment_reference: string | null
  item_count: number
  medications: string
}

export interface PrescriptionItem {
  id: string
  prescription_id: string
  medicine_id: string | null
  medication_name: string
  dosage: string
  frequency: string
  duration: string
  instructions: string | null
  quantity: number | null
  position: number
}

export interface LabReport {
  id: string
  reference: string
  patient_id: string
  doctor_id: string | null
  department_id: string | null
  appointment_id: string | null
  test_name: string
  laboratory: string
  collected_at: string | null
  resulted_at: string | null
  status: LabStatus
  summary: string | null
  document_path: string | null
  is_sample: boolean
  created_at: string
  updated_at: string
  doctor_name: string | null
  department_name: string | null
  patient_name: string | null
  result_count: number
}

export interface LabResult {
  id: string
  report_id: string
  analyte: string
  value: string
  unit: string | null
  reference_range: string | null
  position: number
}

export interface Observation {
  id: string
  patient_id: string
  appointment_id: string | null
  observed_at: string
  observer_id: string
  observation_type: string
  value: string
  unit: string | null
  context: string | null
  is_sample: boolean
  patient_name: string | null
  observer_name: string | null
}

export interface Medicine {
  id: string
  slug: string
  name: string
  generic_name: string | null
  category: string
  form: string
  strength: string | null
  pack_size: string | null
  description: string
  price: number
  requires_prescription: boolean
  stock: number
  is_active: boolean
  is_sample: boolean
}

export interface Order {
  id: string
  reference: string
  patient_id: string
  prescription_id: string | null
  status: OrderStatus
  subtotal: number
  delivery_fee: number
  total: number
  payment_method: string
  delivery_address: string
  contact_phone: string
  notes: string | null
  review_note: string | null
  is_sample: boolean
  created_at: string
  updated_at: string
  patient_name: string | null
  prescription_reference: string | null
  item_count: number
}

export interface OrderItem {
  id: string
  order_id: string
  medicine_id: string
  name: string
  unit_price: number
  quantity: number
  line_total: number
  requires_prescription: boolean
}

export interface OrderEvent {
  id: number
  order_id: string
  from_status: OrderStatus | null
  to_status: OrderStatus
  note: string | null
  created_at: string
}

export interface DonationCause {
  id: string
  slug: string
  title: string
  description: string
  suggested_amounts: number[]
  is_active: boolean
  sort_order: number
  is_sample: boolean
}

export interface Donation {
  id: string
  reference: string
  cause_id: string
  cause_title: string
  donor_id: string | null
  donor_name: string | null
  donor_email: string | null
  is_anonymous: boolean
  amount: number
  currency: string
  message: string | null
  status: DonationStatus
  provider: string
  is_sample: boolean
  created_at: string
}

export interface Notification {
  id: string
  kind: string
  title: string
  body: string
  link: string | null
  read_at: string | null
  created_at: string
}

export interface DoctorApplication {
  id: string
  user_id: string
  full_name: string
  email: string
  phone: string | null
  licence_number: string
  qualifications: string[]
  speciality: string
  department_id: string | null
  department_name: string | null
  years_experience: number | null
  credential_path: string | null
  status: 'pending' | 'approved' | 'rejected'
  review_notes: string | null
  reviewed_at: string | null
  created_at: string
}

export interface UserRow {
  id: string
  email: string
  full_name: string
  phone: string | null
  is_active: boolean
  is_sample: boolean
  created_at: string
  roles: AppRole[]
  permissions: StaffPermission[]
}

export interface PatientSearchRow {
  id: string
  full_name: string
  email: string
  phone: string | null
  date_of_birth: string | null
  last_appointment_at: string | null
  appointment_count: number
}

export interface PatientChart {
  scope: 'clinical' | 'administrative' | 'laboratory'
  profile: Pick<Profile, 'id' | 'full_name' | 'email' | 'phone' | 'date_of_birth' | 'blood_group' | 'address' | 'emergency_contact_name' | 'emergency_contact_phone' | 'is_sample'>
  appointments: { id: string; reference: string; starts_at: string; status: AppointmentStatus; reason: string | null; doctor_name: string; department_name: string }[]
  consultations: { id: string; appointment_id: string; notes: string; updated_at: string }[]
  prescriptions: { id: string; reference: string; status: PrescriptionStatus; issued_at: string | null; created_at: string; doctor_name: string; version: number; items: string[] }[]
  lab_reports: { id: string; reference: string; test_name: string; status: LabStatus; resulted_at: string | null; collected_at: string | null; is_sample: boolean }[]
  observations: { id: string; observed_at: string; observation_type: string; value: string; unit: string | null; context: string | null }[]
}

export interface Setting {
  key: string
  value: unknown
  description: string | null
  is_public: boolean
}
