import { AlertCircle, Eye, EyeOff, Search, X } from 'lucide-react'
import {
  cloneElement,
  forwardRef,
  isValidElement,
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { cn } from '@/lib/utils'

export const controlStyles =
  'w-full rounded-[var(--radius-control)] border border-line-strong bg-white px-3.5 text-[15px] text-ink placeholder:text-muted/70 transition-[border-color,box-shadow] duration-200 hover:border-mint-300 focus:border-mint-500 focus:outline-none focus:shadow-[var(--shadow-ring)] disabled:cursor-not-allowed disabled:bg-mist disabled:text-muted aria-[invalid=true]:border-error/70 aria-[invalid=true]:focus:shadow-[0_0_0_4px_rgb(198_83_83/0.15)]'

interface FieldProps {
  label: ReactNode
  error?: string
  hint?: ReactNode
  required?: boolean
  className?: string
  children: ReactElement<Record<string, unknown>>
  optional?: boolean
}

/** Wires label, hint and error to the control with the right ARIA attributes. */
export function FormField({ label, error, hint, required, optional, className, children }: FieldProps) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined
  const control = isValidElement(children)
    ? cloneElement(children, { id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy, 'aria-required': required || undefined })
    : children
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-[13.5px] font-medium text-ink">
        {label}
        {required && <span className="ml-0.5 text-error" aria-hidden>*</span>}
        {optional && <span className="ml-1.5 text-xs font-normal text-muted">(optional)</span>}
      </label>
      {control}
      {hint && !error && <p id={hintId} className="text-[12.5px] text-muted">{hint}</p>}
      {error && (
        <p id={errorId} role="alert" className="flex items-start gap-1.5 text-[12.5px] font-medium text-error">
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden /> {error}
        </p>
      )}
    </div>
  )
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(controlStyles, 'h-11', className)} {...props} />
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, rows = 4, ...props }, ref) {
  return <textarea ref={ref} rows={rows} className={cn(controlStyles, 'resize-y py-2.5 leading-relaxed', className)} {...props} />
})

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cn(controlStyles, 'h-11 appearance-none bg-[url("data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A//www.w3.org/2000/svg%27%20width%3D%2716%27%20height%3D%2716%27%20fill%3D%27none%27%20stroke%3D%27%23718078%27%20stroke-width%3D%272%27%3E%3Cpath%20d%3D%27m4%206%204%204%204-4%27/%3E%3C/svg%3E")] bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-10', className)}
      {...props}
    >
      {children}
    </select>
  )
})

export const PasswordInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function PasswordInput({ className, ...props }, ref) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <input ref={ref} type={visible ? 'text' : 'password'} className={cn(controlStyles, 'h-11 pr-11', className)} {...props} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-[var(--radius-control)] text-muted transition-colors hover:text-forest"
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
      >
        {visible ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
      </button>
    </div>
  )
})

export function Checkbox({ label, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  return (
    <label className={cn('flex cursor-pointer items-start gap-2.5 text-sm text-ink', className)}>
      <input
        type="checkbox"
        className="peer mt-0.5 h-[18px] w-[18px] shrink-0 cursor-pointer appearance-none rounded-[5px] border border-line-strong bg-white transition-colors checked:border-forest checked:bg-forest checked:bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A//www.w3.org/2000/svg%27%20viewBox%3D%270%200%2016%2016%27%20fill%3D%27none%27%20stroke%3D%27white%27%20stroke-width%3D%272.4%27%3E%3Cpath%20d%3D%27m3.5%208.5%203%203%206-7%27/%3E%3C/svg%3E')] checked:bg-center focus-visible:shadow-[var(--shadow-ring)] focus-visible:outline-none aria-[invalid=true]:border-error"
        {...props}
      />
      <span className="leading-snug">{label}</span>
    </label>
  )
}

export function SearchBar({ value, onChange, placeholder = 'Search', className, label = 'Search' }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string; label?: string }) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className={cn(controlStyles, 'h-11 pl-10 pr-9 [&::-webkit-search-cancel-button]:hidden')}
      />
      {value && (
        <button type="button" onClick={() => onChange('')} className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted hover:bg-mint-50 hover:text-forest" aria-label="Clear search">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

export function PasswordRequirements({ value }: { value: string }) {
  const rules = [
    { ok: value.length >= 10, label: 'At least 10 characters' },
    { ok: /[a-z]/.test(value) && /[A-Z]/.test(value), label: 'Upper and lower case letters' },
    { ok: /\d/.test(value), label: 'At least one number' },
    { ok: /[^A-Za-z0-9]/.test(value), label: 'At least one symbol' },
  ]
  return (
    <ul className="grid grid-cols-1 gap-1 text-[12.5px] sm:grid-cols-2" aria-label="Password requirements">
      {rules.map((r) => (
        <li key={r.label} className={cn('flex items-center gap-1.5 transition-colors', r.ok ? 'text-success' : 'text-muted')}>
          <span className={cn('flex h-3.5 w-3.5 items-center justify-center rounded-full border text-[9px]', r.ok ? 'border-success bg-success text-white' : 'border-line-strong')} aria-hidden>
            {r.ok ? '✓' : ''}
          </span>
          {r.label}
          <span className="sr-only">{r.ok ? '(met)' : '(not met)'}</span>
        </li>
      ))}
    </ul>
  )
}
