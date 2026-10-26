import { db } from '@/lib/backend'
import type { Filter } from '@/lib/backend/types'
import type { Medicine, Order, OrderEvent, OrderItem, OrderStatus } from '@/types/models'

export async function listMedicines(q: { search?: string; category?: string; includeInactive?: boolean; limit?: number; offset?: number } = {}) {
  const filters: Filter[] = []
  if (!q.includeInactive) filters.push({ col: 'is_active', op: 'eq', value: true })
  if (q.category) filters.push({ col: 'category', op: 'eq', value: q.category })
  return db().select<Medicine>('medicines', {
    filters,
    search: q.search ? { cols: ['name', 'generic_name', 'category'], term: q.search } : undefined,
    order: [{ col: 'name' }],
    limit: q.limit ?? 60,
    offset: q.offset,
    count: true,
  })
}

export async function listMedicineCategories() {
  const { rows } = await db().select<{ category: string }>('medicines', { columns: 'category', filters: [{ col: 'is_active', op: 'eq', value: true }] })
  return [...new Set(rows.map((r) => r.category))].sort()
}

export async function getMedicine(slug: string) {
  const { rows } = await db().select<Medicine>('medicines', { filters: [{ col: 'slug', op: 'eq', value: slug }], limit: 1 })
  return rows[0] ?? null
}

export function placeOrder(input: { items: { medicine_id: string; quantity: number }[]; deliveryAddress: string; contactPhone: string; notes?: string; prescriptionId?: string | null }) {
  return db().rpc<Order>('place_order', {
    p_items: input.items,
    p_delivery_address: input.deliveryAddress,
    p_contact_phone: input.contactPhone,
    p_notes: input.notes || null,
    p_prescription_id: input.prescriptionId || null,
  })
}

export async function listOrders(q: { patientId?: string; statuses?: OrderStatus[]; search?: string; limit?: number } = {}) {
  const filters: Filter[] = []
  if (q.patientId) filters.push({ col: 'patient_id', op: 'eq', value: q.patientId })
  if (q.statuses?.length) filters.push({ col: 'status', op: 'in', value: q.statuses })
  const { rows } = await db().select<Order>('v_orders', {
    filters,
    search: q.search ? { cols: ['reference', 'patient_name'], term: q.search } : undefined,
    order: [{ col: 'created_at', asc: false }],
    limit: q.limit ?? 100,
  })
  return rows
}

export async function getOrder(id: string) {
  const { rows } = await db().select<Order>('v_orders', { filters: [{ col: 'id', op: 'eq', value: id }], limit: 1 })
  if (!rows[0]) return null
  const [items, events] = await Promise.all([
    db().select<OrderItem>('medication_order_items', { filters: [{ col: 'order_id', op: 'eq', value: id }] }),
    db().select<OrderEvent>('order_events', { filters: [{ col: 'order_id', op: 'eq', value: id }], order: [{ col: 'created_at' }, { col: 'id' }] }),
  ])
  return { ...rows[0], items: items.rows, events: events.rows }
}

export function updateOrderStatus(id: string, status: OrderStatus, note?: string) {
  return db().rpc<Order>('update_order_status', { p_order_id: id, p_status: status, p_note: note || null })
}

export function adjustStock(medicineId: string, change: number, reason: string) {
  return db().rpc<Medicine>('adjust_stock', { p_medicine_id: medicineId, p_change: change, p_reason: reason })
}

export function saveMedicine(values: Partial<Medicine> & { id?: string }) {
  const { id, stock, ...rest } = values
  const payload = { ...rest } as Record<string, unknown>
  delete payload.created_at
  delete payload.updated_at
  if (id) return db().update<Medicine>('medicines', payload, [{ col: 'id', op: 'eq', value: id }]).then((r) => r[0])
  return db().insert<Medicine>('medicines', { ...payload, stock: stock ?? 0 })
}

/** Order status workflow — mirrors public.order_transition_allowed (the server enforces it). */
export const ORDER_NEXT: Record<OrderStatus, OrderStatus[]> = {
  placed: ['processing', 'cancelled'],
  pending_review: ['approved', 'rejected', 'cancelled'],
  approved: ['processing', 'cancelled'],
  processing: ['dispatched', 'cancelled'],
  dispatched: ['delivered'],
  delivered: [],
  cancelled: [],
  rejected: [],
}
