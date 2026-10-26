import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Clock, Mail, MapPin, Phone, Send, Siren } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import type { z } from 'zod'
import { Button } from '@/components/common/Button'
import { DeptIcon } from '@/components/common/DeptIcon'
import { PageHeader, Reveal } from '@/components/common/Layout'
import { Checkbox, FormField, Input, Textarea } from '@/components/forms/Field'
import { FormAlert } from '@/components/layout/AuthShell'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { PLACEHOLDER_NOTE, useSettings } from '@/hooks/useSettings'
import { errorMessage } from '@/lib/utils'
import { contactSchema } from '@/schemas'
import { submitContactMessage } from '@/services/account'
import { listDepartments } from '@/services/directory'

type Values = z.infer<typeof contactSchema>

export default function Contact() {
  useDocumentTitle('Contact us')
  const { data: s } = useSettings()
  const departments = useQuery({ queryKey: ['departments', ''], queryFn: () => listDepartments() })
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: '', email: '', subject: '', message: '', consent: false as unknown as true, website: '' },
  })
  const onSubmit = handleSubmit(async (v) => {
    setError(null)
    if (v.website) return setSent(true) // honeypot: silently drop bot submissions
    try {
      await submitContactMessage(v)
      setSent(true)
      reset()
    } catch (e) {
      setError(errorMessage(e))
    }
  })

  return (
    <div className="container-page py-12 sm:py-16">
      <PageHeader eyebrow="Contact" title="We’d love to hear from you" description="Questions about appointments, services or your account? Send us a message and the team will reply by email." breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Contact' }]} />
      <Reveal className="mb-10 flex items-start gap-4 rounded-[var(--radius-card)] border border-error/20 bg-[#fdf6f5] p-5">
        <Siren className="mt-0.5 h-6 w-6 shrink-0 text-error" />
        <p className="text-[15px] text-muted-strong"><strong className="text-error">Medical emergency?</strong> Do not use this form. Call <strong>{s?.emergency_phone ?? '112'}</strong> or go to the nearest emergency department immediately. Messages are not monitored around the clock.</p>
      </Reveal>
      <div className="grid gap-10 lg:grid-cols-[1.3fr_1fr]">
        <div className="card p-6 sm:p-8">
          {sent ? (
            <div className="py-10 text-center" role="status">
              <CheckCircle2 className="mx-auto h-12 w-12 text-mint-500" />
              <h2 className="mt-4 text-xl font-semibold">Message received</h2>
              <p className="mt-2 text-muted">Thank you — our team will reply to your email address. Please don’t send the same message twice.</p>
              <Button variant="secondary" className="mt-6" onClick={() => setSent(false)}>Send another message</Button>
            </div>
          ) : (
            <form onSubmit={onSubmit} noValidate className="space-y-5">
              {error && <FormAlert>{error}</FormAlert>}
              <div className="grid gap-5 sm:grid-cols-2">
                <FormField label="Name" error={errors.name?.message} required><Input autoComplete="name" {...register('name')} /></FormField>
                <FormField label="Email" error={errors.email?.message} required><Input type="email" autoComplete="email" {...register('email')} /></FormField>
              </div>
              <FormField label="Subject" error={errors.subject?.message} required><Input {...register('subject')} /></FormField>
              <FormField label="Message" error={errors.message?.message} required hint="Please don’t include detailed medical information."><Textarea rows={6} maxLength={4000} {...register('message')} /></FormField>
              <div className="hidden" aria-hidden><label>Website<input tabIndex={-1} autoComplete="off" {...register('website')} /></label></div>
              <div>
                <Checkbox aria-invalid={errors.consent ? true : undefined} label="I agree that A10 Hospital may use these details to respond to my enquiry, as described in the Privacy Notice." {...register('consent')} />
                {errors.consent && <p role="alert" className="mt-1.5 text-[12.5px] font-medium text-error">{errors.consent.message}</p>}
              </div>
              <Button type="submit" size="lg" loading={isSubmitting} icon={<Send className="h-4 w-4" />}>Send message</Button>
            </form>
          )}
        </div>
        <div className="space-y-5">
          <div className="card space-y-4 p-6">
            {[[Phone, 'Phone', s?.contact_phone], [Mail, 'Email', s?.contact_email], [MapPin, 'Address', s?.address], [Clock, 'Opening hours', s?.opening_hours]].map(([Icon, label, value]) => {
              const I = Icon as typeof Phone
              return <div key={label as string} className="flex gap-3"><I className="mt-0.5 h-5 w-5 shrink-0 text-mint-600" /><div><p className="text-[12.5px] font-medium uppercase tracking-wide text-muted">{label as string}</p><p className="text-[15px] text-forest">{(value as string) ?? '—'}</p></div></div>
            })}
            <p className="rounded-xl bg-[#fdf9f0] p-3 text-[12.5px] text-[#7a5413]">{PLACEHOLDER_NOTE} A map will be shown once a verified location is configured.</p>
          </div>
          <div className="card p-6">
            <h2 className="text-base font-semibold">Departments</h2>
            <ul className="mt-3 divide-y divide-line">
              {departments.data?.map((d) => (
                <li key={d.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="flex items-center gap-2 text-forest"><DeptIcon name={d.icon} className="h-4 w-4 text-mint-600" />{d.name}</span>
                  <span className="text-muted">{d.phone_extension ? `Ext. ${d.phone_extension}` : 'Via main line'}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
