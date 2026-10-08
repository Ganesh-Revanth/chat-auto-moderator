import express from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import WebSocket from 'ws';

const __dirname = process.cwd();
const SESSION_STORE_PATH = process.env.MODSTUDIO_SESSION_PATH
  ? path.resolve(process.env.MODSTUDIO_SESSION_PATH)
  : path.join(__dirname, '.discord_session.json');
const SCAN_MEMORY_DIR = path.join(__dirname, '.modstudio_memory');
if (!fs.existsSync(SCAN_MEMORY_DIR)) {
  try {
    fs.mkdirSync(SCAN_MEMORY_DIR, { recursive: true });
  } catch {
    // ignore
  }
}

export interface PresetDiscordChannel {
  channel_id: string;
  guild_id: string;
  url: string;
  name: string;
}

const DEFAULT_PRESET_CHANNELS: PresetDiscordChannel[] = [
  {
    channel_id: '1474488688812495094',
    guild_id: '1250416860000817162',
    url: 'https://discord.com/channels/1250416860000817162/1474488688812495094',
    name: 'Channel 1474488688812495094',
  },
  {
    channel_id: '1473478972816752650',
    guild_id: '1250416860000817162',
    url: 'https://discord.com/channels/1250416860000817162/1473478972816752650',
    name: 'Channel 1473478972816752650',
  },
  {
    channel_id: '1473793765008343285',
    guild_id: '1250416860000817162',
    url: 'https://discord.com/channels/1250416860000817162/1473793765008343285',
    name: 'Channel 1473793765008343285',
  },
  {
    channel_id: '1473814315948834973',
    guild_id: '1250416860000817162',
    url: 'https://discord.com/channels/1250416860000817162/1473814315948834973',
    name: 'Channel 1473814315948834973',
  },
  {
    channel_id: '1484703765629243423',
    guild_id: '1250416860000817162',
    url: 'https://discord.com/channels/1250416860000817162/1484703765629243423',
    name: 'Channel 1484703765629243423',
  },
  {
    channel_id: '1546730982525116497',
    guild_id: '1250416860000817162',
    url: 'https://discord.com/channels/1250416860000817162/1546730982525116497',
    name: 'Channel 1546730982525116497',
  },
];

interface PersistedSessionState {
  token: string;
  selected_channel_id: string;
  staff_channel_id: string;
  preset_channels: PresetDiscordChannel[];
}

function loadSessionState(): PersistedSessionState {
  try {
    if (fs.existsSync(SESSION_STORE_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(SESSION_STORE_PATH, 'utf-8'));
      const savedChannels: PresetDiscordChannel[] = Array.isArray(parsed.preset_channels)
        ? parsed.preset_channels
        : [];
      const mergedPresets = DEFAULT_PRESET_CHANNELS.map((def) => {
        const existing = savedChannels.find((c) => c.channel_id === def.channel_id);
        return existing && existing.name ? { ...def, name: existing.name } : def;
      });
      return {
        token: String(parsed.token || ''),
        selected_channel_id: String(parsed.selected_channel_id || DEFAULT_PRESET_CHANNELS[1].channel_id),
        staff_channel_id: String(parsed.staff_channel_id || '1252195894065893387'),
        preset_channels: mergedPresets,
      };
    }
  } catch {
    // ignore read error
  }
  return {
    token: '',
    selected_channel_id: DEFAULT_PRESET_CHANNELS[1].channel_id,
    staff_channel_id: '1252195894065893387',
    preset_channels: [...DEFAULT_PRESET_CHANNELS],
  };
}

const sessionState: PersistedSessionState = loadSessionState();

function saveSessionState() {
  try {
    fs.writeFileSync(SESSION_STORE_PATH, JSON.stringify(sessionState, null, 2), 'utf-8');
  } catch {
    // ignore write error
  }
}

// ==========================================
// 1. SCHEMAS & INTERFACES
// ==========================================

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
  review_status_tier: string;
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
  severity: string;
  confidence: number;
  primary_category: string;
  categories: string[];
  reasons: string[];
  ai_breakdown: Record<string, number>;
  review_status: string;
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

export function extractDateString(timestamp: string): string | null {
  if (!timestamp || timestamp === 'Unknown') return null;
  // Match standard YYYY-MM-DD
  const isoMatch = /^(\d{4}-\d{2}-\d{2})/.exec(timestamp);
  if (isoMatch) return isoMatch[1];
  // Match DD-MM-YYYY
  const dmMatch = /^(\d{2})-(\d{2})-(\d{4})/.exec(timestamp);
  if (dmMatch) return `${dmMatch[3]}-${dmMatch[2]}-${dmMatch[1]}`;
  // Try Date.parse
  try {
    const d = new Date(timestamp);
    if (!isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }
  } catch {
    // ignore
  }
  return null;
}

export function parseTimestampToMillis(timestamp: string): number | null {
  if (!timestamp || timestamp === 'Unknown') return null;
  try {
    // Try normalized ISO if it has space
    const isoCandidate = timestamp.includes('T') ? timestamp : timestamp.replace(' ', 'T');
    const d = new Date(isoCandidate);
    if (!isNaN(d.getTime())) return d.getTime();
  } catch {
    // ignore
  }
  return null;
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

// ==========================================
// 2. TEXT NORMALIZER
// ==========================================

const LEET_MAP: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '!': 'i',
  '|': 'l',
  '3': 'e',
  '4': 'a',
  '@': 'a',
  '5': 's',
  '$': 's',
  '7': 't',
  '+': 't',
  '8': 'b',
  '9': 'g',
};

class TextNormalizer {
  normalize(text: string): string {
    if (!text) return '';
    const nfkd = text.normalize('NFKD');
    const strippedAccents = nfkd.replace(/[\u0300-\u036f]/g, '');
    return strippedAccents.toLowerCase().replace(/\s+/g, ' ').trim();
  }

  deobfuscate(text: string): string {
    const normalized = this.normalize(text);
    const collapsedRepeats = normalized.replace(/(.)\1{2,}/g, '$1$1');
    const deLeeted = collapsedRepeats
      .split('')
      .map((c) => LEET_MAP[c] ?? c)
      .join('');
    return deLeeted.replace(/(?<=\b[a-z])[\s.\-_/\\*~]+(?=[a-z]\b)/g, '');
  }
}

const normalizer = new TextNormalizer();

// ==========================================
// 3. RULE MODERATION ENGINE
// ==========================================

interface RuleResult {
  is_flagged: boolean;
  categories: string[];
  severity: string;
  confidence: number;
  reasons: string[];
}

const SEVERITY_RANKS: Record<string, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

const EXEMPT_WORDS = new Set([
  'grass', 'bass', 'compass', 'classic', 'class', 'classes',
  'mass', 'pass', 'passed', 'passing', 'glass', 'glasses',
  'asset', 'assets', 'assist', 'assistant', 'assistance',
  'peacock', 'cockpit', 'cockatoo', 'cocktail',
  'scrap', 'scraps', 'scrapped',
  'hello', 'shell', 'shells', 'helium',
  'title', 'titles', 'titan', 'attitude', 'entity', 'entities',
  'spite', 'despite', 'hospitable',
  'butter', 'canal', 'country', 'count',
  'night', 'nights', 'knight', 'knights', 'ignite', 'ignited', 'enigma', 'sign', 'benign', 'align', 'assign', 'resign', 'design', 'insignia', 'dignity', 'indignant',
  'snicker', 'snickers', 'snigger',
  'chigger', 'trigger', 'triggers', 'triggered', 'bigger', 'digger', 'vigor', 'rigor', 'figure', 'figures',
  'chutney', 'chute', 'chutes', 'randy', 'because', 'bacon', 'match', 'machine', 'channel',
]);

type PatternTuple = [RegExp, string, number, string];
type HindiPatternTuple = [RegExp, string, number, string, string];

// ========================================================
// HINDI & HINGLISH MODERATION RULES (Roman Hindi / Slang)
// Detects severe cusses, maternal/sister abuses, acronyms (tmkc, bsdk, bkl, mc, bc),
// sexual/genital profanities, threats, and caste/identity slurs.
// Harmless conversational Hindi (namaste, bhai, yaar, kya, acha) is strictly exempt.
// ========================================================
const HINDI_PATTERNS: HindiPatternTuple[] = [
  // 1. Maternal / Sister Abuses & Major Acronyms (Critical Severity)
  [
    /\b(t+m+k+c+|m+k+c+|t+k+m+c+|b+k+l+|b+s+d+k+)\b/i,
    'Severe Hindi abusive acronym (tmkc / mkc / bsdk / bkl)',
    0.99,
    'critical',
    'harassment',
  ],
  [
    /\b(t+e+r+i+\s+m+a+[aik]*\s*(?:k+i+|k+a+)?\s*c+h+[u0o]+t+|t+e+r+i+\s+m+a+k+i+\s*c+h+[u0o]+t+|t+e+r+i+\s+m+a+[aik]*\s*k+i+\s*c+h+[o0]{2}t+|t+e+r+i+\s*m+a+k+i+c+h+u+t+)\b/i,
    'Severe Hindi maternal sexual abuse ("teri maki chut" / variant)',
    0.99,
    'critical',
    'harassment',
  ],
  [
    /\b(t+e+r+i+\s+m+a+[ai]*\s*k+a+\s*b+h+[o0]+s+[a-z]*|t+e+r+i+\s+m+a+[ai]*\s*k+i+|t+e+r+i+\s+m+a+[ai]*\s*k+a+|t+e+r+i+\s+m+a+[ai]*\s*c+h+[u0o]+d+w*a*|t+e+r+i+\s+a+m+m+[i1]+\s*k+i+\s*c+h+[u0o]+t+)\b/i,
    'Severe Hindi maternal insult / abuse ("teri maa ka/ki...")',
    0.98,
    'critical',
    'harassment',
  ],
  [
    /\b(t+e+r+i+\s+b+h+e+n+\s*k+i+\s*c+h+[u0o]+t+|t+e+r+i+\s+b+e+h+e+n+\s*k+i+\s*c+h+[u0o]+t+|t+e+r+i+\s+b+e+h+a+n+\s*k+i+\s*c+h+[u0o]+t+)\b/i,
    'Severe Hindi sister sexual abuse ("teri behen ki chut")',
    0.99,
    'critical',
    'harassment',
  ],
  [
    /\b(b+h+e+n+c+h+[o0]+d+[a-z]*|b+e+h+e+n+c+h+[o0]+d+[a-z]*|b+e+h+n+c+h+[o0]+d+[a-z]*|b+e+n+c+h+[o0]+d+[a-z]*|b+h+e+n+\s*c+h+[o0]+d+[a-z]*|b+e+h+e+n+\s*c+h+[o0]+d+[a-z]*)\b/i,
    'Severe Hindi incest profanity ("bhenchod" / "behenchod")',
    0.98,
    'critical',
    'profanity',
  ],
  [
    /\b(m+a+d+a+r+c+h+[o0]+d+[a-z]*|m+a+d+e+r+c+h+[o0]+d+[a-z]*|m+a+d+a+r+\s*c+h+[o0]+d+[a-z]*|m+a+d+a+r+j+a+t+|m+a+d+a+r+z+a+t+|m+a+d+e+r+j+a+t+)\b/i,
    'Severe Hindi maternal incest abuse ("madarchod")',
    0.99,
    'critical',
    'harassment',
  ],
  [
    /\b(b+h+e+n+\s*k+e+\s*l+[o0a]+d+[e3a]*|b+e+h+e+n+\s*k+e+\s*l+[o0a]+d+[e3a]*|b+h+e+n+\s*k+e+\s*t+a+k+k+[e3a]*|b+e+h+e+n+\s*k+e+\s*t+a+k+k+[e3a]*)\b/i,
    'Severe Hindi familial genital abuse ("bhen ke lode")',
    0.98,
    'critical',
    'insult',
  ],
  [
    /\b(b+h+[o0]+s+[a-z]*d+i+k+[e3a]*|b+h+[o0]+s+d+i+k+[e3a]*|b+h+[o0]+s+a+d+i+\s*k+e+|b+h+[o0]+s+d+i+\s*k+e+|b+h+[o0]+s+[a-z]*d+[a-z]+)\b/i,
    'Severe Hindi vulgar insult ("bhosdike" / "bhosda")',
    0.96,
    'high',
    'insult',
  ],

  // 2. Hindi Direct Vulgar Insults & Genital Abuses (High Severity)
  [
    /\b(c+h+[u0o]+t+[i1]+y+[a4e3]+[a-z]*|c+h+[o0]{2}t+[i1]+y+[a4e3]+[a-z]*|c+h+u+t+y+[a4e3]+[a-z]*|c+h+u+t+i+y+a+p+a+)\b/i,
    'Vulgar Hindi insult ("chutiya" / "chutiye")',
    0.95,
    'high',
    'insult',
  ],
  [
    /\b(g+a*a*n+d+u+[s]?|g+a*n+d+u+[s]?|g+a*a*n+d+\s*m+a+r+a+[a-z]*|g+a*a*n+d+\s*m+a+r+w+a+[a-z]*|g+a*n+d+f+a+t+[a-z]*|g+a*a*n+d+\s*f+a+t+i+)\b/i,
    'Vulgar Hindi abusive profanity ("gandu" / "gaand mara")',
    0.95,
    'high',
    'profanity',
  ],
  [
    /\b(l+[o0a]+u*d+[a4e3]+[s]?|l+a+w+d+[a4e3]+[s]?|l+u+n+d+[s]?|l+[o0]+d+u+[s]?|l+u+n+d+\s*l+e+|l+a+u+d+e+\s*l+a+g+g+a+y+e+)\b/i,
    'Vulgar Hindi genital profanity ("lauda" / "lode" / "lund")',
    0.95,
    'high',
    'profanity',
  ],
  [
    /\b(c+h+[u0]+t+|c+h+[o0]{2}t+|c+h+u+t+m+a+r+[i1]k+[a4e3]+)\b/i,
    'Vulgar Hindi sexual profanity ("chut" / "choot")',
    0.95,
    'high',
    'profanity',
  ],
  [
    /\b(r+a*n+d+[i1]+[s]?|r+a*a*n+d+[i1]+[s]?|r+@+n+d+[i1]+[s]?|r+a*a*n+d+w+a+|c+h+[i1]+n+a+l+)\b/i,
    'Derogatory Hindi misogynistic slur / insult ("randi" / "raand")',
    0.96,
    'high',
    'insult',
  ],
  [
    /\b(b+h+a+d+w+[a4e3]+|b+h+a+d+v+[a4e3]+|d+a+l+a+l+\s*k+e+)\b/i,
    'Vulgar Hindi derogatory insult ("bhadwa" / "bhadwe")',
    0.93,
    'high',
    'insult',
  ],
  [
    /\b(h+a+r+a+m+i+[s]?|h+a+r+a+a+m+i+[s]?|h+a+r+a+m+z+a+d+[e3a]+|h+a+r+a+m+k+h+[o0]+r+)\b/i,
    'Hostile Hindi insult ("harami" / "haramzada")',
    0.91,
    'medium',
    'insult',
  ],
  [
    /\b(j+h+a*a*t+u+[s]?|j+h+a*a*t+\s*k+e+\s*b+a+a*l+|j+h+a+t+u+)\b/i,
    'Vulgar Hindi pubic insult ("jhaatu" / "jhatu")',
    0.92,
    'medium',
    'insult',
  ],
  [
    /\b(s+u+a+r+\s*k+e+\s*b+a+c+h+[a-z]*|k+u+t+t+e+\s*k+e+\s*b+a+c+h+[a-z]*|k+u+t+i+y+a+\s*k+e+)\b/i,
    'Degrading Hindi insult ("suar ke bacche" / "kutte ke bacche")',
    0.92,
    'medium',
    'insult',
  ],
  [
    /\b(m+a+\s*c+h+u+d+w*a*|c+h+u+d+w+a+\s*l+e+|g+a*a*n+d+\s*d+e+d+e+|m+a+r+w+a+\s*l+e+)\b/i,
    'Vulgar Hindi sexual degradation ("maa chuda" / "marwa le")',
    0.95,
    'high',
    'profanity',
  ],

  // 3. Hindi Slurs (Identity, Caste, Homophobic, Transphobic - Critical Severity)
  [
    /\b(c+h+a+k+k+[a4e3]+[s]?|h+[i1]+j+r+[a4e3]+[s]?|m+e+e+t+h+a+\s*s+a+l+a+)\b/i,
    'Transphobic / homophobic Hindi identity slur ("chakka" / "hijra")',
    0.97,
    'critical',
    'slur',
  ],
  [
    /\b(c+h+a+m+a+r+[s]?|b+h+a+n+g+[i1]+[s]?|k+a+t+w+[e3a]+[s]?)\b/i,
    'Caste-based / religious Hindi hate speech slur ("chamar" / "bhangi")',
    0.98,
    'critical',
    'slur',
  ],

  // 4. Hindi Death Threats & Physical Violence (Critical Severity)
  [
    /\b(j+a+a*n+\s*s+e+\s*m+a*a*r+\s*d+[u0]+n+g+[a4]*|m+a*a*r+\s*d+a+l+[u0]+n+g+[a4]*|g+h+a+r+\s*a+a*k+e+\s*m+a*a*r+[u0]+n+g+[a4]*|t+u+j+h+e+\s*k+a+a*t+\s*d+[u0]+n+g+[a4]*)\b/i,
    'Hindi direct death threat / physical violence ("jaan se maar dunga")',
    0.99,
    'critical',
    'threat',
  ],
  [
    /\b(g+a*a*n+d+\s*t+[o0]+d+\s*d+[u0]+n+g+[a4]*|h+a+a*t+h+\s*p+a+i*r+\s*t+[o0]+d+\s*d+[u0]+n+g+[a4]*|p+e+l+\s*d+[u0]+n+g+[a4]*)\b/i,
    'Hindi violent assault / battery threat ("gaand tod dunga" / "pel dunga")',
    0.96,
    'critical',
    'threat',
  ],

  // 5. Short Hindi Abbreviation Slurs (Strict Word Boundaries to avoid English false positives)
  [
    /\b(b+c+|m+c+)\b(?!\s+(?:of|traffic|the|a|an|i\b|we\b|my\b|our\b|his\b|her\b|because\b))/i,
    'Hindi abusive abbreviation (bc / mc - "bhenchod" / "madarchod")',
    0.95,
    'high',
    'profanity',
  ],
];

const SLUR_PATTERNS: PatternTuple[] = [
  [/\b(n+[i1l!|]+g+[e3a4o0u]*[rzkx]*s?|n+[i1l!|]+g+s?|n+[i1l!|]+g+l+[e3]+t+s?|w+[i1l!|]+g+g*[e3a4]+r*s?|w+[i1l!|]+g+z?)\b/i, 'Racial slur or slur evasion (n-word / wigga variant) detected', 0.99, 'critical'],
  [/\b(f+[a4@]+g+g*[o0i1e3]*t*s?|f+[a4@]+g+s?|d+y+k+e+s?)\b/i, 'Homophobic slur detected', 0.98, 'critical'],
  [/\b(tr[a4@]nn(?:y|ies)|ch[i1!]nk+s?|k[i1!]ke+s?|sp[i1!]c+s?|w[e3]tb[a4@]ck+s?|g[o0]{2}k+s?|c[o0]{2}n+s?|beaner+s?|raghead+s?|towelhead+s?)\b/i, 'Hate speech / identity slur detected', 0.98, 'critical'],
  [/\b(r+[e3]+t+[a4@]+r+d+(?:ed|s)?|t+[a4@]+r+d+s?)\b/i, 'Ableist slur / derogatory term detected', 0.94, 'high'],
];

const THREAT_PATTERNS: PatternTuple[] = [
  [/\b(k+[y1i]+s+|k+[i1!]+l+l*\s*(?:ur|your|yo)?\s*s+e+l+f+|g+o+\s*d+i+e+|neck\s*yourself|hang\s*yourself)\b/i, 'Suicide encouragement / self-harm threat (kys)', 0.98, 'critical'],
  [/\b(i(?:\s*will|'ll|\s+gonna|\s+am\s+going\s+to)\s+(?:[\w\s]{0,20}\s+)?(?:kill|murder|hunt|shoot|stab|slit|rape|strangle)\s+(?:you|u|ur\s+family|your\s+family))\b/i, 'Direct physical violence threat', 0.96, 'critical'],
  [/\b(doxx?(?:ing|ed)?\s+(?:you|u)|leak(?:ing)?\s+(?:your|ur)\s+(?:ip|address|coords|dox)|drop(?:ping)?\s+(?:your|ur)\s+ip)\b/i, 'Doxxing / personal information threat', 0.94, 'high'],
  [/\b(swat(?:ting|ted)?\s+(?:you|u))\b/i, 'Swatting threat', 0.96, 'critical'],
];

const INSULT_PATTERNS: PatternTuple[] = [
  [/\b(p+u+s+s+(?:y+|i+e+s+|i+s+)|p+u+s+y+s?)\b/i, 'Derogatory insult / profanity (pussy / pussies)', 0.92, 'medium'],
  [/\b(idiot+s?|idiotic|moron+s?|imbecile+s?|dumbass(?:es)?|dipshit+s?|jackass(?:es)?|scumbag+s?|degenerate+s?)\b/i, 'Direct personal insult', 0.90, 'medium'],
  [/\b(stfu|shut\s+the\s+f+u*c*k*\s+up|get\s+cancer|hope\s+u\s+get\s+cancer|kill\s+urself|jump\s+off\s+a\s+bridge)\b/i, 'Hostile harassment / abusive demand', 0.92, 'high'],
  [/\b(whore+s?|slut+s?|skank+s?|hoe+s?|thot+s?|prostitute+s?)\b/i, 'Derogatory gendered insult', 0.91, 'medium'],
  [/\b(worthless|subhuman|inbred+s?|braindead|autistic\s+fuck|cancerous)\b/i, 'Dehumanizing / hostile insult', 0.88, 'medium'],
];

const PROFANITY_PATTERNS: PatternTuple[] = [
  [/\b(f+u+c+k+(?:ing|er|ers|ed|s|head|wit|tard|boy|boi)?|m+o+t+h+e+r+f+u+c+k+(?:er|ers|ing)?|f+k+(?:ing|er|ed)?|f+u+k+(?:ing|er)?)\b/gi, 'Explicit profanity (f-word)', 0.92, 'medium'],
  [/\b(s+h+i+t+(?:ty|head|heads|bag|stain|s|ting|ted)?|b+u+l+l+s+h+i+t+)\b/gi, 'Vulgar profanity (shit)', 0.86, 'low'],
  [/\b(b+i+t+c+h+(?:es|y|ing|ed)?|b+i+a+t+c+h+|s+o+n+\s+o+f+\s+a+\s+b+i+t+c+h+)\b/gi, 'Vulgar profanity (bitch)', 0.91, 'medium'],
  [/\b(a+s+s+h+o+l+e+s?|a+s+s+h+a+t+s?|a+s+s+w+i+p+e+s?|f+a+t+a+s+s+|b+i+t+c+h+a+s+s+)\b/gi, 'Vulgar profanity (asshole / compound)', 0.90, 'medium'],
  [/\b(b+a+s+t+a+r+d+s?)\b/gi, 'Vulgar profanity (bastard)', 0.86, 'low'],
  [/\b(c+u+n+t+s?)\b/gi, 'Severe profanity (cunt)', 0.96, 'high'],
  [/\b(d+i+c+k+(?:head|heads|sucker|wad|less|s)?|c+o+c+k+(?:sucker|suckers|head|s)?)\b/gi, 'Vulgar profanity (dick / cock)', 0.89, 'medium'],
  [/\b(p+u+s+s+(?:y+|i+e+s+|i+s+)|p+u+s+y+s?|t+w+a+t+s?|p+r+i+c+k+s?)\b/gi, 'Vulgar profanity (pussy / pussies / twat)', 0.92, 'medium'],
];

const SEXUAL_PATTERNS: PatternTuple[] = [
  [/\b(send\s+nudes?|nsfw|porn(?:o|ography)?|xxx|onlyfans)\b/i, 'Inappropriate / sexual solicitation', 0.92, 'high'],
  [/\b(horny|blowjob+s?|handjob+s?|hentai|cum(?:shot|slut|dumpster)?|jizz|dildo+s?|masturbat(?:e|ing)|gangbang)\b/i, 'Sexually explicit content', 0.90, 'medium'],
];

const SUSPICIOUS_URL_PATTERNS: PatternTuple[] = [
  [/(?:https?:\/\/)?discord(?:\.gg|\.com\/invite)\/[a-zA-Z0-9]+/i, 'External Discord server invite advertisement', 0.95, 'medium'],
  [/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?::\d{1,5})?\b/i, 'Suspicious raw IPv4 address advertisement', 0.92, 'medium'],
  [/\b(?:join|play|connect)\s+(?:at|on|my\s+server)\s+[a-zA-Z0-9.-]+\.[a-z]{2,}\b/i, 'External server advertisement', 0.85, 'low'],
];

class RuleModerationEngine {
  evaluate(rawMessage: string): RuleResult {
    if (!rawMessage || !rawMessage.trim()) {
      return { is_flagged: false, categories: [], severity: 'none', confidence: 0.0, reasons: [] };
    }

    const reasons: string[] = [];
    const categories = new Set<string>();
    let highestSeverity = 'none';
    let maxConfidence = 0.0;

    const updateSeverity = (candSev: string) => {
      if ((SEVERITY_RANKS[candSev] ?? 0) > (SEVERITY_RANKS[highestSeverity] ?? 0)) {
        highestSeverity = candSev;
      }
    };

    const updateConfidence = (candConf: number) => {
      if (candConf > maxConfidence) {
        maxConfidence = candConf;
      }
    };

    // Note: Harmless capitalization (caps lock) and harmless stretched greetings (e.g. "hiiiiiiiii")
    // are intentionally NOT flagged so moderation focuses strictly on harmful player intent, slurs,
    // profanity, insults, threats, sexual content, and malicious links.

    // 1. Suspicious URLs / Ads
    for (const [pattern, reason, conf, sev] of SUSPICIOUS_URL_PATTERNS) {
      if (pattern.test(rawMessage)) {
        categories.add('suspicious_url');
        updateSeverity(sev);
        updateConfidence(conf);
        reasons.push(reason);
      }
    }

    // 2. Content normalization (also inspect both normalized and deobfuscated forms)
    const normalized = normalizer.normalize(rawMessage);
    const deobfuscated = normalizer.deobfuscate(rawMessage);
    const targetsToCheck = deobfuscated !== normalized ? [normalized, deobfuscated] : [deobfuscated];

    for (const [pattern, reason, conf, sev] of SLUR_PATTERNS) {
      for (const targetText of targetsToCheck) {
        const match = pattern.exec(targetText);
        if (match) {
          const matchedWord = match[0].toLowerCase().trim();
          if (EXEMPT_WORDS.has(matchedWord)) continue;
          categories.add('slur');
          updateSeverity(sev);
          updateConfidence(conf);
          reasons.push(`${reason}: '${matchedWord}'`);
          break;
        }
      }
    }

    for (const [pattern, reason, conf, sev] of THREAT_PATTERNS) {
      if (targetsToCheck.some((t) => pattern.test(t))) {
        categories.add('threat');
        updateSeverity(sev);
        updateConfidence(conf);
        reasons.push(reason);
      }
    }

    for (const [pattern, reason, conf, sev] of INSULT_PATTERNS) {
      for (const targetText of targetsToCheck) {
        const match = pattern.exec(targetText);
        if (match) {
          const matchedWord = match[0].toLowerCase().trim();
          if (EXEMPT_WORDS.has(matchedWord)) continue;
          categories.add('insult');
          updateSeverity(sev);
          updateConfidence(conf);
          reasons.push(`${reason}: '${matchedWord}'`);
          break;
        }
      }
    }

    for (const [pattern, reason, conf, sev] of PROFANITY_PATTERNS) {
      let matchedProfanity = false;
      for (const targetText of targetsToCheck) {
        pattern.lastIndex = 0;
        const matches = targetText.matchAll(pattern);
        for (const match of matches) {
          const word = match[0].toLowerCase().trim();
          if (EXEMPT_WORDS.has(word)) continue;
          categories.add('profanity');
          updateSeverity(sev);
          updateConfidence(conf);
          reasons.push(`${reason}: '${word}'`);
          matchedProfanity = true;
          break;
        }
        if (matchedProfanity) break;
      }
    }

    for (const [pattern, reason, conf, sev] of SEXUAL_PATTERNS) {
      for (const targetText of targetsToCheck) {
        const match = pattern.exec(targetText);
        if (match) {
          const matchedWord = match[0].toLowerCase().trim();
          if (EXEMPT_WORDS.has(matchedWord)) continue;
          categories.add('sexual');
          updateSeverity(sev);
          updateConfidence(conf);
          reasons.push(`${reason}: '${matchedWord}'`);
          break;
        }
      }
    }

    // 3. Comprehensive Hindi / Hinglish evaluation (tmkc, teri maki chut, bhenchod, bsdk, bkl, etc.)
    for (const [pattern, reason, conf, sev, cat] of HINDI_PATTERNS) {
      for (const targetText of targetsToCheck) {
        pattern.lastIndex = 0;
        const match = pattern.exec(targetText);
        if (match) {
          const matchedWord = match[0].toLowerCase().trim();
          if (EXEMPT_WORDS.has(matchedWord)) continue;
          categories.add(cat);
          updateSeverity(sev);
          updateConfidence(conf);
          reasons.push(`${reason}: '${matchedWord}'`);
          break;
        }
      }
    }

    const isFlagged = categories.size > 0;
    return {
      is_flagged: isFlagged,
      categories: Array.from(categories).sort(),
      severity: isFlagged ? highestSeverity : 'none',
      confidence: isFlagged ? Number(maxConfidence.toFixed(2)) : 0.0,
      reasons,
    };
  }
}

const ruleEngine = new RuleModerationEngine();

// ==========================================
// 4. LOCAL SEMANTIC AI MODERATOR
// ==========================================

interface AIModerationResult {
  scores: Record<string, number>;
  top_category: string | null;
  max_confidence: number;
  threshold_tier: string;
}

class LocalSemanticModerator {
  private hostilityMarkers: Record<string, number> = {
    'nobody likes you': 0.85,
    'nobody wants you': 0.88,
    'get out of here': 0.65,
    'get off the server': 0.75,
    'shut up': 0.60,
    'uninstall the game': 0.80,
    'you are terrible': 0.70,
    'you are useless': 0.82,
    'waste of space': 0.90,
    'never play again': 0.75,
    'worthless': 0.85,
    'loser': 0.65,
    'delete your account': 0.82,
    'stop talking': 0.55,
    // Hindi / Hinglish Hostility & Severe Abuse Markers
    'teri maki chut': 0.99,
    'teri ma ki chut': 0.99,
    'teri maa ki chut': 0.99,
    'teri maa ki choot': 0.99,
    'tmkc': 0.98,
    'mkc': 0.96,
    'bhenchod': 0.96,
    'behenchod': 0.96,
    'madarchod': 0.98,
    'maderchod': 0.98,
    'bhosdike': 0.96,
    'bhosadike': 0.96,
    'bsdk': 0.96,
    'bkl': 0.95,
    'chutiya': 0.92,
    'chutiye': 0.92,
    'gandu': 0.94,
    'gaandu': 0.94,
    'gaand mara': 0.95,
    'gand mara': 0.95,
    'randi': 0.96,
    'bhadwa': 0.94,
    'bhadwe': 0.94,
    'harami': 0.90,
    'laude': 0.93,
    'lode': 0.93,
    'lund': 0.92,
    'chup kar bsdk': 0.97,
    'maa chuda': 0.96,
    'suar ke bacche': 0.92,
  };

  private threatMarkers: Record<string, number> = {
    'i know where you live': 0.95,
    'watch your back': 0.85,
    'you will regret this': 0.75,
    'hope you die': 0.96,
    'slit your': 0.98,
    'hunt you down': 0.92,
    'beat you up': 0.88,
    'leak your': 0.90,
    'swat': 0.92,
    // Hindi Threat & Violent Assault Markers
    'jaan se maar dunga': 0.99,
    'maar dalunga': 0.98,
    'mar dalunga': 0.97,
    'gaand tod dunga': 0.96,
    'gand tod dunga': 0.96,
    'ghar aake marunga': 0.96,
    'pel dunga': 0.92,
  };

  private identityMarkers: Record<string, number> = {
    'go back to your country': 0.95,
    'people like you': 0.60,
    'your kind': 0.70,
    // Hindi Identity & Slur Markers
    'chakka': 0.97,
    'hijra': 0.96,
    'chamar': 0.98,
    'bhangi': 0.98,
    'katwe': 0.97,
  };

  analyzeMessage(message: string): AIModerationResult {
    const msgLower = message.toLowerCase().trim();
    let toxicity = 0.0;
    let harassment = 0.0;
    let personal_attack = 0.0;
    let threat = 0.0;
    let identity_attack = 0.0;
    let sexual = 0.0;
    let severe_toxicity = 0.0;

    for (const [marker, weight] of Object.entries(this.hostilityMarkers)) {
      if (msgLower.includes(marker)) {
        toxicity = Math.max(toxicity, weight);
        harassment = Math.max(harassment, weight * 0.95);
        personal_attack = Math.max(personal_attack, weight * 0.9);
      }
    }

    for (const [marker, weight] of Object.entries(this.threatMarkers)) {
      if (msgLower.includes(marker)) {
        threat = Math.max(threat, weight);
        toxicity = Math.max(toxicity, weight * 0.9);
        severe_toxicity = Math.max(severe_toxicity, weight * 0.85);
      }
    }

    for (const [marker, weight] of Object.entries(this.identityMarkers)) {
      if (msgLower.includes(marker)) {
        identity_attack = Math.max(identity_attack, weight);
        toxicity = Math.max(toxicity, weight * 0.9);
      }
    }

    const isTargeted = /\b(you\s*re|you\s*are|u\s*r|ur|you|tu\b|tera\b|teri\b|tujhe\b)\b/.test(msgLower);
    if (isTargeted && (toxicity > 0 || harassment > 0)) {
      personal_attack = Math.min(1.0, personal_attack + 0.15);
      harassment = Math.min(1.0, harassment + 0.10);
    }

    if (/\b(fuck(?:ing|er|ers|ed|s)?|shit(?:ty|head|s)?|bitch(?:es)?|cunt+s?|dick(?:head|s)?|asshole+s?|puss(?:y|ies|is)|twat+s?)\b/.test(msgLower)) {
      toxicity = Math.max(toxicity, 0.78);
      if (msgLower.includes('fuck you') || msgLower.includes('bitch') || msgLower.includes('puss')) {
        personal_attack = Math.max(personal_attack, 0.82);
        harassment = Math.max(harassment, 0.78);
      }
    }

    if (/\b(n+[i1l!|]+g+[e3a4o0u]*[rzkx]*s?|n+[i1l!|]+g+s?|w+[i1l!|]+g+g*[e3a4]+r*s?|f+[a4@]+g+g*[o0i1e3]*t*s?|r+[e3]+t+[a4@]+r+d+(?:ed|s)?)\b/.test(msgLower)) {
      identity_attack = Math.max(identity_attack, 0.96);
      toxicity = Math.max(toxicity, 0.95);
      severe_toxicity = Math.max(severe_toxicity, 0.92);
    }

    // Explicit Hindi pattern amplification in AI Semantic Moderator
    if (/\b(teri\s+maki?\s+chut|tmkc|mkc|bhenchod|behenchod|madarchod|bhosdike|bsdk|bkl|chutiya|gandu|randi|laude|lund)\b/.test(msgLower)) {
      toxicity = Math.max(toxicity, 0.96);
      personal_attack = Math.max(personal_attack, 0.95);
      harassment = Math.max(harassment, 0.94);
      severe_toxicity = Math.max(severe_toxicity, 0.92);
    }

    if (/\b(kys|kill\s+yourself)\b/.test(msgLower)) {
      threat = Math.max(threat, 0.98);
      toxicity = Math.max(toxicity, 0.95);
      severe_toxicity = Math.max(severe_toxicity, 0.92);
    }

    if (/\b(send\s+nudes|porn|horny|xxx|nsfw)\b/.test(msgLower)) {
      sexual = Math.max(sexual, 0.85);
    }

    const scores: Record<string, number> = {
      toxicity: Number(toxicity.toFixed(2)),
      harassment: Number(harassment.toFixed(2)),
      personal_attack: Number(personal_attack.toFixed(2)),
      threat: Number(threat.toFixed(2)),
      identity_attack: Number(identity_attack.toFixed(2)),
      sexual: Number(sexual.toFixed(2)),
      severe_toxicity: Number(severe_toxicity.toFixed(2)),
    };

    let topCategory: string | null = null;
    const maxScore = Math.max(...Object.values(scores));
    if (maxScore > 0.0) {
      for (const [cat, s] of Object.entries(scores)) {
        if (s === maxScore) {
          topCategory = cat;
          break;
        }
      }
    }

    let tier = 'unlikely';
    if (maxScore > 0.89) tier = 'highly_likely';
    else if (maxScore > 0.69) tier = 'likely';
    else if (maxScore > 0.39) tier = 'questionable';

    return {
      scores,
      top_category: topCategory,
      max_confidence: maxScore,
      threshold_tier: tier,
    };
  }
}

const aiModerator = new LocalSemanticModerator();

// ==========================================
// 5. HYBRID SCORER
// ==========================================

const SEVERITY_WEIGHTS: Record<string, number> = {
  none: 0.0,
  low: 0.45,
  medium: 0.70,
  high: 0.88,
  critical: 0.98,
};

class HybridScorer {
  score(ruleRes: RuleResult, aiRes: AIModerationResult, contextBoost = 0.0) {
    const ruleScore = SEVERITY_WEIGHTS[ruleRes.severity] ?? 0.0;
    const aiScore = aiRes.max_confidence;

    let overallScore = 0.0;
    if ((ruleRes.severity === 'critical' || ruleRes.severity === 'high') && ruleScore >= 0.88) {
      overallScore = Math.max(ruleScore, aiScore);
    } else if (ruleRes.is_flagged && aiScore > 0.40) {
      overallScore = Math.min(1.0, ruleScore * 0.5 + aiScore * 0.5 + contextBoost);
    } else if (ruleRes.is_flagged) {
      overallScore = ruleScore;
    } else if (aiScore >= 0.70) {
      overallScore = aiScore;
    } else if (aiScore >= 0.40) {
      overallScore = aiScore * 0.8;
    }

    overallScore = Number(Math.min(1.0, overallScore).toFixed(2));
    const confidence = Number(Math.max(ruleRes.confidence, aiRes.max_confidence).toFixed(2));

    let severity = 'none';
    if (overallScore >= 0.95 || ruleRes.severity === 'critical') severity = 'critical';
    else if (overallScore >= 0.80 || ruleRes.severity === 'high') severity = 'high';
    else if (overallScore >= 0.55 || ruleRes.severity === 'medium') severity = 'medium';
    else if (overallScore >= 0.35 || ruleRes.severity === 'low') severity = 'low';

    const isFlagged = severity !== 'none';
    const combinedCategories = new Set<string>(ruleRes.categories);
    if (aiRes.top_category && aiRes.max_confidence >= 0.50) {
      combinedCategories.add(aiRes.top_category);
    }

    let primaryCategory = 'none';
    const priorityOrder = ['threat', 'slur', 'harassment', 'insult', 'profanity', 'suspicious_url', 'spam'];
    for (const p of priorityOrder) {
      if (combinedCategories.has(p)) {
        primaryCategory = p;
        break;
      }
    }
    if (primaryCategory === 'none' && combinedCategories.size > 0) {
      primaryCategory = Array.from(combinedCategories).sort()[0];
    }

    const reasons: string[] = [];
    for (const r of ruleRes.reasons) {
      reasons.push(`Rule match: ${r}`);
    }
    for (const [cat, val] of Object.entries(aiRes.scores)) {
      if (val >= 0.70) {
        reasons.push(`AI detected strong ${cat.replace('_', ' ')} signals (${Math.round(val * 100)}%)`);
      } else if (val >= 0.45) {
        reasons.push(`AI detected moderate ${cat.replace('_', ' ')} signals (${Math.round(val * 100)}%)`);
      }
    }
    if (contextBoost > 0.0) {
      reasons.push('Escalation pattern detected in surrounding chat context');
    }

    return {
      is_flagged: isFlagged,
      overall_score: overallScore,
      rule_score: Number(ruleScore.toFixed(2)),
      ai_score: Number(aiScore.toFixed(2)),
      severity,
      confidence: isFlagged ? confidence : 0.0,
      primary_category: primaryCategory,
      all_categories: Array.from(combinedCategories).sort(),
      reasons,
      ai_breakdown: aiRes.scores,
    };
  }
}

const hybridScorer = new HybridScorer();

// ==========================================
// 6. PLAYER PROFILER & CONTEXT ANALYZER
// ==========================================

function buildPlayerProfiles(evaluatedMessages: MessageRecord[]): Record<string, PlayerProfile> {
  const playerMsgs: Record<string, MessageRecord[]> = {};
  for (const msg of evaluatedMessages) {
    if (!playerMsgs[msg.player]) playerMsgs[msg.player] = [];
    playerMsgs[msg.player].push(msg);
  }

  const profiles: Record<string, PlayerProfile> = {};
  for (const [player, msgs] of Object.entries(playerMsgs)) {
    const total = msgs.length;
    const flaggedMsgs = msgs.filter((m) => m.is_flagged);
    const flaggedCount = flaggedMsgs.length;

    const critCount = flaggedMsgs.filter((m) => m.severity === 'critical').length;
    const highCount = flaggedMsgs.filter((m) => m.severity === 'high').length;
    const medCount = flaggedMsgs.filter((m) => m.severity === 'medium').length;
    const lowCount = flaggedMsgs.filter((m) => m.severity === 'low').length;

    const categoryCounts: Record<string, number> = {};
    for (const m of flaggedMsgs) {
      for (const c of m.categories) {
        categoryCounts[c] = (categoryCounts[c] || 0) + 1;
      }
    }

    const common = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([cat]) => cat);

    const toxicityScores = msgs
      .map((m) => m.ai_breakdown?.toxicity)
      .filter((v): v is number => typeof v === 'number');
    const avgToxicity =
      toxicityScores.length > 0
        ? Number((toxicityScores.reduce((a, b) => a + b, 0) / toxicityScores.length).toFixed(2))
        : 0.0;

    let tier = 'clean';
    if (critCount > 0 || highCount >= 2) tier = 'high_priority_review';
    else if (flaggedCount >= 3) tier = 'repeated_flags';
    else if (flaggedCount >= 1) tier = 'requires_review';

    profiles[player] = {
      username: player,
      total_messages: total,
      flagged_messages: flaggedCount,
      flagged_percentage: total > 0 ? Number(((flaggedCount / total) * 100).toFixed(1)) : 0.0,
      critical_severity_count: critCount,
      high_severity_count: highCount,
      medium_severity_count: medCount,
      low_severity_count: lowCount,
      average_toxicity: avgToxicity,
      threat_count: categoryCounts.threat || 0,
      harassment_count: categoryCounts.harassment || 0,
      insult_count: categoryCounts.insult || 0,
      spam_count: categoryCounts.spam || 0,
      profanity_count: categoryCounts.profanity || 0,
      common_categories: common,
      review_status_tier: tier,
      first_seen_timestamp: msgs[0]?.timestamp ?? null,
      last_seen_timestamp: msgs[msgs.length - 1]?.timestamp ?? null,
    };
  }

  return profiles;
}

function extractAndAnalyzeContext(
  messages: MessageRecord[],
  targetIdx: number,
  windowSize = 3
): ContextAnalysisResult {
  const total = messages.length;
  if (targetIdx < 0 || targetIdx >= total) {
    throw new Error(`Target index ${targetIdx} is out of bounds (total: ${total})`);
  }

  const startIdx = Math.max(0, targetIdx - windowSize);
  const endIdx = Math.min(total, targetIdx + windowSize + 1);

  const preceding: ContextMessage[] = [];
  for (let i = startIdx; i < targetIdx; i++) {
    const m = messages[i];
    preceding.push({
      line_number: m.line_number,
      timestamp: m.timestamp,
      player: m.player,
      message: m.message,
      is_target: false,
      is_flagged: m.is_flagged,
      severity: m.severity,
    });
  }

  const targetM = messages[targetIdx];
  const target: ContextMessage = {
    line_number: targetM.line_number,
    timestamp: targetM.timestamp,
    player: targetM.player,
    message: targetM.message,
    is_target: true,
    is_flagged: targetM.is_flagged,
    severity: targetM.severity,
  };

  const succeeding: ContextMessage[] = [];
  for (let i = targetIdx + 1; i < endIdx; i++) {
    const m = messages[i];
    succeeding.push({
      line_number: m.line_number,
      timestamp: m.timestamp,
      player: m.player,
      message: m.message,
      is_target: false,
      is_flagged: m.is_flagged,
      severity: m.severity,
    });
  }

  const author = target.player;
  const sameAuthorFlags = preceding.filter((p) => p.player === author && p.is_flagged).length;

  const contextNotes: string[] = [];
  let contextBoost = 0.0;
  let classification = 'isolated_remark';

  if (sameAuthorFlags >= 1) {
    classification = 'repeated_harassment';
    contextNotes.push(`Player ${author} has sent multiple flagged messages in this immediate dialogue sequence.`);
    contextBoost = 0.15;
  }

  const allPlayersInWindow = new Set<string>([
    ...preceding.map((p) => p.player),
    ...succeeding.map((s) => s.player),
  ]);
  const otherPlayers = Array.from(allPlayersInWindow).filter((p) => p !== author);

  const hasDialogueExchange = otherPlayers.length === 1 && preceding.length >= 2;
  if (hasDialogueExchange && target.is_flagged) {
    if (classification === 'repeated_harassment') {
      classification = 'targeted_abuse';
      contextNotes.push(`Targeted hostility concentrated towards ${otherPlayers[0]}.`);
      contextBoost = 0.20;
    } else {
      classification = 'escalation';
      contextNotes.push(`Heated dialogue exchange observed between ${author} and ${otherPlayers[0]}.`);
      contextBoost = 0.10;
    }
  }

  if (!target.is_flagged && sameAuthorFlags === 0) {
    classification = preceding.length > 0 ? 'normal_disagreement' : 'isolated_remark';
  }

  return {
    target_line_number: target.line_number,
    target_player: target.player,
    preceding,
    target,
    succeeding,
    classification,
    context_notes: contextNotes,
    context_boost: contextBoost,
  };
}

// ==========================================
// 7. LOG PARSERS (Minecraft, Discord, CSV, Generic)
// ==========================================

interface RawParsedMessage {
  timestamp: string;
  player: string;
  message: string;
  raw_line: string;
  line_number: number;
  discord_message_url?: string;
}

const NON_CHAT_INDICATORS = [
  'joined the game', 'left the game', 'lost connection', 'logged in with entity id',
  'issued server command:', 'UUID of player', 'fell from a high place', 'was slain by',
  'drowned', 'burned to death', 'was shot by', 'hit the ground too hard',
  'tried to swim in lava', 'suffocated in a wall', 'was blown up by',
  'Starting minecraft server', 'Loading properties', 'Default game type:',
  'Generating keypair', 'Starting Minecraft server on', 'Using default channel type',
  'Preparing level', 'Preparing start region', 'Time elapsed:', 'Done (',
  'Stopping server', 'Saving players', 'Saving worlds', 'Closing Server',
];

function cleanPlayerName(rawPlayer: string): string {
  return rawPlayer
    .trim()
    .replace(/^\[[^\]]+\]\s*/, '')
    .replace(/\s*\[[^\]]+\]$/, '')
    .trim();
}

function parseMinecraftLines(lines: string[]): { messages: RawParsedMessage[]; errors: ParseErrorRecord[] } {
  const messages: RawParsedMessage[] = [];
  const errors: ParseErrorRecord[] = [];
  const LINE_PATTERN = /^(?:\[([^\]]+)\](?:\s*\[([^\]]+)\])?|(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s+\[([^\]]+)\])\s*:?\s*(.*)$/;
  const CHAT_PATTERN = /^(?:\[[^\]]+\]\s*)?<([a-zA-Z0-9_]{2,16}|\[[^\]]+\]\s*[a-zA-Z0-9_]{2,16})>\s*(.*)$/;
  const WHISPER_PATTERN = /^([a-zA-Z0-9_]{2,16})\s+whispers\s+to\s+[a-zA-Z0-9_]{2,16}\s*:\s*(.*)$/i;
  const WHISPER_ARROW_PATTERN = /^\[([a-zA-Z0-9_]{2,16})\s*->\s*[a-zA-Z0-9_]{2,16}\]\s*(.*)$/;

  lines.forEach((rawLine, index) => {
    const lineNum = index + 1;
    const lineStr = rawLine.replace(/\r?\n$/, '');
    if (!lineStr.trim()) return;

    const m = LINE_PATTERN.exec(lineStr);
    if (!m) {
      const chatDirect = CHAT_PATTERN.exec(lineStr);
      if (chatDirect) {
        messages.push({
          timestamp: 'Unknown',
          player: cleanPlayerName(chatDirect[1]),
          message: chatDirect[2].trim(),
          raw_line: lineStr,
          line_number: lineNum,
        });
      }
      return;
    }

    let timestamp = m[1] || m[3] || 'Unknown';
    if (timestamp.includes(' ') && (timestamp.includes('INFO') || timestamp.includes('WARN') || timestamp.includes('ERROR'))) {
      timestamp = timestamp.split(/\s+/)[0];
    }
    const content = (m[5] || '').trim();

    const chatMatch = CHAT_PATTERN.exec(content);
    if (chatMatch) {
      messages.push({
        timestamp,
        player: cleanPlayerName(chatMatch[1]),
        message: chatMatch[2],
        raw_line: lineStr,
        line_number: lineNum,
      });
      return;
    }

    const whisperMatch = WHISPER_PATTERN.exec(content) || WHISPER_ARROW_PATTERN.exec(content);
    if (whisperMatch) {
      messages.push({
        timestamp,
        player: cleanPlayerName(whisperMatch[1]),
        message: whisperMatch[2],
        raw_line: lineStr,
        line_number: lineNum,
      });
      return;
    }

    if (content.includes('<') && content.includes('>') && !NON_CHAT_INDICATORS.some((ind) => content.includes(ind))) {
      const looseMatch = /<([^>]+)>\s*(.*)$/.exec(content);
      if (looseMatch) {
        const player = cleanPlayerName(looseMatch[1]);
        if (player) {
          messages.push({
            timestamp,
            player,
            message: looseMatch[2],
            raw_line: lineStr,
            line_number: lineNum,
          });
        }
      }
    }
  });

  return { messages, errors };
}

function parseDiscordLines(lines: string[]): { messages: RawParsedMessage[]; errors: ParseErrorRecord[] } {
  const messages: RawParsedMessage[] = [];
  const errors: ParseErrorRecord[] = [];
  const TIMESTAMP_HEADER = /^\[(\d{2}-\d{2}-\d{4})\s+(\d{1,2}[.:]\d{2}(?:\s*[AP]M)?)\]\s+\S+/i;
  const CHAT_LINE = /^(?:\*\*[^*]+\*\*\s+)?(?:[A-Z][A-Z0-9_]{1,15}\s+)?([^\s\u00bb]{1,32})\s+\u00bb\s+(.+)$/;
  const HEADER_LINE = /^(={3,}|Guild:|Channel:|Topic:|After:|\*\*\*)/;
  const SERVER_EVENTS = /(joined the server|left the server|joined the server for the first time)/i;

  let currentTs = 'Unknown';
  let inEmbed = false;

  lines.forEach((rawLine, index) => {
    const lineNum = index + 1;
    const line = rawLine.replace(/\r?\n$/, '');
    const stripped = line.trim();

    if (!stripped) {
      inEmbed = false;
      return;
    }
    if (HEADER_LINE.test(stripped)) return;

    const tsM = TIMESTAMP_HEADER.exec(stripped);
    if (tsM) {
      currentTs = `${tsM[1]} ${tsM[2].replace('.', ':')}`;
      inEmbed = false;
      return;
    }

    if (stripped === '{Embed}') {
      inEmbed = true;
      return;
    }

    if (inEmbed || SERVER_EVENTS.test(stripped)) return;

    const chatM = CHAT_LINE.exec(stripped);
    if (chatM) {
      const player = chatM[1].trim();
      const message = chatM[2].trim();
      if (player && message) {
        messages.push({
          timestamp: currentTs,
          player,
          message,
          raw_line: line,
          line_number: lineNum,
        });
      }
    }
  });

  return { messages, errors };
}

function parseGenericLines(lines: string[]): { messages: RawParsedMessage[]; errors: ParseErrorRecord[] } {
  const messages: RawParsedMessage[] = [];
  const errors: ParseErrorRecord[] = [];
  const GENERIC_PATTERN = /^(?:\[([^\]]+)\]\s*|(\d{2}:\d{2}(?::\d{2})?)\s+)?(?:<([^>]+)>|([a-zA-Z0-9_\-.]{2,20}))\s*[:>]\s*(.*)$/;

  lines.forEach((rawLine, index) => {
    const lineNum = index + 1;
    const lineStr = rawLine.replace(/\r?\n$/, '');
    if (!lineStr.trim()) return;

    const m = GENERIC_PATTERN.exec(lineStr);
    if (!m) return;
    const timestamp = m[1] || m[2] || 'Unknown';
    const player = (m[3] || m[4] || '').trim();
    const message = m[5] || '';
    if (player && message) {
      messages.push({
        timestamp,
        player,
        message,
        raw_line: lineStr,
        line_number: lineNum,
      });
    }
  });

  return { messages, errors };
}

function splitCsvRow(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function parseCsvLines(lines: string[]): { messages: RawParsedMessage[]; errors: ParseErrorRecord[] } {
  const messages: RawParsedMessage[] = [];
  const errors: ParseErrorRecord[] = [];
  let header: string[] | null = null;

  lines.forEach((rawLine, index) => {
    const lineNum = index + 1;
    const lineStr = rawLine.replace(/\r?\n$/, '');
    if (!lineStr.trim()) return;

    const row = splitCsvRow(lineStr);
    if (!row.some((f) => f.trim())) return;

    if (!header) {
      header = row.map((col) => col.trim().toLowerCase());
      return;
    }

    try {
      let tsIdx = -1;
      let playerIdx = -1;
      let msgIdx = -1;

      header.forEach((colName, i) => {
        if (['timestamp', 'time', 'date', 'datetime'].includes(colName)) tsIdx = i;
        else if (['player', 'user', 'username', 'author', 'sender'].includes(colName)) playerIdx = i;
        else if (['message', 'text', 'content', 'msg'].includes(colName)) msgIdx = i;
      });

      if (playerIdx === -1 || msgIdx === -1) {
        throw new Error(`CSV missing player or message column in header: ${header.join(', ')}`);
      }
      if (playerIdx >= row.length || msgIdx >= row.length) {
        throw new Error('Row has fewer columns than header requires');
      }

      const timestamp = tsIdx !== -1 && tsIdx < row.length ? row[tsIdx].trim() : 'Unknown';
      const player = row[playerIdx].trim();
      const message = row[msgIdx].trim();
      if (!player || !message) return;

      messages.push({
        timestamp,
        player,
        message,
        raw_line: lineStr,
        line_number: lineNum,
      });
    } catch (e: any) {
      errors.push({
        line_number: lineNum,
        raw_line: lineStr,
        reason: e?.message || String(e),
      });
    }
  });

  return { messages, errors };
}

class ParserManager {
  currentMessages: MessageRecord[] = [];
  currentProfiles: Record<string, PlayerProfile> = {};

  detectFormat(lines: string[], filename: string): string {
    if (filename.toLowerCase().endsWith('.csv')) return 'csv';
    const sample = lines.slice(0, 100).map((l) => l.trim()).filter(Boolean);
    if (sample.some((l) => l.includes('\u00bb'))) return 'discord';

    if (sample.length > 0) {
      const header = sample[0].toLowerCase();
      if (
        (header.includes('player') || header.includes('user') || header.includes('author')) &&
        (header.includes('message') || header.includes('text') || header.includes('content'))
      ) {
        return 'csv';
      }
    }

    const mcRegex = /^(?:\[([^\]]+)\](?:\s*\[([^\]]+)\])?|(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s+\[([^\]]+)\])\s*:?\s*(.*)$/;
    const mcMatches = sample.slice(0, 20).filter((l) => mcRegex.test(l)).length;
    if (mcMatches >= 2) return 'minecraft';

    const genRegex = /^(?:\[([^\]]+)\]\s*|(\d{2}:\d{2}(?::\d{2})?)\s+)?(?:<([^>]+)>|([a-zA-Z0-9_\-.]{2,20}))\s*[:>]\s*(.*)$/;
    const genMatches = sample.slice(0, 20).filter((l) => genRegex.test(l)).length;
    if (genMatches >= 2) return 'generic';

    return 'minecraft';
  }

  evaluateRawMessages(
    sourceName: string,
    fileSizeBytes: number,
    totalLines: number,
    detectedFormat: string,
    rawMessages: RawParsedMessage[],
    errors: ParseErrorRecord[]
  ): LogParseResponse {
    const evaluatedMessages: MessageRecord[] = [];
    const severityCounts: Record<string, number> = {};
    const categoryCounts: Record<string, number> = {};
    let flaggedCount = 0;
    let critCount = 0;
    let highCount = 0;

    rawMessages.forEach((msg, idx) => {
      const ruleEval = ruleEngine.evaluate(msg.message);
      const aiEval = aiModerator.analyzeMessage(msg.message);
      const hybridEval = hybridScorer.score(ruleEval, aiEval);

      if (hybridEval.is_flagged) {
        flaggedCount++;
        severityCounts[hybridEval.severity] = (severityCounts[hybridEval.severity] || 0) + 1;
        if (hybridEval.severity === 'critical') critCount++;
        else if (hybridEval.severity === 'high') highCount++;

        for (const cat of hybridEval.all_categories) {
          categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
        }
      }

      evaluatedMessages.push({
        id: idx,
        timestamp: msg.timestamp,
        player: msg.player,
        message: msg.message,
        raw_line: msg.raw_line,
        line_number: msg.line_number,
        discord_message_url: msg.discord_message_url,
        is_flagged: hybridEval.is_flagged,
        overall_score: hybridEval.overall_score,
        rule_score: hybridEval.rule_score,
        ai_score: hybridEval.ai_score,
        severity: hybridEval.severity,
        confidence: hybridEval.confidence,
        primary_category: hybridEval.primary_category,
        categories: hybridEval.all_categories,
        reasons: hybridEval.reasons,
        ai_breakdown: hybridEval.ai_breakdown,
        review_status: 'unreviewed',
        moderator_notes: '',
      });
    });

    this.currentMessages = evaluatedMessages;
    this.currentProfiles = buildPlayerProfiles(evaluatedMessages);
    const uniquePlayers = Object.keys(this.currentProfiles).sort();

    // Extract dates and timeline range
    const dateSet = new Set<string>();
    let earliestTs: string | null = null;
    let latestTs: string | null = null;
    let earliestMs = Infinity;
    let latestMs = -Infinity;

    for (const m of evaluatedMessages) {
      const dStr = extractDateString(m.timestamp);
      if (dStr) dateSet.add(dStr);
      const ms = parseTimestampToMillis(m.timestamp);
      if (ms !== null) {
        if (ms < earliestMs) {
          earliestMs = ms;
          earliestTs = m.timestamp;
        }
        if (ms > latestMs) {
          latestMs = ms;
          latestTs = m.timestamp;
        }
      }
    }

    const availableDates = Array.from(dateSet).sort();

    return {
      file_name: sourceName,
      file_size_bytes: fileSizeBytes,
      lines_processed: totalLines,
      messages_detected: evaluatedMessages.length,
      unique_players_count: uniquePlayers.length,
      unique_players: uniquePlayers,
      detected_format: detectedFormat,
      parsing_errors: errors,
      flagged_messages_count: flaggedCount,
      critical_severity_count: critCount,
      high_severity_count: highCount,
      severity_breakdown: severityCounts,
      category_breakdown: categoryCounts,
      player_profiles: this.currentProfiles,
      messages_preview: evaluatedMessages,
      earliest_timestamp: earliestTs,
      latest_timestamp: latestTs,
      available_dates: availableDates,
    };
  }

  processFileContent(filename: string, content: string, parserOverride?: string): LogParseResponse {
    const lines = content.split(/\r?\n/);
    const totalLines = lines.length;
    const fileSizeBytes = Buffer.byteLength(content, 'utf-8');

    const validFormats = ['minecraft', 'discord', 'csv', 'generic'];
    const detectedFormat =
      parserOverride && validFormats.includes(parserOverride)
        ? parserOverride
        : this.detectFormat(lines, filename);

    let parsed: { messages: RawParsedMessage[]; errors: ParseErrorRecord[] };
    if (detectedFormat === 'discord') parsed = parseDiscordLines(lines);
    else if (detectedFormat === 'csv') parsed = parseCsvLines(lines);
    else if (detectedFormat === 'generic') parsed = parseGenericLines(lines);
    else parsed = parseMinecraftLines(lines);

    return this.evaluateRawMessages(
      filename,
      fileSizeBytes,
      totalLines,
      detectedFormat,
      parsed.messages,
      parsed.errors
    );
  }

  getMessageContext(msgId: number, windowSize = 3): ContextAnalysisResult {
    if (!this.currentMessages.length) {
      throw new Error('No active log dataset loaded.');
    }
    return extractAndAnalyzeContext(this.currentMessages, msgId, windowSize);
  }

  updateMessageAction(msgId: number, action: string, notes?: string): MessageRecord {
    if (msgId < 0 || msgId >= this.currentMessages.length) {
      throw new Error(`Message ID ${msgId} not found.`);
    }
    const msg = this.currentMessages[msgId];
    msg.review_status = action;
    if (notes !== undefined) {
      msg.moderator_notes = notes;
    }
    this.currentMessages[msgId] = msg;
    return msg;
  }
}

const parserManager = new ParserManager();

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchDiscordWithToken(
  url: string,
  rawToken: string,
  onRateLimit?: (waitMs: number) => void
): Promise<Response> {
  const cleanToken = rawToken.trim();

  const doRequest = async (authHeader: string): Promise<Response> => {
    for (let attempt = 0; attempt < 6; attempt++) {
      const res = await fetch(url, {
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
          'User-Agent': 'DiscordBot (https://discord.com, 10)',
        },
      });
      if (res.status === 429) {
        const body: any = await res.json().catch(() => ({}));
        const retrySec = Number(body?.retry_after) || Number(res.headers.get('retry-after')) || 1.5;
        const waitMs = Math.min(15000, Math.ceil(retrySec * 1000) + 150);
        if (onRateLimit) onRateLimit(waitMs);
        await sleep(waitMs);
        if (onRateLimit) onRateLimit(0);
        continue;
      }
      return res;
    }
    return fetch(url, {
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
        'User-Agent': 'DiscordBot (https://discord.com, 10)',
      },
    });
  };

  let res = await doRequest(cleanToken);

  if (res.status === 401) {
    const altAuth = cleanToken.toLowerCase().startsWith('bot ')
      ? cleanToken.slice(4).trim()
      : `Bot ${cleanToken}`;
    res = await doRequest(altAuth);
  }
  return res;
}

interface DiscordFetchJobState {
  status: 'idle' | 'fetching' | 'analyzing' | 'completed' | 'error';
  fetched: number;
  target: number;
  mode: 'date' | 'limit';
  channelName: string;
  rateLimitWaitMs: number;
  stopRequested: boolean;
  result: LogParseResponse | null;
  error: string | null;
}

const discordFetchJob: DiscordFetchJobState = {
  status: 'idle',
  fetched: 0,
  target: 0,
  mode: 'limit',
  channelName: '',
  rateLimitWaitMs: 0,
  stopRequested: false,
  result: null,
  error: null,
};

function inferGamemodeFromChannel(channelName: string): string {
  const lower = channelName.toLowerCase();
  if (lower.includes('lifesteal')) return 'Lifesteal';
  if (lower.includes('boxpvp') || lower.includes('box')) return 'BoxPvP';
  if (lower.includes('skyblock')) return 'Skyblock';
  if (lower.includes('survival')) return 'Survival';
  if (lower.includes('factions')) return 'Factions';
  if (lower.includes('prison')) return 'Prison';
  if (lower.includes('bedwars')) return 'BedWars';
  if (lower.includes('practice') || lower.includes('pvp')) return 'Practice';
  return 'SMP';
}

function processDiscordMessagesArray(
  channelName: string,
  allDiscordMessages: any[],
  guildId?: string,
  channelId?: string
): LogParseResponse {
  const ordered = [...allDiscordMessages].reverse();

  const BRIDGE_LINE = /^(?:\*\*[^*]+\*\*\s+)?(?:[A-Z][A-Z0-9_]{1,15}\s+)?([^\s\u00bb]{1,32})\s+(?:\u00bb|>>)\s+(.+)$/;
  const MC_BRACKET_LINE = /^(?:\[[^\]]+\]\s*)?<([^>]+)>\s*(.+)$/;
  const SERVER_EVENT = /(joined the server|left the server|joined the game|left the game)/i;

  const rawParsed: RawParsedMessage[] = [];
  let rawBytes = 0;

  ordered.forEach((dMsg, index) => {
    const content = String(dMsg.content || '').trim();
    if (!content || SERVER_EVENT.test(content)) return;

    const isoTs = dMsg.timestamp ? new Date(dMsg.timestamp) : null;
    const formattedTs =
      isoTs && !isNaN(isoTs.getTime())
        ? isoTs.toISOString().replace('T', ' ').slice(0, 19)
        : 'Unknown';

    const resolvedChannelId = channelId || dMsg.channel_id || '';
    const resolvedGuildId = guildId || dMsg.guild_id || '@me';
    const messageUrl =
      resolvedChannelId && dMsg.id
        ? `https://discord.com/channels/${resolvedGuildId}/${resolvedChannelId}/${dMsg.id}`
        : undefined;

    const subLines = content.split(/\r?\n/);
    for (const sub of subLines) {
      const trimmedSub = sub.trim();
      if (!trimmedSub || SERVER_EVENT.test(trimmedSub)) continue;

      let player = dMsg.author?.global_name || dMsg.author?.username || 'Unknown';
      let messageBody = trimmedSub;

      const bridgeMatch = BRIDGE_LINE.exec(trimmedSub);
      const mcMatch = MC_BRACKET_LINE.exec(trimmedSub);
      if (bridgeMatch) {
        player = bridgeMatch[1].trim();
        messageBody = bridgeMatch[2].trim();
      } else if (mcMatch) {
        player = cleanPlayerName(mcMatch[1]);
        messageBody = mcMatch[2].trim();
      }

      const rawLine = `[${formattedTs}] ${player} » ${messageBody}`;
      rawBytes += Buffer.byteLength(rawLine, 'utf-8');

      rawParsed.push({
        timestamp: formattedTs,
        player,
        message: messageBody,
        raw_line: rawLine,
        line_number: index + 1,
        discord_message_url: messageUrl,
      });
    }
  });

  const result = parserManager.evaluateRawMessages(
    channelName,
    rawBytes,
    ordered.length,
    'discord_token',
    rawParsed,
    []
  );
  return {
    ...result,
    guild_id: guildId,
    channel_id: channelId,
    detected_gamemode: inferGamemodeFromChannel(channelName),
    messages_preview: [],
  };
}

// ==========================================
// 7B. SMART SCAN MEMORY VAULT (PERSISTENT DELTA CACHE)
// ==========================================

interface ChannelMemoryCacheRecord {
  channel_id: string;
  channel_name: string;
  guild_id?: string;
  detected_gamemode?: string;
  last_synced_at: string;
  newest_message_id?: string;
  raw_discord_messages: any[];
  cached_summary: {
    cached_messages_count: number;
    flagged_messages_count: number;
    critical_severity_count: number;
    high_severity_count: number;
  };
}

const channelMemoryCache = new Map<string, ChannelMemoryCacheRecord>();

function getChannelMemoryFilePath(channelId: string): string {
  const safeId = channelId.replace(/[^a-zA-Z0-9_-]/g, '');
  return path.join(SCAN_MEMORY_DIR, `channel_${safeId}.json`);
}

function loadAllChannelMemoriesFromDisk() {
  try {
    if (!fs.existsSync(SCAN_MEMORY_DIR)) return;
    const files = fs.readdirSync(SCAN_MEMORY_DIR).filter((f) => f.startsWith('channel_') && f.endsWith('.json'));
    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(SCAN_MEMORY_DIR, file), 'utf-8');
        const parsed: ChannelMemoryCacheRecord = JSON.parse(raw);
        if (parsed && parsed.channel_id && Array.isArray(parsed.raw_discord_messages)) {
          channelMemoryCache.set(parsed.channel_id, parsed);
        }
      } catch {
        // ignore corrupt cache file
      }
    }
  } catch {
    // ignore
  }
}

loadAllChannelMemoriesFromDisk();

function saveChannelMemoryToDisk(record: ChannelMemoryCacheRecord) {
  channelMemoryCache.set(record.channel_id, record);
  try {
    // Keep up to 30,000 most recent Discord messages on disk per channel for instant reload
    const toSave: ChannelMemoryCacheRecord = {
      ...record,
      raw_discord_messages: record.raw_discord_messages.slice(0, 30000),
    };
    fs.writeFileSync(getChannelMemoryFilePath(record.channel_id), JSON.stringify(toSave), 'utf-8');
  } catch {
    // ignore disk write error
  }
}

function deleteChannelMemory(channelId: string) {
  channelMemoryCache.delete(channelId);
  try {
    const p = getChannelMemoryFilePath(channelId);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch {
    // ignore
  }
}

// ==========================================
// 7C. LIVE CHAT MODERATION RADAR & ALERT STREAM
// ==========================================

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
  severity: string;
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

interface LiveMonitorState {
  running: boolean;
  mode: 'all' | 'single';
  token: string;
  channel_id: string;
  channel_name: string;
  guild_id?: string;
  monitored_channels: MonitoredChannelLiveState[];
  poll_interval_ms: number;
  started_at: string | null;
  last_polled_at: string | null;
  last_seen_discord_id: string | null;
  total_seen_live: number;
  total_flagged_live: number;
  error: string | null;
  recent_messages: LiveFeedAlertItem[];
  active_alerts: LiveFeedAlertItem[];
  timer: ReturnType<typeof setInterval> | null;
  is_polling: boolean;
}

const DEFAULT_FALLBACK_GAMEMODES: Record<string, { label: string; gamemode: string }> = {
  '1474488688812495094': { label: '#lifesteal-chat', gamemode: 'Lifesteal' },
  '1473478972816752650': { label: '#survival-chat', gamemode: 'Survival' },
  '1473793765008343285': { label: '#skyblock-chat', gamemode: 'Skyblock' },
  '1473814315948834973': { label: '#bedwars-chat', gamemode: 'Bedwars' },
  '1484703765629243423': { label: '#pvp-arena-chat', gamemode: 'PvP' },
  '1546730982525116497': { label: '#global-lobby-chat', gamemode: 'Lobby' },
};

function buildInitialMonitoredChannelsList(): MonitoredChannelLiveState[] {
  return sessionState.preset_channels.map((p) => {
    const cached = channelMemoryCache.get(p.channel_id);
    const fb = DEFAULT_FALLBACK_GAMEMODES[p.channel_id];
    const resolvedName =
      p.name && !p.name.startsWith('Channel ')
        ? p.name
        : cached?.channel_name || fb?.label || p.name;
    const gm =
      cached?.detected_gamemode ||
      inferGamemodeFromChannel(resolvedName) ||
      fb?.gamemode ||
      'SMP';
    return {
      channel_id: p.channel_id,
      channel_name: resolvedName,
      guild_id: p.guild_id || '1250416860000817162',
      detected_gamemode: gm,
      status: 'standby',
      last_message_id: cached?.newest_message_id || '',
      last_polled_at: null,
      messages_seen: 0,
      flags_detected: 0,
    };
  });
}

const liveMonitor: LiveMonitorState = {
  running: false,
  mode: 'all',
  token: '',
  channel_id: 'all',
  channel_name: 'All Working Channels',
  guild_id: '1250416860000817162',
  monitored_channels: buildInitialMonitoredChannelsList(),
  poll_interval_ms: 4000,
  started_at: null,
  last_polled_at: null,
  last_seen_discord_id: null,
  total_seen_live: 0,
  total_flagged_live: 0,
  error: null,
  recent_messages: [],
  active_alerts: [],
  timer: null,
  is_polling: false,
};

function evaluateSingleLiveLine(
  dMsgId: string,
  channelId: string,
  channelName: string,
  guildId: string | undefined,
  timestamp: string,
  player: string,
  messageBody: string,
  detectedGamemode?: string
): LiveFeedAlertItem {
  const ruleEval = ruleEngine.evaluate(messageBody);
  const aiEval = aiModerator.analyzeMessage(messageBody);
  const hybridEval = hybridScorer.score(ruleEval, aiEval);

  const messageUrl =
    channelId && dMsgId
      ? `https://discord.com/channels/${guildId || '1250416860000817162'}/${channelId}/${dMsgId}`
      : undefined;

  const gm =
    detectedGamemode ||
    inferGamemodeFromChannel(channelName) ||
    DEFAULT_FALLBACK_GAMEMODES[channelId]?.gamemode ||
    'SMP';

  // Also append to active parserManager.currentMessages so the main Review Queue stays in sync!
  const newRecordId = parserManager.currentMessages.length;
  const newLineNum =
    (parserManager.currentMessages[parserManager.currentMessages.length - 1]?.line_number || 0) + 1;
  const fullRecord: MessageRecord = {
    id: newRecordId,
    timestamp,
    player,
    message: messageBody,
    raw_line: `[${timestamp}] [${channelName}] ${player} » ${messageBody}`,
    line_number: newLineNum,
    discord_message_url: messageUrl,
    is_flagged: hybridEval.is_flagged,
    overall_score: hybridEval.overall_score,
    rule_score: hybridEval.rule_score,
    ai_score: hybridEval.ai_score,
    severity: hybridEval.severity,
    confidence: hybridEval.confidence,
    primary_category: hybridEval.primary_category,
    categories: hybridEval.all_categories,
    reasons: hybridEval.reasons,
    ai_breakdown: hybridEval.ai_breakdown,
    review_status: 'unreviewed',
    moderator_notes: '',
  };
  parserManager.currentMessages.push(fullRecord);
  parserManager.currentProfiles = buildPlayerProfiles(parserManager.currentMessages);

  return {
    id: `${dMsgId}-${Math.random().toString(36).slice(2, 7)}`,
    discord_message_id: dMsgId,
    channel_id: channelId,
    channel_name: channelName,
    guild_id: guildId,
    detected_gamemode: gm,
    timestamp,
    received_at: new Date().toISOString().replace('T', ' ').slice(11, 19),
    player,
    message: messageBody,
    discord_message_url: messageUrl,
    is_flagged: hybridEval.is_flagged,
    severity: hybridEval.severity,
    confidence: hybridEval.confidence,
    overall_score: hybridEval.overall_score,
    primary_category: hybridEval.primary_category,
    categories: hybridEval.all_categories,
    reasons: hybridEval.reasons,
    acknowledged: false,
  };
}

async function pollSingleChannelInMonitor(chanState: MonitoredChannelLiveState) {
  if (!liveMonitor.running || !liveMonitor.token) return;
  try {
    const query = new URLSearchParams({ limit: '20' });
    if (chanState.last_message_id) {
      query.set('after', chanState.last_message_id);
    }
    const url = `https://discord.com/api/v10/channels/${chanState.channel_id}/messages?${query.toString()}`;
    const res = await fetchDiscordWithToken(url, liveMonitor.token);
    const nowTime = new Date().toISOString().replace('T', ' ').slice(11, 19);
    chanState.last_polled_at = nowTime;
    liveMonitor.last_polled_at = nowTime;

    if (res.status === 429) {
      chanState.status = 'rate_limited';
      chanState.status_detail = 'Rate limited by Discord, backing off';
      return;
    }

    if (!res.ok) {
      const errBody: any = await res.json().catch(() => ({}));
      chanState.status = 'unreachable';
      chanState.status_detail = `HTTP ${res.status}: ${errBody?.message || 'Inaccessible'}`;
      return;
    }

    chanState.status = 'working';
    chanState.status_detail = 'Live stream active';
    const batch: any[] = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) return;

    // Discord returns newest first; reverse to process chronologically
    const chronological = [...batch].reverse();
    const BRIDGE_LINE = /^(?:\*\*[^*]+\*\*\s+)?(?:[A-Z][A-Z0-9_]{1,15}\s+)?([^\s\u00bb]{1,32})\s+(?:\u00bb|>>)\s+(.+)$/;
    const MC_BRACKET_LINE = /^(?:\[[^\]]+\]\s*)?<([^>]+)>\s*(.+)$/;
    const SERVER_EVENT = /(joined the server|left the server|joined the game|left the game)/i;

    // If this was the very first seed poll on this channel, take up to last 5 messages per channel so multi-channel doesn't flood
    const maxSeed = liveMonitor.mode === 'all' ? 5 : 10;
    const toProcess = !chanState.last_message_id ? chronological.slice(-maxSeed) : chronological;
    chanState.last_message_id = String(batch[0].id);

    // Prepend new Discord messages into Smart Memory Cache if this channel is cached
    const cachedChan = channelMemoryCache.get(chanState.channel_id);
    if (cachedChan) {
      const existingIds = new Set(cachedChan.raw_discord_messages.map((m) => String(m.id)));
      const brandNewRaw = batch.filter((m) => !existingIds.has(String(m.id)));
      if (brandNewRaw.length > 0) {
        cachedChan.raw_discord_messages = [...brandNewRaw, ...cachedChan.raw_discord_messages];
        cachedChan.newest_message_id = String(batch[0].id);
        cachedChan.last_synced_at = new Date().toISOString().replace('T', ' ').slice(0, 19);
        saveChannelMemoryToDisk(cachedChan);
      }
    }

    for (const dMsg of toProcess) {
      const content = String(dMsg.content || '').trim();
      if (!content || SERVER_EVENT.test(content)) continue;
      const isoTs = dMsg.timestamp ? new Date(dMsg.timestamp) : null;
      const formattedTs =
        isoTs && !isNaN(isoTs.getTime())
          ? isoTs.toISOString().replace('T', ' ').slice(0, 19)
          : new Date().toISOString().replace('T', ' ').slice(0, 19);

      const subLines = content.split(/\r?\n/);
      for (const sub of subLines) {
        const trimmedSub = sub.trim();
        if (!trimmedSub || SERVER_EVENT.test(trimmedSub)) continue;

        let player = dMsg.author?.global_name || dMsg.author?.username || 'Unknown';
        let messageBody = trimmedSub;

        const bridgeMatch = BRIDGE_LINE.exec(trimmedSub);
        const mcMatch = MC_BRACKET_LINE.exec(trimmedSub);
        if (bridgeMatch) {
          player = bridgeMatch[1].trim();
          messageBody = bridgeMatch[2].trim();
        } else if (mcMatch) {
          player = cleanPlayerName(mcMatch[1]);
          messageBody = mcMatch[2].trim();
        }

        const item = evaluateSingleLiveLine(
          String(dMsg.id),
          chanState.channel_id,
          chanState.channel_name,
          chanState.guild_id,
          formattedTs,
          player,
          messageBody,
          chanState.detected_gamemode
        );

        chanState.messages_seen++;
        liveMonitor.total_seen_live++;
        liveMonitor.recent_messages.unshift(item);
        if (liveMonitor.recent_messages.length > 250) {
          liveMonitor.recent_messages.length = 250;
        }

        if (item.is_flagged) {
          chanState.flags_detected++;
          liveMonitor.total_flagged_live++;
          liveMonitor.active_alerts.unshift(item);
          if (liveMonitor.active_alerts.length > 150) {
            liveMonitor.active_alerts.length = 150;
          }
        }
      }
    }
  } catch (err: any) {
    chanState.status = 'unreachable';
    chanState.status_detail = err?.message || 'Poll error';
  }
}

async function pollLiveDiscordChannelOnce() {
  if (!liveMonitor.running || !liveMonitor.token || liveMonitor.is_polling) return;
  liveMonitor.is_polling = true;
  try {
    const activeTargets = liveMonitor.monitored_channels.filter(
      (c) => c.status !== 'unreachable'
    );
    if (activeTargets.length === 0) {
      liveMonitor.error = 'No reachable Discord channels found with the current token.';
      return;
    }
    liveMonitor.error = null;
    for (const ch of activeTargets) {
      if (!liveMonitor.running) break;
      await pollSingleChannelInMonitor(ch);
      // Small stagger between channels to avoid Discord burst rate limits
      if (activeTargets.length > 1) {
        await new Promise((r) => setTimeout(r, 180));
      }
    }
  } catch (err: any) {
    liveMonitor.error = err?.message || 'Live multi-channel polling error';
  } finally {
    liveMonitor.is_polling = false;
  }
}

// ==========================================
// 8. AUTOMATED /STAFF LOG PUNISHMENT + MODAL SUBMITTER
// ==========================================

const punishmentsStore: PunishmentRecord[] = [];
let nextPunishmentId = 1;

interface DiscoveredCommandInfo {
  candidates: any[];
  allCommandNames: string[];
}

function scoreCommandCandidate(c: any, actionMode: 'log' | 'request' = 'log'): number {
  if (!c) return -1;
  const name = String(c?.name || '').toLowerCase();
  const opts: any[] = Array.isArray(c?.options) ? c.options : [];
  const hasTargetGroup = opts.some(
    (o) => o?.type === 2 && String(o?.name || '').toLowerCase() === actionMode
  );
  const hasLogOrReqGroup = opts.some(
    (o) =>
      o?.type === 2 &&
      (String(o?.name || '').toLowerCase() === 'log' ||
        String(o?.name || '').toLowerCase() === 'request')
  );
  const hasPunishSub = opts.some(
    (o) =>
      String(o?.name || '').toLowerCase().includes('punish') ||
      (Array.isArray(o?.options) &&
        o.options.some((so: any) => String(so?.name || '').toLowerCase().includes('punish')))
  );

  let score = 0;
  if (name === 'staff') score += 100;
  if (hasTargetGroup) score += 75;
  else if (hasLogOrReqGroup) score += 55;
  if (hasPunishSub) score += 50;
  if (name.includes('staff')) score += 25;
  if (name.includes('punish') || name === 'log' || name === 'request') score += 20;
  return score;
}

async function discoverDiscordStaffCommand(
  cleanToken: string,
  guildId: string,
  channelId: string,
  actionMode: 'log' | 'request' = 'log'
): Promise<DiscoveredCommandInfo> {
  const collectedCommands: any[] = [];

  const harvest = (data: any) => {
    if (!data) return;
    if (Array.isArray(data)) {
      collectedCommands.push(...data);
      return;
    }
    if (Array.isArray(data.application_commands)) {
      collectedCommands.push(...data.application_commands);
    }
    if (Array.isArray(data.commands)) {
      collectedCommands.push(...data.commands);
    }
  };

  const indexUrls = [
    `https://discord.com/api/v10/guilds/${guildId}/application-command-index`,
    `https://discord.com/api/v9/guilds/${guildId}/application-command-index`,
    `https://discord.com/api/v9/channels/${channelId}/application-commands/search?type=1&query=staff&limit=25&include_applications=true`,
    `https://discord.com/api/v10/channels/${channelId}/application-commands/search?type=1&query=staff&limit=25&include_applications=true`,
    `https://discord.com/api/v9/guilds/${guildId}/application-commands`,
  ];

  for (const url of indexUrls) {
    try {
      const res = await fetchDiscordWithToken(url, cleanToken);
      if (res.ok) {
        const data = await res.json().catch(() => null);
        harvest(data);
      }
    } catch {
      // try next discovery endpoint
    }
  }

  // Deduplicate by command id + version
  const uniqueMap = new Map<string, any>();
  for (const cmd of collectedCommands) {
    if (cmd && cmd.id) {
      const key = `${cmd.id}:${cmd.version || ''}:${cmd.guild_id || 'global'}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, cmd);
      }
    }
  }

  const uniqueCommands = Array.from(uniqueMap.values());
  const ranked = uniqueCommands
    .map((c) => ({ cmd: c, score: scoreCommandCandidate(c, actionMode) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.cmd);

  const allCommandNames = Array.from(new Set(uniqueCommands.map((c) => `/${c?.name}`).filter(Boolean)));
  return { candidates: ranked, allCommandNames };
}

function formatDiscordErrors(errorsObj: any, prefix = ''): string {
  if (!errorsObj || typeof errorsObj !== 'object') return '';
  if (Array.isArray(errorsObj._errors)) {
    const msgs = errorsObj._errors.map((e: any) => `${e.message || e.code}`).join('; ');
    return prefix ? `${prefix}: ${msgs}` : msgs;
  }
  const parts: string[] = [];
  for (const [k, v] of Object.entries(errorsObj)) {
    const sub = formatDiscordErrors(v, prefix ? `${prefix}.${k}` : k);
    if (sub) parts.push(sub);
  }
  return parts.join(' | ');
}

function buildCommandOptionsFromSchema(
  staffCmd: any,
  params: {
    actionMode?: 'log' | 'request';
    punishmentType: string;
    duration: string;
    evidenceLinks: string;
    username: string;
    reason: string;
    gamemode: string;
  }
): any[] {
  const targetGroupName = params.actionMode === 'request' ? 'request' : 'log';
  const resolveOptionValue = (opt: any): any => {
    const optName = String(opt?.name || '').toLowerCase();
    const isEvidenceOpt =
      optName.includes('evidence') ||
      optName.includes('link') ||
      optName.includes('proof') ||
      optName.includes('url');
    const isDurationOpt =
      optName.includes('duration') ||
      optName.includes('time') ||
      optName.includes('length');

    // Evidence links and duration must ALWAYS be passed as the exact string (message link / duration string),
    // NEVER overwritten by an `opt.choices` fallback (like "sexual")!
    if (isEvidenceOpt) {
      return String(params.evidenceLinks);
    }
    if (isDurationOpt) {
      return String(params.duration);
    }

    let rawVal: any = params.evidenceLinks;
    if (optName === 'punishment_type' || optName.includes('type') || optName === 'punishment') {
      rawVal = params.punishmentType;
    } else if (optName.includes('user') || optName.includes('player') || optName.includes('ign') || optName.includes('target')) {
      rawVal = params.username;
    } else if (optName.includes('reason')) {
      rawVal = params.reason;
    } else if (optName.includes('mode') || optName.includes('server') || optName.includes('realm')) {
      rawVal = params.gamemode;
    }

    // If the slash command option defines fixed `choices` (e.g. punishment_type), match case-insensitively to the exact choice value
    if (Array.isArray(opt?.choices) && opt.choices.length > 0) {
      const lowerTarget = String(rawVal).toLowerCase().trim();
      const matchedChoice =
        opt.choices.find((ch: any) => String(ch.value).toLowerCase() === lowerTarget) ||
        opt.choices.find((ch: any) => String(ch.name).toLowerCase() === lowerTarget) ||
        opt.choices.find(
          (ch: any) =>
            String(ch.name).toLowerCase().includes(lowerTarget) ||
            lowerTarget.includes(String(ch.name).toLowerCase()) ||
            String(ch.value).toLowerCase().includes(lowerTarget) ||
            lowerTarget.includes(String(ch.value).toLowerCase())
        );
      if (matchedChoice !== undefined) {
        return matchedChoice.value;
      }
      if (lowerTarget.includes('ban')) {
        const banChoice = opt.choices.find((ch: any) => String(ch.name).toLowerCase().includes('ban'));
        if (banChoice) return banChoice.value;
      }
      if (lowerTarget.includes('mute')) {
        const muteChoice = opt.choices.find((ch: any) => String(ch.name).toLowerCase().includes('mute'));
        if (muteChoice) return muteChoice.value;
      }
      return opt.choices[0].value;
    }

    // Coerce value type if Discord expects INTEGER (4) or NUMBER (10) or BOOLEAN (5)
    if (opt?.type === 4) {
      const n = parseInt(String(rawVal), 10);
      return isNaN(n) ? 1 : n;
    }
    if (opt?.type === 10) {
      const f = parseFloat(String(rawVal));
      return isNaN(f) ? 1 : f;
    }
    if (opt?.type === 5) {
      return Boolean(rawVal);
    }

    return String(rawVal);
  };

  const mapLeafOptions = (leafOpts: any[]): any[] => {
    const coreStep1Names = new Set(['punishment_type', 'duration', 'evidence_links', 'type', 'evidence', 'link', 'proof']);

    return leafOpts
      .filter((opt: any) => {
        const optName = String(opt?.name || '').toLowerCase();
        const optType = Number(opt?.type || 3);

        // Never send ATTACHMENT (11)
        if (optType === 11) return false;

        // Discord USER (6), CHANNEL (7), ROLE (8), MENTIONABLE (9) require a 17-20 digit Discord Snowflake ID!
        if (optType === 6 || optType === 7 || optType === 8 || optType === 9) {
          const candidate = String(resolveOptionValue(opt)).trim();
          if (!/^\d{15,22}$/.test(candidate)) {
            return false;
          }
        }

        // Only include the 3 slash command options (`punishment_type`, `duration`, `evidence_links`) or required options
        // (Excluding any optional category/Preset options that might overwrite evidence)
        if (coreStep1Names.has(optName) || opt.required === true) {
          return true;
        }

        return false;
      })
      .map((opt: any) => ({
        type: opt.type || 3,
        name: opt.name,
        value: resolveOptionValue(opt),
      }));
  };

  const cmdOptions: any[] = Array.isArray(staffCmd?.options) ? staffCmd.options : [];

  // 1. Exact check for `/staff <log|request> punishment` (subcommand group `log` or `request` -> subcommand `punishment`)
  const targetGroup =
    cmdOptions.find((o) => o.type === 2 && String(o.name).toLowerCase() === targetGroupName) ||
    cmdOptions.find((o) => o.type === 2 && String(o.name).toLowerCase().includes(targetGroupName)) ||
    cmdOptions.find((o) => o.type === 2);
  if (targetGroup && Array.isArray(targetGroup.options)) {
    const punishSub =
      targetGroup.options.find((o: any) => o.type === 1 && String(o.name).toLowerCase() === 'punishment') ||
      targetGroup.options.find((o: any) => o.type === 1 && String(o.name).toLowerCase().includes('punish')) ||
      targetGroup.options.find((o: any) => o.type === 1) ||
      targetGroup.options[0];
    if (punishSub) {
      const subLeafs = Array.isArray(punishSub.options) ? mapLeafOptions(punishSub.options) : [];
      return [
        {
          type: 2,
          name:
            String(targetGroup.name).toLowerCase() === 'log' && targetGroupName === 'request'
              ? cmdOptions.some((o) => o.type === 2 && String(o.name).toLowerCase() === 'request')
                ? 'request'
                : 'request'
              : targetGroup.name,
          options: [
            {
              type: 1,
              name: punishSub.name,
              options: subLeafs,
            },
          ],
        },
      ];
    }
  }

  // 2. Check if command has direct subcommand `request` or `log` or `punishment` (type 1)
  const directSub =
    cmdOptions.find(
      (o) =>
        o.type === 1 &&
        String(o.name).toLowerCase().includes(targetGroupName)
    ) ||
    cmdOptions.find(
      (o) =>
        o.type === 1 &&
        (String(o.name).toLowerCase().includes('punish') || String(o.name).toLowerCase().includes('log'))
    ) ||
    cmdOptions.find((o) => o.type === 1);
  if (directSub) {
    const subLeafs = Array.isArray(directSub.options) ? mapLeafOptions(directSub.options) : [];
    return [
      {
        type: 1,
        name: directSub.name,
        options: subLeafs,
      },
    ];
  }

  // 3. If top-level options are leaf options directly on the command (type >= 3)
  if (cmdOptions.length > 0 && cmdOptions.every((o) => o.type >= 3)) {
    return mapLeafOptions(cmdOptions);
  }

  // Fallback to standard `/staff <log|request> punishment` structure
  return [
    {
      type: 2,
      name: targetGroupName,
      options: [
        {
          type: 1,
          name: 'punishment',
          options: [
            { type: 3, name: 'punishment_type', value: params.punishmentType },
            { type: 3, name: 'duration', value: params.duration },
            { type: 3, name: 'evidence_links', value: params.evidenceLinks },
          ],
        },
      ],
    },
  ];
}

async function executeDiscordStaffLogInteraction(params: {
  token: string;
  staffChannelId: string;
  actionMode?: 'log' | 'request';
  punishmentType: string;
  duration: string;
  evidenceLinks: string;
  username: string;
  reason: string;
  gamemode: string;
}): Promise<{ ok: boolean; detail: string }> {
  const actionMode: 'log' | 'request' = params.actionMode === 'request' ? 'request' : 'log';
  const slashLabel = `/staff ${actionMode} punishment`;
  const cleanToken = params.token.trim().replace(/^bot\s+/i, '');
  const rawChan = params.staffChannelId.trim();
  const snowflakes = rawChan.match(/\d{15,22}/g);
  const channelId = snowflakes ? snowflakes[snowflakes.length - 1] : rawChan;

  if (!/^\d{15,22}$/.test(channelId)) {
    return { ok: false, detail: 'Invalid Staff Command Channel ID.' };
  }

  // 1. Fetch channel info to get guild_id
  const chanRes = await fetchDiscordWithToken(`https://discord.com/api/v10/channels/${channelId}`, cleanToken);
  if (!chanRes.ok) {
    return { ok: false, detail: `Cannot access staff channel (${chanRes.status}). Check token permissions.` };
  }
  const chanData: any = await chanRes.json();
  const guildId: string | undefined = chanData?.guild_id;
  const chanName = chanData?.name ? `#${chanData.name} (${channelId})` : `channel ${channelId}`;
  if (!guildId) {
    return { ok: false, detail: 'Target channel does not belong to a Discord guild.' };
  }

  // 2. Discover all candidate /staff commands in the guild/channel
  const { candidates, allCommandNames } = await discoverDiscordStaffCommand(
    cleanToken,
    guildId,
    channelId,
    actionMode
  );

  if (candidates.length === 0) {
    const foundHint =
      allCommandNames.length > 0
        ? ` Commands visible in this server: ${allCommandNames.slice(0, 12).join(', ')}.`
        : ' Note: #punishment-logs is usually a read-only output channel where the bot posts embeds—make sure you enter the Staff Command channel ID (e.g. #staff-commands or #bot-commands) where staff type /staff.';
    return {
      ok: false,
      detail: `Could not find "/staff" slash command in ${chanName}.${foundHint}`,
    };
  }

  // 3. Connect to Discord Gateway WebSocket to get session_id and automatically test/retry candidate payloads until Step 1 succeeds, then catch INTERACTION_MODAL_CREATE
  return new Promise((resolve) => {
    const ws = new WebSocket('wss://gateway.discord.gg/?v=10&encoding=json');
    let sessionId = '';
    let interactionSent = false;
    let activeCmd: any = candidates[0];
    let activeNonce = '';
    let finished = false;

    const finish = (result: { ok: boolean; detail: string }) => {
      if (finished) return;
      finished = true;
      try {
        ws.close();
      } catch {
        // ignore close error
      }
      resolve(result);
    };

    const timeout = setTimeout(() => {
      finish({
        ok: false,
        detail: interactionSent
          ? `Step 1 (${slashLabel}) was accepted in ${chanName}, but timed out waiting for the Step 2 modal popup from the bot. Check if ${chanName} allows slash commands.`
          : 'Timed out connecting to Discord Gateway.',
      });
    }, 18000);

    ws.on('message', async (raw) => {
      try {
        const packet = JSON.parse(String(raw));
        // OP 10 Hello -> send OP 2 Identify
        if (packet.op === 10) {
          ws.send(
            JSON.stringify({
              op: 2,
              d: {
                token: cleanToken,
                properties: {
                  os: 'linux',
                  browser: 'Chrome',
                  device: '',
                },
              },
            })
          );
        }

        // Dispatch events (OP 0)
        if (packet.op === 0) {
          if (packet.t === 'READY' && packet.d?.session_id && !interactionSent) {
            sessionId = packet.d.session_id;
            interactionSent = true;

            const attemptErrors: string[] = [];
            let step1Accepted = false;

            // Self-testing loop: iterate through every discovered command candidate & payload variant until Discord returns 204 OK
            for (const candidateCmd of candidates) {
              if (step1Accepted) break;
              const builtOptions = buildCommandOptionsFromSchema(candidateCmd, params);

              // Build payload variants for this candidate command:
              // Variant A: Standard guild interaction with guild_id in data if guild-scoped
              // Variant B: With sanitized application_command object included (required by some Discord v9 interaction validations)
              // Variant C: With lowercase vs TitleCase punishment_type fallback
              const cleanAppCmd: Record<string, any> = {
                id: String(candidateCmd.id),
                application_id: String(candidateCmd.application_id),
                version: String(candidateCmd.version),
                name: String(candidateCmd.name || 'staff'),
                description: String(candidateCmd.description || 'Staff command'),
                type: 1,
                options: Array.isArray(candidateCmd.options) ? candidateCmd.options : [],
              };
              if (candidateCmd.guild_id) {
                cleanAppCmd.guild_id = String(candidateCmd.guild_id);
              }

              const dataVariants: Record<string, any>[] = [
                {
                  version: String(candidateCmd.version),
                  id: String(candidateCmd.id),
                  name: String(candidateCmd.name || 'staff'),
                  type: 1,
                  options: builtOptions,
                  application_command: cleanAppCmd,
                  attachments: [],
                  ...(candidateCmd.guild_id ? { guild_id: String(candidateCmd.guild_id) } : {}),
                },
                {
                  version: String(candidateCmd.version),
                  id: String(candidateCmd.id),
                  name: String(candidateCmd.name || 'staff'),
                  type: 1,
                  options: builtOptions,
                  attachments: [],
                  ...(candidateCmd.guild_id ? { guild_id: String(guildId) } : {}),
                },
              ];

              for (const dataObj of dataVariants) {
                const nonce = `${Date.now()}${Math.floor(Math.random() * 900 + 100)}`;
                const interactionPayload = {
                  type: 2,
                  application_id: String(candidateCmd.application_id),
                  guild_id: String(guildId),
                  channel_id: String(channelId),
                  session_id: sessionId,
                  data: dataObj,
                  nonce,
                };

                const slashRes = await fetch('https://discord.com/api/v9/interactions', {
                  method: 'POST',
                  headers: {
                    Authorization: cleanToken,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(interactionPayload),
                });

                if (slashRes.ok) {
                  step1Accepted = true;
                  activeCmd = candidateCmd;
                  activeNonce = nonce;
                  break;
                } else {
                  const errBody: any = await slashRes.json().catch(() => ({}));
                  const exactFieldErrors = formatDiscordErrors(errBody?.errors);
                  const errMsg = `${errBody?.message || slashRes.status}${exactFieldErrors ? ` [${exactFieldErrors}]` : ''} (cmd=${candidateCmd.name}, app=${candidateCmd.application_id})`;
                  if (!attemptErrors.includes(errMsg)) {
                    attemptErrors.push(errMsg);
                  }
                  // If Unknown Integration (10062 / 400), break inner loop and try next command candidate
                  if (String(errBody?.message || '').toLowerCase().includes('unknown integration')) {
                    break;
                  }
                }
              }
            }

            if (!step1Accepted) {
              clearTimeout(timeout);
              finish({
                ok: false,
                detail: `Auto-tested ${candidates.length} command candidate(s) in ${chanName}, all rejected: ${attemptErrors.join(' || ')}`,
              });
            }
          }

          // If the bot completed immediately without opening a modal (e.g. single-step command)
          if (
            packet.t === 'INTERACTION_SUCCESS' &&
            (!activeNonce || packet.d?.nonce === activeNonce)
          ) {
            setTimeout(() => {
              if (!finished) {
                clearTimeout(timeout);
                finish({
                  ok: true,
                  detail: `Executed /${activeCmd?.name || 'staff'} in ${chanName}!`,
                });
              }
            }, 1500);
          }

          // If Discord dispatches INTERACTION_FAILURE over the gateway, report it immediately
          if (
            packet.t === 'INTERACTION_FAILURE' &&
            (!activeNonce || packet.d?.nonce === activeNonce)
          ) {
            clearTimeout(timeout);
            finish({
              ok: false,
              detail: `Discord interaction failed in ${chanName} (INTERACTION_FAILURE). Make sure the bot is online and ${chanName} allows /staff log punishment.`,
            });
          }

          // STEP 2: Catch the Modal popup (`INTERACTION_MODAL_CREATE`) and auto-fill username, reason, gamemode!
          if (packet.t === 'INTERACTION_MODAL_CREATE' && packet.d) {
            const modal = packet.d;
            const modalComponents: any[] = Array.isArray(modal.components) ? modal.components : [];
            const filledSummary: string[] = [];

            const pickFieldVal = (comp: any, parentLabel: string, rowIdx: number): { val: string; tag: string } => {
              const cid = String(comp?.custom_id || '').toLowerCase();
              const label = `${String(comp?.label || '')} ${parentLabel}`.toLowerCase();
              const placeholder = String(comp?.placeholder || '').toLowerCase();

              let val = params.reason;
              let tagName = 'reason';

              if (
                cid.includes('evidence') ||
                cid.includes('link') ||
                cid.includes('proof') ||
                cid.includes('url') ||
                label.includes('evidence') ||
                label.includes('link') ||
                label.includes('proof') ||
                placeholder.includes('evidence') ||
                placeholder.includes('link') ||
                placeholder.includes('http')
              ) {
                val = params.evidenceLinks;
                tagName = 'evidence_links';
              } else if (
                cid.includes('user') ||
                cid.includes('player') ||
                cid.includes('ign') ||
                cid.includes('name') ||
                cid.includes('target') ||
                cid.includes('offender') ||
                label.includes('user') ||
                label.includes('player') ||
                label.includes('ign') ||
                label.includes('name') ||
                placeholder.includes('user') ||
                placeholder.includes('player') ||
                rowIdx === 0
              ) {
                val = params.username;
                tagName = 'username';
              } else if (
                cid.includes('mode') ||
                cid.includes('server') ||
                cid.includes('realm') ||
                label.includes('mode') ||
                label.includes('server') ||
                placeholder.includes('mode') ||
                rowIdx === 2
              ) {
                val = params.gamemode;
                tagName = 'gamemode';
              } else if (
                cid.includes('reason') ||
                label.includes('reason') ||
                placeholder.includes('reason') ||
                rowIdx === 1
              ) {
                val = params.reason;
                tagName = 'reason';
              }

              // Respect max_length if defined on TextInput
              if (typeof comp?.max_length === 'number' && comp.max_length > 0) {
                val = val.slice(0, comp.max_length);
              }
              // Respect min_length if defined on TextInput
              if (typeof comp?.min_length === 'number' && val.length < comp.min_length) {
                val = val.padEnd(comp.min_length, ' ');
              }

              return { val, tag: `${tagName}="${val}"` };
            };

            const buildModalComponentAnswer = (comp: any, parentLabel: string, rowIdx: number): any => {
              const { val, tag } = pickFieldVal(comp, parentLabel, rowIdx);
              filledSummary.push(tag);
              const cType = Number(comp?.type || 4);

              // If the modal contains a String Select Menu (type 3) instead of TextInput (type 4)
              if (cType === 3) {
                const opts: any[] = Array.isArray(comp?.options) ? comp.options : [];
                const lower = val.toLowerCase().trim();
                const matched =
                  opts.find((o) => String(o.value).toLowerCase() === lower) ||
                  opts.find((o) => String(o.label).toLowerCase() === lower) ||
                  opts.find(
                    (o) =>
                      String(o.label).toLowerCase().includes(lower) ||
                      lower.includes(String(o.label).toLowerCase())
                  ) ||
                  opts[0];
                return {
                  type: 3,
                  custom_id: String(comp.custom_id),
                  values: [matched ? String(matched.value) : val],
                };
              }

              return {
                type: 4,
                custom_id: String(comp.custom_id),
                value: val,
              };
            };

            // Variant 1: Preserve exact wrapper structure (handles both ActionRow type=1 and Label wrapper type=18)
            const buildStructuredRows = (forceType1Rows: boolean): any[] => {
              filledSummary.length = 0;
              return modalComponents.map((row: any, rowIdx: number) => {
                const rowType = Number(row?.type || 1);
                const rowLabel = String(row?.label || '');

                // New Discord Modal Label component (type 18) with single `component` child
                if (row?.component && typeof row.component === 'object') {
                  const innerAns = buildModalComponentAnswer(row.component, rowLabel, rowIdx);
                  if (forceType1Rows) {
                    return { type: 1, components: [innerAns] };
                  }
                  return {
                    type: rowType,
                    ...(row.id !== undefined ? { id: row.id } : {}),
                    component: innerAns,
                  };
                }

                // Classic ActionRow (type 1) with `components: [...]` array
                const children: any[] = Array.isArray(row?.components) ? row.components : [];
                return {
                  type: forceType1Rows ? 1 : rowType,
                  components: children.map((comp: any) =>
                    buildModalComponentAnswer(comp, rowLabel, rowIdx)
                  ),
                };
              });
            };

            const rowsNative = buildStructuredRows(false);
            const rowsClassic = buildStructuredRows(true);

            const modalDataVariants: Record<string, any>[] = [
              {
                id: String(modal.id),
                custom_id: String(modal.custom_id),
                components: rowsNative,
              },
              {
                id: String(modal.id),
                custom_id: String(modal.custom_id),
                components: rowsClassic,
              },
              {
                custom_id: String(modal.custom_id),
                components: rowsClassic,
              },
            ];

            let submitOk = false;
            const modalErrors: string[] = [];

            for (const modalData of modalDataVariants) {
              const modalSubmitPayload = {
                type: 5,
                application_id: String(modal.application_id || activeCmd?.application_id),
                channel_id: String(modal.channel_id || channelId),
                guild_id: String(guildId),
                data: modalData,
                session_id: sessionId,
                nonce: `${Date.now()}${Math.floor(Math.random() * 900 + 100)}`,
              };

              const submitRes = await fetch('https://discord.com/api/v9/interactions', {
                method: 'POST',
                headers: {
                  Authorization: cleanToken,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(modalSubmitPayload),
              });

              if (submitRes.ok) {
                submitOk = true;
                break;
              } else {
                const errBody: any = await submitRes.json().catch(() => ({}));
                const exactErr = formatDiscordErrors(errBody?.errors);
                modalErrors.push(
                  `${submitRes.status}: ${errBody?.message || 'Error'}${exactErr ? ` [${exactErr}]` : ''}`
                );
              }
            }

            clearTimeout(timeout);
            if (submitOk) {
              finish({
                ok: true,
                detail: `2-Step Automation Complete in ${chanName}: Step 1 sent ${slashLabel} -> Step 2 caught Modal "${modal.title || 'Punishment'}" & submitted (${filledSummary.join(', ')})!`,
              });
            } else {
              const rawSchemaPreview = JSON.stringify(modal.components).slice(0, 320);
              finish({
                ok: false,
                detail: `Step 2 Modal submit failed in ${chanName} (${modalErrors.join(' | ')}) [Modal schema: ${rawSchemaPreview}]`,
              });
            }
          }
        }
      } catch (e: any) {
        clearTimeout(timeout);
        finish({ ok: false, detail: e?.message || 'Gateway error' });
      }
    });

    ws.on('error', (err) => {
      clearTimeout(timeout);
      finish({ ok: false, detail: `Discord Gateway connection error: ${err.message}` });
    });
  });
}

// ==========================================
// 9. EXPRESS SERVER & ROUTES
// ==========================================

const ALLOWED_EXTENSIONS = new Set(['.log', '.txt', '.csv']);
const upload = multer({ storage: multer.memoryStorage() });

export async function startServer(customPort?: number): Promise<number> {
  const app = express();
  app.use(express.json());

  app.get('/api/v1/health', (_req, res) => {
    res.json({
      status: 'healthy',
      service: 'chat-log-moderation-analyzer',
      version: '1.0.0',
      supported_formats: ['discord_token', 'minecraft', 'discord', 'generic', 'csv'],
    });
  });

  app.get('/api/v1/punishments', (_req, res) => {
    res.json(punishmentsStore);
  });

  app.get('/api/v1/download/portable-exe', (_req, res) => {
    const exePath = path.join(__dirname, 'release', 'ModerationStudio-Portable.exe');
    if (!fs.existsSync(exePath)) {
      res.status(404).json({ detail: 'ModerationStudio-Portable.exe not found in /release.' });
      return;
    }
    res.download(exePath, 'ModerationStudio-Portable.exe');
  });

  app.get('/api/v1/discord/session', (_req, res) => {
    res.json(sessionState);
  });

  app.post('/api/v1/discord/session', (req, res) => {
    const { token, selected_channel_id, staff_channel_id } = req.body || {};
    if (typeof token === 'string' && token.trim()) {
      sessionState.token = token.trim();
    }
    if (typeof selected_channel_id === 'string' && selected_channel_id.trim()) {
      sessionState.selected_channel_id = selected_channel_id.trim();
    }
    if (typeof staff_channel_id === 'string' && staff_channel_id.trim()) {
      sessionState.staff_channel_id = staff_channel_id.trim();
    }
    saveSessionState();
    res.json(sessionState);
  });

  app.post('/api/v1/discord/resolve-channels', async (req, res) => {
    const rawToken = String(req.body?.token || sessionState.token || '').trim();
    if (!rawToken) {
      res.json(sessionState);
      return;
    }
    sessionState.token = rawToken;

    // Fetch all guild channels in one API call if possible (`GET /guilds/1250416860000817162/channels`)
    const guildChannelNameMap = new Map<string, string>();
    try {
      const guildRes = await fetchDiscordWithToken(
        'https://discord.com/api/v10/guilds/1250416860000817162/channels',
        rawToken
      );
      if (guildRes.ok) {
        const guildChans: any[] = await guildRes.json();
        if (Array.isArray(guildChans)) {
          for (const ch of guildChans) {
            if (ch?.id && ch?.name) {
              guildChannelNameMap.set(String(ch.id), `#${ch.name}`);
            }
          }
        }
      }
    } catch {
      // ignore guild channels list error
    }

    // Resolve each preset channel name
    for (const preset of sessionState.preset_channels) {
      if (guildChannelNameMap.has(preset.channel_id)) {
        preset.name = guildChannelNameMap.get(preset.channel_id)!;
      } else {
        try {
          const cRes = await fetchDiscordWithToken(
            `https://discord.com/api/v10/channels/${preset.channel_id}`,
            rawToken
          );
          if (cRes.ok) {
            const cData: any = await cRes.json();
            if (cData?.name) {
              preset.name = `#${cData.name}`;
            }
          }
        } catch {
          // ignore individual lookup error
        }
      }
    }

    saveSessionState();
    res.json(sessionState);
  });

  app.post('/api/v1/punishments', async (req, res) => {
    try {
      const {
        message_id,
        staff_action_mode = 'log',
        username,
        punishment_type,
        duration,
        reason,
        gamemode,
        evidence_links,
        message_excerpt = '',
        severity = 'medium',
        auto_send_discord = false,
        token = '',
        staff_channel_id = '',
      } = req.body || {};

      if (!username || !punishment_type || !duration || !reason || !gamemode || !evidence_links) {
        res.status(400).json({
          detail: 'All punishment fields (punishment_type, duration, evidence_links, username, reason, gamemode) are required.',
        });
        return;
      }

      const cleanActionMode: 'log' | 'request' = staff_action_mode === 'request' ? 'request' : 'log';
      const id = nextPunishmentId++;
      const caseId =
        cleanActionMode === 'request'
          ? `REQ-${String(id).padStart(4, '0')}`
          : `CASE-${String(id).padStart(4, '0')}`;
      const commandString = `/staff ${cleanActionMode} punishment punishment_type:${punishment_type} duration:${duration} evidence_links:${evidence_links}`;

      let discordStatus: 'logged_locally' | 'sent_to_discord' | 'failed' = 'logged_locally';
      let discordDetail =
        cleanActionMode === 'request'
          ? 'Saved to Punishment Request Ledger.'
          : 'Saved to Punishment Log.';

      if (auto_send_discord) {
        if (!token || !staff_channel_id) {
          discordStatus = 'failed';
          discordDetail = 'Discord Token and Staff Command Channel ID are required to auto-submit to Discord.';
        } else {
          const dispatchRes = await executeDiscordStaffLogInteraction({
            token: String(token),
            staffChannelId: String(staff_channel_id),
            actionMode: cleanActionMode,
            punishmentType: String(punishment_type),
            duration: String(duration),
            evidenceLinks: String(evidence_links),
            username: String(username),
            reason: String(reason),
            gamemode: String(gamemode),
          });
          discordStatus = dispatchRes.ok ? 'sent_to_discord' : 'failed';
          discordDetail = dispatchRes.detail;
        }
      }

      // Also mark the source message as confirmed if message_id is provided
      if (typeof message_id === 'number') {
        try {
          parserManager.updateMessageAction(
            message_id,
            'confirmed',
            `[${caseId}] (${cleanActionMode.toUpperCase()}) ${punishment_type} (${duration}) - ${reason} [${gamemode}]`
          );
        } catch {
          // ignore if message not in current session
        }
      }

      const record: PunishmentRecord = {
        id,
        case_id: caseId,
        created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
        message_id: typeof message_id === 'number' ? message_id : undefined,
        staff_action_mode: cleanActionMode,
        username: String(username),
        punishment_type: String(punishment_type),
        duration: String(duration),
        reason: String(reason),
        gamemode: String(gamemode),
        evidence_links: String(evidence_links),
        message_excerpt: String(message_excerpt),
        severity: String(severity),
        command_string: commandString,
        discord_status: discordStatus,
        discord_detail: discordDetail,
      };

      punishmentsStore.unshift(record);
      res.json(record);
    } catch (err: any) {
      res.status(500).json({ detail: err?.message || 'Failed to log punishment.' });
    }
  });

  app.delete('/api/v1/punishments/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    const idx = punishmentsStore.findIndex((p) => p.id === id);
    if (idx !== -1) {
      punishmentsStore.splice(idx, 1);
    }
    res.json({ deleted: true });
  });

  app.get('/api/v1/discord/fetch/status', (_req, res) => {
    res.json({
      status: discordFetchJob.status,
      fetched: discordFetchJob.fetched,
      target: discordFetchJob.target,
      mode: discordFetchJob.mode,
      channel_name: discordFetchJob.channelName,
      rate_limit_wait_ms: discordFetchJob.rateLimitWaitMs,
      result: discordFetchJob.status === 'completed' ? discordFetchJob.result : null,
      detail: discordFetchJob.error,
    });
  });

  app.post('/api/v1/discord/fetch/stop', (_req, res) => {
    discordFetchJob.stopRequested = true;
    res.json({ status: 'stopping', fetched: discordFetchJob.fetched });
  });

  // ==========================================
  // SMART SCAN MEMORY CACHE ENDPOINTS
  // ==========================================
  app.get('/api/v1/cache/channels', (_req, res) => {
    const list = Array.from(channelMemoryCache.values())
      .map((rec) => ({
        channel_id: rec.channel_id,
        channel_name: rec.channel_name,
        guild_id: rec.guild_id,
        detected_gamemode: rec.detected_gamemode || inferGamemodeFromChannel(rec.channel_name),
        cached_messages_count: rec.cached_summary.cached_messages_count,
        flagged_messages_count: rec.cached_summary.flagged_messages_count,
        critical_severity_count: rec.cached_summary.critical_severity_count,
        high_severity_count: rec.cached_summary.high_severity_count,
        newest_message_id: rec.newest_message_id,
        last_synced_at: rec.last_synced_at,
      }))
      .sort((a, b) => b.last_synced_at.localeCompare(a.last_synced_at));
    res.json(list);
  });

  app.post('/api/v1/cache/channels/:channelId/load', (req, res) => {
    const { channelId } = req.params;
    const cached = channelMemoryCache.get(channelId);
    if (!cached || !cached.raw_discord_messages.length) {
      res.status(404).json({ detail: `No saved scan memory found for channel ${channelId}.` });
      return;
    }

    const result = processDiscordMessagesArray(
      cached.channel_name,
      cached.raw_discord_messages,
      cached.guild_id,
      cached.channel_id
    );
    result.cache_metadata = {
      cache_hit: true,
      cached_messages_reused: cached.raw_discord_messages.length,
      newly_scanned_messages: 0,
      total_cached_in_channel: cached.raw_discord_messages.length,
      last_synced_at: cached.last_synced_at,
    };
    res.json(result);
  });

  app.delete('/api/v1/cache/channels/:channelId', (req, res) => {
    const { channelId } = req.params;
    if (channelId === 'all') {
      for (const k of Array.from(channelMemoryCache.keys())) {
        deleteChannelMemory(k);
      }
      res.json({ cleared: 'all' });
      return;
    }
    deleteChannelMemory(channelId);
    res.json({ deleted: channelId });
  });

  // ==========================================
  // LIVE CHAT MODERATION RADAR ENDPOINTS (MULTI-CHANNEL + SINGLE-CHANNEL)
  // ==========================================
  const getLiveStatusPayload = () => {
    const workingCount = liveMonitor.monitored_channels.filter((c) => c.status === 'working').length;
    return {
      running: liveMonitor.running,
      mode: liveMonitor.mode,
      channel_id: liveMonitor.channel_id,
      channel_name: liveMonitor.channel_name,
      guild_id: liveMonitor.guild_id,
      monitored_channels: liveMonitor.monitored_channels,
      working_channels_count: workingCount,
      poll_interval_ms: liveMonitor.poll_interval_ms,
      started_at: liveMonitor.started_at,
      last_polled_at: liveMonitor.last_polled_at,
      total_seen_live: liveMonitor.total_seen_live,
      total_flagged_live: liveMonitor.total_flagged_live,
      error: liveMonitor.error,
      recent_messages: liveMonitor.recent_messages,
      active_alerts: liveMonitor.active_alerts,
    };
  };

  app.get('/api/v1/live/status', (_req, res) => {
    res.json(getLiveStatusPayload());
  });

  app.post('/api/v1/live/start', async (req, res) => {
    const {
      token,
      channel_id,
      channel_ids,
      mode = 'all',
      poll_interval_ms = 4000,
    } = req.body || {};
    const cleanToken = String(token || sessionState.token || '').trim();
    const isAllMode = mode === 'all' || channel_id === 'all' || (Array.isArray(channel_ids) && channel_ids.length > 1);

    if (liveMonitor.timer) {
      clearInterval(liveMonitor.timer);
      liveMonitor.timer = null;
    }

    // Determine target channel IDs to monitor
    let rawTargets: string[] = [];
    if (Array.isArray(channel_ids) && channel_ids.length > 0) {
      rawTargets = channel_ids.map((id) => String(id).trim()).filter(Boolean);
    } else if (isAllMode) {
      const presetIds = sessionState.preset_channels.map((p) => p.channel_id);
      const cachedIds = Array.from(channelMemoryCache.keys());
      rawTargets = Array.from(new Set([...presetIds, ...cachedIds]));
    } else {
      const rawChannel = String(channel_id || sessionState.selected_channel_id || '').trim();
      const snowflakes = rawChannel.match(/\d{15,22}/g);
      const extracted = snowflakes ? snowflakes[snowflakes.length - 1] : rawChannel;
      if (extracted) rawTargets = [extracted];
    }

    if (rawTargets.length === 0) {
      res.status(400).json({ detail: 'At least one Channel ID is required to start Live Chat Moderation.' });
      return;
    }

    // Try fetching guild channels map first if token is provided so we get clean #names in 1 request
    const guildChannelNameMap = new Map<string, { name: string; guild_id: string }>();
    if (cleanToken) {
      try {
        const gRes = await fetchDiscordWithToken(
          'https://discord.com/api/v10/guilds/1250416860000817162/channels',
          cleanToken
        );
        if (gRes.ok) {
          const gChans: any[] = await gRes.json();
          if (Array.isArray(gChans)) {
            for (const gc of gChans) {
              if (gc?.id && gc?.name) {
                guildChannelNameMap.set(String(gc.id), {
                  name: `#${gc.name}`,
                  guild_id: String(gc.guild_id || '1250416860000817162'),
                });
              }
            }
          }
        }
      } catch {
        // ignore
      }
    }

    const newMonitoredList: MonitoredChannelLiveState[] = [];

    for (const rawId of rawTargets) {
      const snowflakes = rawId.match(/\d{15,22}/g);
      const cid = snowflakes ? snowflakes[snowflakes.length - 1] : rawId;
      const presetMatch = sessionState.preset_channels.find((p) => p.channel_id === cid);
      const cachedMatch = channelMemoryCache.get(cid);
      const fb = DEFAULT_FALLBACK_GAMEMODES[cid];
      const existingMon = liveMonitor.monitored_channels.find((m) => m.channel_id === cid);

      let chanName =
        guildChannelNameMap.get(cid)?.name ||
        (presetMatch?.name && !presetMatch.name.startsWith('Channel ') ? presetMatch.name : '') ||
        cachedMatch?.channel_name ||
        fb?.label ||
        presetMatch?.name ||
        `#channel-${cid}`;
      let guildId =
        guildChannelNameMap.get(cid)?.guild_id ||
        presetMatch?.guild_id ||
        cachedMatch?.guild_id ||
        '1250416860000817162';
      let status: MonitoredChannelLiveState['status'] = cleanToken ? 'working' : 'working';
      let statusDetail = cleanToken ? 'Ready to poll' : 'Simulation / Ready Mode';

      if (cleanToken && !guildChannelNameMap.has(cid)) {
        try {
          const cRes = await fetchDiscordWithToken(
            `https://discord.com/api/v10/channels/${cid}`,
            cleanToken
          );
          if (cRes.ok) {
            const cData: any = await cRes.json();
            if (cData?.name) chanName = `#${cData.name}`;
            if (cData?.guild_id) guildId = String(cData.guild_id);
            status = 'working';
            statusDetail = 'Verified & working';
          } else if (cRes.status === 403 || cRes.status === 404 || cRes.status === 401) {
            status = 'unreachable';
            statusDetail = `HTTP ${cRes.status} (No access or invalid channel)`;
          }
        } catch {
          // keep working so pollSingleChannelInMonitor can try
        }
      }

      const detectedGamemode =
        inferGamemodeFromChannel(chanName) !== 'SMP'
          ? inferGamemodeFromChannel(chanName)
          : fb?.gamemode || cachedMatch?.detected_gamemode || 'SMP';

      newMonitoredList.push({
        channel_id: cid,
        channel_name: chanName,
        guild_id: guildId,
        detected_gamemode: detectedGamemode,
        status,
        status_detail: statusDetail,
        last_message_id: existingMon?.last_message_id || '',
        last_polled_at: existingMon?.last_polled_at || null,
        messages_seen: existingMon?.messages_seen || 0,
        flags_detected: existingMon?.flags_detected || 0,
      });
    }

    liveMonitor.running = true;
    liveMonitor.mode = isAllMode ? 'all' : 'single';
    liveMonitor.token = cleanToken;
    liveMonitor.monitored_channels = newMonitoredList;
    liveMonitor.channel_id = isAllMode ? 'all' : newMonitoredList[0].channel_id;
    liveMonitor.channel_name = isAllMode
      ? `All Working Channels (${newMonitoredList.filter((c) => c.status !== 'unreachable').length}/${newMonitoredList.length})`
      : newMonitoredList[0].channel_name;
    liveMonitor.guild_id = newMonitoredList[0]?.guild_id || '1250416860000817162';
    liveMonitor.poll_interval_ms = Math.max(2500, Math.min(30000, Number(poll_interval_ms) || 4000));
    liveMonitor.started_at = new Date().toISOString().replace('T', ' ').slice(11, 19);
    liveMonitor.error = null;

    if (cleanToken) {
      await pollLiveDiscordChannelOnce();
      const workingCountAfterPoll = liveMonitor.monitored_channels.filter(
        (c) => c.status === 'working'
      ).length;
      if (isAllMode) {
        liveMonitor.channel_name = `All Working Channels (${workingCountAfterPoll}/${liveMonitor.monitored_channels.length} Active)`;
      }
      liveMonitor.timer = setInterval(() => {
        pollLiveDiscordChannelOnce();
      }, liveMonitor.poll_interval_ms);
    }

    res.json(getLiveStatusPayload());
  });

  app.post('/api/v1/live/stop', (_req, res) => {
    liveMonitor.running = false;
    if (liveMonitor.timer) {
      clearInterval(liveMonitor.timer);
      liveMonitor.timer = null;
    }
    res.json(getLiveStatusPayload());
  });

  app.post('/api/v1/live/clear-alerts', (_req, res) => {
    liveMonitor.active_alerts = [];
    liveMonitor.recent_messages = [];
    liveMonitor.total_seen_live = 0;
    liveMonitor.total_flagged_live = 0;
    for (const ch of liveMonitor.monitored_channels) {
      ch.messages_seen = 0;
      ch.flags_detected = 0;
    }
    res.json(getLiveStatusPayload());
  });

  app.post('/api/v1/live/simulate', (req, res) => {
    const customMsg = req.body?.message;
    const customPlayer = req.body?.player;
    const targetChannelId = req.body?.channel_id;
    const multiChannelBurst = Boolean(req.body?.multi_channel_burst);

    const SIMULATION_SAMPLES = [
      { player: 'VortexPvP_', message: 'kys noob i will leak your ip and swat you right now' },
      { player: 'xX_Slayer_Xx', message: 'Join my duping discord right now discord.gg/freedupes or connect at 198.51.100.42:25565' },
      { player: 'DiamondMiner12', message: 'Anyone trading mending books at spawn?' },
      { player: 'ToxicKing99', message: 'you are a fucking idiot stfu worthless trash player' },
      { player: 'DesiRider_', message: 'abe Steve teri maki chut noob tmkc' },
      { player: 'Rohan_Pro', message: 'bhenchod chup kar bsdk diamonds wapas de' },
      { player: 'BuilderAlex', message: 'GG nice duel at warp arena!' },
      { player: 'ShadowRaider', message: 'ADMIN HELP SOMEONE IS GRIEFING SPAWN RIGHT NOW!!!!' },
      { player: 'NetherLord_', message: 'nobody wants you here delete your account loser' },
      { player: 'DesiRider_', message: 'jaan se maar dunga tujhe chutiye' },
      { player: 'CrystalKnight', message: 'f.u.c.k you stupid r3tard get doxxed' },
      { player: 'SkyTrader99', message: 'Selling 64x enchanted golden apples at /ah SkyTrader99' },
    ];

    if (!liveMonitor.monitored_channels || liveMonitor.monitored_channels.length === 0) {
      liveMonitor.monitored_channels = buildInitialMonitoredChannelsList();
    }

    const workingPool = liveMonitor.monitored_channels.filter((c) => c.status !== 'unreachable');
    const channelPool = workingPool.length > 0 ? workingPool : liveMonitor.monitored_channels;

    const nowTs = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const nowShort = new Date().toISOString().replace('T', ' ').slice(11, 19);
    liveMonitor.last_polled_at = nowShort;

    // If multi_channel_burst is true, simulate messages across all channels at once!
    if (multiChannelBurst) {
      const generatedItems: LiveFeedAlertItem[] = [];
      for (const ch of channelPool) {
        ch.status = 'working';
        ch.last_polled_at = nowShort;
        const sample = SIMULATION_SAMPLES[Math.floor(Math.random() * SIMULATION_SAMPLES.length)];
        const fakeDiscordId = String(Date.now() * 1000000 + Math.floor(Math.random() * 999999));
        const item = evaluateSingleLiveLine(
          fakeDiscordId,
          ch.channel_id,
          ch.channel_name,
          ch.guild_id || '1250416860000817162',
          nowTs,
          sample.player,
          sample.message,
          ch.detected_gamemode
        );
        ch.messages_seen++;
        liveMonitor.total_seen_live++;
        liveMonitor.recent_messages.unshift(item);
        if (item.is_flagged) {
          ch.flags_detected++;
          liveMonitor.total_flagged_live++;
          liveMonitor.active_alerts.unshift(item);
        }
        generatedItems.push(item);
      }
      if (liveMonitor.recent_messages.length > 250) liveMonitor.recent_messages.length = 250;
      if (liveMonitor.active_alerts.length > 150) liveMonitor.active_alerts.length = 150;
      res.json({ burst_count: generatedItems.length, items: generatedItems, status: getLiveStatusPayload() });
      return;
    }

    const chosen =
      customMsg && customPlayer
        ? { player: String(customPlayer), message: String(customMsg) }
        : SIMULATION_SAMPLES[Math.floor(Math.random() * SIMULATION_SAMPLES.length)];

    let targetChan =
      targetChannelId && targetChannelId !== 'all'
        ? channelPool.find((c) => c.channel_id === targetChannelId)
        : undefined;
    if (!targetChan) {
      targetChan = channelPool[Math.floor(Math.random() * channelPool.length)];
    }

    const chanId = targetChan?.channel_id || sessionState.selected_channel_id || '1473478972816752650';
    const chanName = targetChan?.channel_name || '#survival-chat';
    const chanGm = targetChan?.detected_gamemode || 'Survival';

    if (targetChan) {
      targetChan.status = 'working';
      targetChan.last_polled_at = nowShort;
      targetChan.messages_seen++;
    }

    const fakeDiscordId = String(Date.now() * 1000000 + Math.floor(Math.random() * 999999));

    const item = evaluateSingleLiveLine(
      fakeDiscordId,
      chanId,
      chanName,
      targetChan?.guild_id || liveMonitor.guild_id || '1250416860000817162',
      nowTs,
      chosen.player,
      chosen.message,
      chanGm
    );

    liveMonitor.total_seen_live++;
    liveMonitor.recent_messages.unshift(item);
    if (liveMonitor.recent_messages.length > 250) liveMonitor.recent_messages.length = 250;

    if (item.is_flagged) {
      if (targetChan) targetChan.flags_detected++;
      liveMonitor.total_flagged_live++;
      liveMonitor.active_alerts.unshift(item);
      if (liveMonitor.active_alerts.length > 150) liveMonitor.active_alerts.length = 150;
    }

    res.json(item);
  });

  app.post('/api/v1/discord/fetch', async (req, res) => {
    try {
      const {
        token,
        channel_id,
        limit = 25000,
        start_date,
        end_date,
        async_mode = false,
        use_cache = true,
        force_rescan = false,
      } = req.body || {};
      if (!token || !String(token).trim()) {
        res.status(400).json({ detail: 'Discord Token is required.' });
        return;
      }
      if (!channel_id || !String(channel_id).trim()) {
        res.status(400).json({ detail: 'Discord Channel ID or Channel URL is required.' });
        return;
      }

      const rawChannelInput = String(channel_id).trim();
      const snowflakeMatches = rawChannelInput.match(/\d{15,22}/g);
      const extractedChannelId = snowflakeMatches ? snowflakeMatches[snowflakeMatches.length - 1] : rawChannelInput;
      let extractedGuildId = snowflakeMatches && snowflakeMatches.length >= 2 ? snowflakeMatches[0] : undefined;

      if (!/^\d{15,22}$/.test(extractedChannelId)) {
        res.status(400).json({
          detail: `Invalid Discord Channel ID '${rawChannelInput}'. Provide a 17-20 digit Channel ID or Discord channel link.`,
        });
        return;
      }

      // Mutual exclusivity contract:
      // If moderating via Date way (moderate_by === 'date' OR (start_date provided and moderate_by !== 'limit')):
      // -> message limit is completely IRRELEVANT (unbounded up to 100,000 safe network ceiling, fetches all msgs in date range).
      // If moderating via Message Limit way (moderate_by === 'limit' OR (no start_date and moderate_by !== 'date')):
      // -> dates are completely IRRELEVANT (fetches newest N messages with zero date cutoff, ignores any start_date / end_date).
      const isDateMode = req.body?.moderate_by === 'date' || (req.body?.moderate_by !== 'limit' && Boolean(start_date && String(start_date).trim()));
      const maxMessages = isDateMode ? 100000 : Math.min(100000, Math.max(10, Number(limit) || 25000));
      let channelName = `discord-channel-${extractedChannelId}`;

      const startDateMs = isDateMode && typeof start_date === 'string' && start_date.trim() ? new Date(`${start_date.trim()}T00:00:00Z`).getTime() : null;
      const endDateMs = isDateMode && typeof end_date === 'string' && end_date.trim() ? new Date(`${end_date.trim()}T23:59:59.999Z`).getTime() : null;

      // Save token & selected channel to persistent session state
      sessionState.token = String(token).trim();
      sessionState.selected_channel_id = extractedChannelId;

      try {
        const chanRes = await fetchDiscordWithToken(
          `https://discord.com/api/v10/channels/${extractedChannelId}`,
          String(token)
        );
        if (chanRes.ok) {
          const chanInfo: any = await chanRes.json();
          if (chanInfo?.name) {
            channelName = `#${chanInfo.name} (${extractedChannelId})`;
            const matchingPreset = sessionState.preset_channels.find(
              (p) => p.channel_id === extractedChannelId
            );
            if (matchingPreset) {
              matchingPreset.name = `#${chanInfo.name}`;
            }
          }
          if (chanInfo?.guild_id) {
            extractedGuildId = String(chanInfo.guild_id);
          }
        }
      } catch {
        // Ignore metadata lookup errors
      }
      saveSessionState();

      // Check Smart Scan Memory Cache for this channel
      const existingCache =
        use_cache && !force_rescan ? channelMemoryCache.get(extractedChannelId) : undefined;
      const cachedIdSet = new Set<string>(
        existingCache ? existingCache.raw_discord_messages.map((m: any) => String(m.id)) : []
      );

      // Fetch first batch immediately to validate token and channel access
      const firstBatchSize = isDateMode ? 100 : Math.min(100, maxMessages);
      const firstUrl = `https://discord.com/api/v10/channels/${extractedChannelId}/messages?limit=${firstBatchSize}`;
      const firstRes = await fetchDiscordWithToken(firstUrl, String(token));

      if (!firstRes.ok) {
        const errBody: any = await firstRes.json().catch(() => ({}));
        const discordMsg = errBody?.message || `HTTP ${firstRes.status}`;
        res.status(firstRes.status === 401 || firstRes.status === 403 ? 401 : 400).json({
          detail: `Discord API Error (${firstRes.status}): ${discordMsg}. Verify your Discord Token and Channel read permissions.`,
        });
        return;
      }

      const firstBatch: any[] = await firstRes.json();
      const newDiscordMessages: any[] = [];
      let hitCachedBoundary = false;

      if (Array.isArray(firstBatch)) {
        for (const msg of firstBatch) {
          if (cachedIdSet.has(String(msg.id))) {
            hitCachedBoundary = true;
            break;
          }
          if (isDateMode && startDateMs !== null && msg.timestamp) {
            const mTime = new Date(msg.timestamp).getTime();
            if (!isNaN(mTime) && mTime < startDateMs) {
              hitCachedBoundary = true;
              break;
            }
          }
          newDiscordMessages.push(msg);
        }
      }

      // Helper to merge newly fetched messages with cached messages, persist to Smart Memory Vault, and evaluate
      const finalizeAndStoreWithMemory = (newlyFetched: any[]): LogParseResponse => {
        const reusedFromCache = existingCache ? existingCache.raw_discord_messages : [];
        let combinedRaw = [...newlyFetched, ...reusedFromCache];

        if (isDateMode) {
          // Moderating via Date: Message limit is IRRELEVANT. Retain all messages in the date range.
          if (startDateMs !== null || endDateMs !== null) {
            combinedRaw = combinedRaw.filter((m: any) => {
              if (!m.timestamp) return true;
              const t = new Date(m.timestamp).getTime();
              if (isNaN(t)) return true;
              if (startDateMs !== null && t < startDateMs) return false;
              if (endDateMs !== null && t > endDateMs) return false;
              return true;
            });
          }
        } else {
          // Moderating via Message Limit: Dates are IRRELEVANT. Retain newest maxMessages.
          combinedRaw = combinedRaw.slice(0, maxMessages);
        }

        const syncedAt = new Date().toISOString().replace('T', ' ').slice(0, 19);

        const finalResult = processDiscordMessagesArray(
          channelName,
          isDateMode ? combinedRaw : combinedRaw.slice(0, maxMessages),
          extractedGuildId,
          extractedChannelId
        );

        const cacheRecord: ChannelMemoryCacheRecord = {
          channel_id: extractedChannelId,
          channel_name: channelName,
          guild_id: extractedGuildId,
          detected_gamemode: finalResult.detected_gamemode,
          last_synced_at: syncedAt,
          newest_message_id: combinedRaw[0]?.id ? String(combinedRaw[0].id) : undefined,
          raw_discord_messages: combinedRaw,
          cached_summary: {
            cached_messages_count: combinedRaw.length,
            flagged_messages_count: finalResult.flagged_messages_count,
            critical_severity_count: finalResult.critical_severity_count,
            high_severity_count: finalResult.high_severity_count,
          },
        };
        saveChannelMemoryToDisk(cacheRecord);

        finalResult.cache_metadata = {
          cache_hit: Boolean(existingCache && reusedFromCache.length > 0),
          cached_messages_reused: reusedFromCache.length,
          newly_scanned_messages: newlyFetched.length,
          total_cached_in_channel: combinedRaw.length,
          last_synced_at: syncedAt,
        };
        return finalResult;
      };

      // If we hit the cached message boundary in the very first batch (and cache already satisfies limit or has history), return immediately without re-scanning old pages!
      if (
        (hitCachedBoundary && existingCache && existingCache.raw_discord_messages.length > 0) ||
        !async_mode ||
        newDiscordMessages.length >= maxMessages ||
        firstBatch.length < firstBatchSize
      ) {
        let beforeId = firstBatch[firstBatch.length - 1]?.id;
        while (
          !hitCachedBoundary &&
          !async_mode &&
          (isDateMode ? newDiscordMessages.length < 100000 : newDiscordMessages.length < maxMessages) &&
          beforeId
        ) {
          const batchSize = isDateMode ? 100 : Math.min(100, maxMessages - newDiscordMessages.length);
          const query = new URLSearchParams({ limit: String(batchSize), before: beforeId });
          const msgUrl = `https://discord.com/api/v10/channels/${extractedChannelId}/messages?${query.toString()}`;
          const msgRes = await fetchDiscordWithToken(msgUrl, String(token));
          if (!msgRes.ok) break;
          const batch: any[] = await msgRes.json();
          if (!Array.isArray(batch) || batch.length === 0) break;
          for (const m of batch) {
            if (cachedIdSet.has(String(m.id))) {
              hitCachedBoundary = true;
              break;
            }
            if (isDateMode && startDateMs !== null && m.timestamp) {
              const mTime = new Date(m.timestamp).getTime();
              if (!isNaN(mTime) && mTime < startDateMs) {
                hitCachedBoundary = true;
                break;
              }
            }
            newDiscordMessages.push(m);
          }
          beforeId = batch[batch.length - 1]?.id;
          if (batch.length < batchSize) break;
        }

        const finalResult = finalizeAndStoreWithMemory(newDiscordMessages);
        res.json(finalResult);
        return;
      }

      // Start background pagination for large message limits or deep date timeline
      discordFetchJob.status = 'fetching';
      discordFetchJob.fetched = newDiscordMessages.length + (existingCache?.raw_discord_messages.length || 0);
      discordFetchJob.target = isDateMode ? 0 : maxMessages;
      discordFetchJob.mode = isDateMode ? 'date' : 'limit';
      discordFetchJob.channelName = channelName;
      discordFetchJob.rateLimitWaitMs = 0;
      discordFetchJob.stopRequested = false;
      discordFetchJob.result = null;
      discordFetchJob.error = null;

      res.json({
        async_job: true,
        status: 'fetching',
        fetched: discordFetchJob.fetched,
        target: isDateMode ? 0 : maxMessages,
        mode: isDateMode ? 'date' : 'limit',
        channel_name: channelName,
      });

      // Background pagination task
      (async () => {
        try {
          let beforeId = firstBatch[firstBatch.length - 1]?.id;
          while (
            !hitCachedBoundary &&
            (isDateMode
              ? newDiscordMessages.length < 100000
              : newDiscordMessages.length + (existingCache?.raw_discord_messages.length || 0) < maxMessages) &&
            beforeId &&
            !discordFetchJob.stopRequested
          ) {
            const remainingNeeded = isDateMode
              ? 100
              : maxMessages - (newDiscordMessages.length + (existingCache?.raw_discord_messages.length || 0));
            const batchSize = Math.min(100, Math.max(1, remainingNeeded));
            const query = new URLSearchParams({ limit: String(batchSize), before: beforeId });
            const msgUrl = `https://discord.com/api/v10/channels/${extractedChannelId}/messages?${query.toString()}`;

            const msgRes = await fetchDiscordWithToken(msgUrl, String(token), (waitMs) => {
              discordFetchJob.rateLimitWaitMs = waitMs;
            });

            if (!msgRes.ok) {
              if (newDiscordMessages.length > 0 || (existingCache?.raw_discord_messages.length || 0) > 0) break;
              const errBody: any = await msgRes.json().catch(() => ({}));
              throw new Error(errBody?.message || `Discord API Error ${msgRes.status}`);
            }

            const batch: any[] = await msgRes.json();
            if (!Array.isArray(batch) || batch.length === 0) break;

            for (const m of batch) {
              if (cachedIdSet.has(String(m.id))) {
                hitCachedBoundary = true;
                break;
              }
              if (isDateMode && startDateMs !== null && m.timestamp) {
                const mTime = new Date(m.timestamp).getTime();
                if (!isNaN(mTime) && mTime < startDateMs) {
                  hitCachedBoundary = true;
                  break;
                }
              }
              newDiscordMessages.push(m);
            }

            discordFetchJob.fetched =
              newDiscordMessages.length + (existingCache?.raw_discord_messages.length || 0);
            beforeId = batch[batch.length - 1]?.id;
            if (batch.length < batchSize) break;
          }

          discordFetchJob.status = 'analyzing';
          const finalResult = finalizeAndStoreWithMemory(newDiscordMessages);
          discordFetchJob.result = finalResult;
          discordFetchJob.status = 'completed';
        } catch (bgErr: any) {
          discordFetchJob.error = bgErr?.message || 'Background Discord fetch failed.';
          discordFetchJob.status = 'error';
        }
      })();
    } catch (err: any) {
      res.status(500).json({
        detail: err?.message || 'Failed to fetch messages from Discord via token.',
      });
    }
  });

  app.post('/api/v1/upload', upload.single('file'), (req, res) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ detail: 'No file uploaded.' });
      return;
    }

    const filename = file.originalname || 'unknown.log';
    const ext = path.extname(filename).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      res.status(400).json({
        detail: `Unsupported file format '${ext}'. Allowed extensions are: .csv, .log, .txt`,
      });
      return;
    }

    const contentStr = file.buffer.toString('utf-8');
    if (!contentStr.trim()) {
      res.status(400).json({ detail: 'Uploaded file is empty.' });
      return;
    }

    const formatHint = typeof req.query.format_hint === 'string' ? req.query.format_hint : undefined;
    const result = parserManager.processFileContent(filename, contentStr, formatHint);
    res.json({ ...result, messages_preview: [] });
  });

  app.get('/api/v1/messages', (req, res) => {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const pageSize = Math.min(500, Math.max(1, parseInt(String(req.query.page_size || '200'), 10) || 200));
    const flaggedOnly = req.query.flagged_only === 'true';
    const severity = typeof req.query.severity === 'string' ? req.query.severity : undefined;
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const player = typeof req.query.player === 'string' ? req.query.player : undefined;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const sortBy = typeof req.query.sort_by === 'string' ? req.query.sort_by : 'severity';
    const startDate = typeof req.query.start_date === 'string' && req.query.start_date.trim() ? req.query.start_date.trim() : undefined;
    const endDate = typeof req.query.end_date === 'string' && req.query.end_date.trim() ? req.query.end_date.trim() : undefined;

    let msgs = [...parserManager.currentMessages];

    if (flaggedOnly) msgs = msgs.filter((m) => m.is_flagged);
    if (severity) msgs = msgs.filter((m) => m.severity === severity);
    if (category) msgs = msgs.filter((m) => m.categories.includes(category));
    if (player) msgs = msgs.filter((m) => m.player === player);
    if (status) msgs = msgs.filter((m) => m.review_status === status);
    if (search) {
      const q = search.toLowerCase();
      msgs = msgs.filter((m) => m.message.toLowerCase().includes(q) || m.player.toLowerCase().includes(q));
    }

    if (startDate) {
      // startDate is YYYY-MM-DD
      const startMs = new Date(`${startDate}T00:00:00`).getTime();
      msgs = msgs.filter((m) => {
        const dStr = extractDateString(m.timestamp);
        if (dStr) {
          return dStr >= startDate;
        }
        const ms = parseTimestampToMillis(m.timestamp);
        if (ms !== null) {
          return ms >= startMs;
        }
        // Fallback for timestamps with no full date: if date is filtered, don't drop if start date is today
        return true;
      });
    }

    if (endDate) {
      // endDate is YYYY-MM-DD
      const endMs = new Date(`${endDate}T23:59:59.999`).getTime();
      msgs = msgs.filter((m) => {
        const dStr = extractDateString(m.timestamp);
        if (dStr) {
          return dStr <= endDate;
        }
        const ms = parseTimestampToMillis(m.timestamp);
        if (ms !== null) {
          return ms <= endMs;
        }
        return true;
      });
    }

    const SEVERITY_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1, none: 0 };
    if (sortBy === 'severity') {
      msgs.sort((a, b) => {
        const diff = (SEVERITY_RANK[b.severity] || 0) - (SEVERITY_RANK[a.severity] || 0);
        return diff !== 0 ? diff : b.overall_score - a.overall_score;
      });
    } else if (sortBy === 'confidence') {
      msgs.sort((a, b) => b.confidence - a.confidence);
    } else if (sortBy === 'line_desc') {
      msgs.sort((a, b) => b.line_number - a.line_number);
    } else {
      msgs.sort((a, b) => a.line_number - b.line_number);
    }

    const total = msgs.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const start = (page - 1) * pageSize;
    const pageMsgs = msgs.slice(start, start + pageSize);

    res.json({
      total,
      page,
      page_size: pageSize,
      total_pages: totalPages,
      messages: pageMsgs,
    });
  });

  app.get('/api/v1/sample', (_req, res) => {
    const sampleContent = `[21:14:02 INFO]: Starting minecraft server version 1.20.4
[21:14:05 INFO]: Loading properties
[21:14:10 INFO]: Done (4.812s)! For help, type "help"
[21:14:15 INFO]: Steve[/127.0.0.1:54321] logged in with entity id 120
[21:14:15 INFO]: Steve joined the game
[21:14:18 INFO]: Alex[/127.0.0.1:54322] logged in with entity id 121
[21:14:18 INFO]: Alex joined the game
[21:14:20 INFO]: [Admin] <Steve> Welcome everyone! Check your compass to locate the main fortress.
[21:14:24 INFO]: <Alex> Hey Steve! Look at all the tall green grass around spawn, looks great.
[21:14:28 INFO]: <Alex> Can anyone assist me with gathering cobblestone?
[21:14:30 INFO]: Griefer99[/127.0.0.1:54323] logged in with entity id 122
[21:14:30 INFO]: Griefer99 joined the game
[21:14:32 INFO]: <Griefer99> ez noobs
[21:14:40 INFO]: <Griefer99> Steve you are an i.d.i.o.t
[21:14:45 INFO]: <Griefer99> GIVE ME DIAMONDS RIGHT NOW OR GET WRECKED
[21:14:50 INFO]: <Alex> why are you yelling????!!!!!
[21:14:55 INFO]: <Griefer99> Join my server at 192.168.1.50:25565 or discord.gg/cheatclub
[21:15:02 INFO]: <Griefer99> kys Steve or i will leak your coords
[21:15:06 INFO]: <Griefer99> nobody wants you here, uninstall the game and delete your account
[21:15:10 INFO]: <Steve> What the fuck is wrong with this player?
[21:15:15 INFO]: Steve was slain by Griefer99
[21:15:20 INFO]: [Mod] <Alex> Reporting Griefer99 for harassment and death threats.
[21:15:25 INFO]: Steve issued server command: /mute Griefer99
[21:15:28 INFO]: DesiRider[/127.0.0.1:54324] logged in with entity id 123
[21:15:30 INFO]: <DesiRider> abe Steve teri maki chut noob tmkc
[21:15:34 INFO]: <Steve> What did you just say?
[21:15:38 INFO]: <DesiRider> bhenchod chup kar bsdk diamonds wapas de
[21:15:42 INFO]: <Alex> Warning: abusive language in Hindi is also strictly moderated here
[21:15:46 INFO]: <DesiRider> jaan se maar dunga tujhe chutiye
[21:15:50 INFO]: Steve issued server command: /ban DesiRider Severe Hindi Harassment and Threats
`;
    const result = parserManager.processFileContent('sample_minecraft.log', sampleContent);
    result.detected_gamemode = 'SMP';
    result.messages_preview = result.messages_preview.map((m) => ({
      ...m,
      discord_message_url:
        m.discord_message_url ||
        `https://discord.com/channels/1092837465192837465/1182736451928374651/${1200000000000000000 + m.line_number}`,
    }));
    parserManager.currentMessages = result.messages_preview;
    res.json(result);
  });

  app.get('/api/v1/messages/:msg_id/context', (req, res) => {
    const msgId = parseInt(req.params.msg_id, 10);
    const windowSize = Math.min(10, Math.max(1, parseInt(String(req.query.window || '3'), 10) || 3));
    try {
      const ctx = parserManager.getMessageContext(msgId, windowSize);
      res.json(ctx);
    } catch (e: any) {
      res.status(404).json({ detail: e?.message || 'Not found' });
    }
  });

  app.post('/api/v1/messages/:msg_id/action', (req, res) => {
    const msgId = parseInt(req.params.msg_id, 10);
    const { action, notes } = req.body || {};
    try {
      const updated = parserManager.updateMessageAction(msgId, action, notes);
      res.json(updated);
    } catch (e: any) {
      res.status(404).json({ detail: e?.message || 'Not found' });
    }
  });

  app.get('/api/v1/players', (_req, res) => {
    res.json(parserManager.currentProfiles);
  });

  app.get('/api/v1/players/:username', (req, res) => {
    const { username } = req.params;
    const profile = parserManager.currentProfiles[username];
    if (!profile) {
      res.status(404).json({ detail: `Player '${username}' not found in active dataset.` });
      return;
    }
    const playerMessages = parserManager.currentMessages.filter((m) => m.player === username);
    res.json({
      profile,
      messages: playerMessages,
    });
  });

  app.get('/api/v1/analytics/summary', (_req, res) => {
    const totalMsgs = parserManager.currentMessages.length;
    const flaggedMsgs = parserManager.currentMessages.filter((m) => m.is_flagged);
    const reviewedCount = parserManager.currentMessages.filter((m) => m.review_status !== 'unreviewed').length;
    const fpCount = parserManager.currentMessages.filter((m) => m.review_status === 'false_positive').length;
    const confirmedCount = parserManager.currentMessages.filter((m) => m.review_status === 'confirmed').length;
    const fpRate = reviewedCount > 0 ? Number(((fpCount / reviewedCount) * 100).toFixed(1)) : 0.0;

    res.json({
      total_messages: totalMsgs,
      total_flagged: flaggedMsgs.length,
      total_players: Object.keys(parserManager.currentProfiles).length,
      reviewed_count: reviewedCount,
      confirmed_count: confirmedCount,
      false_positive_count: fpCount,
      false_positive_rate: fpRate,
      top_flagged_players: Object.values(parserManager.currentProfiles)
        .filter((p) => p.flagged_messages > 0)
        .sort((a, b) => b.flagged_messages - a.flagged_messages)
        .slice(0, 5),
    });
  });

  app.get('/api/v1/export/report', (req, res) => {
    if (!parserManager.currentMessages.length) {
      res.status(400).json({ detail: 'No active log data to export.' });
      return;
    }

    const format = req.query.format === 'csv' ? 'csv' : 'json';
    if (format === 'json') {
      const data = {
        summary: {
          total_messages: parserManager.currentMessages.length,
          total_flagged: parserManager.currentMessages.filter((m) => m.is_flagged).length,
          players: Object.keys(parserManager.currentProfiles).length,
        },
        flagged_messages: parserManager.currentMessages.filter((m) => m.is_flagged),
        players: parserManager.currentProfiles,
      };
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=moderation_report.json');
      res.send(JSON.stringify(data, null, 2));
    } else {
      const escapeCsv = (val: unknown) => {
        const s = String(val ?? '');
        return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const rows = [
        ['Line', 'Timestamp', 'Player', 'Message', 'Severity', 'Confidence', 'Categories', 'Review_Status', 'Notes', 'Reasons'].join(','),
      ];
      for (const m of parserManager.currentMessages) {
        if (m.is_flagged) {
          rows.push(
            [
              m.line_number,
              m.timestamp,
              m.player,
              m.message,
              m.severity,
              m.confidence,
              m.categories.join('; '),
              m.review_status,
              m.moderator_notes,
              m.reasons.join(' | '),
            ]
              .map(escapeCsv)
              .join(',')
          );
        }
      }
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=moderation_report.csv');
      res.send(rows.join('\n'));
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = process.env.MODSTUDIO_DIST_PATH
      ? path.resolve(process.env.MODSTUDIO_DIST_PATH)
      : path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const targetPort = customPort ?? (Number(process.env.PORT) || 3000);
  return new Promise<number>((resolve) => {
    const srv = app.listen(targetPort, '0.0.0.0', () => {
      const addr = srv.address();
      const actualPort = typeof addr === 'object' && addr ? addr.port : targetPort;
      console.log(`Server running on http://0.0.0.0:${actualPort}`);
      resolve(actualPort);
    });
  });
}

if (!process.env.MODSTUDIO_EMBEDDED) {
  startServer();
}
