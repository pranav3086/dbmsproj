import { z } from 'zod'

export const phoneRegex = /^[0-9+() -]{6,20}$/
export const email = z.string().trim().min(1, 'Enter your email address').email('Enter a valid email address').max(254)
export const phone = z.string().trim().regex(phoneRegex, 'Enter a valid phone number (digits, spaces, + and brackets)')
export const optionalPhone = z.string().trim().refine((v) => v === '' || phoneRegex.test(v), 'Enter a valid phone number').optional()

export const password = z
  .string()
  .min(10, 'Use at least 10 characters')
  .max(72, 'Use at most 72 characters')
  .regex(/[a-z]/, 'Include a lowercase letter')
  .regex(/[A-Z]/, 'Include an uppercase letter')
  .regex(/\d/, 'Include a number')
  .regex(/[^A-Za-z0-9]/, 'Include a symbol')

const fullName = z.string().trim().min(2, 'Enter your full name').max(120)

export const signInSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password'),
  remember: z.boolean(),
})

const passwordPair = { password, confirmPassword: z.string() }
const matchPasswords = (v: { password: string; confirmPassword: string }) => v.password === v.confirmPassword

export const patientSignUpSchema = z
  .object({
    fullName,
    email,
    phone: optionalPhone,
    dateOfBirth: z.string().optional().refine((v) => !v || (new Date(v) < new Date() && new Date(v) > new Date('1900-01-01')), 'Enter a valid date of birth'),
    ...passwordPair,
    terms: z.literal(true, { message: 'Please accept the terms and privacy notice' }),
  })
  .refine(matchPasswords, { message: 'Passwords do not match', path: ['confirmPassword'] })

export const doctorSignUpSchema = z
  .object({
    fullName,
    email,
    phone,
    licenceNumber: z.string().trim().min(3, 'Enter your medical registration / licence number').max(60),
    qualifications: z.string().trim().min(2, 'List your qualifications').max(400),
    speciality: z.string().trim().min(2, 'Enter your speciality').max(80),
    departmentId: z.string().min(1, 'Choose a department'),
    yearsExperience: z.string().regex(/^\d{1,2}$/, 'Enter years of experience (0–70)'),
    ...passwordPair,
    terms: z.literal(true, { message: 'Please accept the terms and privacy notice' }),
  })
  .refine(matchPasswords, { message: 'Passwords do not match', path: ['confirmPassword'] })

export const staffSignUpSchema = z
  .object({ fullName, email, phone: optionalPhone, ...passwordPair, terms: z.literal(true, { message: 'Please accept the terms and privacy notice' }) })
  .refine(matchPasswords, { message: 'Passwords do not match', path: ['confirmPassword'] })

export const resetSchema = z.object({ ...passwordPair }).refine(matchPasswords, { message: 'Passwords do not match', path: ['confirmPassword'] })

export const profileSchema = z.object({
  full_name: fullName,
  phone: optionalPhone,
  date_of_birth: z.string().optional().refine((v) => !v || (new Date(v) < new Date() && new Date(v) > new Date('1900-01-01')), 'Enter a valid date of birth'),
  address: z.string().trim().max(400, 'Keep the address under 400 characters').optional(),
  emergency_contact_name: z.string().trim().max(120).optional(),
  emergency_contact_phone: optionalPhone,
  blood_group: z.string().optional(),
})

export const contactSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name').max(120),
  email,
  subject: z.string().trim().min(2, 'Enter a subject').max(160),
  message: z.string().trim().min(10, 'Please write at least 10 characters').max(4000),
  consent: z.literal(true, { message: 'Please confirm we may use your details to reply' }),
  website: z.string().max(0).optional(), // honeypot — must stay empty
})

export const checkoutSchema = z.object({
  deliveryAddress: z.string().trim().min(5, 'Enter a delivery address').max(400),
  contactPhone: phone,
  notes: z.string().trim().max(500).optional(),
  prescriptionId: z.string().optional(),
})

export const donationSchema = z
  .object({
    causeId: z.string().min(1, 'Choose a cause'),
    amount: z.number({ message: 'Enter an amount' }).min(1, 'Enter at least ₹1').max(1_000_000, 'For gifts above ₹10,00,000 please contact us'),
    donorName: z.string().trim().max(120).optional(),
    donorEmail: z.string().trim().optional(),
    anonymous: z.boolean(),
    message: z.string().trim().max(500).optional(),
    signedIn: z.boolean(),
  })
  .refine((v) => v.signedIn || (v.donorEmail && z.string().email().safeParse(v.donorEmail).success), { message: 'Enter a valid email for your confirmation', path: ['donorEmail'] })
  .refine((v) => v.anonymous || v.signedIn || (v.donorName && v.donorName.length >= 2), { message: 'Enter your name, or choose to give anonymously', path: ['donorName'] })

export const rxItemSchema = z.object({
  medicine_id: z.string().optional().nullable(),
  medication_name: z.string().trim().min(1, 'Medication is required').max(160),
  dosage: z.string().trim().min(1, 'Dosage is required').max(80),
  frequency: z.string().trim().min(1, 'Frequency is required').max(80),
  duration: z.string().trim().min(1, 'Duration is required').max(80),
  instructions: z.string().trim().max(500).optional().nullable(),
  quantity: z.number().int().min(1).max(1000).optional().nullable(),
})
