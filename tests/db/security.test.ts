import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestDb, type TestDb } from './harness'

let t: TestDb
const ids: Record<string, string> = {}
const EMAIL: Record<string, string> = {
  patient: 'patient@a10.example', patient2: 'patient2@a10.example', doctor: 'doctor@a10.example', gp: 'gp@a10.example',
  staff: 'staff@a10.example', pharmacy: 'pharmacy@a10.example', admin: 'admin@a10.example',
  pending: 'pending.doctor@a10.example', intruder: 'intruder@a10.example',
}

// Act as a user through the application's MySQL account, as the API server does.
const tok = (who: string | null) => t.token(who ? EMAIL[who] : null)
const rpc = async <T = Record<string, unknown>>(who: string | null, fn: string, args: Record<string, unknown> = {}) =>
  t.db.rpc(await tok(who), fn, args) as Promise<T>
const rpcRows = async <T = Record<string, unknown>>(who: string | null, fn: string, args: Record<string, unknown> = {}) =>
  t.db.rpcRows(await tok(who), fn, args) as Promise<T[]>
const view = async <T = Record<string, unknown>>(who: string | null, relation: string, query: Record<string, unknown> = {}) =>
  (await t.db.select(await tok(who), relation, query)).rows as T[]
const write = async (who: string, op: string, table: string, values: Record<string, unknown>, id?: string) =>
  t.db.write(await tok(who), op, table, values, id ? [{ col: 'id', op: 'eq', value: id }] : [])
const byRef = async (table: string, reference: string) =>
  (await t.q<{ id: string }>(`SELECT id FROM {h}.${table} WHERE reference = ?`, [reference]))[0].id

beforeAll(async () => {
  t = await createTestDb('a10t')
  for (const [k, email] of Object.entries(EMAIL)) {
    if (k === 'intruder') continue
    ids[k] = (await t.q<{ id: string }>(`SELECT id FROM {h}.auth_users WHERE email = ?`, [email]))[0].id
  }
  ids.intruder = await t.createUser(EMAIL.intruder, { account_type: 'admin', full_name: 'Mallory' })
})
afterAll(async () => {
  await t?.close()
})

async function nextSlot(doctorSlug: string) {
  const [d] = await t.q<{ id: string }>(`SELECT id FROM {h}.doctors WHERE slug = ?`, [doctorSlug])
  const slots = await rpcRows<{ starts_at: string }>(null, 'get_available_slots', { p_doctor_id: d.id, p_from: new Date().toISOString().slice(0, 10), p_days: 14 })
  return { doctorId: d.id, slots: slots.map((s) => s.starts_at) }
}

describe('database privileges', () => {
  it('the application account cannot touch base tables at all', async () => {
    await expect(t.db.pool.query(`SELECT * FROM a10t_hospital.appointments`)).rejects.toThrow(/command denied/)
    await expect(t.db.pool.query(`INSERT INTO a10t_hospital.user_roles (user_id, role) VALUES (?, 'admin')`, [ids.patient])).rejects.toThrow(/command denied/)
    await expect(t.db.pool.query(`UPDATE a10t_hospital.medicines SET stock = 0`)).rejects.toThrow(/command denied/)
  })

  it('cannot call internal procedures or pick an identity without a valid session token', async () => {
    await expect(t.db.pool.query(`CALL a10t_hospital.bootstrap_admin('patient@a10.example')`)).rejects.toThrow(/command denied/)
    await expect(t.db.pool.query(`CALL a10t_hospital.notify(?, 'x', 'x', 'x', NULL, FALSE)`, [ids.patient])).rejects.toThrow(/command denied/)
    const conn = await t.db.pool.getConnection()
    try {
      await conn.query(`SET @app_session_token = 'made-up-token', @app_uid = ?`, [ids.admin])
      const [rows] = await conn.query(`SELECT COUNT(*) AS n FROM a10t_api.audit_logs`)
      expect((rows as { n: number }[])[0].n).toBe(0)
    } finally {
      await conn.query(`SET @app_session_token = NULL`)
      conn.release()
    }
  })
})

describe('sign-up bootstrap and roles', () => {
  it('gives new self-registered accounts only the patient role', async () => {
    const a = await rpc<{ roles: string[] }>('patient2', 'get_my_access')
    expect(a.roles).toEqual(['patient'])
  })

  it('never grants admin from sign-up metadata', async () => {
    const a = await rpc<{ roles: string[] }>('intruder', 'get_my_access')
    expect(a.roles).toEqual(['patient'])
  })

  it('creates a pending doctor application without any clinical role', async () => {
    const a = await rpc<{ roles: string[]; doctor_application: { status: string } }>('pending', 'get_my_access')
    expect(a.roles).toEqual([])
    expect(a.doctor_application.status).toBe('pending')
    expect(await view('pending', 'appointments')).toHaveLength(0)
  })

  it('blocks protected profile fields (mass assignment)', async () => {
    await expect(write('patient', 'update', 'profiles', { is_active: false }, ids.patient)).rejects.toThrow(/protected/)
    await write('patient', 'update', 'profiles', { address: 'New address' }, ids.patient)
    const [p] = await t.q<{ address: string }>(`SELECT address FROM {h}.profiles WHERE id = ?`, [ids.patient])
    expect(p.address).toBe('New address')
  })

  it('writes to tables without an owning procedure are refused', async () => {
    await expect(write('patient', 'insert', 'user_roles', { user_id: ids.patient, role: 'admin' })).rejects.toThrow(/not supported/)
  })
})

describe('patient record ownership', () => {
  it('a patient sees only their own appointments, prescriptions, orders and profile', async () => {
    const appts = await view<{ patient_id: string }>('patient2', 'v_appointments')
    expect(appts.length).toBeGreaterThan(0)
    expect(new Set(appts.map((a) => a.patient_id))).toEqual(new Set([ids.patient2]))
    expect(await view('patient2', 'prescriptions')).toHaveLength(0)
    expect(await view('patient2', 'medication_orders')).toHaveLength(0)
    const profiles = await view<{ id: string }>('patient2', 'profiles')
    expect(profiles.map((p) => p.id)).toEqual([ids.patient2])
  })

  it('patients only see released lab reports', async () => {
    const reports = await view<{ status: string }>('patient', 'lab_reports')
    expect(reports.length).toBe(2)
    expect(reports.every((r) => r.status === 'final' || r.status === 'amended')).toBe(true)
  })

  it('anonymous visitors see no clinical rows but can browse the directory', async () => {
    expect(await view(null, 'appointments')).toHaveLength(0)
    expect(await view(null, 'prescriptions')).toHaveLength(0)
    expect(await view(null, 'v_doctors')).toHaveLength(40)
  })

  it("patients cannot cancel someone else's appointment", async () => {
    const id = await byRef('appointments', 'APT-DEMO0006')
    await expect(rpc('patient', 'update_appointment_status', { p_appointment_id: id, p_status: 'cancelled' })).rejects.toThrow(/permission/)
  })
})

describe('appointment booking', () => {
  it('books an available slot and prevents double-booking', async () => {
    const { doctorId, slots } = await nextSlot('meera-example')
    expect(slots.length).toBeGreaterThan(0)
    const b = await rpc<{ status: string; reference: string }>('patient', 'book_appointment', { p_doctor_id: doctorId, p_starts_at: slots[0], p_reason: 'Check-up' })
    expect(b.status).toBe('requested')
    expect(b.reference).toMatch(/^APT-/)
    await expect(rpc('patient2', 'book_appointment', { p_doctor_id: doctorId, p_starts_at: slots[0] })).rejects.toThrow(/no longer available/)
    const after = await nextSlot('meera-example')
    expect(after.slots).not.toContain(slots[0])
  })

  it('the unique key on the generated slot column is the last line of defence', async () => {
    const [a] = await t.q<{ doctor_id: string; starts_at: string; ends_at: string; department_id: string }>(
      `SELECT doctor_id, department_id, starts_at, ends_at FROM {h}.appointments WHERE reference = 'APT-DEMO0003'`)
    await expect(t.q(
      `INSERT INTO {h}.appointments (reference, patient_id, doctor_id, department_id, starts_at, ends_at, patient_name) VALUES ('APT-DUP', ?, ?, ?, ?, ?, 'X')`,
      [ids.patient2, a.doctor_id, a.department_id, a.starts_at, a.ends_at])).rejects.toThrow(/Duplicate entry/)
  })

  it('rejects times that are not real slots', async () => {
    const { doctorId, slots } = await nextSlot('meera-example')
    const off = new Date(new Date(slots[1]).getTime() + 7 * 60_000).toISOString()
    await expect(rpc('patient', 'book_appointment', { p_doctor_id: doctorId, p_starts_at: off })).rejects.toThrow(/no longer available/)
    const past = new Date(Date.now() - 86_400_000).toISOString()
    await expect(rpc('patient', 'book_appointment', { p_doctor_id: doctorId, p_starts_at: past })).rejects.toThrow(/no longer available/)
  })

  it('doctors and staff cannot book as patients; anonymous users must sign in', async () => {
    const { doctorId, slots } = await nextSlot('kabir-samplewood')
    await expect(rpc('doctor', 'book_appointment', { p_doctor_id: doctorId, p_starts_at: slots[0] })).rejects.toThrow(/Only patient/)
    await expect(rpc(null, 'book_appointment', { p_doctor_id: doctorId, p_starts_at: slots[0] })).rejects.toThrow(/sign in/)
  })

  it('enforces controlled status transitions', async () => {
    const id = await byRef('appointments', 'APT-DEMO0006')
    await expect(rpc('gp', 'update_appointment_status', { p_appointment_id: id, p_status: 'confirmed' })).rejects.toThrow(/permission/)
    await expect(rpc('doctor', 'update_appointment_status', { p_appointment_id: id, p_status: 'completed' })).rejects.toThrow(/cannot move/)
    await rpc('doctor', 'update_appointment_status', { p_appointment_id: id, p_status: 'confirmed' })
    await expect(rpc('doctor', 'update_appointment_status', { p_appointment_id: id, p_status: 'completed' })).rejects.toThrow(/after its start/)
    const events = await t.q(`SELECT * FROM {h}.appointment_events WHERE appointment_id = ?`, [id])
    expect(events.length).toBeGreaterThanOrEqual(2)
  })

  it('patient can reschedule atomically', async () => {
    const id = await byRef('appointments', 'APT-DEMO0004')
    const { slots } = await nextSlot('sana-prototype')
    const r = await rpc<{ reference: string }>('patient', 'reschedule_appointment', { p_appointment_id: id, p_new_starts_at: slots[3] })
    expect(r.reference).toMatch(/^APT-/)
    const [old] = await t.q<{ status: string }>(`SELECT status FROM {h}.appointments WHERE id = ?`, [id])
    expect(old.status).toBe('cancelled')
  })

})

describe('transactions', () => {
  it('a failed procedure rolls back everything it already wrote', async () => {
    const count = async () => (await t.q<{ n: number }>(`SELECT COUNT(*) AS n FROM {h}.prescriptions`))[0].n
    const before = await count()
    // save_prescription inserts the prescription row first; the empty item list then fails.
    await expect(rpc('doctor', 'save_prescription', { p_patient_id: ids.patient, p_items: [], p_issue: true })).rejects.toThrow(/at least one medication/)
    expect(await count()).toBe(before)
  })
})

describe('clinical access policy', () => {
  it('doctors see only patients in their care', async () => {
    const mine = await rpcRows<{ id: string }>('doctor', 'search_patients', { p_query: '', p_limit: 25 })
    expect(new Set(mine.map((p) => p.id))).toEqual(new Set([ids.patient, ids.patient2]))
    const gp = await rpcRows<{ id: string }>('gp', 'search_patients', { p_query: '', p_limit: 25 })
    expect(gp.map((p) => p.id)).toEqual([ids.patient])
    await expect(rpc('gp', 'get_patient_chart', { p_patient_id: ids.patient2 })).rejects.toThrow(/not authorised/)
  })

  it('chart access is audited', async () => {
    await rpc('doctor', 'get_patient_chart', { p_patient_id: ids.patient })
    const logs = await t.q(`SELECT * FROM {h}.audit_logs WHERE action = 'view_patient_chart' AND entity_id = ?`, [ids.patient])
    expect(logs.length).toBeGreaterThan(0)
  })

  it('administrators do not get clinical read access', async () => {
    expect(await view('admin', 'prescriptions')).toHaveLength(0)
    expect(await view('admin', 'lab_reports')).toHaveLength(0)
    expect(await view('admin', 'consultations')).toHaveLength(0)
  })

  it('pending doctors cannot read clinical records', async () => {
    expect(await view('pending', 'lab_reports')).toHaveLength(0)
    await expect(rpc('pending', 'get_patient_chart', { p_patient_id: ids.patient })).rejects.toThrow()
  })
})

describe('prescriptions', () => {
  const items = [{ medication_name: 'Cetirizine 10 mg', dosage: '1 tablet', frequency: 'Once daily', duration: '5 days' }]

  it('doctor issues, patient sees it, amendments preserve history', async () => {
    const d = await rpc<{ id: string; status: string }>('doctor', 'save_prescription', { p_id: null, p_patient_id: ids.patient, p_notes: 'Sample', p_items: items, p_issue: false })
    expect(d.status).toBe('draft')
    expect(await view('patient', 'prescriptions', { filters: [{ col: 'id', op: 'eq', value: d.id }] })).toHaveLength(0)
    const i = await rpc<{ status: string }>('doctor', 'save_prescription', { p_id: d.id, p_patient_id: ids.patient, p_notes: 'Sample', p_items: items, p_issue: true })
    expect(i.status).toBe('issued')
    expect(await view('patient', 'prescriptions', { filters: [{ col: 'id', op: 'eq', value: d.id }] })).toHaveLength(1)
    await expect(rpc('gp', 'amend_prescription', { p_id: d.id, p_reason: 'dose change', p_items: items })).rejects.toThrow(/prescribing doctor/)
    const a = await rpc<{ version: number; supersedes_id: string }>('doctor', 'amend_prescription', { p_id: d.id, p_reason: 'Dose clarified', p_items: items })
    expect(a.version).toBe(2)
    expect(a.supersedes_id).toBe(d.id)
    const [old] = await t.q<{ status: string }>(`SELECT status FROM {h}.prescriptions WHERE id = ?`, [d.id])
    expect(old.status).toBe('superseded')
  })

  it('doctors cannot prescribe for patients outside their care', async () => {
    await expect(rpc('gp', 'save_prescription', { p_patient_id: ids.patient2, p_items: [{ medication_name: 'X', dosage: '1', frequency: '1', duration: '1' }], p_issue: true }))
      .rejects.toThrow(/not under your care/)
  })
})

describe('lab reports', () => {
  it('final reports can only change through amendment', async () => {
    const id = await byRef('lab_reports', 'LAB-DEMO0001')
    await expect(rpc('doctor', 'save_lab_report', { p_report: { id, test_name: 'Lipid profile (sample)', status: 'final' } })).rejects.toThrow(/amended/)
    await rpc('doctor', 'save_lab_report', { p_report: { id, test_name: 'Lipid profile (sample)', status: 'amended', results: [{ analyte: 'HDL', value: '50', unit: 'mg/dL' }] } })
    const [after] = await t.q<{ status: string }>(`SELECT status FROM {h}.lab_reports WHERE id = ?`, [id])
    expect(after.status).toBe('amended')
  })

  it('lab staff can manage reports; patients cannot write', async () => {
    const r = await rpc<{ id: string }>('staff', 'save_lab_report', { p_report: { patient_id: ids.patient2, test_name: 'Thyroid panel (sample)', status: 'collected' } })
    expect(r.id).toBeTruthy()
    await expect(rpc('patient', 'save_lab_report', { p_report: { patient_id: ids.patient, test_name: 'Fake', status: 'final' } })).rejects.toThrow(/not authorised/)
  })

  it('private documents follow the same access rules', async () => {
    const id = await byRef('lab_reports', 'LAB-DEMO0002')
    const path = `${ids.patient}/${id}/report.pdf`
    await t.db.call(await tok('gp'), 'storage_put', ['lab-reports', path, 'application/pdf', Buffer.from([1, 2, 3])])
    const [file] = await t.db.call(await tok('patient'), 'storage_get', ['lab-reports', path])
    expect(Buffer.from(file.data as Buffer)).toEqual(Buffer.from([1, 2, 3]))
    await expect(t.db.call(await tok('patient2'), 'storage_get', ['lab-reports', path])).rejects.toThrow(/not available/)
    await expect(t.db.call(await tok('patient2'), 'storage_put', ['lab-reports', `${ids.patient2}/${id}/x.pdf`, 'application/pdf', Buffer.from([1])])).rejects.toThrow(/permission/)
  })
})

describe('pharmacy orders', () => {
  it('computes totals in the database and reserves stock (with an inventory record)', async () => {
    const [m] = await t.q<{ id: string; stock: number; price: string }>(`SELECT id, stock, price FROM {h}.medicines WHERE slug = 'paracetamol-500-mg'`)
    const o = await rpc<{ status: string; subtotal: number; id: string }>('patient2', 'place_order', {
      p_items: [{ medicine_id: m.id, quantity: 2 }, { medicine_id: m.id, quantity: 1 }], p_delivery_address: '1 Example Road, Sample City', p_contact_phone: '+91 90000 00002',
    })
    expect(o.status).toBe('placed')
    expect(Number(o.subtotal)).toBe(Number(m.price) * 3)
    const [after] = await t.q<{ stock: number }>(`SELECT stock FROM {h}.medicines WHERE id = ?`, [m.id])
    expect(after.stock).toBe(m.stock - 3)
    const moves = await t.q<{ change: number }>(`SELECT \`change\` FROM {h}.inventory_movements WHERE order_id = ?`, [o.id])
    expect(moves.map((x) => x.change)).toEqual([-3])
    await rpc('patient2', 'update_order_status', { p_order_id: o.id, p_status: 'cancelled' })
    const [restored] = await t.q<{ stock: number }>(`SELECT stock FROM {h}.medicines WHERE id = ?`, [m.id])
    expect(restored.stock).toBe(m.stock)
  })

  it("prescription-only items require the patient's own issued prescription", async () => {
    const [m] = await t.q<{ id: string }>(`SELECT id FROM {h}.medicines WHERE slug = 'amoxicillin-500-mg'`)
    const items = [{ medicine_id: m.id, quantity: 1 }]
    await expect(rpc('patient2', 'place_order', { p_items: items, p_delivery_address: '1 Example Road', p_contact_phone: '+91 90000 00002' })).rejects.toThrow(/prescription/)
    const rx = await byRef('prescriptions', 'RX-DEMO0001')
    await expect(rpc('patient2', 'place_order', { p_items: items, p_delivery_address: '1 Example Road', p_contact_phone: '+91 90000 00002', p_prescription_id: rx })).rejects.toThrow(/prescription/)
    const o = await rpc<{ status: string }>('patient', 'place_order', { p_items: items, p_delivery_address: '1 Example Road', p_contact_phone: '+91 90000 00001', p_prescription_id: rx })
    expect(o.status).toBe('pending_review')
  })

  it('only pharmacy staff move orders through the workflow', async () => {
    const id = await byRef('medication_orders', 'ORD-DEMO0002')
    await expect(rpc('patient', 'update_order_status', { p_order_id: id, p_status: 'approved' })).rejects.toThrow()
    await expect(rpc('pharmacy', 'update_order_status', { p_order_id: id, p_status: 'dispatched' })).rejects.toThrow(/cannot move/)
    await rpc('pharmacy', 'update_order_status', { p_order_id: id, p_status: 'approved', p_note: 'Prescription verified' })
    expect(await view('pharmacy', 'prescriptions', { filters: [{ col: 'reference', op: 'eq', value: 'RX-DEMO0001' }] })).toHaveLength(1)
  })

  it('stock cannot be edited directly, even by root', async () => {
    await expect(write('pharmacy', 'update', 'medicines', { stock: 9999 }, (await t.q<{ id: string }>(`SELECT id FROM {h}.medicines WHERE slug = 'paracetamol-500-mg'`))[0].id))
      .rejects.toThrow(/inventory adjustment/)
    await expect(t.q(`UPDATE {h}.medicines SET stock = 9999 WHERE slug = 'paracetamol-500-mg'`)).rejects.toThrow(/inventory adjustment/)
  })
})

describe('donations', () => {
  it('records simulated donations in demo mode and exposes a minimal receipt', async () => {
    const [c] = await t.q<{ id: string }>(`SELECT id FROM {h}.donation_causes LIMIT 1`)
    const d = await rpc<{ status: string; reference: string }>(null, 'create_donation', {
      p_cause_id: c.id, p_amount: 750, p_donor_name: 'Guest Donor', p_donor_email: 'guest@a10.example', p_is_anonymous: false,
    })
    expect(d.status).toBe('simulated')
    const rec = await rpc<{ amount: number; donor_name: string }>(null, 'get_donation_receipt', { p_reference: d.reference })
    expect(Number(rec.amount)).toBe(750)
    expect(await view(null, 'donations')).toHaveLength(0)
  })
})

describe('doctor verification', () => {
  it('only admins approve; approval grants the doctor role and a directory entry', async () => {
    const [app] = await t.q<{ id: string }>(`SELECT id FROM {h}.doctor_applications WHERE user_id = ?`, [ids.pending])
    const [dept] = await t.q<{ id: string }>(`SELECT id FROM {h}.departments WHERE slug = 'cardiology'`)
    await expect(rpc('patient', 'review_doctor_application', { p_application_id: app.id, p_decision: 'approved', p_department_id: dept.id })).rejects.toThrow(/administrators/)
    await rpc('admin', 'review_doctor_application', { p_application_id: app.id, p_decision: 'approved', p_notes: 'Licence checked', p_department_id: dept.id })
    const a = await rpc<{ roles: string[]; doctor_id: string }>('pending', 'get_my_access')
    expect(a.roles).toContain('doctor')
    expect(a.doctor_id).toBeTruthy()
  })

  it('doctors cannot self-verify directory credentials', async () => {
    const [d] = await t.q<{ id: string }>(`SELECT id FROM {h}.doctors WHERE user_id = ?`, [ids.doctor])
    await expect(write('doctor', 'update', 'doctors', { licence_verified: true, speciality: 'Anything' }, d.id)).rejects.toThrow(/administrator/)
    await write('doctor', 'update', 'doctors', { bio: 'Updated bio' }, d.id)
    const [after] = await t.q<{ bio: string }>(`SELECT bio FROM {h}.doctors WHERE id = ?`, [d.id])
    expect(after.bio).toBe('Updated bio')
  })

  it('availability windows cannot overlap', async () => {
    const [d] = await t.q<{ id: string }>(`SELECT id FROM {h}.doctors WHERE user_id = ?`, [ids.doctor])
    await expect(write('doctor', 'insert', 'doctor_availability', { doctor_id: d.id, weekday: 1, start_time: '12:00', end_time: '15:00' })).rejects.toThrow(/overlaps/)
    await expect(write('gp', 'insert', 'doctor_availability', { doctor_id: d.id, weekday: 0, start_time: '08:00', end_time: '09:00' })).rejects.toThrow(/own working hours/)
  })
})

describe('staff invitations', () => {
  it('invited staff receive exactly the invited permissions', async () => {
    const inv = await rpc<{ token: string }>('admin', 'create_employee_invitation', { p_email: 'nurse@a10.example', p_permissions: ['appointments'] })
    await t.createUser('nurse@a10.example', { account_type: 'staff', invite_token: inv.token })
    EMAIL.nurse = 'nurse@a10.example'
    const a = await rpc<{ roles: string[]; permissions: string[] }>('nurse', 'get_my_access')
    expect(a.roles).toEqual(['staff'])
    expect(a.permissions).toEqual(['appointments'])
    await t.createUser('someone@a10.example', { account_type: 'staff', invite_token: inv.token })
    EMAIL.someone = 'someone@a10.example'
    const o = await rpc<{ roles: string[] }>('someone', 'get_my_access')
    expect(o.roles).toEqual([])
  })
})

describe('audit trail', () => {
  it('row changes are recorded by triggers with the acting user', async () => {
    const [d] = await t.q<{ id: string }>(`SELECT id FROM {h}.doctors WHERE user_id = ?`, [ids.doctor])
    const logs = await t.q<{ actor_id: string; details: { changed: string[] } }>(
      `SELECT actor_id, details FROM {h}.audit_logs WHERE entity = 'doctors' AND entity_id = ? AND action = 'update' ORDER BY id DESC LIMIT 1`, [d.id])
    expect(logs[0].actor_id).toBe(ids.doctor)
    expect(logs[0].details.changed).toEqual(['bio'])
    expect((await view<{ id: number }>('admin', 'v_audit_logs', { limit: 5 })).length).toBeGreaterThan(0)
    expect(await view('doctor', 'v_audit_logs')).toHaveLength(0)
  })
})
