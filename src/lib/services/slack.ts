import { WebClient } from '@slack/web-api'

export class SlackService {
  private client: WebClient

  constructor(token: string) {
    this.client = new WebClient(token)
  }

  // Find all customer/client channels
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
        if (
          name.startsWith('client-') ||
          name.startsWith('cliente-') ||
          name.startsWith('customer-')
        ) {
          channels.push({
            id: ch.id!,
            name: `#${name}`,
            topic: ch.topic?.value || '',
          })
        }
      }
      cursor = result.response_metadata?.next_cursor
    } while (cursor)

    return channels
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
    let cursor: string | undefined

    try {
      do {
        const result = await this.client.conversations.history({
          channel: channelId,
          oldest,
          limit: 100,
          cursor,
        })
        messages.push(...(result.messages || []))
        cursor = result.response_metadata?.next_cursor
      } while (cursor)
    } catch (e: any) {
      // Bot might not be in the channel
      console.error(`Error reading ${channelId}: ${e.message}`)
      return []
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

    for (const ch of channels) {
      const messages = await this.getChannelMessages(ch.id)
      if (messages.length > 0) {
        results.push({
          channelId: ch.id,
          channelName: ch.name,
          topic: ch.topic,
          messages,
        })
      }
    }

    return results
  }
}
