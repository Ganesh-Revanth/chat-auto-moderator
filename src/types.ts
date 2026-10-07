export interface TokenAnalysisItem {
  raw_token: string;
  normalized_token: string;
  deobfuscated_token: string;
  status: 'flagged' | 'exempt' | 'clean';
  category?: string;
  weight?: number;
}

export interface ContextMessage {
  line_number: number;
  timestamp: string;
  player: string;
  message: string;
  is_target: boolean;
  is_flagged: boolean;
  severity: string;
}

export interface ContextAnalysisResult {
  target_line_number: number;
  target_player: string;
  preceding: ContextMessage[];
  target: ContextMessage;
  succeeding: ContextMessage[];
  classification: string;
  context_notes: string[];
  context_boost: number;
}

export interface PlayerProfile {
  username: string;
  total_messages: number;
  flagged_messages: number;
  flagged_percentage: number;
  critical_severity_count: number;
  high_severity_count: number;
  medium_severity_count: number;
  low_severity_count: number;
  average_toxicity: number;
  threat_count: number;
  harassment_count: number;
  insult_count: number;
  spam_count: number;
  profanity_count: number;
  common_categories: string[];
  review_status_tier: 'clean' | 'flagged' | 'requires_review' | 'repeated_flags' | 'high_priority_review';
  first_seen_timestamp: string | null;
  last_seen_timestamp: string | null;
}

export interface MessageRecord {
  id: number;
  timestamp: string;
  player: string;
  message: string;
  raw_line: string;
  line_number: number;
  discord_message_url?: string;
  is_flagged: boolean;
  overall_score: number;
  rule_score: number;
  ai_score: number;
  severity: 'none' | 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  primary_category: string;
  categories: string[];
  reasons: string[];
  ai_breakdown: Record<string, number>;
  tokens?: TokenAnalysisItem[];
  review_status: 'unreviewed' | 'confirmed' | 'false_positive' | 'reviewed' | 'ignored';
  moderator_notes: string;
}

export interface ParseErrorRecord {
  line_number: number;
  raw_line: string;
  reason: string;
}

export interface CacheHitMetadata {
  cache_hit: boolean;
  cached_messages_reused: number;
  newly_scanned_messages: number;
  total_cached_in_channel: number;
  last_synced_at: string;
}

export interface LogParseResponse {
  file_name: string;
  file_size_bytes: number;
  lines_processed: number;
  messages_detected: number;
  unique_players_count: number;
  unique_players: string[];
  detected_format: string;
  guild_id?: string;
  channel_id?: string;
  detected_gamemode?: string;
  parsing_errors: ParseErrorRecord[];
  flagged_messages_count: number;
  critical_severity_count: number;
  high_severity_count: number;
  severity_breakdown: Record<string, number>;
  category_breakdown: Record<string, number>;
  player_profiles: Record<string, PlayerProfile>;
  messages_preview: MessageRecord[];
  cache_metadata?: CacheHitMetadata;
  earliest_timestamp?: string | null;
  latest_timestamp?: string | null;
  available_dates?: string[];
}

export interface ChannelCacheSummary {
  channel_id: string;
  channel_name: string;
  guild_id?: string;
  detected_gamemode?: string;
  cached_messages_count: number;
  flagged_messages_count: number;
  critical_severity_count: number;
  high_severity_count: number;
  newest_message_id?: string;
  last_synced_at: string;
}

export interface LiveFeedAlertItem {
  id: string;
  discord_message_id: string;
  channel_id: string;
  channel_name: string;
  guild_id?: string;
  detected_gamemode?: string;
  timestamp: string;
  received_at: string;
  player: string;
  message: string;
  discord_message_url?: string;
  is_flagged: boolean;
  severity: 'none' | 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  overall_score: number;
  primary_category: string;
  categories: string[];
  reasons: string[];
  acknowledged?: boolean;
}

export interface MonitoredChannelLiveState {
  channel_id: string;
  channel_name: string;
  guild_id?: string;
  detected_gamemode?: string;
  status: 'working' | 'standby' | 'rate_limited' | 'unreachable';
  status_detail?: string;
  last_message_id: string;
  last_polled_at: string | null;
  messages_seen: number;
  flags_detected: number;
}

export interface LiveMonitorStatusResponse {
  running: boolean;
  mode: 'all' | 'single';
  channel_id: string;
  channel_name: string;
  guild_id?: string;
  monitored_channels: MonitoredChannelLiveState[];
  working_channels_count: number;
  poll_interval_ms: number;
  started_at: string | null;
  last_polled_at: string | null;
  total_seen_live: number;
  total_flagged_live: number;
  error: string | null;
  recent_messages: LiveFeedAlertItem[];
  active_alerts: LiveFeedAlertItem[];
}

export interface PunishmentRecord {
  id: number;
  case_id: string;
  created_at: string;
  message_id?: number;
  staff_action_mode?: 'log' | 'request';
  username: string;
  punishment_type: string;
  duration: string;
  reason: string;
  gamemode: string;
  evidence_links: string;
  message_excerpt: string;
  severity: string;
  command_string: string;
  discord_status: 'logged_locally' | 'sent_to_discord' | 'failed';
  discord_detail?: string;
}
