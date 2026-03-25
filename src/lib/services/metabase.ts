import type { MetabaseReport } from '@/lib/types'

export class MetabaseService {
  private baseUrl: string
  private apiKey: string
  private databaseId: number

  constructor(baseUrl: string, apiKey: string, databaseId = 100) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
    this.apiKey = apiKey
    this.databaseId = databaseId
  }

  private async query(sql: string): Promise<any[]> {
    const res = await fetch(`${this.baseUrl}/api/dataset`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
      },
      body: JSON.stringify({
        database: this.databaseId,
        type: 'native',
        native: { query: sql },
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Metabase error ${res.status}: ${text}`)
    }

    const data = await res.json()
    // Metabase returns { data: { rows: [...], cols: [...] } }
    const cols = data.data?.cols?.map((c: any) => c.name) || []
    const rows = data.data?.rows || []

    return rows.map((row: any[]) => {
      const obj: Record<string, any> = {}
      cols.forEach((col: string, i: number) => {
        obj[col] = row[i]
      })
      return obj
    })
  }

  // Fetch account metrics for the report
  async fetchAccountMetrics(): Promise<{
    accounts: Array<{
      name: string
      owner: string
      owner_full_name: string
      owner_slack_id: string
      phase: string
      mrr: number
      health_score: number
      conversations_included: number
      months: Record<string, number>
    }>
  }> {
    const sql = `
      WITH monthly_conv AS (
        SELECT
          c.NAME as account_name,
          c.OWNER_EMAIL,
          c.OWNER_FULL_NAME,
          c.CONVERSATIONS_INCLUDED,
          c.AMOUNT,
          c.HEALTH_SCORE,
          c.PHASE,
          c.OWNER_SLACK_ID,
          DATE_TRUNC('month', m.PERIOD_DATE)::DATE as month,
          SUM(m.ACTIVE_CONVERSATIONS) as total_conv
        FROM PRODUCT.FCT_ACCOUNT_DAILY_MESSAGES m
        JOIN COMMON.DIM_CUSTOMERS c ON m.ACCOUNT_ID = c.ACCOUNT_ID
        WHERE m.PERIOD_DATE >= DATEADD('month', -4, CURRENT_DATE())
          AND c.IS_ENABLED = true
          AND c.PHASE NOT IN ('Production Churn', 'Sales Churn', 'Production Churn Negotiation', 'Sales Churn Negotiation')
        GROUP BY 1,2,3,4,5,6,7,8,9
      )
      SELECT * FROM monthly_conv ORDER BY account_name, month
    `

    const rows = await this.query(sql)

    // Group by account
    const accountMap = new Map<
      string,
      {
        name: string
        owner: string
        owner_full_name: string
        owner_slack_id: string
        phase: string
        mrr: number
        health_score: number
        conversations_included: number
        months: Record<string, number>
      }
    >()
    const monthNames = [
      'jan',
      'feb',
      'mar',
      'apr',
      'may',
      'jun',
      'jul',
      'aug',
      'sep',
      'oct',
      'nov',
      'dec',
    ]

    for (const row of rows) {
      const name = row.ACCOUNT_NAME || row.account_name
      if (!name) continue

      if (!accountMap.has(name)) {
        accountMap.set(name, {
          name,
          owner: row.OWNER_EMAIL || row.owner_email || '',
          owner_full_name: row.OWNER_FULL_NAME || row.owner_full_name || '',
          owner_slack_id: row.OWNER_SLACK_ID || row.owner_slack_id || '',
          phase: row.PHASE || row.phase || '',
          mrr: Number(row.AMOUNT || row.amount || 0),
          health_score: Number(row.HEALTH_SCORE || row.health_score || 0),
          conversations_included: Number(
            row.CONVERSATIONS_INCLUDED || row.conversations_included || 0,
          ),
          months: {} as Record<string, number>,
        })
      }

      const acc = accountMap.get(name)!
      const monthStr = row.MONTH || row.month || ''
      if (monthStr) {
        const d = new Date(monthStr)
        const key = monthNames[d.getMonth()]
        acc.months[key] = Number(row.TOTAL_CONV || row.total_conv || 0)
      }
    }

    return { accounts: Array.from(accountMap.values()) }
  }

  // Build the full MetabaseReport with RED/GREEN flags
  buildReport(
    rawData: Awaited<ReturnType<typeof this.fetchAccountMetrics>>,
  ): MetabaseReport {
    const today = new Date()
    const dayOfMonth = today.getDate()
    const daysInMonth = new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      0,
    ).getDate()
    const projectionFactor = daysInMonth / dayOfMonth

    const monthKeys = [
      'jan',
      'feb',
      'mar',
      'apr',
      'may',
      'jun',
      'jul',
      'aug',
      'sep',
      'oct',
      'nov',
      'dec',
    ]
    const currentMonthKey = monthKeys[today.getMonth()]
    const prevMonthKey = monthKeys[(today.getMonth() - 1 + 12) % 12]
    const prevPrevMonthKey = monthKeys[(today.getMonth() - 2 + 12) % 12]

    const flaggedAccounts: any[] = []

    for (const acc of rawData.accounts) {
      const currActual = acc.months[currentMonthKey] || 0
      const prev = acc.months[prevMonthKey] || 0
      const prevPrev = acc.months[prevPrevMonthKey] || 0
      const projected = Math.round(currActual * projectionFactor)

      if (prev === 0) continue
      const mom = ((projected - prev) / prev) * 100

      let flag: 'RED' | 'GREEN' | null = null

      // RED flags
      if (mom < -30 && prev > 20) flag = 'RED'
      else if (prev > 100 && currActual === 0) flag = 'RED'
      else if (
        prevPrev > 0 &&
        prev > 0 &&
        projected < prev &&
        prev < prevPrev
      ) {
        const total = ((projected - prevPrev) / prevPrev) * 100
        if (total < -25) flag = 'RED'
      }

      // GREEN flags
      if (!flag) {
        if (mom > 30 && prev > 50) flag = 'GREEN'
        else if (prevPrev > 0 && prev > prevPrev && projected > prev) {
          const total = ((projected - prevPrev) / prevPrev) * 100
          if (total > 30 && projected > 50) flag = 'GREEN'
        }
      }

      if (flag) {
        flaggedAccounts.push({
          name: acc.name,
          owner: acc.owner,
          owner_slack_id: acc.owner_slack_id || '',
          phase: acc.phase,
          mrr: acc.mrr,
          health_score: acc.health_score,
          conversations_included: acc.conversations_included,
          flag,
          months: acc.months,
          current_month_actual: currActual,
          current_month_projected: projected,
          mom_change_percent: Math.round(mom * 10) / 10,
        })
      }
    }

    const reds = flaggedAccounts.filter((a: any) => a.flag === 'RED').length
    const greens = flaggedAccounts.filter((a: any) => a.flag === 'GREEN').length

    return {
      date: today.toISOString().split('T')[0],
      generated_at: new Date().toISOString(),
      data_range: `Last 4 months - ${today.toISOString().split('T')[0]}`,
      projection_note: `${dayOfMonth}/${daysInMonth} days`,
      summary: {
        total_accounts: rawData.accounts.length,
        flagged_accounts: flaggedAccounts.length,
        red_flags: reds,
        green_flags: greens,
      },
      accounts: flaggedAccounts.sort((a: any, b: any) => {
        if (a.flag === 'RED' && b.flag !== 'RED') return -1
        if (a.flag !== 'RED' && b.flag === 'RED') return 1
        return a.mom_change_percent - b.mom_change_percent
      }),
    }
  }
}
