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
  review_status: 'unreviewed' | 'confirmed' | 'false_positive' | 'reviewed' | 'ignored';
  moderator_notes: string;
}

export interface ParseErrorRecord {
  line_number: number;
  raw_line: string;
  reason: string;
}

export interface LogParseResponse {
  file_name: string;
  file_size_bytes: number;
  lines_processed: number;
  messages_detected: number;
  unique_players_count: number;
  unique_players: string[];
  detected_format: string;
  parsing_errors: ParseErrorRecord[];
  flagged_messages_count: number;
  critical_severity_count: number;
  high_severity_count: number;
  severity_breakdown: Record<string, number>;
  category_breakdown: Record<string, number>;
  player_profiles: Record<string, PlayerProfile>;
  messages_preview: MessageRecord[];
}
