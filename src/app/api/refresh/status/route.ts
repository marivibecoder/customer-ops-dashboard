import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('refresh_logs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !data) {
      return NextResponse.json({ status: 'none', last_refresh: null })
    }

    return NextResponse.json({
      status: data.status,
      trigger: data.trigger,
      started_at: data.started_at,
      completed_at: data.completed_at,
      sources_completed: data.sources_completed,
      error_message: data.error_message,
      duration_ms: data.duration_ms,
    })
  } catch {
    return NextResponse.json({ status: 'error' }, { status: 500 })
  }
}
