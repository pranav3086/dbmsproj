import { describe, expect, it } from 'vitest'
import { checkoutSchema, contactSchema, donationSchema, doctorSignUpSchema, password, patientSignUpSchema, rxItemSchema, signInSchema } from '@/schemas'

describe('password policy', () => {
  it('requires length, mixed case, digit and symbol', () => {
    expect(password.safeParse('short').success).toBe(false)
    expect(password.safeParse('alllowercase1!').success).toBe(false)
    expect(password.safeParse('NoDigitsHere!!').success).toBe(false)
    expect(password.safeParse('NoSymbols1234').success).toBe(false)
    expect(password.safeParse('Valid#Pass2026').success).toBe(true)
  })
})

describe('sign-up validation', () => {
  const base = { fullName: 'Test Patient', email: 'p@example.com', phone: '', dateOfBirth: '', password: 'Valid#Pass2026', confirmPassword: 'Valid#Pass2026', terms: true }
  it('accepts a valid patient', () => expect(patientSignUpSchema.safeParse(base).success).toBe(true))
  it('rejects mismatched passwords', () => {
    const r = patientSignUpSchema.safeParse({ ...base, confirmPassword: 'Other#Pass2026' })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0].path).toEqual(['confirmPassword'])
  })
  it('requires accepting the terms', () => expect(patientSignUpSchema.safeParse({ ...base, terms: false }).success).toBe(false))
  it('rejects invalid email and future birth dates', () => {
    expect(patientSignUpSchema.safeParse({ ...base, email: 'nope' }).success).toBe(false)
    expect(patientSignUpSchema.safeParse({ ...base, dateOfBirth: '2999-01-01' }).success).toBe(false)
  })
  it('requires licence and department for professionals', () => {
    const r = doctorSignUpSchema.safeParse({ ...base, phone: '+91 90000 00000', licenceNumber: '', qualifications: 'MBBS', speciality: 'Cardiology', departmentId: '', yearsExperience: '5' })
    expect(r.success).toBe(false)
    expect(r.error!.issues.map((i) => i.path[0])).toEqual(expect.arrayContaining(['licenceNumber', 'departmentId']))
  })
})

describe('other forms', () => {
  it('sign-in needs email and password', () => expect(signInSchema.safeParse({ email: '', password: '', remember: true }).success).toBe(false))
  it('contact form rejects bots filling the honeypot', () => {
    const ok = { name: 'Asha', email: 'a@example.com', subject: 'Hello', message: 'A sufficiently long message', consent: true as const }
    expect(contactSchema.safeParse(ok).success).toBe(true)
    expect(contactSchema.safeParse({ ...ok, website: 'http://spam' }).success).toBe(false)
  })
  it('checkout validates phone', () => expect(checkoutSchema.safeParse({ deliveryAddress: '12 Street, City', contactPhone: 'abc' }).success).toBe(false))
  it('guest donations need an email; anonymous gifts need no name', () => {
    const d = { causeId: 'x', amount: 500, anonymous: true, signedIn: false, donorEmail: '' }
    expect(donationSchema.safeParse(d).success).toBe(false)
    expect(donationSchema.safeParse({ ...d, donorEmail: 'g@example.com' }).success).toBe(true)
    expect(donationSchema.safeParse({ ...d, donorEmail: 'g@example.com', anonymous: false }).success).toBe(false)
  })
  it('prescription items require dosage details', () => {
    expect(rxItemSchema.safeParse({ medication_name: 'X', dosage: '', frequency: 'daily', duration: '5 days' }).success).toBe(false)
  })
})
