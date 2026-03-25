export class PeriskopeService {
  private baseUrl: string
  private token: string

  constructor(token: string, baseUrl = 'https://api.periskope.app/v1') {
    this.token = token
    this.baseUrl = baseUrl
  }

  private async fetch(path: string, phone?: string) {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json',
    }
    if (phone) headers['x-phone'] = phone
    const res = await fetch(`${this.baseUrl}${path}`, { headers })
    if (!res.ok) throw new Error(`Periskope API error: ${res.status}`)
    return res.json()
  }

  // Get all connected phones with Operations or Support labels
  async getPhones(): Promise<
    Array<{ phone: string; name: string; labels: string[] }>
  > {
    const data = await this.fetch('/phones/all')
    const raw = Array.isArray(data) ? data : data.data || []
    return raw
      .filter((p: any) =>
        p.wa_state === 'CONNECTED' &&
        Array.isArray(p.labels) &&
        p.labels.some((l: string) => ['Operations', 'Support'].includes(l))
      )
      .map((p: any) => ({
        phone: (p.org_phone || p.phone || '').replace('@c.us', ''),
        name: p.phone_name || p.name || p.org_phone || '',
        labels: p.labels || [],
      }))
  }

  // Get chats for a phone
  async getChats(phone: string): Promise<any[]> {
    const data = await this.fetch('/chats?limit=100', phone)
    // API returns {chats: [...]} not {data: [...]}
    return data.chats || data.data || (Array.isArray(data) ? data : [])
  }

  // Get messages for a chat
  async getChatMessages(
    phone: string,
    chatId: string,
    limit = 50,
  ): Promise<any[]> {
    const data = await this.fetch(
      `/chats/${chatId}/messages?limit=${limit}`,
      phone,
    )
    // API returns {messages: [...]} or {data: [...]}
    return data.messages || data.data || (Array.isArray(data) ? data : [])
  }

  // Main method: fetch all data for daily report
  async fetchDailyData(): Promise<
    {
      phone: string
      phoneName: string
      groups: Array<{
        chatId: string
        chatName: string
        assignedTo: string | null
        messages: any[]
      }>
    }[]
  > {
    const phones = await this.getPhones()
    console.log(`[Periskope] Found ${phones.length} ops/support phones`)

    const now = Date.now()
    const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000

    // Process phones in parallel batches of 5
    const results: {
      phone: string
      phoneName: string
      groups: Array<{
        chatId: string
        chatName: string
        assignedTo: string | null
        messages: any[]
      }>
    }[] = []

    for (let i = 0; i < phones.length; i += 5) {
      const batch = phones.slice(i, i + 5)
      const batchResults = await Promise.all(
        batch.map(async (phone) => {
          try {
            console.log(`[Periskope] Fetching chats for ${phone.name}`)
            const chats = await this.getChats(phone.phone)
            const activeGroups = chats.filter((c: any) => {
              const isGroup = c.chat_id?.endsWith('@g.us')
              const lastMsg = c.updated_at ? new Date(c.updated_at).getTime() : 0
              return isGroup && lastMsg > twentyFourHoursAgo
            })

            const groups = []
            for (const group of activeGroups) {
              const messages = await this.getChatMessages(phone.phone, group.chat_id, 50)
              const recentMessages = messages.filter((m: any) => {
                const ts = new Date(m.timestamp || m.created_at).getTime()
                return ts > twentyFourHoursAgo
              })
              if (recentMessages.length > 0) {
                groups.push({
                  chatId: group.chat_id,
                  chatName: group.chat_name || group.name || group.chat_id,
                  assignedTo: group.assigned_to || null,
                  messages: recentMessages,
                })
              }
            }

            console.log(`[Periskope] ${phone.name}: ${activeGroups.length} active groups, ${groups.length} with messages`)
            if (groups.length > 0) {
              return { phone: phone.phone, phoneName: phone.name, groups }
            }
            return null
          } catch (e: any) {
            console.error(`[Periskope] Error for ${phone.name}: ${e.message}`)
            return null
          }
        })
      )
      results.push(...batchResults.filter(Boolean) as typeof results)
    }

    console.log(`[Periskope] Total: ${results.length} phones with active groups`)
    return results
  }
}
