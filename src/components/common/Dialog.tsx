import { X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { Dialog as D } from 'radix-ui'
import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Button } from './Button'

interface ModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const widths = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }

export function Modal({ open, onOpenChange, title, description, children, footer, size = 'md' }: ModalProps) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <D.Portal forceMount>
            <D.Overlay asChild forceMount>
              <motion.div className="fixed inset-0 z-50 bg-forest/30 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} />
            </D.Overlay>
            <D.Content asChild forceMount>
              <motion.div
                className={cn('fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-[var(--radius-panel)] border border-line bg-white shadow-[var(--shadow-lift)] focus:outline-none', widths[size])}
                initial={{ opacity: 0, x: '-50%', y: '-46%', scale: 0.98 }}
                animate={{ opacity: 1, x: '-50%', y: '-50%', scale: 1 }}
                exit={{ opacity: 0, x: '-50%', y: '-47%', scale: 0.98 }}
                transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
                  <div>
                    <D.Title className="font-display text-lg font-semibold text-forest">{title}</D.Title>
                    {description ? <D.Description className="mt-1 text-sm text-muted">{description}</D.Description> : <D.Description className="sr-only">{typeof title === 'string' ? title : 'Dialog'}</D.Description>}
                  </div>
                  <D.Close className="-mr-2 flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-mint-50 hover:text-forest" aria-label="Close">
                    <X className="h-4.5 w-4.5" />
                  </D.Close>
                </div>
                {children && <div className="overflow-y-auto px-6 py-5">{children}</div>}
                {footer && <div className="flex flex-col-reverse gap-2 border-t border-line bg-mist/60 px-6 py-4 sm:flex-row sm:justify-end">{footer}</div>}
              </motion.div>
            </D.Content>
          </D.Portal>
        )}
      </AnimatePresence>
    </D.Root>
  )
}

/** Side drawer used for carts, detail panels and the mobile navigation. */
export function Drawer({ open, onOpenChange, title, children, footer, side = 'right', className }: Omit<ModalProps, 'size'> & { side?: 'left' | 'right'; className?: string }) {
  const from = side === 'right' ? '100%' : '-100%'
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <D.Portal forceMount>
            <D.Overlay asChild forceMount>
              <motion.div className="fixed inset-0 z-50 bg-forest/30 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            </D.Overlay>
            <D.Content asChild forceMount>
              <motion.div
                className={cn('fixed inset-y-0 z-50 flex w-full max-w-md flex-col bg-white shadow-[var(--shadow-lift)] focus:outline-none', side === 'right' ? 'right-0' : 'left-0', className)}
                initial={{ x: from }}
                animate={{ x: 0 }}
                exit={{ x: from }}
                transition={{ type: 'spring', damping: 34, stiffness: 320 }}
              >
                <div className="flex items-center justify-between border-b border-line px-5 py-4">
                  <D.Title className="font-display text-lg font-semibold text-forest">{title}</D.Title>
                  <D.Description className="sr-only">{typeof title === 'string' ? title : 'Panel'}</D.Description>
                  <D.Close className="flex h-10 w-10 items-center justify-center rounded-lg text-muted hover:bg-mint-50 hover:text-forest" aria-label="Close">
                    <X className="h-5 w-5" />
                  </D.Close>
                </div>
                <div className="flex-1 overflow-y-auto">{children}</div>
                {footer && <div className="border-t border-line p-5">{footer}</div>}
              </motion.div>
            </D.Content>
          </D.Portal>
        )}
      </AnimatePresence>
    </D.Root>
  )
}

interface ConfirmProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  confirmLabel?: string
  tone?: 'danger' | 'primary'
  onConfirm: (note: string) => Promise<unknown> | unknown
  /** Ask for a note (e.g. a cancellation reason). */
  noteLabel?: string
  noteRequired?: boolean
}

export function ConfirmationDialog({ open, onOpenChange, title, description, confirmLabel = 'Confirm', tone = 'primary', onConfirm, noteLabel, noteRequired }: ConfirmProps) {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const run = async () => {
    setBusy(true)
    try {
      await onConfirm(note)
      setNote('')
      onOpenChange(false)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal
      open={open}
      onOpenChange={(o) => !busy && onOpenChange(o)}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>Go back</Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={run} loading={busy} disabled={noteRequired && note.trim().length < 3}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm leading-relaxed text-muted-strong">{description}</div>
      {noteLabel && (
        <label className="mt-4 block text-sm font-medium text-ink">
          {noteLabel} {!noteRequired && <span className="font-normal text-muted">(optional)</span>}
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={500} className="mt-1.5 w-full rounded-[var(--radius-control)] border border-line-strong px-3 py-2 text-sm focus:border-mint-500 focus:shadow-[var(--shadow-ring)] focus:outline-none" />
        </label>
      )}
    </Modal>
  )
}
