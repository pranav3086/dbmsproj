import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BadgeCheck, Plus, Save, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/app/auth'
import { SampleBadge } from '@/components/common/Badge'
import { Button } from '@/components/common/Button'
import { Avatar, DescriptionList, PageHeader } from '@/components/common/Layout'
import { ErrorState, LoadingSkeleton } from '@/components/common/States'
import { FormField, Input, Select, Textarea } from '@/components/forms/Field'
import { FormAlert } from '@/components/layout/AuthShell'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { errorMessage, formatMoney } from '@/lib/utils'
import { addAvailability, removeAvailability, updateMyDoctorProfile } from '@/services/account'
import { getAvailability, getDoctor } from '@/services/directory'

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function DoctorProfile() {
  useDocumentTitle('Profile & availability')
  const { access } = useAuth()
  const qc = useQueryClient()
  const doctorId = access!.doctor_id!
  const doctor = useQuery({ queryKey: ['doctor', doctorId], queryFn: () => getDoctor(doctorId) })
  const availability = useQuery({ queryKey: ['availability', doctorId], queryFn: () => getAvailability(doctorId) })
  const [bio, setBio] = useState('')
  const [languages, setLanguages] = useState('')
  const [photo, setPhoto] = useState('')
  const [minutes, setMinutes] = useState(20)
  const [slot, setSlot] = useState({ weekday: 1, start_time: '09:00', end_time: '12:00', slot_minutes: 20 })
  const [slotError, setSlotError] = useState<string | null>(null)
  useEffect(() => {
    if (doctor.data) { setBio(doctor.data.bio); setLanguages(doctor.data.languages.join(', ')); setPhoto(doctor.data.photo_url ?? ''); setMinutes(doctor.data.consultation_minutes) }
  }, [doctor.data])

  const saveProfile = useMutation({
    mutationFn: () => {
      if (photo && !/^https:\/\//.test(photo)) throw new Error('Photo URL must start with https://')
      return updateMyDoctorProfile(doctorId, { bio: bio.trim(), languages: languages.split(',').map((l) => l.trim()).filter(Boolean), photo_url: photo.trim() || null, consultation_minutes: minutes })
    },
    onSuccess: () => { toast.success('Profile updated'); qc.invalidateQueries({ queryKey: ['doctor'] }); qc.invalidateQueries({ queryKey: ['doctors'] }) },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const add = useMutation({
    mutationFn: () => {
      if (slot.end_time <= slot.start_time) throw new Error('End time must be after start time.')
      return addAvailability({ doctor_id: doctorId, ...slot })
    },
    onSuccess: () => { setSlotError(null); toast.success('Working hours added — new slots are now bookable'); qc.invalidateQueries({ queryKey: ['availability'] }); qc.invalidateQueries({ queryKey: ['slots'] }) },
    onError: (e) => setSlotError(errorMessage(e)),
  })
  const remove = useMutation({
    mutationFn: removeAvailability,
    onSuccess: () => { toast.success('Working hours removed'); qc.invalidateQueries({ queryKey: ['availability'] }); qc.invalidateQueries({ queryKey: ['slots'] }) },
    onError: (e) => toast.error(errorMessage(e)),
  })

  if (doctor.isLoading) return <LoadingSkeleton variant="detail" rows={8} />
  if (doctor.error || !doctor.data) return <ErrorState error={doctor.error} />
  const d = doctor.data

  return (
    <>
      <PageHeader title="Profile & availability" description="Manage how you appear in the directory and when patients can book you." />
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <section className="card p-6">
          <div className="flex items-center gap-4">
            <Avatar name={d.full_name} src={d.photo_url} size="lg" />
            <div><h2 className="text-xl font-semibold">{d.full_name}</h2><p className="text-sm text-mint-700">{d.speciality} · {d.department_name}</p>{d.is_sample && <SampleBadge className="mt-1" />}</div>
          </div>
          <h3 className="mt-6 flex items-center gap-1.5 text-sm font-semibold text-forest"><BadgeCheck className="h-4 w-4 text-success" />Verified details (managed by administrators)</h3>
          <DescriptionList className="mt-3" items={[
            { label: 'Qualifications', value: d.qualifications.join(', ') || '—' },
            { label: 'Licence', value: d.licence_verified ? 'Verified' : 'Not verified' },
            { label: 'Experience', value: d.years_experience !== null ? `${d.years_experience} years` : '—' },
            { label: 'Consultation fee', value: d.consultation_fee !== null ? formatMoney(d.consultation_fee) : 'Not set' },
          ]} />
          <p className="mt-3 text-[12.5px] text-muted">To change verified information, contact the hospital administration. Self-edits never mark credentials as verified.</p>
          <div className="mt-6 space-y-4 border-t border-line pt-6">
            <FormField label="Biography"><Textarea rows={5} value={bio} onChange={(e) => setBio(e.target.value)} /></FormField>
            <FormField label="Languages" hint="Separate with commas"><Input value={languages} onChange={(e) => setLanguages(e.target.value)} /></FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Photo URL" optional hint="https:// image link"><Input value={photo} onChange={(e) => setPhoto(e.target.value)} /></FormField>
              <FormField label="Consultation length (minutes)"><Input type="number" min={5} max={120} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} /></FormField>
            </div>
            <Button icon={<Save className="h-4 w-4" />} loading={saveProfile.isPending} onClick={() => saveProfile.mutate()}>Save profile</Button>
          </div>
        </section>
        <section className="card p-6">
          <h2 className="text-lg font-semibold">Weekly working hours</h2>
          <p className="mt-1 text-sm text-muted">Patients can book slots inside these windows. Existing bookings are not affected when you remove hours.</p>
          {availability.isLoading ? <LoadingSkeleton rows={3} className="mt-4" /> : (
            <ul className="mt-4 divide-y divide-line rounded-2xl border border-line">
              {!availability.data?.length && <li className="p-4 text-sm text-muted">No working hours set — you won’t appear as bookable.</li>}
              {availability.data?.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 p-3.5">
                  <span><span className="font-medium text-forest">{WEEKDAYS[a.weekday]}</span> <span className="text-muted-strong">{a.start_time.slice(0, 5)}–{a.end_time.slice(0, 5)}</span> <span className="text-xs text-muted">({a.slot_minutes}-min slots)</span></span>
                  <Button variant="ghost" size="icon" aria-label={`Remove ${WEEKDAYS[a.weekday]} ${a.start_time.slice(0, 5)}`} onClick={() => remove.mutate(a.id)}><Trash2 className="h-4 w-4 text-error" /></Button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-6 rounded-2xl bg-mist p-4">
            <h3 className="text-sm font-semibold text-forest">Add working hours</h3>
            {slotError && <div className="mt-3"><FormAlert>{slotError}</FormAlert></div>}
            <div className="mt-3 grid gap-3 sm:grid-cols-4">
              <Select aria-label="Weekday" value={slot.weekday} onChange={(e) => setSlot({ ...slot, weekday: Number(e.target.value) })}>{WEEKDAYS.map((w, i) => <option key={w} value={i}>{w}</option>)}</Select>
              <Input aria-label="Start time" type="time" value={slot.start_time} onChange={(e) => setSlot({ ...slot, start_time: e.target.value })} />
              <Input aria-label="End time" type="time" value={slot.end_time} onChange={(e) => setSlot({ ...slot, end_time: e.target.value })} />
              <Select aria-label="Slot length" value={slot.slot_minutes} onChange={(e) => setSlot({ ...slot, slot_minutes: Number(e.target.value) })}>{[10, 15, 20, 30, 45, 60].map((m) => <option key={m} value={m}>{m} min</option>)}</Select>
            </div>
            <Button className="mt-3" size="sm" icon={<Plus className="h-4 w-4" />} loading={add.isPending} onClick={() => add.mutate()}>Add hours</Button>
          </div>
        </section>
      </div>
    </>
  )
}
