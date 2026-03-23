// Periskope (WhatsApp) report
export interface PeriskopeAlert {
  priority: "alta" | "media" | "baja";
  type: string;
  group_name: string;
  chat_id: string;
  client_name: string;
  detail: string;
  event_time: string;
  hours_without_response?: number;
  action_suggested?: string;
  shared: boolean;
}

export interface PeriskopeOpsExecutive {
  name: string;
  email?: string;
  phone?: string;
  groups_monitored?: number;
  groups_active?: number;
  alerts: PeriskopeAlert[];
}

export interface PeriskopeReport {
  date: string;
  generated_at: string;
  summary: {
    ops_monitored: number;
    total_groups: number;
    active_groups: number;
    total_messages: number;
    alerts_alta: number;
    alerts_media: number;
    alerts_baja: number;
    total_alerts: number;
  };
  ops_executives: PeriskopeOpsExecutive[];
  observations: string[];
}

// Slack report
export interface SlackHighlight {
  summary: string;
  people_involved: string[];
  risk_flag?: "churn_risk" | "escalation" | "blocker" | null;
  intervention_needed: boolean;
  detail: string;
}

export interface SlackChannel {
  name: string;
  topic?: string;
  activity_level: "high" | "medium" | "low";
  highlights: SlackHighlight[];
  last_activity?: string;
}

export interface SlackReport {
  date: string;
  generated_at: string;
  summary: {
    channels_scanned: number;
    channels_with_activity: number;
    total_highlights: number;
    intervention_needed: number;
    churn_risks: number;
  };
  channels: SlackChannel[];
}

// Metabase report
export interface MetabaseAccount {
  name: string;
  owner: string;
  owner_slack_id?: string;
  phase: string;
  mrr: number;
  health_score: number;
  flag: "RED" | "GREEN";
  conversations_included?: number;
  months: Record<string, number>;
  current_month_actual: number;
  current_month_projected: number;
  mom_change_percent: number;
}

export interface MetabaseReport {
  date: string;
  generated_at: string;
  data_range: string;
  projection_note?: string;
  summary: {
    total_accounts: number;
    flagged_accounts: number;
    red_flags: number;
    green_flags: number;
  };
  accounts: MetabaseAccount[];
}

// Unified client view
export interface UnifiedClient {
  id: string; // slug
  display_name: string;
  ops_executive?: string;
  whatsapp?: {
    groups: string[];
    alerts: PeriskopeAlert[];
    total_alerts: number;
    highest_priority: "alta" | "media" | "baja" | null;
  };
  slack?: {
    channels: string[];
    highlights: SlackHighlight[];
    intervention_needed: boolean;
    has_risk: boolean;
  };
  metabase?: {
    account_name: string;
    flag?: "RED" | "GREEN";
    mom_change_percent?: number;
    mrr?: number;
    conversations_projected?: number;
  };
  risk_level: "critical" | "warning" | "ok";
  matched_sources: number; // 1, 2, or 3
}

// Mappings
export interface ClientMapping {
  display_name: string;
  whatsapp_groups?: string[];
  slack_channels?: string[];
  metabase_account?: string;
}

export type MappingsFile = Record<string, ClientMapping>;
