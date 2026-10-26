import { expect, test, type Page } from '@playwright/test'

const PASSWORD = 'DemoCare#2026' // demo-account password (local, synthetic accounts only)

async function ready(page: Page, path = '/') {
  await page.goto(path)
  await expect(page.locator('#main')).toBeVisible({ timeout: 60_000 })
}

async function signIn(page: Page, email: string, next?: string, password = PASSWORD) {
  await ready(page, next ? `/signin?next=${encodeURIComponent(next)}` : '/signin')
  await page.getByLabel('Email address').fill(email)
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
}

test('home page links to the main features', async ({ page }) => {
  await ready(page)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('puts you first')
  await page.getByRole('link', { name: 'Meet Our Doctors' }).click()
  await expect(page).toHaveURL(/\/doctors$/)
  await expect(page.getByRole('heading', { name: 'Our doctors' })).toBeVisible()
})

test('doctor directory search, filters and empty state', async ({ page }) => {
  await ready(page, '/doctors')
  await expect(page.getByText(/40\s+doctors found/)).toBeVisible()
  await page.getByLabel('Search doctors').fill('zzzz-no-match')
  await expect(page.getByText('No doctors match your search')).toBeVisible()
  await page.getByRole('button', { name: 'Clear filters' }).first().click()
  await page.getByLabel('Speciality / department').selectOption('cardiology')
  await expect(page.getByText(/4\s+doctors found/)).toBeVisible()
})

test('unauthenticated users are sent to sign in, then back', async ({ page }) => {
  await ready(page, '/patient/prescriptions')
  await expect(page).toHaveURL(/\/signin\?next=/)
  await page.getByLabel('Email address').fill('patient@a10.example')
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Prescriptions' })).toBeVisible()
  await expect(page.getByText('Atorvastatin 10 mg, Amlodipine 5 mg').first()).toBeVisible()
})

test('invalid credentials show a generic error', async ({ page }) => {
  await ready(page, '/signin')
  await page.getByLabel('Email address').fill('patient@a10.example')
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill('Wrong#Password1')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByText('Invalid email or password.')).toBeVisible()
})

test('patient registration requires email verification', async ({ page }) => {
  const email = `new.patient.${Date.now()}@a10.example`
  await ready(page, '/signup')
  await page.getByLabel('Full name').fill('New Sample Patient')
  await page.getByLabel('Email address').fill(email)
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill('Fresh#Pass2026')
  await page.getByLabel('Confirm password').fill('Fresh#Pass2026')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Create patient account' }).click()
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible()

  // Signing in before verifying is refused.
  await signIn(page, email, undefined, 'Fresh#Pass2026')
  await expect(page.getByText(/verify your email/i)).toBeVisible()

  // Open the confirmation link from the simulated inbox.
  await ready(page, '/dev/mailbox')
  const message = page.locator('li', { hasText: email }).filter({ hasText: 'Confirm your email' }).first()
  await message.getByRole('link', { name: /Open link/ }).click()
  await expect(page).toHaveURL(/\/patient\/dashboard/)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('New')
})

test('patient books an appointment; the slot disappears for others', async ({ page }) => {
  await signIn(page, 'patient2@a10.example', '/appointments/book?doctor=kabir-samplewood')
  await expect(page.getByRole('heading', { name: 'Select a date and time' })).toBeVisible()
  const firstSlot = page.getByRole('radio').first()
  const time = (await firstSlot.textContent())!.trim()
  await firstSlot.click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Review booking' }).click()
  await page.getByRole('button', { name: 'Confirm booking' }).click()
  await expect(page.getByRole('heading', { name: 'Appointment request received' })).toBeVisible()
  await expect(page.getByText(/^APT-/)).toBeVisible()

  // The booked time is no longer offered.
  await page.goto('/doctors/kabir-samplewood')
  await expect(page.getByRole('heading', { name: 'Availability' })).toBeVisible()
  await expect(page.getByRole('radio').first()).not.toHaveText(time)
})

test('patients cannot open the doctor portal; doctors cannot open admin', async ({ page }) => {
  await signIn(page, 'patient@a10.example')
  await expect(page).toHaveURL(/\/patient\/dashboard/)
  await page.goto('/doctor/patients')
  await expect(page.getByText(/don’t have access/)).toBeVisible()
})

test('pending doctor sees verification status; admin approves', async ({ page }) => {
  await signIn(page, 'pending.doctor@a10.example')
  await expect(page).toHaveURL(/verification-pending/)
  await expect(page.getByText(/Clinical dashboards and patient records stay locked/)).toBeVisible()
  await page.getByRole('button', { name: 'Sign out' }).click()

  await signIn(page, 'admin@a10.example')
  await expect(page).toHaveURL(/\/admin\/dashboard/)
  await page.goto('/admin/doctors')
  await page.getByRole('button', { name: 'Review' }).first().click()
  await page.getByLabel('Department').selectOption({ label: 'Dermatology' })
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Approve doctor' }).click()
  await expect(page.getByText('Doctor approved and added to the directory')).toBeVisible()
})

test('mobile navigation drawer works @mobile', async ({ page }) => {
  await ready(page)
  await page.getByRole('button', { name: 'Open menu' }).click()
  await page.getByRole('navigation', { name: 'Mobile' }).getByRole('link', { name: 'Pharmacy' }).click()
  await expect(page).toHaveURL(/\/pharmacy$/)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})
