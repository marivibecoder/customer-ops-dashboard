import { NextRequest, NextResponse } from 'next/server'
import { runRefresh, type SourceType } from '@/lib/services/refresh'

const VALID_SOURCES: SourceType[] = ['periskope', 'slack', 'metabase']

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

    // Parse optional sources filter
    let onlySources: SourceType[] | undefined
    if (body.sources) {
      const requested = Array.isArray(body.sources) ? body.sources : [body.sources]
      onlySources = requested.filter((s: string) => VALID_SOURCES.includes(s as SourceType)) as SourceType[]
      if (onlySources.length === 0) {
        return NextResponse.json({ error: 'Invalid sources. Valid: periskope, slack, metabase' }, { status: 400 })
      }
    }

    // Fire-and-forget: respond immediately, run refresh in background
    runRefresh(trigger, onlySources).catch((err) => {
      console.error('[REFRESH] Background refresh failed:', err)
    })

    return NextResponse.json({
      status: 'started',
      sources: onlySources || VALID_SOURCES,
      message: 'Refresh started in background. Poll /api/refresh/status for updates.',
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
