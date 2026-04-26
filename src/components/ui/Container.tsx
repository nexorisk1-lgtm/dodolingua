import { HTMLAttributes } from 'react'

export function Container({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`mx-auto w-full max-w-md md:max-w-2xl px-4 ${className}`}
      {...props}
    />
  )
}
