import { NextRequest, NextResponse } from 'next/server'
import { runRefresh } from '@/lib/services/refresh'

export const maxDuration = 300 // 5 minutes max

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const trigger = body.trigger === 'cron' ? 'cron' : 'manual'

    // If triggered by cron, require CRON_SECRET
    if (trigger === 'cron') {
      const auth = request.headers.get('authorization')
      if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const result = await runRefresh(trigger)
    return NextResponse.json(result)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
