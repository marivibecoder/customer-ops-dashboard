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

  // Get all connected phones
  async getPhones(): Promise<
    Array<{ phone: string; name: string }>
  > {
    const data = await this.fetch('/phones/all')
    // API returns array directly, phone is in org_phone with @c.us suffix
    const raw = Array.isArray(data) ? data : data.data || []
    return raw
      .filter((p: any) => p.wa_state === 'CONNECTED')
      .map((p: any) => ({
        phone: (p.org_phone || p.phone || '').replace('@c.us', ''),
        name: p.phone_name || p.name || p.org_phone || '',
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
    console.log(`[Periskope] Found ${phones.length} connected phones`)
    const opsPhones = phones // No label filter — include all connected phones

    const results = []
    const now = Date.now()
    const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000

    for (const phone of opsPhones) {
      console.log(`[Periskope] Fetching chats for ${phone.name} (${phone.phone})`)
      const chats = await this.getChats(phone.phone)
      console.log(`[Periskope] ${phone.name}: ${chats.length} chats`)
      // Filter to group chats with recent activity
      const activeGroups = chats.filter((c: any) => {
        const isGroup = c.chat_id?.endsWith('@g.us')
        // Use updated_at (not last_message_at)
        const lastMsg = c.updated_at
          ? new Date(c.updated_at).getTime()
          : 0
        return isGroup && lastMsg > twentyFourHoursAgo
      })
      console.log(`[Periskope] ${phone.name}: ${activeGroups.length} active groups (last 24h)`)

      const groups = []
      for (const group of activeGroups) {
        const messages = await this.getChatMessages(
          phone.phone,
          group.chat_id,
          50,
        )
        // Filter messages to last 24h
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

      if (groups.length > 0) {
        results.push({
          phone: phone.phone,
          phoneName: phone.name,
          groups,
        })
      }
    }
    return results
  }
}
