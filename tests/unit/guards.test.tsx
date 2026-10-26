// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Access } from '@/types/models'

const auth = vi.hoisted(() => ({ value: {} as Record<string, unknown> }))
vi.mock('@/app/auth', async (orig) => {
  const actual = await orig<typeof import('@/app/auth')>()
  return { ...actual, useAuth: () => auth.value }
})
const { GuestOnly, ProtectedRoute, RoleGuard } = await import('@/routes/guards')
const { homeFor } = await import('@/app/auth')

function setAccess(access: Partial<Access> | null, status = access ? 'signed-in' : 'signed-out') {
  const a = access ? ({ is_active: true, roles: [], permissions: [], doctor_application: null, ...access } as Access) : null
  auth.value = {
    status,
    access: a,
    hasRole: (r: string) => !!a?.is_active && a.roles.includes(r as never),
    can: (p: string) => !!a?.is_active && a.roles.includes('staff') && a.permissions.includes(p as never),
  }
}

const app = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/signin" element={<p>sign-in page</p>} />
        <Route path="/doctor/dashboard" element={<ProtectedRoute><RoleGuard roles={['doctor']}><p>doctor area</p></RoleGuard></ProtectedRoute>} />
        <Route path="/staff/orders" element={<ProtectedRoute><RoleGuard roles={['staff']} permissions={['pharmacy']}><p>orders</p></RoleGuard></ProtectedRoute>} />
        <Route path="/login" element={<GuestOnly><p>login form</p></GuestOnly>} />
        <Route path="/patient/dashboard" element={<p>patient home</p>} />
        <Route path="/account-inactive" element={<p>inactive</p>} />
      </Routes>
    </MemoryRouter>,
  )

describe('route guards', () => {
  beforeEach(() => setAccess(null))

  it('sends signed-out visitors to sign-in', () => {
    app('/doctor/dashboard')
    expect(screen.getByText('sign-in page')).toBeInTheDocument()
  })
  it('blocks patients from typing a doctor URL', () => {
    setAccess({ roles: ['patient'] })
    app('/doctor/dashboard')
    expect(screen.getByText(/don’t have access/i)).toBeInTheDocument()
    expect(screen.queryByText('doctor area')).not.toBeInTheDocument()
  })
  it('keeps pending doctors out of clinical pages', () => {
    setAccess({ roles: [], doctor_application: { id: '1', status: 'pending', review_notes: null, credential_path: null, created_at: '' } })
    app('/doctor/dashboard')
    expect(screen.queryByText('doctor area')).not.toBeInTheDocument()
  })
  it('lets approved doctors in', () => {
    setAccess({ roles: ['doctor'] })
    app('/doctor/dashboard')
    expect(screen.getByText('doctor area')).toBeInTheDocument()
  })
  it('requires the matching staff permission', () => {
    setAccess({ roles: ['staff'], permissions: ['appointments'] })
    app('/staff/orders')
    expect(screen.queryByText('orders')).not.toBeInTheDocument()
    setAccess({ roles: ['staff'], permissions: ['pharmacy'] })
    app('/staff/orders')
    expect(screen.getByText('orders')).toBeInTheDocument()
  })
  it('redirects deactivated accounts', () => {
    setAccess({ roles: ['doctor'], is_active: false })
    app('/doctor/dashboard')
    expect(screen.getByText('inactive')).toBeInTheDocument()
  })
  it('sends signed-in users away from the sign-in form', () => {
    setAccess({ roles: ['patient'] })
    app('/login')
    expect(screen.getByText('patient home')).toBeInTheDocument()
  })
})

describe('role-based home', () => {
  const a = (roles: Access['roles'], extra: Partial<Access> = {}) => ({ is_active: true, roles, permissions: [], doctor_application: null, ...extra }) as Access
  it('routes each role to its portal', () => {
    expect(homeFor(a(['admin']))).toBe('/admin/dashboard')
    expect(homeFor(a(['doctor']))).toBe('/doctor/dashboard')
    expect(homeFor(a(['staff']))).toBe('/staff/dashboard')
    expect(homeFor(a(['patient']))).toBe('/patient/dashboard')
    expect(homeFor(a([]))).toBe('/verification-pending')
    expect(homeFor(a(['admin'], { is_active: false }))).toBe('/account-inactive')
    expect(homeFor(null)).toBe('/signin')
  })
})
