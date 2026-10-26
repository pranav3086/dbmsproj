import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { BriefcaseMedical, IdCard, UserRound } from 'lucide-react'
import { useState } from 'react'
import { useForm, useWatch, type FieldValues, type UseFormRegister } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Button } from '@/components/common/Button'
import { Segmented } from '@/components/common/Layout'
import { Checkbox, FormField, Input, PasswordInput, PasswordRequirements, Select, Textarea } from '@/components/forms/Field'
import { AuthShell, FormAlert } from '@/components/layout/AuthShell'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { db } from '@/lib/backend'
import { errorMessage, formatDate } from '@/lib/utils'
import { doctorSignUpSchema, patientSignUpSchema, staffSignUpSchema } from '@/schemas'
import { getInvitation } from '@/services/account'
import { listDepartments } from '@/services/directory'

type Pathway = 'patient' | 'doctor' | 'staff'

function Terms({ register, error }: { register: UseFormRegister<FieldValues>; error?: string }) {
  return (
    <div>
      <Checkbox
        aria-invalid={error ? true : undefined}
        label={<>I agree to the <Link to="/terms" target="_blank" className="font-medium text-mint-700 underline">Terms of Use</Link> and have read the <Link to="/privacy" target="_blank" className="font-medium text-mint-700 underline">Privacy Notice</Link>.</>}
        {...register('terms')}
      />
      {error && <p role="alert" className="mt-1.5 text-[12.5px] font-medium text-error">{error}</p>}
    </div>
  )
}

function PasswordFields({ register, errors, control }: { register: UseFormRegister<FieldValues>; errors: Record<string, { message?: string } | undefined>; control: never }) {
  const pw = (useWatch({ control, name: 'password' }) as string | undefined) ?? ''
  return (
    <>
      <FormField label="Password" error={errors.password?.message} required>
        <PasswordInput autoComplete="new-password" {...register('password')} />
      </FormField>
      <PasswordRequirements value={pw} />
      <FormField label="Confirm password" error={errors.confirmPassword?.message} required>
        <PasswordInput autoComplete="new-password" {...register('confirmPassword')} />
      </FormField>
    </>
  )
}

function useSignUp() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const submit = async (email: string, password: string, metadata: Record<string, unknown>) => {
    setError(null)
    try {
      await db().auth.signUp({ email, password, metadata })
      navigate(`/check-email?email=${encodeURIComponent(email)}&type=${metadata.account_type}`)
    } catch (e) {
      setError(errorMessage(e))
    }
  }
  return { error, submit }
}

function PatientForm() {
  const { error, submit } = useSignUp()
  const form = useForm({ resolver: zodResolver(patientSignUpSchema), defaultValues: { fullName: '', email: '', phone: '', dateOfBirth: '', password: '', confirmPassword: '', terms: false as unknown as true } })
  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = form
  const onSubmit = handleSubmit((v) => submit(v.email, v.password, { account_type: 'patient', full_name: v.fullName, phone: v.phone, date_of_birth: v.dateOfBirth }))
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {error && <FormAlert>{error}</FormAlert>}
      <FormField label="Full name" error={errors.fullName?.message} required><Input autoComplete="name" {...register('fullName')} /></FormField>
      <FormField label="Email address" error={errors.email?.message} required><Input type="email" autoComplete="email" {...register('email')} /></FormField>
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="Phone number" error={errors.phone?.message} optional hint="Used for appointment updates"><Input type="tel" autoComplete="tel" {...register('phone')} /></FormField>
        <FormField label="Date of birth" error={errors.dateOfBirth?.message} optional hint="Helps us identify your records"><Input type="date" max={new Date().toISOString().slice(0, 10)} {...register('dateOfBirth')} /></FormField>
      </div>
      <PasswordFields register={register as never} errors={errors} control={control as never} />
      <Terms register={register as never} error={errors.terms?.message} />
      <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>Create patient account</Button>
    </form>
  )
}

function DoctorForm() {
  const { error, submit } = useSignUp()
  const departments = useQuery({ queryKey: ['departments', ''], queryFn: () => listDepartments() })
  const form = useForm({
    resolver: zodResolver(doctorSignUpSchema),
    defaultValues: { fullName: '', email: '', phone: '', licenceNumber: '', qualifications: '', speciality: '', departmentId: '', yearsExperience: '', password: '', confirmPassword: '', terms: false as unknown as true },
  })
  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = form
  const onSubmit = handleSubmit((v) =>
    submit(v.email, v.password, {
      account_type: 'doctor', full_name: v.fullName, phone: v.phone, licence_number: v.licenceNumber,
      qualifications: v.qualifications.split(',').map((q) => q.trim()).filter(Boolean),
      speciality: v.speciality, department_id: v.departmentId, years_experience: v.yearsExperience,
    }),
  )
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <FormAlert tone="info">Professional accounts start as <strong>Pending verification</strong>. An administrator reviews your registration before any clinical tools or patient records become available. You can upload supporting credentials after confirming your email.</FormAlert>
      {error && <FormAlert>{error}</FormAlert>}
      <FormField label="Full name (as registered)" error={errors.fullName?.message} required><Input autoComplete="name" {...register('fullName')} /></FormField>
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="Professional email" error={errors.email?.message} required><Input type="email" autoComplete="email" {...register('email')} /></FormField>
        <FormField label="Phone number" error={errors.phone?.message} required><Input type="tel" autoComplete="tel" {...register('phone')} /></FormField>
      </div>
      <FormField label="Medical registration / licence number" error={errors.licenceNumber?.message} required><Input {...register('licenceNumber')} /></FormField>
      <FormField label="Qualifications" error={errors.qualifications?.message} required hint="Separate with commas, e.g. MBBS, MD (Medicine)"><Textarea rows={2} {...register('qualifications')} /></FormField>
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="Speciality" error={errors.speciality?.message} required><Input {...register('speciality')} /></FormField>
        <FormField label="Department" error={errors.departmentId?.message} required>
          <Select {...register('departmentId')} disabled={departments.isLoading}>
            <option value="">Select…</option>
            {departments.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
        </FormField>
      </div>
      <FormField label="Years of experience" error={errors.yearsExperience?.message} required><Input inputMode="numeric" className="sm:max-w-40" {...register('yearsExperience')} /></FormField>
      <PasswordFields register={register as never} errors={errors} control={control as never} />
      <Terms register={register as never} error={errors.terms?.message} />
      <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>Submit for verification</Button>
    </form>
  )
}

function StaffForm({ token }: { token: string | null }) {
  const { error, submit } = useSignUp()
  const invite = useQuery({ queryKey: ['invite', token], queryFn: () => getInvitation(token!), enabled: !!token })
  const form = useForm({ resolver: zodResolver(staffSignUpSchema), values: { fullName: '', email: invite.data?.email ?? '', phone: '', password: '', confirmPassword: '', terms: false as unknown as true } })
  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = form
  if (!token || (!invite.isLoading && !invite.data)) {
    return (
      <FormAlert tone="info">
        Staff accounts are created by invitation only. {token ? 'This invitation link is invalid or has expired.' : 'Ask your administrator to send you an invitation link.'} If you already have an account, sign in and use the invitation from your portal.
      </FormAlert>
    )
  }
  const onSubmit = handleSubmit((v) => submit(v.email, v.password, { account_type: 'staff', full_name: v.fullName, phone: v.phone, invite_token: token }))
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {invite.data && <FormAlert tone="info">You’ve been invited to the staff portal. Invitation valid until {formatDate(invite.data.expires_at)}. Use the invited email address.</FormAlert>}
      {error && <FormAlert>{error}</FormAlert>}
      <FormField label="Full name" error={errors.fullName?.message} required><Input autoComplete="name" {...register('fullName')} /></FormField>
      <FormField label="Work email" error={errors.email?.message} required><Input type="email" readOnly {...register('email')} /></FormField>
      <FormField label="Phone number" error={errors.phone?.message} optional><Input type="tel" {...register('phone')} /></FormField>
      <PasswordFields register={register as never} errors={errors} control={control as never} />
      <Terms register={register as never} error={errors.terms?.message} />
      <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>Create staff account</Button>
    </form>
  )
}

export default function SignUp() {
  useDocumentTitle('Create an account')
  const [params, setParams] = useSearchParams()
  const token = params.get('invite')
  const pathway = (params.get('as') as Pathway) ?? (token ? 'staff' : 'patient')
  const set = (p: Pathway) => setParams((prev) => { const n = new URLSearchParams(prev); n.set('as', p); return n }, { replace: true })
  return (
    <AuthShell title="Create your account" subtitle={<>Already registered? <Link to="/signin" className="font-semibold text-mint-700 hover:underline">Sign in</Link></>}>
      <Segmented
        label="Account type"
        value={pathway}
        onChange={set}
        className="mb-7 w-full"
        options={[
          { value: 'patient', label: <span className="flex items-center gap-1.5"><UserRound className="h-4 w-4" />Patient</span> },
          { value: 'doctor', label: <span className="flex items-center gap-1.5"><BriefcaseMedical className="h-4 w-4" />Healthcare professional</span> },
          { value: 'staff', label: <span className="flex items-center gap-1.5"><IdCard className="h-4 w-4" />Staff</span> },
        ]}
      />
      {pathway === 'patient' && <PatientForm />}
      {pathway === 'doctor' && <DoctorForm />}
      {pathway === 'staff' && <StaffForm token={token} />}
    </AuthShell>
  )
}
