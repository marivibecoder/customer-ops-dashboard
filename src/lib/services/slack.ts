import { WebClient } from '@slack/web-api'

export class SlackService {
  private client: WebClient
  private userCache: Map<string, string> = new Map() // user_id -> display_name

  constructor(token: string) {
    this.client = new WebClient(token, {
      retryConfig: { retries: 1, minTimeout: 1000 },
    })
  }

  // Resolve a user ID to a display name
  private async resolveUser(userId: string): Promise<string> {
    if (this.userCache.has(userId)) return this.userCache.get(userId)!

    try {
      const result = await this.client.users.info({ user: userId })
      const name = result.user?.profile?.real_name
        || result.user?.profile?.display_name
        || result.user?.name
        || userId
      this.userCache.set(userId, name)
      return name
    } catch {
      this.userCache.set(userId, userId)
      return userId
    }
  }

  // Bulk resolve user IDs from messages
  private async resolveUsers(messages: any[]): Promise<void> {
    const userIds = new Set<string>()
    for (const m of messages) {
      if (m.user && !this.userCache.has(m.user)) {
        userIds.add(m.user)
      }
    }

    // Resolve in parallel batches of 5
    const ids = Array.from(userIds)
    for (let i = 0; i < ids.length; i += 5) {
      const batch = ids.slice(i, i + 5)
      await Promise.all(batch.map((id) => this.resolveUser(id)))
    }
  }

  // Find all customer/client channels where the user IS a member
  async getClientChannels(): Promise<
    Array<{ id: string; name: string; topic: string }>
  > {
    const channels: Array<{ id: string; name: string; topic: string }> = []
    let cursor: string | undefined

    do {
      const result = await this.client.conversations.list({
        types: 'public_channel,private_channel',
        limit: 200,
        cursor,
        exclude_archived: true,
      })

      for (const ch of result.channels || []) {
        const name = ch.name || ''
        const isClientChannel =
          name.startsWith('client-') ||
          name.startsWith('cliente-') ||
          name.startsWith('customer-')

        if (isClientChannel && ch.is_member) {
          channels.push({
            id: ch.id!,
            name: `#${name}`,
            topic: ch.topic?.value || '',
          })
        }
      }
      cursor = result.response_metadata?.next_cursor
    } while (cursor)

    console.log(`[Slack] Found ${channels.length} client channels (user is member)`)
    return channels
  }

  // Get messages from a channel in the last N hours
  async getChannelMessages(channelId: string, hoursBack = 24): Promise<any[]> {
    const oldest = String(
      Math.floor((Date.now() - hoursBack * 60 * 60 * 1000) / 1000),
    )

    try {
      const result = await this.client.conversations.history({
        channel: channelId,
        oldest,
        limit: 100,
      })
      return result.messages || []
    } catch (e: any) {
      console.error(`[Slack] Error reading ${channelId}: ${e.data?.error || e.message}`)
      return []
    }
  }

  // Main method: fetch all client channel data with resolved user names
  async fetchDailyData(): Promise<
    Array<{
      channelId: string
      channelName: string
      topic: string
      messages: any[]
    }>
  > {
    const channels = await this.getClientChannels()
    const results = []

    // Process channels in parallel batches of 3
    for (let i = 0; i < channels.length; i += 3) {
      const batch = channels.slice(i, i + 3)
      const batchResults = await Promise.all(
        batch.map(async (ch) => {
          const messages = await this.getChannelMessages(ch.id)
          if (messages.length > 0) {
            // Resolve user names for all messages
            await this.resolveUsers(messages)

            // Enrich messages with resolved names
            const enriched = messages.map((m: any) => ({
              ...m,
              user_name: m.user ? (this.userCache.get(m.user) || m.user) : 'Unknown',
            }))

            return {
              channelId: ch.id,
              channelName: ch.name,
              topic: ch.topic,
              messages: enriched,
            }
          }
          return null
        })
      )
      results.push(...batchResults.filter(Boolean))
    }

    console.log(`[Slack] ${results.length} channels with activity, ${this.userCache.size} users resolved`)
    return results as Array<{
      channelId: string
      channelName: string
      topic: string
      messages: any[]
    }>
  }
}
