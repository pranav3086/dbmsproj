import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Medicine } from '@/types/models'

export interface CartLine {
  medicine: Pick<Medicine, 'id' | 'slug' | 'name' | 'strength' | 'price' | 'requires_prescription' | 'stock' | 'pack_size'>
  quantity: number
}

interface CartState {
  lines: CartLine[]
  count: number
  /** Indicative only — the server recalculates prices and totals when the order is placed. */
  subtotal: number
  needsPrescription: boolean
  open: boolean
  setOpen: (o: boolean) => void
  add: (m: CartLine['medicine'], qty?: number) => void
  setQuantity: (id: string, qty: number) => void
  remove: (id: string) => void
  clear: () => void
}

const CartContext = createContext<CartState | null>(null)
const KEY = 'a10.cart'
export const MAX_QTY = 20

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(KEY) ?? '[]') as CartLine[]
    } catch {
      return []
    }
  })
  const [open, setOpen] = useState(false)
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(lines))
    } catch {
      /* storage unavailable */
    }
  }, [lines])

  const value = useMemo<CartState>(() => ({
    lines,
    count: lines.reduce((n, l) => n + l.quantity, 0),
    subtotal: lines.reduce((n, l) => n + Number(l.medicine.price) * l.quantity, 0),
    needsPrescription: lines.some((l) => l.medicine.requires_prescription),
    open,
    setOpen,
    add: (m, qty = 1) =>
      setLines((ls) => {
        const existing = ls.find((l) => l.medicine.id === m.id)
        if (existing) return ls.map((l) => (l.medicine.id === m.id ? { ...l, quantity: Math.min(MAX_QTY, l.quantity + qty) } : l))
        return [...ls, { medicine: m, quantity: Math.min(MAX_QTY, qty) }]
      }),
    setQuantity: (id, qty) => setLines((ls) => ls.map((l) => (l.medicine.id === id ? { ...l, quantity: Math.max(1, Math.min(MAX_QTY, qty)) } : l))),
    remove: (id) => setLines((ls) => ls.filter((l) => l.medicine.id !== id)),
    clear: () => setLines([]),
  }), [lines, open])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used inside CartProvider')
  return ctx
}
