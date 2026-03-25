import { WebClient } from '@slack/web-api'

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export class SlackService {
  private client: WebClient

  constructor(token: string) {
    this.client = new WebClient(token, {
      retryConfig: { retries: 3, minTimeout: 2000 },
    })
  }

  // Find all customer/client channels (public only to avoid permission issues)
  async getClientChannels(): Promise<
    Array<{ id: string; name: string; topic: string; isMember: boolean }>
  > {
    const channels: Array<{ id: string; name: string; topic: string; isMember: boolean }> = []
    let cursor: string | undefined

    do {
      const result = await this.client.conversations.list({
        types: 'public_channel',
        limit: 200,
        cursor,
        exclude_archived: true,
      })

      for (const ch of result.channels || []) {
        const name = ch.name || ''
        if (
          name.startsWith('client-') ||
          name.startsWith('cliente-') ||
          name.startsWith('customer-')
        ) {
          channels.push({
            id: ch.id!,
            name: `#${name}`,
            topic: ch.topic?.value || '',
            isMember: ch.is_member || false,
          })
        }
      }
      cursor = result.response_metadata?.next_cursor
    } while (cursor)

    return channels
  }

  // Join a channel if not already a member
  private async ensureJoined(channelId: string): Promise<boolean> {
    try {
      await this.client.conversations.join({ channel: channelId })
      return true
    } catch (e: any) {
      // Can't join private channels we're not invited to
      if (e.data?.error === 'method_not_supported_for_channel_type' ||
          e.data?.error === 'channel_not_found' ||
          e.data?.error === 'is_archived') {
        return false
      }
      console.error(`Cannot join ${channelId}: ${e.message}`)
      return false
    }
  }

  // Get messages from a channel in the last N hours
  async getChannelMessages(
    channelId: string,
    hoursBack = 24,
  ): Promise<any[]> {
    const oldest = String(
      Math.floor((Date.now() - hoursBack * 60 * 60 * 1000) / 1000),
    )
    const messages: any[] = []

    try {
      const result = await this.client.conversations.history({
        channel: channelId,
        oldest,
        limit: 100,
      })
      messages.push(...(result.messages || []))
    } catch (e: any) {
      if (e.data?.error === 'not_in_channel') {
        // Try joining first
        const joined = await this.ensureJoined(channelId)
        if (joined) {
          try {
            const result = await this.client.conversations.history({
              channel: channelId,
              oldest,
              limit: 100,
            })
            messages.push(...(result.messages || []))
          } catch {
            return []
          }
        }
      } else {
        console.error(`Error reading ${channelId}: ${e.data?.error || e.message}`)
      }
      return messages
    }

    return messages
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

    // Process in batches of 5 with delay to avoid rate limits
    for (let i = 0; i < channels.length; i++) {
      const ch = channels[i]

      // Join channel if not a member
      if (!ch.isMember) {
        await this.ensureJoined(ch.id)
        await delay(500)
      }

      const messages = await this.getChannelMessages(ch.id)
      if (messages.length > 0) {
        results.push({
          channelId: ch.id,
          channelName: ch.name,
          topic: ch.topic,
          messages,
        })
      }

      // Rate limit: pause every 5 channels
      if ((i + 1) % 5 === 0) {
        await delay(2000)
      }
    }

    return results
  }
}
