import Anthropic from '@anthropic-ai/sdk'
import type { PeriskopeAlert, SlackReport, SlackChannel } from '@/lib/types'

export class AnalyzerService {
  private client: Anthropic

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey })
  }

  // Analyze WhatsApp messages for a single ops executive
  async analyzeWhatsAppForOps(
    opsName: string,
    opsEmail: string,
    opsPhone: string,
    groupsData: Array<{
      chatId: string
      chatName: string
      assignedTo: string | null
      messages: any[]
    }>
  ): Promise<{
    alerts: PeriskopeAlert[]
    groups_monitored: number
    groups_active: number
  }> {
    const systemPrompt = `You are an operations monitoring assistant for Darwin AI. You analyze WhatsApp group messages between ops executives and clients to detect alert conditions.

## MONITORING RULES

### Alert Types (from highest to lowest priority):

1. **Peticion de cliente sin actualizar 24h** (Alta): Client makes a request (config changes, questions, etc.) and ops doesn't respond in 24h.
2. **Cliente con problemas sin respuesta en 24h** (Alta): Client reports a platform/agent issue (agent doesn't follow flow, AI doesn't respond, slow process, agent doesn't escalate) and ops doesn't respond in 24h.
3. **Peticion de cliente sin actualizar 2h** (Baja): Client makes a request and ops doesn't respond in 2h.
4. **Cliente con problemas sin respuesta en 2h** (Media): Client reports a technical issue and ops doesn't respond in 2h.
5. **Sin respuesta de cliente 8+ dias** (Media): Client hasn't responded to ops for 8+ days.
6. **Cliente molesto -> Churn risk** (Media): Client shows disappointment/anger about the service. Action: flag as churn risk.
7. **Cliente pide la baja** (Media): Client asks to cancel or pause their service. Action: flag as churn negotiation.
8. **Frustracion acumulada** (Media): Client shows signs of accumulated frustration - shorter responses ("ok", "bueno", "ya"), repeating questions, passive-aggressive tone.
9. **Idas y vueltas innecesarias** (Media): Too many messages exchanged for what should be a simple task. Ops asks for info the client already provided.

## MESSAGE FORMAT
Messages have: from_me (true = ops, false = someone else), body (text), timestamp, sender_name, sender_phone.

## IDENTIFYING CLIENT vs OPS
- from_me: true -> message from the ops executive's phone (they ARE the ops)
- from_me: false -> could be the client OR another Darwin team member
- If sender_phone matches a known Darwin phone number, treat them as Darwin staff, not client

## OUTPUT FORMAT
Return a JSON array of alerts. Each alert must have:
- priority: "alta", "media", or "baja"
- type: descriptive alert type name
- group_name: WhatsApp group name
- chat_id: the chat ID
- client_name: extracted client name from group name (remove "Darwin AI", "Darwin Ai", "<>", "-", etc.)
- detail: specific description of what happened (quote key messages when relevant)
- event_time: ISO timestamp of the triggering event
- hours_without_response: numeric hours since last response (or omit if not applicable)
- action_suggested: what the ops should do (or omit if not applicable)
- shared: false (unless the group has no assigned_to)

If there are NO alerts for a group, don't include it. Only flag real issues.
Return ONLY valid JSON array, no markdown, no explanation.`

    const userMessage = `Analyze these WhatsApp groups for ops executive: ${opsName} (${opsEmail})

${groupsData.map(g => `
=== GROUP: ${g.chatName} (${g.chatId}) ===
Assigned to: ${g.assignedTo || 'Not assigned (shared group)'}
Messages (last 24h):
${g.messages.map((m: any) => `[${m.timestamp}] ${m.from_me ? 'OPS' : m.sender_name || 'CLIENT'}: ${m.body || '(media/no text)'}`).join('\n')}
`).join('\n\n')}

Return a JSON array of alerts found. If no alerts, return [].`

    try {
      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      })

      const text = response.content[0].type === 'text' ? response.content[0].text : ''
      // Extract JSON from response (might have markdown code blocks)
      const jsonMatch = text.match(/\[[\s\S]*\]/)
      const alerts: PeriskopeAlert[] = jsonMatch ? JSON.parse(jsonMatch[0]) : []

      return {
        alerts,
        groups_monitored: groupsData.length,
        groups_active: groupsData.filter(g => g.messages.length > 0).length,
      }
    } catch (e: any) {
      console.error(`Analyzer error for ${opsName}:`, e.message)
      return { alerts: [], groups_monitored: groupsData.length, groups_active: 0 }
    }
  }

  // Analyze Slack channel messages
  async analyzeSlackChannels(
    channelsData: Array<{
      channelName: string
      topic: string
      messages: any[]
    }>
  ): Promise<SlackReport> {
    // Process in batches of 10 channels
    const batchSize = 10
    const allChannels: SlackChannel[] = []

    for (let i = 0; i < channelsData.length; i += batchSize) {
      const batch = channelsData.slice(i, i + batchSize)

      const systemPrompt = `You are a customer success monitoring assistant. Analyze Slack channel messages between a SaaS company (Darwin AI) and their clients. Identify important highlights, risks, and issues.

For each channel, identify:
1. Key topics discussed
2. People involved (by name)
3. Risk flags: "churn_risk" (customer seems at risk of leaving), "escalation" (needs escalation), "blocker" (something is blocking progress), or null
4. Whether management intervention is needed (true/false)
5. Detailed context

Activity levels: "high" (>20 messages), "medium" (5-20), "low" (<5)

Return a JSON array of channel objects with this structure:
{
  "name": "#channel-name",
  "topic": "channel topic",
  "activity_level": "high|medium|low",
  "highlights": [
    {
      "summary": "Short summary of highlight",
      "people_involved": ["Name1", "Name2"],
      "risk_flag": null | "churn_risk" | "escalation" | "blocker",
      "intervention_needed": false,
      "detail": "More detail about the highlight"
    }
  ],
  "last_activity": "ISO timestamp"
}

Only include channels that have meaningful highlights. Skip channels with just casual/routine messages.
Return ONLY valid JSON array, no markdown.`

      const userMessage = batch.map(ch => `
=== CHANNEL: ${ch.channelName} ===
Topic: ${ch.topic || 'No topic'}
Messages (${ch.messages.length}):
${ch.messages.slice(0, 50).map((m: any) => `[${new Date(Number(m.ts) * 1000).toISOString()}] ${m.user_profile?.real_name || m.user || 'Unknown'}: ${m.text || '(no text)'}`).join('\n')}
`).join('\n\n')

      try {
        const response = await this.client.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: 'user', content: `Analyze these Slack channels:\n${userMessage}\n\nReturn JSON array.` }],
        })

        const text = response.content[0].type === 'text' ? response.content[0].text : ''
        const jsonMatch = text.match(/\[[\s\S]*\]/)
        const channels: SlackChannel[] = jsonMatch ? JSON.parse(jsonMatch[0]) : []
        allChannels.push(...channels)
      } catch (e: any) {
        console.error(`Slack analyzer error batch ${i}:`, e.message)
      }
    }

    const interventions = allChannels.reduce((sum, ch) =>
      sum + ch.highlights.filter(h => h.intervention_needed).length, 0)
    const churnRisks = allChannels.reduce((sum, ch) =>
      sum + ch.highlights.filter(h => h.risk_flag === 'churn_risk').length, 0)

    return {
      date: new Date().toISOString().split('T')[0],
      generated_at: new Date().toISOString(),
      summary: {
        channels_scanned: channelsData.length,
        channels_with_activity: allChannels.length,
        total_highlights: allChannels.reduce((sum, ch) => sum + ch.highlights.length, 0),
        intervention_needed: interventions,
        churn_risks: churnRisks,
      },
      channels: allChannels,
    }
  }
}
