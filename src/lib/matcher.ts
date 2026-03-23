import { PeriskopeReport, SlackReport, MetabaseReport, MappingsFile, UnifiedClient } from './types';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim()
    .replace(/\s+/g, '-');
}

function extractClientFromWhatsApp(groupName: string): string {
  let name = groupName
    .replace(/darwin\s*ai?\s*/gi, '')
    .replace(/<>/g, '')
    .replace(/\s*-\s*/g, ' ')
    .replace(/[🏋️‍♀️👶🏼🦺💆‍♀️🏠]/gu, '')
    .trim();
  // Remove "PoC" prefix/suffix
  name = name.replace(/\bPoC\b/gi, '').trim();
  return name;
}

function extractClientFromSlack(channelName: string): string {
  return channelName
    .replace(/^#?(customer|client|clients)-/i, '')
    .replace(/-/g, ' ')
    .trim();
}

function normalize(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function fuzzyMatch(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  // Check if most words match
  const wordsA = a.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const wordsB = b.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const matchCount = wordsA.filter(wa => wordsB.some(wb => normalize(wa) === normalize(wb))).length;
  return matchCount > 0 && matchCount >= Math.min(wordsA.length, wordsB.length) * 0.5;
}

export function buildUnifiedClients(
  periskope: PeriskopeReport | null,
  slack: SlackReport | null,
  metabase: MetabaseReport | null,
  mappings: MappingsFile
): UnifiedClient[] {
  const clients = new Map<string, UnifiedClient>();

  // Step 1: Apply manual mappings first
  for (const [id, mapping] of Object.entries(mappings)) {
    clients.set(id, {
      id,
      display_name: mapping.display_name,
      whatsapp: mapping.whatsapp_groups?.length ? { groups: mapping.whatsapp_groups, alerts: [], total_alerts: 0, highest_priority: null } : undefined,
      slack: mapping.slack_channels?.length ? { channels: mapping.slack_channels, highlights: [], intervention_needed: false, has_risk: false } : undefined,
      metabase: mapping.metabase_account ? { account_name: mapping.metabase_account } : undefined,
      risk_level: 'ok',
      matched_sources: 0,
    });
  }

  // Step 2: Process Periskope data
  if (periskope) {
    for (const ops of periskope.ops_executives) {
      for (const alert of ops.alerts) {
        const clientName = extractClientFromWhatsApp(alert.group_name);
        const slug = slugify(clientName);

        // Check manual mapping by chat_id
        let mappedId: string | null = null;
        for (const [id, m] of Object.entries(mappings)) {
          if (m.whatsapp_groups?.includes(alert.chat_id)) {
            mappedId = id;
            break;
          }
        }

        const targetId = mappedId || slug;
        if (!clients.has(targetId)) {
          clients.set(targetId, {
            id: targetId,
            display_name: clientName,
            risk_level: 'ok',
            matched_sources: 0,
          });
        }

        const client = clients.get(targetId)!;
        if (!client.whatsapp) {
          client.whatsapp = { groups: [], alerts: [], total_alerts: 0, highest_priority: null };
        }
        if (!client.whatsapp.groups.includes(alert.chat_id)) {
          client.whatsapp.groups.push(alert.chat_id);
        }
        client.whatsapp.alerts.push(alert);
        client.whatsapp.total_alerts = client.whatsapp.alerts.length;
        client.ops_executive = client.ops_executive || ops.name;

        // Update highest priority
        const prio = alert.priority;
        if (prio === 'alta' || (prio === 'media' && client.whatsapp.highest_priority !== 'alta')) {
          client.whatsapp.highest_priority = prio;
        } else if (!client.whatsapp.highest_priority) {
          client.whatsapp.highest_priority = prio;
        }
      }
    }
  }

  // Step 3: Process Slack data
  if (slack) {
    for (const channel of slack.channels) {
      const clientName = extractClientFromSlack(channel.name);
      const slug = slugify(clientName);

      // Check manual mapping by channel name
      let mappedId: string | null = null;
      for (const [id, m] of Object.entries(mappings)) {
        if (m.slack_channels?.includes(channel.name)) {
          mappedId = id;
          break;
        }
      }

      // Try fuzzy match with existing clients
      let targetId = mappedId;
      if (!targetId) {
        for (const [id, client] of clients) {
          if (fuzzyMatch(clientName, client.display_name)) {
            targetId = id;
            break;
          }
        }
      }
      if (!targetId) targetId = slug;

      if (!clients.has(targetId)) {
        clients.set(targetId, {
          id: targetId,
          display_name: clientName,
          risk_level: 'ok',
          matched_sources: 0,
        });
      }

      const client = clients.get(targetId)!;
      client.slack = {
        channels: [channel.name],
        highlights: channel.highlights,
        intervention_needed: channel.highlights.some(h => h.intervention_needed),
        has_risk: channel.highlights.some(h => h.risk_flag != null),
      };
    }
  }

  // Step 4: Process Metabase data
  if (metabase) {
    for (const account of metabase.accounts) {
      const slug = slugify(account.name);

      // Check manual mapping
      let mappedId: string | null = null;
      for (const [id, m] of Object.entries(mappings)) {
        if (m.metabase_account && normalize(m.metabase_account) === normalize(account.name)) {
          mappedId = id;
          break;
        }
      }

      // Try fuzzy match
      let targetId = mappedId;
      if (!targetId) {
        for (const [id, client] of clients) {
          if (fuzzyMatch(account.name, client.display_name)) {
            targetId = id;
            break;
          }
        }
      }
      if (!targetId) targetId = slug;

      if (!clients.has(targetId)) {
        clients.set(targetId, {
          id: targetId,
          display_name: account.name,
          risk_level: 'ok',
          matched_sources: 0,
        });
      }

      const client = clients.get(targetId)!;
      client.metabase = {
        account_name: account.name,
        flag: account.flag,
        mom_change_percent: account.mom_change_percent,
        mrr: account.mrr,
        conversations_projected: account.current_month_projected,
      };
      client.ops_executive = client.ops_executive || account.owner;
    }
  }

  // Step 5: Calculate risk levels and matched_sources
  for (const client of clients.values()) {
    let sources = 0;
    if (client.whatsapp?.alerts.length) sources++;
    if (client.slack?.highlights.length) sources++;
    if (client.metabase) sources++;
    client.matched_sources = sources;

    // Risk level
    const hasAltaAlert = client.whatsapp?.highest_priority === 'alta';
    const hasChurnAlert = client.whatsapp?.alerts.some(a =>
      a.type.toLowerCase().includes('baja') || a.type.toLowerCase().includes('churn')
    );
    const hasRedFlag = client.metabase?.flag === 'RED';
    const hasSlackRisk = client.slack?.has_risk;

    if (hasAltaAlert || hasChurnAlert || (hasRedFlag && hasSlackRisk)) {
      client.risk_level = 'critical';
    } else if (hasRedFlag || hasSlackRisk || client.whatsapp?.highest_priority === 'media') {
      client.risk_level = 'warning';
    } else {
      client.risk_level = 'ok';
    }
  }

  // Sort: critical first, then warning, then ok. Within each: by matched_sources desc
  const riskOrder = { critical: 0, warning: 1, ok: 2 };
  return Array.from(clients.values()).sort((a, b) => {
    const riskDiff = riskOrder[a.risk_level] - riskOrder[b.risk_level];
    if (riskDiff !== 0) return riskDiff;
    return b.matched_sources - a.matched_sources;
  });
}
