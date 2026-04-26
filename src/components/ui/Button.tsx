import { ButtonHTMLAttributes, forwardRef } from 'react'

type Variant = 'primary' | 'ghost' | 'warn'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  block?: boolean
}

const variants: Record<Variant, string> = {
  primary: 'bg-primary-700 hover:bg-primary-900 text-white',
  ghost: 'bg-white border border-rule text-gray-900 hover:bg-primary-50',
  warn: 'bg-warn hover:opacity-90 text-white',
}

const sizes: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', block, className = '', ...props }, ref) => (
    <button
      ref={ref}
      className={`font-semibold rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${block ? 'w-full' : ''} ${className}`}
      {...props}
    />
  )
)
Button.displayName = 'Button'
