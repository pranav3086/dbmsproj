import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { HandHeart, Info, Lock } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useNavigate } from 'react-router'
import type { z } from 'zod'
import { useAuth } from '@/app/auth'
import { Button } from '@/components/common/Button'
import { Reveal } from '@/components/common/Layout'
import { ErrorState, LoadingSkeleton } from '@/components/common/States'
import { Checkbox, FormField, Input, Textarea } from '@/components/forms/Field'
import { FormAlert } from '@/components/layout/AuthShell'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useSettings } from '@/hooks/useSettings'
import { cn, errorMessage, formatMoney } from '@/lib/utils'
import { donationSchema } from '@/schemas'
import { createDonation, listCauses } from '@/services/account'

type Values = z.infer<typeof donationSchema>

export default function Donations() {
  useDocumentTitle('Donations')
  const { status, access } = useAuth()
  const { data: settings } = useSettings()
  const navigate = useNavigate()
  const causes = useQuery({ queryKey: ['causes'], queryFn: listCauses })
  const [error, setError] = useState<string | null>(null)
  const [custom, setCustom] = useState(false)
  const signedIn = status === 'signed-in'
  const demoPayments = (settings?.payments_mode ?? 'demo') === 'demo'

  const { register, handleSubmit, control, setValue, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(donationSchema),
    defaultValues: { causeId: '', amount: 1000, donorName: '', donorEmail: '', anonymous: false, message: '', signedIn },
  })
  useEffect(() => setValue('signedIn', signedIn), [signedIn, setValue])
  useEffect(() => { if (causes.data?.[0]) setValue('causeId', causes.data[0].id) }, [causes.data, setValue])
  const causeId = useWatch({ control, name: 'causeId' })
  const amount = useWatch({ control, name: 'amount' })
  const anonymous = useWatch({ control, name: 'anonymous' })
  const cause = causes.data?.find((c) => c.id === causeId)

  const onSubmit = handleSubmit(async (v) => {
    setError(null)
    try {
      const r = await createDonation({ causeId: v.causeId, amount: v.amount, donorName: v.donorName, donorEmail: v.donorEmail, anonymous: v.anonymous, message: v.message })
      navigate(`/donations/confirmation/${r.reference}`)
    } catch (e) {
      setError(errorMessage(e))
    }
  })

  return (
    <>
      <section className="relative overflow-hidden bg-forest text-white">
        <img src="/images/community.webp" alt="" className="absolute inset-0 h-full w-full object-cover opacity-20" />
        <div className="container-page relative py-16 sm:py-24">
          <Reveal className="max-w-2xl">
            <p className="eyebrow !text-mint-300"><HandHeart className="h-4 w-4" />Give to A10 Hospital</p>
            <h1 className="display-xl mt-4 !text-white">Every gift helps someone receive care.</h1>
            <p className="mt-5 text-lg text-white/75">Your support helps patients facing hardship, children in our care and community health programmes.</p>
          </Reveal>
        </div>
      </section>
      <div className="container-page grid gap-10 py-14 lg:grid-cols-[1fr_380px]">
        <form onSubmit={onSubmit} noValidate className="space-y-8">
          {demoPayments && <FormAlert tone="info"><strong>Demonstration donations.</strong> This site records a simulated donation for demonstration purposes. <strong>No money is collected</strong> and no payment details are requested.</FormAlert>}
          {error && <FormAlert>{error}</FormAlert>}
          <fieldset>
            <legend className="text-lg font-semibold text-forest">1. Choose a cause</legend>
            {causes.isLoading ? <LoadingSkeleton rows={2} className="mt-4" /> : causes.error ? <ErrorState error={causes.error} /> : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2" role="radiogroup">
                {causes.data?.map((c) => (
                  <label key={c.id} className={cn('card cursor-pointer p-5 transition-all', causeId === c.id ? 'border-mint-500 ring-2 ring-mint-200' : 'hover:border-mint-300')}>
                    <input type="radio" value={c.id} className="sr-only" {...register('causeId')} />
                    <p className="font-semibold text-forest">{c.title}</p>
                    <p className="mt-1 text-[13.5px] text-muted">{c.description}</p>
                  </label>
                ))}
              </div>
            )}
            {errors.causeId && <p role="alert" className="mt-2 text-sm text-error">{errors.causeId.message}</p>}
          </fieldset>
          <fieldset>
            <legend className="text-lg font-semibold text-forest">2. Amount</legend>
            <Controller control={control} name="amount" render={({ field }) => (
              <div className="mt-4 flex flex-wrap gap-2">
                {(cause?.suggested_amounts ?? [500, 1000, 2500, 5000]).map((a) => (
                  <button type="button" key={a} onClick={() => { setCustom(false); field.onChange(Number(a)) }} aria-pressed={!custom && field.value === Number(a)} className={cn('h-12 rounded-xl border px-5 font-semibold transition-colors', !custom && field.value === Number(a) ? 'border-forest bg-forest text-white' : 'border-line bg-white text-forest hover:border-mint-400')}>
                    {formatMoney(a)}
                  </button>
                ))}
                <button type="button" onClick={() => setCustom(true)} aria-pressed={custom} className={cn('h-12 rounded-xl border px-5 font-semibold', custom ? 'border-forest bg-forest text-white' : 'border-line bg-white text-forest hover:border-mint-400')}>Other</button>
              </div>
            )} />
            {custom && <FormField label="Custom amount (₹)" error={errors.amount?.message} className="mt-4 max-w-xs"><Input type="number" min={1} step="1" inputMode="numeric" {...register('amount', { valueAsNumber: true })} /></FormField>}
            {!custom && errors.amount && <p role="alert" className="mt-2 text-sm text-error">{errors.amount.message}</p>}
          </fieldset>
          <fieldset className="space-y-5">
            <legend className="text-lg font-semibold text-forest">3. Your details</legend>
            <Checkbox label="Give anonymously (your name won’t be shown on the receipt)" {...register('anonymous')} />
            {!signedIn ? (
              <div className="grid gap-5 sm:grid-cols-2">
                <FormField label="Full name" error={errors.donorName?.message} required={!anonymous} optional={anonymous}><Input autoComplete="name" {...register('donorName')} /></FormField>
                <FormField label="Email for confirmation" error={errors.donorEmail?.message} required><Input type="email" autoComplete="email" {...register('donorEmail')} /></FormField>
              </div>
            ) : <p className="text-sm text-muted">Donating as <strong className="text-ink">{access?.full_name || access?.email}</strong>. It will appear in your donation history.</p>}
            <FormField label="Message" optional error={errors.message?.message}><Textarea rows={3} maxLength={500} {...register('message')} /></FormField>
          </fieldset>
          <Button type="submit" size="lg" loading={isSubmitting} icon={<Lock className="h-4 w-4" />} className="w-full sm:w-auto">
            {demoPayments ? `Record demo donation of ${formatMoney(Number.isFinite(amount) ? amount : 0)}` : `Continue to payment`}
          </Button>
        </form>
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="card p-6">
            <h2 className="text-lg font-semibold">Donation summary</h2>
            <dl className="mt-4 space-y-3 text-[15px]">
              <div className="flex justify-between gap-4"><dt className="text-muted">Cause</dt><dd className="text-right font-medium text-forest">{cause?.title ?? '—'}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted">Amount</dt><dd className="font-display text-xl font-semibold text-forest">{formatMoney(Number.isFinite(amount) ? amount : 0)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted">Payment</dt><dd className="text-right">{demoPayments ? 'Simulated — no charge' : 'Secure provider checkout'}</dd></div>
            </dl>
            <p className="mt-5 flex gap-2 rounded-xl bg-mist p-3 text-[12.5px] text-muted"><Info className="mt-0.5 h-4 w-4 shrink-0" />A10 Hospital does not make tax-deductibility or charity-registration claims on this site. Real payments require a verified payment provider configured on the server.</p>
          </div>
        </aside>
      </div>
    </>
  )
}
