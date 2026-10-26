import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router'
import { cn } from '@/lib/utils'

export const buttonStyles = cva(
  'relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-medium transition-[background-color,color,border-color,box-shadow,transform] duration-200 ease-[var(--ease-out-soft)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-55 focus-visible:outline-none focus-visible:shadow-[var(--shadow-ring)]',
  {
    variants: {
      variant: {
        primary: 'bg-forest text-white shadow-[0_8px_20px_-10px_rgb(22_61_48/0.6)] hover:bg-forest-soft',
        mint: 'bg-mint-400 text-forest hover:bg-mint-300',
        secondary: 'border border-line-strong bg-white text-forest hover:border-mint-400 hover:bg-mint-50',
        soft: 'bg-mint-100 text-forest hover:bg-mint-200',
        ghost: 'text-forest hover:bg-mint-50',
        danger: 'bg-error text-white hover:bg-[#b04545]',
        'danger-outline': 'border border-error/40 bg-white text-error hover:bg-error/5',
        link: 'h-auto px-0 text-mint-700 underline-offset-4 hover:underline active:scale-100',
      },
      size: {
        sm: 'h-9 rounded-[10px] px-3.5 text-[13px]',
        md: 'h-11 rounded-[var(--radius-control)] px-5 text-sm',
        lg: 'h-13 rounded-[14px] px-7 text-[15px]',
        icon: 'h-10 w-10 rounded-[var(--radius-control)]',
      },
    },
    compoundVariants: [{ variant: 'link', className: 'h-auto px-0' }],
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

type Common = VariantProps<typeof buttonStyles> & { loading?: boolean; icon?: ReactNode; iconRight?: ReactNode; className?: string }

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & Common

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, loading, icon, iconRight, children, disabled, type = 'button', ...props },
  ref,
) {
  return (
    <button ref={ref} type={type} className={cn(buttonStyles({ variant, size }), className)} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {children}
      {iconRight}
    </button>
  )
})

export function ButtonLink({ className, variant, size, icon, iconRight, children, ...props }: LinkProps & Common) {
  return (
    <Link className={cn(buttonStyles({ variant, size }), className)} {...props}>
      {icon}
      {children}
      {iconRight}
    </Link>
  )
}
