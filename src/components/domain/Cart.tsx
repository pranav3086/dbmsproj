import { FileWarning, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router'
import { MAX_QTY, useCart } from '@/app/cart'
import { Button } from '@/components/common/Button'
import { Drawer } from '@/components/common/Dialog'
import { EmptyState } from '@/components/common/States'
import { formatMoney } from '@/lib/utils'

export function QuantityStepper({ value, onChange, max = MAX_QTY, label }: { value: number; onChange: (n: number) => void; max?: number; label: string }) {
  return (
    <div className="inline-flex items-center rounded-xl border border-line-strong bg-white" role="group" aria-label={`Quantity for ${label}`}>
      <button className="flex h-9 w-9 items-center justify-center text-forest disabled:opacity-40" onClick={() => onChange(value - 1)} disabled={value <= 1} aria-label="Decrease quantity"><Minus className="h-3.5 w-3.5" /></button>
      <span className="w-8 text-center text-sm font-semibold tabular-nums" aria-live="polite">{value}</span>
      <button className="flex h-9 w-9 items-center justify-center text-forest disabled:opacity-40" onClick={() => onChange(value + 1)} disabled={value >= max} aria-label="Increase quantity"><Plus className="h-3.5 w-3.5" /></button>
    </div>
  )
}

export function CartButton() {
  const cart = useCart()
  return (
    <Button variant="secondary" onClick={() => cart.setOpen(true)} icon={<ShoppingBag className="h-4 w-4" />} aria-label={`Open cart, ${cart.count} items`}>
      Cart{cart.count > 0 && <span className="ml-1 rounded-full bg-forest px-2 py-0.5 text-[11px] text-white">{cart.count}</span>}
    </Button>
  )
}

export function CartDrawer() {
  const cart = useCart()
  const navigate = useNavigate()
  return (
    <Drawer open={cart.open} onOpenChange={cart.setOpen} title="Your cart" footer={cart.lines.length > 0 && (
      <div className="space-y-4">
        {cart.needsPrescription && (
          <p className="flex gap-2 rounded-xl bg-[#fbf3e4] p-3 text-[13px] text-[#7a5413]"><FileWarning className="mt-0.5 h-4 w-4 shrink-0" />Your cart includes prescription-only medicine. You’ll link a current prescription at checkout and a pharmacist will review it before dispensing.</p>
        )}
        <div className="flex justify-between text-[15px]"><span className="text-muted">Estimated subtotal</span><span className="font-semibold text-forest">{formatMoney(cart.subtotal)}</span></div>
        <p className="text-[12px] text-muted">Final prices, stock and delivery are confirmed by the server when you place the order.</p>
        <Button size="lg" className="w-full" onClick={() => { cart.setOpen(false); navigate('/patient/checkout') }}>Proceed to checkout</Button>
      </div>
    )}>
      {cart.lines.length === 0 ? (
        <div className="p-5"><EmptyState icon={<ShoppingBag className="h-5 w-5" />} title="Your cart is empty" description="Browse the pharmacy to add items." /></div>
      ) : (
        <ul className="divide-y divide-line">
          {cart.lines.map((l) => (
            <li key={l.medicine.id} className="flex gap-4 p-5">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-forest">{l.medicine.name} {l.medicine.strength}</p>
                <p className="text-[13px] text-muted">{l.medicine.pack_size} · {formatMoney(l.medicine.price)} each</p>
                {l.medicine.requires_prescription && <p className="mt-1 text-[12px] font-medium text-warning">Prescription required</p>}
                <div className="mt-3 flex items-center gap-3">
                  <QuantityStepper value={l.quantity} onChange={(n) => cart.setQuantity(l.medicine.id, n)} label={l.medicine.name} />
                  <button onClick={() => cart.remove(l.medicine.id)} className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-error/5 hover:text-error" aria-label={`Remove ${l.medicine.name}`}><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              <p className="font-semibold tabular-nums text-forest">{formatMoney(l.medicine.price * l.quantity)}</p>
            </li>
          ))}
        </ul>
      )}
    </Drawer>
  )
}
