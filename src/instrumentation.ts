export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const cron = await import('node-cron')

    // 7:00 AM Argentina (UTC-3) = 10:00 UTC
    cron.default.schedule('0 10 * * *', async () => {
      console.log('[CRON] Starting daily refresh at', new Date().toISOString())

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      try {
        const res = await fetch(`${appUrl}/api/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.CRON_SECRET}`,
          },
          body: JSON.stringify({ trigger: 'cron' }),
        })
        const data = await res.json()
        console.log('[CRON] Refresh completed:', data.status, '| Sources:', data.sources_completed?.join(', '))
      } catch (e) {
        console.error('[CRON] Refresh failed:', e)
      }
    })

    console.log('[CRON] Daily refresh scheduled for 10:00 UTC (7:00 AM Argentina)')
  }
}
