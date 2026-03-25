import { supabase } from '@/lib/supabase'
import type { PeriskopeReport, SlackReport, MetabaseReport, ClientMapping } from '@/lib/types'

export type MappingsFile = Record<string, ClientMapping>

export async function readReport<T>(source: string, date: string): Promise<T | null> {
  const { data, error } = await supabase
    .from('reports')
    .select('data')
    .eq('source', source)
    .eq('report_date', date)
    .single()

  if (error || !data) return null
  return data.data as T
}

export async function writeReport(source: string, date: string, data: unknown): Promise<void> {
  const { error } = await supabase
    .from('reports')
    .upsert(
      { source, report_date: date, data, updated_at: new Date().toISOString() },
      { onConflict: 'source,report_date' },
    )

  if (error) throw new Error(`Failed to write report: ${error.message}`)
}

export async function listDates(source: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('reports')
    .select('report_date')
    .eq('source', source)
    .order('report_date', { ascending: false })

  if (error || !data) return []
  return data.map((row) => row.report_date)
}

export async function listAllDates(): Promise<Record<string, string[]>> {
  const [periskope, slack, metabase] = await Promise.all([
    listDates('periskope'),
    listDates('slack'),
    listDates('metabase'),
  ])
  return { periskope, slack, metabase }
}

export async function readMappings(): Promise<MappingsFile> {
  const { data, error } = await supabase
    .from('client_mappings')
    .select('*')

  if (error || !data) return {}

  const mappings: MappingsFile = {}
  for (const row of data) {
    mappings[row.client_id] = {
      display_name: row.display_name,
      whatsapp_groups: row.whatsapp_groups ?? [],
      slack_channels: row.slack_channels ?? [],
      metabase_account: row.metabase_account,
    }
  }
  return mappings
}

export async function writeMappings(mappings: MappingsFile): Promise<void> {
  const rows = Object.entries(mappings).map(([client_id, mapping]) => ({
    client_id,
    display_name: mapping.display_name,
    whatsapp_groups: mapping.whatsapp_groups,
    slack_channels: mapping.slack_channels,
    metabase_account: mapping.metabase_account,
    updated_at: new Date().toISOString(),
  }))

  const { error } = await supabase
    .from('client_mappings')
    .upsert(rows, { onConflict: 'client_id' })

  if (error) throw new Error(`Failed to write mappings: ${error.message}`)
}

export async function getLatestDate(source: string): Promise<string | null> {
  const dates = await listDates(source)
  return dates[0] || null
}

export function getPeriskopeReport(date: string) {
  return readReport<PeriskopeReport>('periskope', date)
}

export function getSlackReport(date: string) {
  return readReport<SlackReport>('slack', date)
}

export function getMetabaseReport(date: string) {
  return readReport<MetabaseReport>('metabase', date)
}
