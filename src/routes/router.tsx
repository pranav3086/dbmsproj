import { lazy, type ComponentType, type ReactNode } from 'react'
import { createBrowserRouter, Navigate, Outlet, useParams, type RouteObject } from 'react-router'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { PublicLayout, ScrollToTop } from '@/components/layout/PublicLayout'
import { RouteError } from '@/pages/public/RouteError'
import type { AppRole, StaffPermission } from '@/types/models'
import { GuestOnly, ProtectedRoute, RoleGuard } from './guards'

// Route-based code splitting: every page is its own chunk.
const page = (loader: () => Promise<{ default: ComponentType }>) => {
  const C = lazy(loader)
  return <C />
}

const P = {
  Home: () => import('@/pages/public/Home'),
  About: () => import('@/pages/public/About'),
  Services: () => import('@/pages/public/Services'),
  Doctors: () => import('@/pages/public/Doctors'),
  DoctorProfile: () => import('@/pages/public/DoctorProfile'),
  Departments: () => import('@/pages/public/Departments'),
  DepartmentDetail: () => import('@/pages/public/DepartmentDetail'),
  Book: () => import('@/pages/public/BookAppointment'),
  Pharmacy: () => import('@/pages/public/Pharmacy'),
  MedicineDetail: () => import('@/pages/public/MedicineDetail'),
  Donations: () => import('@/pages/public/Donations'),
  DonationConfirmation: () => import('@/pages/public/DonationConfirmation'),
  Contact: () => import('@/pages/public/Contact'),
  Privacy: () => import('@/pages/public/Privacy'),
  Terms: () => import('@/pages/public/Terms'),
  NotFound: () => import('@/pages/public/NotFound'),
  Mailbox: () => import('@/pages/public/DevMailbox'),
  SignIn: () => import('@/pages/auth/SignIn'),
  SignUp: () => import('@/pages/auth/SignUp'),
  Forgot: () => import('@/pages/auth/ForgotPassword'),
  Reset: () => import('@/pages/auth/ResetPassword'),
  Callback: () => import('@/pages/auth/AuthCallback'),
  CheckEmail: () => import('@/pages/auth/CheckEmail'),
  Pending: () => import('@/pages/auth/VerificationPending'),
  Inactive: () => import('@/pages/auth/AccountInactive'),
}

const guarded = (roles: AppRole[], el: ReactNode, permissions?: StaffPermission[]) => (
  <ProtectedRoute><RoleGuard roles={roles} permissions={permissions}>{el}</RoleGuard></ProtectedRoute>
)
const portal = (p: 'patient' | 'doctor' | 'staff' | 'admin', roles: AppRole[], children: RouteObject[]): RouteObject => ({
  path: p,
  element: guarded(roles, <DashboardLayout portal={p} />),
  children: [{ index: true, element: <Navigate to="dashboard" replace /> }, ...children],
})

const routes: RouteObject[] = [
  {
    element: <><ScrollToTop /><Outlet /></>,
    errorElement: <RouteError />,
    children: [
      {
        element: <PublicLayout />,
        children: [
          { index: true, element: page(P.Home) },
          { path: 'about', element: page(P.About) },
          { path: 'services', element: page(P.Services) },
          { path: 'doctors', element: page(P.Doctors) },
          { path: 'doctors/:doctorId', element: page(P.DoctorProfile) },
          { path: 'departments', element: page(P.Departments) },
          { path: 'departments/:departmentId', element: page(P.DepartmentDetail) },
          { path: 'appointments/book', element: page(P.Book) },
          { path: 'appointments', element: <Navigate to="/patient/appointments" replace /> },
          { path: 'appointments/:appointmentId', element: <RedirectParam to="/patient/appointments/" param="appointmentId" /> },
          { path: 'pharmacy', element: page(P.Pharmacy) },
          { path: 'pharmacy/:slug', element: page(P.MedicineDetail) },
          { path: 'donations', element: page(P.Donations) },
          { path: 'donations/confirmation/:reference', element: page(P.DonationConfirmation) },
          { path: 'contact', element: page(P.Contact) },
          { path: 'privacy', element: page(P.Privacy) },
          { path: 'terms', element: page(P.Terms) },
          { path: 'dev/mailbox', element: page(P.Mailbox) },
          { path: 'signin', element: <GuestOnly>{page(P.SignIn)}</GuestOnly> },
          { path: 'signup', element: <GuestOnly>{page(P.SignUp)}</GuestOnly> },
          { path: 'forgot-password', element: page(P.Forgot) },
          { path: 'reset-password', element: page(P.Reset) },
          { path: 'auth/callback', element: page(P.Callback) },
          { path: 'check-email', element: page(P.CheckEmail) },
          { path: 'verification-pending', element: <ProtectedRoute>{page(P.Pending)}</ProtectedRoute> },
          { path: 'account-inactive', element: page(P.Inactive) },
          { path: '*', element: page(P.NotFound) },
        ],
      },
      portal('patient', ['patient'], [
        { path: 'dashboard', element: page(() => import('@/pages/patient/Dashboard')) },
        { path: 'profile', element: page(() => import('@/pages/patient/Profile')) },
        { path: 'appointments', element: page(() => import('@/pages/patient/Appointments')) },
        { path: 'appointments/:appointmentId', element: page(() => import('@/pages/patient/AppointmentDetail')) },
        { path: 'prescriptions', element: page(() => import('@/pages/patient/Prescriptions')) },
        { path: 'prescriptions/:prescriptionId', element: page(() => import('@/pages/patient/PrescriptionDetail')) },
        { path: 'lab-reports', element: page(() => import('@/pages/patient/LabReports')) },
        { path: 'lab-reports/:reportId', element: page(() => import('@/pages/patient/LabReportDetail')) },
        { path: 'pharmacy', element: page(P.Pharmacy) },
        { path: 'checkout', element: page(() => import('@/pages/patient/Checkout')) },
        { path: 'orders', element: page(() => import('@/pages/patient/Orders')) },
        { path: 'orders/:orderId', element: page(() => import('@/pages/patient/OrderDetail')) },
        { path: 'donations', element: page(() => import('@/pages/patient/Donations')) },
      ]),
      portal('doctor', ['doctor'], [
        { path: 'dashboard', element: page(() => import('@/pages/doctor/Dashboard')) },
        { path: 'appointments', element: page(() => import('@/pages/doctor/Appointments')) },
        { path: 'patients', element: page(() => import('@/pages/shared/PatientRecords')) },
        { path: 'patients/:patientId', element: page(() => import('@/pages/shared/PatientChart')) },
        { path: 'prescriptions', element: page(() => import('@/pages/doctor/Prescriptions')) },
        { path: 'prescriptions/new', element: page(() => import('@/pages/doctor/PrescriptionEditor')) },
        { path: 'prescriptions/:prescriptionId', element: page(() => import('@/pages/doctor/PrescriptionEditor')) },
        { path: 'lab-records', element: page(() => import('@/pages/shared/LabRecords')) },
        { path: 'lab-records/new', element: page(() => import('@/pages/shared/LabReportEditor')) },
        { path: 'lab-records/:reportId', element: page(() => import('@/pages/shared/LabReportEditor')) },
        { path: 'observations', element: page(() => import('@/pages/doctor/Observations')) },
        { path: 'profile', element: page(() => import('@/pages/doctor/Profile')) },
      ]),
      portal('staff', ['staff'], [
        { path: 'dashboard', element: page(() => import('@/pages/staff/Dashboard')) },
        { path: 'appointments', element: <RoleGuard roles={['staff']} permissions={['appointments']}>{page(() => import('@/pages/shared/AppointmentsManager'))}</RoleGuard> },
        { path: 'patients', element: <RoleGuard roles={['staff']} permissions={['patient_admin', 'lab_records']}>{page(() => import('@/pages/shared/PatientRecords'))}</RoleGuard> },
        { path: 'patients/:patientId', element: <RoleGuard roles={['staff']} permissions={['patient_admin', 'lab_records']}>{page(() => import('@/pages/shared/PatientChart'))}</RoleGuard> },
        { path: 'lab-records', element: <RoleGuard roles={['staff']} permissions={['lab_records']}>{page(() => import('@/pages/shared/LabRecords'))}</RoleGuard> },
        { path: 'lab-records/new', element: <RoleGuard roles={['staff']} permissions={['lab_records']}>{page(() => import('@/pages/shared/LabReportEditor'))}</RoleGuard> },
        { path: 'lab-records/:reportId', element: <RoleGuard roles={['staff']} permissions={['lab_records']}>{page(() => import('@/pages/shared/LabReportEditor'))}</RoleGuard> },
        { path: 'orders', element: <RoleGuard roles={['staff']} permissions={['pharmacy']}>{page(() => import('@/pages/shared/OrdersManager'))}</RoleGuard> },
        { path: 'orders/:orderId', element: <RoleGuard roles={['staff']} permissions={['pharmacy']}>{page(() => import('@/pages/patient/OrderDetail'))}</RoleGuard> },
        { path: 'medicines', element: <RoleGuard roles={['staff']} permissions={['pharmacy']}>{page(() => import('@/pages/shared/MedicinesManager'))}</RoleGuard> },
      ]),
      portal('admin', ['admin'], [
        { path: 'dashboard', element: page(() => import('@/pages/admin/Dashboard')) },
        { path: 'users', element: page(() => import('@/pages/admin/Users')) },
        { path: 'doctors', element: page(() => import('@/pages/admin/Doctors')) },
        { path: 'appointments', element: page(() => import('@/pages/shared/AppointmentsManager')) },
        { path: 'departments', element: page(() => import('@/pages/admin/Departments')) },
        { path: 'medicines', element: page(() => import('@/pages/shared/MedicinesManager')) },
        { path: 'orders', element: page(() => import('@/pages/shared/OrdersManager')) },
        { path: 'orders/:orderId', element: page(() => import('@/pages/patient/OrderDetail')) },
        { path: 'donations', element: page(() => import('@/pages/admin/Donations')) },
        { path: 'messages', element: page(() => import('@/pages/admin/Messages')) },
        { path: 'outbox', element: page(() => import('@/pages/admin/Outbox')) },
        { path: 'audit', element: page(() => import('@/pages/admin/Audit')) },
      ]),
    ],
  },
]

function RedirectParam({ to, param }: { to: string; param: string }) {
  const params = useParams()
  return <Navigate to={to + (params[param] ?? '')} replace />
}

export const router = createBrowserRouter(routes)
