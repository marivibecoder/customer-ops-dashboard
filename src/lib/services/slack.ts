import { WebClient } from '@slack/web-api'

export class SlackService {
  private client: WebClient

  constructor(token: string) {
    this.client = new WebClient(token, {
      retryConfig: { retries: 1, minTimeout: 1000 },
    })
  }

  // Find all customer/client channels where the bot IS a member
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

        // Only include channels where bot is already a member
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

    console.log(`[Slack] Found ${channels.length} client channels (bot is member)`)
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

  // Main method: fetch all client channel data
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
            return {
              channelId: ch.id,
              channelName: ch.name,
              topic: ch.topic,
              messages,
            }
          }
          return null
        })
      )
      results.push(...batchResults.filter(Boolean))
    }

    console.log(`[Slack] ${results.length} channels with activity in last 24h`)
    return results as Array<{
      channelId: string
      channelName: string
      topic: string
      messages: any[]
    }>
  }
}
