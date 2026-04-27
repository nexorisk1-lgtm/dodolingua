'use client'

let confettiLib: any = null

async function loadConfetti(): Promise<any> {
  if (typeof window === 'undefined') return null
  if (confettiLib) return confettiLib
  if ((window as any).confetti) {
    confettiLib = (window as any).confetti
    return confettiLib
  }
  await new Promise<void>((resolve) => {
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js'
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => resolve()
    document.head.appendChild(script)
  })
  confettiLib = (window as any).confetti
  return confettiLib
}

const COLORS = ['#2563EB', '#10B981', '#FBBF24', '#A855F7', '#EF4444']

export async function celebrate(intensity: 'small' | 'big' = 'small') {
  const confetti = await loadConfetti()
  if (!confetti) return

  if (intensity === 'big') {
    confetti({ particleCount: 180, spread: 100, origin: { y: 0.6 }, colors: COLORS })
    setTimeout(() => confetti({ particleCount: 80, spread: 70, origin: { y: 0.7 }, colors: COLORS }), 200)
  } else {
    confetti({ particleCount: 60, spread: 65, origin: { y: 0.7 }, colors: COLORS })
  }
}

export function playSound(type: 'success' | 'error') {
  if (typeof window === 'undefined') return
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext
    if (!AC) return
    const ctx = new AC()
    if (type === 'success') {
      const notes = [{ f: 800, t: 0 }, { f: 1200, t: 0.1 }]
      notes.forEach(({ f, t }) => {
        const osc = ctx.createOscillator(), gain = ctx.createGain()
        osc.connect(gain); gain.connect(ctx.destination)
        osc.frequency.value = f
        gain.gain.setValueAtTime(0.12, ctx.currentTime + t)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2)
        osc.start(ctx.currentTime + t); osc.stop(ctx.currentTime + t + 0.2)
      })
    } else {
      const osc = ctx.createOscillator(), gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.frequency.value = 180
      gain.gain.setValueAtTime(0.08, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
      osc.start(); osc.stop(ctx.currentTime + 0.3)
    }
  } catch (e) {}
}

const ENCOURAGEMENTS = ['Bravo !', 'Top !', 'Bien joué !', 'Génial !', 'Parfait !', 'Excellent !', 'Continue !', 'Super !']

export function randomEncouragement(): string {
  return ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)]
}

const SUPPORT = ['Pas grave, on continue !', 'On apprend en se trompant !', 'Tu vas y arriver !', 'Recommence, tu peux le faire !']

export function randomSupport(): string {
  return SUPPORT[Math.floor(Math.random() * SUPPORT.length)]
}
