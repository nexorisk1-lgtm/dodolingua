'use client'

import { useState } from 'react'

type Pose = 'idle' | 'happy' | 'sad' | 'study' | 'listen' | 'sleep' | 'champion'

type AnimationType = 'breathe' | 'bounce' | 'shake' | 'wave' | 'pop' | 'none'

interface MascotProps {
  pose?: Pose
  size?: number
  animation?: AnimationType
  className?: string
}

export function Mascot({ pose = 'idle', size = 120, animation = 'breathe', className = '' }: MascotProps) {
  const [src, setSrc] = useState(`/dodo/dodo-${pose}.png`)

  const animClass = {
    breathe: 'animate-breathe',
    bounce: 'animate-bounce-soft',
    shake: 'animate-shake',
    wave: 'animate-wave',
    pop: 'animate-pop-in',
    none: '',
  }[animation]

  return (
    <div className={`inline-block ${animClass} ${className}`} style={{ width: size, height: size }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={`Dodo ${pose}`}
        width={size}
        height={size}
        style={{ objectFit: 'contain', width: '100%', height: '100%' }}
        onError={() => { if (src !== '/dodo/dodo-idle.png') setSrc('/dodo/dodo-idle.png') }}
      />
    </div>
  )
}
