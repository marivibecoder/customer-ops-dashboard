export class PeriskopeService {
  private baseUrl: string
  private token: string

  constructor(token: string, baseUrl = 'https://api.periskope.app/v1') {
    this.token = token
    this.baseUrl = baseUrl
  }

  private async apiFetch(path: string, phone?: string) {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json',
    }
    if (phone) headers['x-phone'] = phone
    const res = await fetch(`${this.baseUrl}${path}`, { headers })
    if (!res.ok) throw new Error(`Periskope API error: ${res.status}`)
    return res.json()
  }

  // Get all connected ops/support phones + build Darwin phone set
  async getPhones(): Promise<{
    opsPhones: Array<{ phone: string; name: string }>
    darwinPhones: Set<string>
    phoneToName: Record<string, string>
  }> {
    const raw = await this.apiFetch('/phones/all')
    const allPhones = Array.isArray(raw) ? raw : raw.data || []

    // Build set of ALL Darwin phone numbers for sender identification
    const darwinPhones = new Set<string>()
    const phoneToName: Record<string, string> = {}
    for (const p of allPhones) {
      const phone = (p.org_phone || '').replace('@c.us', '')
      darwinPhones.add(phone)
      phoneToName[phone] = p.phone_name || phone
    }

    const opsPhones = allPhones
      .filter((p: any) =>
        p.wa_state === 'CONNECTED' &&
        Array.isArray(p.labels) &&
        p.labels.some((l: string) => ['Operations', 'Support'].includes(l))
      )
      .map((p: any) => ({
        phone: (p.org_phone || '').replace('@c.us', ''),
        name: p.phone_name || p.org_phone || '',
      }))

    return { opsPhones, darwinPhones, phoneToName }
  }

  // Main method: fetch all data with deduplication (same logic as MCP)
  async fetchDailyData(): Promise<{
    phone: string
    phoneName: string
    groups: Array<{
      chatId: string
      chatName: string
      assignedTo: string | null
      messages: any[]
    }>
  }[]> {
    const { opsPhones, darwinPhones, phoneToName } = await this.getPhones()
    console.log(`[Periskope] Found ${opsPhones.length} ops/support phones`)

    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    // Phase 1: Collect all groups, DEDUPLICATING across phones
    // Key: chat_id -> group data (only fetch messages ONCE per group)
    const groupMap = new Map<string, {
      chatId: string
      chatName: string
      assignedTo: string | null
      messages: any[]
      phonesWithAccess: Array<{ phone: string; name: string }>
    }>()

    for (const opsPhone of opsPhones) {
      try {
        console.log(`[Periskope] Fetching chats for ${opsPhone.name}`)
        const data = await this.apiFetch('/chats?limit=200', opsPhone.phone)
        const chats = data.chats || data.data || (Array.isArray(data) ? data : [])
        const groups = chats.filter((c: any) => c.chat_type === 'group' || c.chat_id?.endsWith('@g.us'))

        for (const g of groups) {
          if (!groupMap.has(g.chat_id)) {
            // First time seeing this group — fetch messages
            let recentMessages: any[] = []
            try {
              const msgData = await this.apiFetch(`/chats/${g.chat_id}/messages?limit=100`, opsPhone.phone)
              const allMsgs = msgData.messages || msgData.data || (Array.isArray(msgData) ? msgData : [])
              recentMessages = allMsgs
                .filter((m: any) => (m.timestamp || m.created_at) >= cutoff)
                .map((m: any) => {
                  const senderPhone = (m.sender_phone || '').replace('@c.us', '')
                  const isDarwin = darwinPhones.has(senderPhone)
                  return {
                    sender_phone: senderPhone,
                    sender_name: isDarwin ? (phoneToName[senderPhone] || senderPhone) : senderPhone,
                    is_darwin: isDarwin,
                    from_me: m.from_me || false,
                    role: isDarwin ? 'DARWIN' : 'CLIENT',
                    body: m.body || '',
                    timestamp: m.timestamp || m.created_at,
                    type: m.message_type,
                  }
                })
            } catch {
              // skip on error
            }

            groupMap.set(g.chat_id, {
              chatId: g.chat_id,
              chatName: g.chat_name || g.chat_id,
              assignedTo: g.assigned_to || null,
              messages: recentMessages,
              phonesWithAccess: [{ phone: opsPhone.phone, name: opsPhone.name }],
            })
          } else {
            // Already seen — just add this phone as having access
            const existing = groupMap.get(g.chat_id)!
            existing.phonesWithAccess.push({ phone: opsPhone.phone, name: opsPhone.name })
            if (g.assigned_to && !existing.assignedTo) {
              existing.assignedTo = g.assigned_to
            }
          }
        }
      } catch (e: any) {
        console.error(`[Periskope] Error for ${opsPhone.name}: ${e.message}`)
      }
    }

    // Phase 2: Organize by ops executive (same as MCP)
    // Normalize name to deduplicate across phones
    const normalizeName = (name: string) => name.trim().toLowerCase()
    const canonicalNames = new Map<string, string>() // normalized -> first seen form

    const opsResults = new Map<string, {
      phone: string
      phoneName: string
      groups: Array<{
        chatId: string
        chatName: string
        assignedTo: string | null
        messages: any[]
      }>
    }>()

    // Initialize all ops, deduplicating by normalized name
    for (const p of opsPhones) {
      const norm = normalizeName(p.name)
      if (!canonicalNames.has(norm)) {
        canonicalNames.set(norm, p.name)
        opsResults.set(p.name, { phone: p.phone, phoneName: p.name, groups: [] })
      }
    }

    // Helper to find canonical ops name
    const findOpsKey = (name: string): string | null => {
      const norm = normalizeName(name)
      return canonicalNames.get(norm) || null
    }

    for (const [, group] of groupMap) {
      if (group.messages.length === 0) continue

      if (group.assignedTo) {
        // Match assigned_to email to ops name
        const emailPrefix = group.assignedTo.split('@')[0].toLowerCase()
        let matchedOps: string | null = null
        for (const [opsName] of opsResults) {
          const nameLower = opsName.toLowerCase()
          if (nameLower.includes(emailPrefix) || emailPrefix.includes(nameLower.split(' ')[0].toLowerCase())) {
            matchedOps = opsName
            break
          }
        }

        if (matchedOps) {
          opsResults.get(matchedOps)!.groups.push({
            chatId: group.chatId,
            chatName: group.chatName,
            assignedTo: group.assignedTo,
            messages: group.messages,
          })
        }
      } else {
        // No assigned_to — add to all ops that have access (shared)
        const addedToOps = new Set<string>()
        for (const accessPhone of group.phonesWithAccess) {
          const canonicalKey = findOpsKey(accessPhone.name)
          if (!canonicalKey || addedToOps.has(canonicalKey)) continue
          addedToOps.add(canonicalKey)
          const ops = opsResults.get(canonicalKey)
          if (ops) {
            ops.groups.push({
              chatId: group.chatId,
              chatName: group.chatName,
              assignedTo: null,
              messages: group.messages,
            })
          }
        }
      }
    }

    const results = Array.from(opsResults.values()).filter(r => r.groups.length > 0)
    const totalGroups = new Set(Array.from(groupMap.keys())).size
    const activeGroups = Array.from(groupMap.values()).filter(g => g.messages.length > 0).length
    console.log(`[Periskope] Done: ${totalGroups} unique groups, ${activeGroups} with messages, ${results.length} ops with activity`)

    return results
  }
}
