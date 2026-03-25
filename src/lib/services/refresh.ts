import { supabase } from '@/lib/supabase'
import { writeReport } from '@/lib/data'
import { PeriskopeService } from '@/lib/services/periskope'
import { SlackService } from '@/lib/services/slack'
import { MetabaseService } from '@/lib/services/metabase'
import { AnalyzerService } from '@/lib/services/analyzer'
import type { PeriskopeReport } from '@/lib/types'

interface RefreshResult {
  status: 'success' | 'partial' | 'error'
  date: string
  sources_completed: string[]
  errors: string[]
  duration_ms: number
}

// Wrap a promise with a timeout
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)
    ),
  ])
}

export async function runRefresh(trigger: 'cron' | 'manual' = 'manual'): Promise<RefreshResult> {
  const startTime = Date.now()
  const today = new Date().toISOString().split('T')[0]
  const sourcesCompleted: string[] = []
  const errors: string[] = []

  // Log the refresh start
  const { data: logRow } = await supabase
    .from('refresh_logs')
    .insert({ trigger, status: 'running' })
    .select('id')
    .single()
  const logId = logRow?.id

  // Initialize services
  const periskope = new PeriskopeService(process.env.PERISKOPE_BEARER_TOKEN!)
  const slack = new SlackService(process.env.SLACK_BOT_TOKEN!)
  const metabase = new MetabaseService(
    process.env.METABASE_URL!,
    process.env.METABASE_API_KEY!,
    Number(process.env.METABASE_DATABASE_ID || 100)
  )
  const analyzer = new AnalyzerService(process.env.ANTHROPIC_API_KEY!)

  const TIMEOUT_MS = 120_000 // 2 minutes per source

  // Run all three in parallel with timeouts
  const results = await Promise.allSettled([
    // 1. Periskope + Claude analysis
    (async () => {
      const rawData = await periskope.fetchDailyData()

      // Group data by ops executive (using assigned_to or phone owner)
      const opsMap = new Map<string, {
        name: string
        email: string
        phone: string
        groups: Array<{ chatId: string; chatName: string; assignedTo: string | null; messages: any[] }>
      }>()

      for (const phoneData of rawData) {
        for (const group of phoneData.groups) {
          // Determine which ops this group belongs to
          const opsKey = group.assignedTo || phoneData.phoneName
          if (!opsMap.has(opsKey)) {
            opsMap.set(opsKey, {
              name: phoneData.phoneName,
              email: group.assignedTo || '',
              phone: phoneData.phone,
              groups: [],
            })
          }
          opsMap.get(opsKey)!.groups.push(group)
        }
      }

      // Analyze each ops executive's groups with Claude
      const opsExecutives = []
      for (const [, ops] of opsMap) {
        const analysis = await analyzer.analyzeWhatsAppForOps(
          ops.name, ops.email, ops.phone, ops.groups
        )
        opsExecutives.push({
          name: ops.name,
          email: ops.email,
          phone: ops.phone,
          groups_monitored: analysis.groups_monitored,
          groups_active: analysis.groups_active,
          alerts: analysis.alerts,
        })
      }

      const totalAlerts = opsExecutives.reduce((sum, op) => sum + op.alerts.length, 0)
      const altaAlerts = opsExecutives.reduce((sum, op) => sum + op.alerts.filter(a => a.priority === 'alta').length, 0)
      const mediaAlerts = opsExecutives.reduce((sum, op) => sum + op.alerts.filter(a => a.priority === 'media').length, 0)
      const bajaAlerts = opsExecutives.reduce((sum, op) => sum + op.alerts.filter(a => a.priority === 'baja').length, 0)
      const totalMessages = rawData.reduce((sum, p) => sum + p.groups.reduce((s, g) => s + g.messages.length, 0), 0)

      const report: PeriskopeReport = {
        date: today,
        generated_at: new Date().toISOString(),
        summary: {
          ops_monitored: opsMap.size,
          total_groups: rawData.reduce((sum, p) => sum + p.groups.length, 0),
          active_groups: rawData.reduce((sum, p) => sum + p.groups.filter(g => g.messages.length > 0).length, 0),
          total_messages: totalMessages,
          alerts_alta: altaAlerts,
          alerts_media: mediaAlerts,
          alerts_baja: bajaAlerts,
          total_alerts: totalAlerts,
        },
        ops_executives: opsExecutives,
        observations: [],
      }

      await writeReport('periskope', today, report)
      return 'periskope'
    })(),

    // 2. Slack + Claude analysis
    (async () => {
      const rawData = await slack.fetchDailyData()
      const channelsForAnalysis = rawData.map(ch => ({
        channelName: ch.channelName,
        topic: ch.topic,
        messages: ch.messages,
      }))

      const report = await analyzer.analyzeSlackChannels(channelsForAnalysis)
      await writeReport('slack', today, report)
      return 'slack'
    })(),

    // 3. Metabase (no Claude needed - pure data processing)
    (async () => {
      const rawData = await metabase.fetchAccountMetrics()
      const report = metabase.buildReport(rawData)
      await writeReport('metabase', today, report)
      return 'metabase'
    })(),
  ])

  // Process results
  for (const result of results) {
    if (result.status === 'fulfilled') {
      sourcesCompleted.push(result.value)
    } else {
      errors.push(result.reason?.message || 'Unknown error')
    }
  }

  const duration = Date.now() - startTime
  const status = errors.length === 0 ? 'success' : sourcesCompleted.length > 0 ? 'partial' : 'error'

  // Update log
  if (logId) {
    await supabase
      .from('refresh_logs')
      .update({
        completed_at: new Date().toISOString(),
        status,
        sources_completed: sourcesCompleted,
        error_message: errors.length > 0 ? errors.join('; ') : null,
        duration_ms: duration,
      })
      .eq('id', logId)
  }

  return { status, date: today, sources_completed: sourcesCompleted, errors, duration_ms: duration }
}
