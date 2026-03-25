import { NextRequest, NextResponse } from 'next/server'
import { runRefresh } from '@/lib/services/refresh'

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

    // Fire-and-forget: respond immediately, run refresh in background
    // This avoids Railway's request timeout
    runRefresh(trigger).catch((err) => {
      console.error('[REFRESH] Background refresh failed:', err)
    })

    return NextResponse.json({
      status: 'started',
      message: 'Refresh started in background. Poll /api/refresh/status for updates.',
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
