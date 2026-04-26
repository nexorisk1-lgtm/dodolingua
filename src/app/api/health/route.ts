import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    version: '1.0.0',
    lot: 'Lot 1 - Foundation',
    timestamp: new Date().toISOString(),
  })
}
