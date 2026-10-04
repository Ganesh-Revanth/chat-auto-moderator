import express from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import WebSocket from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SESSION_STORE_PATH = path.join(__dirname, '.discord_session.json');

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
}

export interface PunishmentRecord {
  id: number;
  case_id: string;
  created_at: string;
  message_id?: number;
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
]);

type PatternTuple = [RegExp, string, number, string];

const SLUR_PATTERNS: PatternTuple[] = [
  [/\b(n[i1l]gg[e3a4]r?|n[i1l]g+a)\b/i, 'Severe racial slur detected', 0.99, 'critical'],
  [/\b(f[a4]gg?[o0i1]t?s?|f[a4]g)\b/i, 'Severe homophobic slur detected', 0.98, 'critical'],
  [/\b(tr[a4]nn[y1i]|ch[i1]nk|k[i1]ke|sp[i1]c|w[e3]tb[a4]ck)\b/i, 'Hate speech / identity slur detected', 0.98, 'critical'],
  [/\b(retard(?:ed)?|tard)\b/i, 'Ableist slur / derogatory term detected', 0.94, 'high'],
];

const THREAT_PATTERNS: PatternTuple[] = [
  [/\b(k[y1i]s|k[i1]ll\s+y(?:our)?self)\b/i, 'Suicide encouragement / threat (kys)', 0.98, 'critical'],
  [/\b(i(?:\s*will|'ll|\s+gonna)\s+(?:[\w\s]{0,20}\s+)?(?:kill|murder|hunt|shoot|stab|slit)\s+(?:you|u))\b/i, 'Direct physical violence threat', 0.95, 'critical'],
  [/\b(doxx?(?:ing|ed)?\s+you|leak(?:ing)?\s+your\s+(?:ip|address|coords))\b/i, 'Doxxing / personal information threat', 0.93, 'high'],
  [/\b(swat(?:ting)?\s+you)\b/i, 'Swatting threat', 0.95, 'critical'],
];

const INSULT_PATTERNS: PatternTuple[] = [
  [/\b(idiot|idiots|idiotic)\b/i, 'Direct insult (idiot)', 0.90, 'medium'],
  [/\b(moron|morons|imbecile)\b/i, 'Direct insult (moron)', 0.88, 'medium'],
  [/\b(loser|losers|noob|trash\s+player)\b/i, 'Derogatory taunt / insult', 0.75, 'low'],
  [/\b(stfu|shut\s+up|get\s+lost|get\s+cancer)\b/i, 'Hostile harassment / abusive demand', 0.86, 'medium'],
  [/\b(clown|garbage|worthless)\b/i, 'Belittling insult', 0.80, 'low'],
];

const PROFANITY_PATTERNS: PatternTuple[] = [
  [/\b(f+u+c+k+(?:ing|er|ed)?|f+k)\b/gi, 'Explicit profanity (f-word)', 0.92, 'medium'],
  [/\b(s+h+i+t+(?:ty|head)?)\b/gi, 'Vulgar profanity (shit)', 0.85, 'low'],
  [/\b(b+i+t+c+h+(?:es)?)\b/gi, 'Vulgar profanity (bitch)', 0.90, 'medium'],
  [/\b(a+s+s+h+o+l+e+s?)\b/gi, 'Vulgar profanity (asshole)', 0.90, 'medium'],
  [/\b(b+a+s+t+a+r+d+s?)\b/gi, 'Vulgar profanity (bastard)', 0.85, 'low'],
  [/\b(c+u+n+t+s?)\b/gi, 'Severe profanity (cunt)', 0.96, 'high'],
  [/\b(d+i+c+k+(?:head)?)\b/gi, 'Vulgar profanity (dick)', 0.88, 'medium'],
  [/\b(p+u+s+s+y+)\b/gi, 'Vulgar profanity (pussy)', 0.90, 'medium'],
];

const SEXUAL_PATTERNS: PatternTuple[] = [
  [/\b(send\s+nudes?|nsfw|porn(?:o|ography)?|xxx)\b/i, 'Inappropriate / sexual solicitation', 0.92, 'high'],
  [/\b(horny|blowjob|handjob|hentai)\b/i, 'Sexually explicit content', 0.88, 'medium'],
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

    // 1. Spam checks
    const alphaChars = Array.from(rawMessage).filter((c) => /[a-zA-Z]/.test(c));
    if (alphaChars.length >= 6) {
      const upperCount = alphaChars.filter((c) => c === c.toUpperCase() && c !== c.toLowerCase()).length;
      if (upperCount / alphaChars.length >= 0.75) {
        categories.add('spam');
        updateSeverity('low');
        updateConfidence(0.85);
        reasons.push('Excessive capitalization (caps lock spam)');
      }
    }

    if (/[!?]{4,}/.test(rawMessage)) {
      categories.add('spam');
      updateSeverity('low');
      updateConfidence(0.80);
      reasons.push('Excessive punctuation spam');
    }

    if (/([a-zA-Z])\1{5,}/.test(rawMessage)) {
      categories.add('spam');
      updateSeverity('low');
      updateConfidence(0.80);
      reasons.push('Character flood repetition spam');
    }

    // 2. Suspicious URLs / Ads
    for (const [pattern, reason, conf, sev] of SUSPICIOUS_URL_PATTERNS) {
      if (pattern.test(rawMessage)) {
        categories.add('suspicious_url');
        updateSeverity(sev);
        updateConfidence(conf);
        reasons.push(reason);
      }
    }

    // 3. Content normalization
    const deobfuscated = normalizer.deobfuscate(rawMessage);

    for (const [pattern, reason, conf, sev] of SLUR_PATTERNS) {
      if (pattern.test(deobfuscated)) {
        categories.add('slur');
        updateSeverity(sev);
        updateConfidence(conf);
        reasons.push(reason);
      }
    }

    for (const [pattern, reason, conf, sev] of THREAT_PATTERNS) {
      if (pattern.test(deobfuscated)) {
        categories.add('threat');
        updateSeverity(sev);
        updateConfidence(conf);
        reasons.push(reason);
      }
    }

    for (const [pattern, reason, conf, sev] of INSULT_PATTERNS) {
      if (pattern.test(deobfuscated)) {
        categories.add('insult');
        updateSeverity(sev);
        updateConfidence(conf);
        reasons.push(reason);
      }
    }

    for (const [pattern, reason, conf, sev] of PROFANITY_PATTERNS) {
      pattern.lastIndex = 0;
      const matches = deobfuscated.matchAll(pattern);
      for (const match of matches) {
        const word = match[0].toLowerCase();
        if (EXEMPT_WORDS.has(word)) continue;
        categories.add('profanity');
        updateSeverity(sev);
        updateConfidence(conf);
        reasons.push(`${reason}: '${word}'`);
        break;
      }
    }

    for (const [pattern, reason, conf, sev] of SEXUAL_PATTERNS) {
      if (pattern.test(deobfuscated)) {
        categories.add('sexual');
        updateSeverity(sev);
        updateConfidence(conf);
        reasons.push(reason);
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
  };

  private identityMarkers: Record<string, number> = {
    'go back to your country': 0.95,
    'people like you': 0.60,
    'your kind': 0.70,
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

    const isTargeted = /\b(you\s*re|you\s*are|u\s*r|ur|you)\b/.test(msgLower);
    if (isTargeted && (toxicity > 0 || harassment > 0)) {
      personal_attack = Math.min(1.0, personal_attack + 0.15);
      harassment = Math.min(1.0, harassment + 0.10);
    }

    if (/\b(fuck|shit|bitch|cunt|dick|asshole)\b/.test(msgLower)) {
      toxicity = Math.max(toxicity, 0.75);
      if (msgLower.includes('fuck you') || msgLower.includes('bitch')) {
        personal_attack = Math.max(personal_attack, 0.80);
        harassment = Math.max(harassment, 0.75);
      }
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
// 8. AUTOMATED /STAFF LOG PUNISHMENT + MODAL SUBMITTER
// ==========================================

const punishmentsStore: PunishmentRecord[] = [];
let nextPunishmentId = 1;

interface DiscoveredCommandInfo {
  candidates: any[];
  allCommandNames: string[];
}

function scoreCommandCandidate(c: any): number {
  if (!c) return -1;
  const name = String(c?.name || '').toLowerCase();
  const opts: any[] = Array.isArray(c?.options) ? c.options : [];
  const hasLogGroup = opts.some((o) => o?.type === 2 && String(o?.name || '').toLowerCase() === 'log');
  const hasPunishSub = opts.some(
    (o) =>
      String(o?.name || '').toLowerCase().includes('punish') ||
      (Array.isArray(o?.options) && o.options.some((so: any) => String(so?.name || '').toLowerCase().includes('punish')))
  );

  let score = 0;
  if (name === 'staff') score += 100;
  if (hasLogGroup) score += 60;
  if (hasPunishSub) score += 50;
  if (name.includes('staff')) score += 25;
  if (name.includes('punish') || name === 'log') score += 20;
  return score;
}

async function discoverDiscordStaffCommand(
  cleanToken: string,
  guildId: string,
  channelId: string
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
    .map((c) => ({ cmd: c, score: scoreCommandCandidate(c) }))
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
    punishmentType: string;
    duration: string;
    evidenceLinks: string;
    username: string;
    reason: string;
    gamemode: string;
  }
): any[] {
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

  // 1. Exact check for `/staff log punishment` (subcommand group `log` -> subcommand `punishment`)
  const logGroup =
    cmdOptions.find((o) => o.type === 2 && String(o.name).toLowerCase() === 'log') ||
    cmdOptions.find((o) => o.type === 2);
  if (logGroup && Array.isArray(logGroup.options)) {
    const punishSub =
      logGroup.options.find((o: any) => o.type === 1 && String(o.name).toLowerCase() === 'punishment') ||
      logGroup.options.find((o: any) => o.type === 1 && String(o.name).toLowerCase().includes('punish')) ||
      logGroup.options.find((o: any) => o.type === 1) ||
      logGroup.options[0];
    if (punishSub) {
      const subLeafs = Array.isArray(punishSub.options) ? mapLeafOptions(punishSub.options) : [];
      return [
        {
          type: 2,
          name: logGroup.name,
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

  // 2. Check if command has direct subcommand `log` or `punishment` or `log_punishment` (type 1)
  const directSub =
    cmdOptions.find(
      (o) =>
        o.type === 1 &&
        (String(o.name).toLowerCase().includes('punish') || String(o.name).toLowerCase().includes('log'))
    ) || cmdOptions.find((o) => o.type === 1);
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

  // Fallback to standard `/staff log punishment` structure
  return [
    {
      type: 2,
      name: 'log',
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
  punishmentType: string;
  duration: string;
  evidenceLinks: string;
  username: string;
  reason: string;
  gamemode: string;
}): Promise<{ ok: boolean; detail: string }> {
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
  const { candidates, allCommandNames } = await discoverDiscordStaffCommand(cleanToken, guildId, channelId);

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
          ? `Step 1 (/staff log punishment) was accepted in ${chanName}, but timed out waiting for the Step 2 modal popup from the bot. Check if ${chanName} allows slash commands.`
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
                detail: `2-Step Automation Complete in ${chanName}: Step 1 sent /staff log punishment -> Step 2 caught Modal "${modal.title || 'Punishment'}" & submitted (${filledSummary.join(', ')})!`,
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

async function startServer() {
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

      const id = nextPunishmentId++;
      const caseId = `CASE-${String(id).padStart(4, '0')}`;
      const commandString = `/staff log punishment punishment_type:${punishment_type} duration:${duration} evidence_links:${evidence_links}`;

      let discordStatus: 'logged_locally' | 'sent_to_discord' | 'failed' = 'logged_locally';
      let discordDetail = 'Saved to Punishment Log.';

      if (auto_send_discord) {
        if (!token || !staff_channel_id) {
          discordStatus = 'failed';
          discordDetail = 'Discord Token and Staff Command Channel ID are required to auto-submit to Discord.';
        } else {
          const dispatchRes = await executeDiscordStaffLogInteraction({
            token: String(token),
            staffChannelId: String(staff_channel_id),
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
            `[${caseId}] ${punishment_type} (${duration}) - ${reason} [${gamemode}]`
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

  app.post('/api/v1/discord/fetch', async (req, res) => {
    try {
      const { token, channel_id, limit = 25000, async_mode = false } = req.body || {};
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

      const maxMessages = Math.min(100000, Math.max(10, Number(limit) || 25000));
      let channelName = `discord-channel-${extractedChannelId}`;

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

      // Fetch first batch immediately to validate token and channel access
      const firstBatchSize = Math.min(100, maxMessages);
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
      const allDiscordMessages: any[] = Array.isArray(firstBatch) ? [...firstBatch] : [];

      // If everything fits in first batch or synchronous mode requested for small fetch
      if (!async_mode || allDiscordMessages.length >= maxMessages || allDiscordMessages.length < firstBatchSize) {
        let beforeId = allDiscordMessages[allDiscordMessages.length - 1]?.id;
        while (!async_mode && allDiscordMessages.length < maxMessages && beforeId) {
          const batchSize = Math.min(100, maxMessages - allDiscordMessages.length);
          const query = new URLSearchParams({ limit: String(batchSize), before: beforeId });
          const msgUrl = `https://discord.com/api/v10/channels/${extractedChannelId}/messages?${query.toString()}`;
          const msgRes = await fetchDiscordWithToken(msgUrl, String(token));
          if (!msgRes.ok) break;
          const batch: any[] = await msgRes.json();
          if (!Array.isArray(batch) || batch.length === 0) break;
          allDiscordMessages.push(...batch);
          beforeId = batch[batch.length - 1]?.id;
          if (batch.length < batchSize) break;
        }
        const finalResult = processDiscordMessagesArray(
          channelName,
          allDiscordMessages,
          extractedGuildId,
          extractedChannelId
        );
        res.json(finalResult);
        return;
      }

      // Start background pagination for large message limits (up to 100,000+)
      discordFetchJob.status = 'fetching';
      discordFetchJob.fetched = allDiscordMessages.length;
      discordFetchJob.target = maxMessages;
      discordFetchJob.channelName = channelName;
      discordFetchJob.rateLimitWaitMs = 0;
      discordFetchJob.stopRequested = false;
      discordFetchJob.result = null;
      discordFetchJob.error = null;

      res.json({
        async_job: true,
        status: 'fetching',
        fetched: allDiscordMessages.length,
        target: maxMessages,
        channel_name: channelName,
      });

      // Background pagination task
      (async () => {
        try {
          let beforeId = allDiscordMessages[allDiscordMessages.length - 1]?.id;
          while (
            allDiscordMessages.length < maxMessages &&
            beforeId &&
            !discordFetchJob.stopRequested
          ) {
            const batchSize = Math.min(100, maxMessages - allDiscordMessages.length);
            const query = new URLSearchParams({ limit: String(batchSize), before: beforeId });
            const msgUrl = `https://discord.com/api/v10/channels/${extractedChannelId}/messages?${query.toString()}`;

            const msgRes = await fetchDiscordWithToken(msgUrl, String(token), (waitMs) => {
              discordFetchJob.rateLimitWaitMs = waitMs;
            });

            if (!msgRes.ok) {
              // If an intermediate batch errors after collecting messages, analyze what we have so far
              if (allDiscordMessages.length > 0) break;
              const errBody: any = await msgRes.json().catch(() => ({}));
              throw new Error(errBody?.message || `Discord API Error ${msgRes.status}`);
            }

            const batch: any[] = await msgRes.json();
            if (!Array.isArray(batch) || batch.length === 0) break;

            allDiscordMessages.push(...batch);
            discordFetchJob.fetched = allDiscordMessages.length;
            beforeId = batch[batch.length - 1]?.id;
            if (batch.length < batchSize) break;
          }

          discordFetchJob.status = 'analyzing';
          const finalResult = processDiscordMessagesArray(
            channelName,
            allDiscordMessages,
            extractedGuildId,
            extractedChannelId
          );
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
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(3000, '0.0.0.0', () => {
    console.log('Server running on http://0.0.0.0:3000');
  });
}

startServer();
