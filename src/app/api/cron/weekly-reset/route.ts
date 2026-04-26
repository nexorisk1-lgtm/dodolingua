import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Endpoint à appeler chaque lundi 00:00 par un cron externe
 * (ex. Vercel Cron, GitHub Actions, ou cron-job.org gratuit).
 *
 * Sécurité : header x-cron-secret obligatoire.
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const supabase = createClient()
  const { error } = await supabase.rpc('weekly_league_reset')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, ts: new Date().toISOString() })
}

export async function GET() {
  return NextResponse.json({ usage: 'POST with x-cron-secret header' })
}
