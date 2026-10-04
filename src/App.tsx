import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  UploadCloud, 
  AlertTriangle, 
  RefreshCw, 
  Search, 
  Download,
  X,
  ChevronLeft,
  ChevronRight,
  Copy,
  Send,
  Link,
  Trash2,
  Terminal
} from 'lucide-react';
import type { LogParseResponse, MessageRecord, ContextAnalysisResult, PlayerProfile, PunishmentRecord } from './types';

const API_BASE_URL = '';

interface PresetChannelItem {
  channel_id: string;
  guild_id: string;
  url: string;
  name: string;
}

const INITIAL_PRESET_CHANNELS: PresetChannelItem[] = [
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

export const App: React.FC = () => {
  const [data, setData] = useState<LogParseResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [formatHint, setFormatHint] = useState<string>('auto');
  const [ingestMode, setIngestMode] = useState<'token' | 'file'>('token');
  const [discordToken, setDiscordToken] = useState<string>(() => {
    try {
      return localStorage.getItem('discord_token_saved') || '';
    } catch {
      return '';
    }
  });
  const [discordChannelId, setDiscordChannelId] = useState<string>(() => {
    try {
      return localStorage.getItem('discord_selected_channel_id') || INITIAL_PRESET_CHANNELS[1].channel_id;
    } catch {
      return INITIAL_PRESET_CHANNELS[1].channel_id;
    }
  });
  const [presetChannels, setPresetChannels] = useState<PresetChannelItem[]>(() => {
    try {
      const raw = localStorage.getItem('discord_preset_channels');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return INITIAL_PRESET_CHANNELS;
  });
  const [isResolvingChannels, setIsResolvingChannels] = useState<boolean>(false);
  const [discordFetchLimit, setDiscordFetchLimit] = useState<number>(25000);
  const [showTokenText, setShowTokenText] = useState<boolean>(false);
  const [fetchProgress, setFetchProgress] = useState<{
    status: string;
    fetched: number;
    target: number;
    channelName: string;
    rateLimitWaitMs: number;
  } | null>(null);

  // Active Tab: 'dashboard' | 'players' | 'analytics' | 'punishments'
  const [activeTab, setActiveTab] = useState<'dashboard' | 'players' | 'analytics' | 'punishments'>('dashboard');

  // Punishment Log & Autofill state
  const [punishments, setPunishments] = useState<PunishmentRecord[]>([]);
  const [staffCommandChannelId, setStaffCommandChannelId] = useState<string>(() => {
    try {
      return localStorage.getItem('staff_command_channel_id') || '1252195894065893387';
    } catch {
      return '1252195894065893387';
    }
  });
  const [punishmentType, setPunishmentType] = useState<string>('Mute');
  const [punishmentDuration, setPunishmentDuration] = useState<string>('');
  const [punishmentEvidenceLinks, setPunishmentEvidenceLinks] = useState<string>('');
  const [punishmentUsername, setPunishmentUsername] = useState<string>('');
  const [punishmentReason, setPunishmentReason] = useState<string>('');
  const [punishmentGamemode, setPunishmentGamemode] = useState<string>('SMP');
  const [isSubmittingPunishment, setIsSubmittingPunishment] = useState<boolean>(false);
  const [punishmentFeedback, setPunishmentFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<any>(null);
  const [isStandaloneApp, setIsStandaloneApp] = useState<boolean>(false);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsStandaloneApp(standalone);

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredInstallPrompt(e);
    };
    const onInstalled = () => {
      setIsStandaloneApp(true);
      setDeferredInstallPrompt(null);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const handleInstallDesktopApp = async () => {
    if (deferredInstallPrompt) {
      await deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice;
      if (choice?.outcome === 'accepted') {
        setDeferredInstallPrompt(null);
      }
    }
  };

  // Paginated messages state
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [totalMessages, setTotalMessages] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isLoadingMessages, setIsLoadingMessages] = useState<boolean>(false);
  const PAGE_SIZE = 200;

  // Filters & Sorting
  const [viewFilter, setViewFilter] = useState<'all' | 'flagged'>('flagged');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedPlayer, setSelectedPlayer] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'severity' | 'confidence' | 'line_asc' | 'line_desc'>('severity');

  // Modal inspection state
  const [activeMessage, setActiveMessage] = useState<MessageRecord | null>(null);
  const [contextData, setContextData] = useState<ContextAnalysisResult | null>(null);
  const [isLoadingContext, setIsLoadingContext] = useState<boolean>(false);
  const [moderatorNoteInput, setModeratorNoteInput] = useState<string>('');

  // Player dossier modal
  const [activePlayerDossier, setActivePlayerDossier] = useState<PlayerProfile | null>(null);
  const [dossierMessages, setDossierMessages] = useState<MessageRecord[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchMessages = useCallback(async (page: number, filters?: {
    flaggedOnly?: boolean;
    severity?: string;
    category?: string;
    player?: string;
    status?: string;
    search?: string;
    sortBy?: string;
  }) => {
    setIsLoadingMessages(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('page_size', String(PAGE_SIZE));
      if (filters?.flaggedOnly) params.set('flagged_only', 'true');
      if (filters?.severity && filters.severity !== 'all') params.set('severity', filters.severity);
      if (filters?.category && filters.category !== 'all') params.set('category', filters.category);
      if (filters?.player && filters.player !== 'all') params.set('player', filters.player);
      if (filters?.status && filters.status !== 'all') params.set('status', filters.status);
      if (filters?.search?.trim()) params.set('search', filters.search.trim());
      if (filters?.sortBy) params.set('sort_by', filters.sortBy);

      const res = await fetch(`${API_BASE_URL}/api/v1/messages?${params.toString()}`);
      if (res.ok) {
        const result = await res.json();
        setMessages(result.messages);
        setTotalMessages(result.total);
        setTotalPages(result.total_pages);
        setCurrentPage(page);
      }
    } catch (e) {
      console.error('Failed to fetch messages:', e);
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  // Re-fetch when filters/sort change
  useEffect(() => {
    if (!data) return;
    fetchMessages(1, {
      flaggedOnly: viewFilter === 'flagged',
      severity: selectedSeverity,
      category: selectedCategory,
      player: selectedPlayer,
      status: selectedStatus,
      search: searchQuery,
      sortBy,
    });
  }, [data, viewFilter, selectedSeverity, selectedCategory, selectedPlayer, selectedStatus, searchQuery, sortBy, fetchMessages]);

  const handleFileUpload = async (file: File) => {
    setIsLoading(true);
    setErrorMessage(null);
    setMessages([]);
    setData(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      let url = `${API_BASE_URL}/api/v1/upload`;
      if (formatHint !== 'auto') {
        url += `?format_hint=${formatHint}`;
      }

      const response = await fetch(url, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Upload failed' }));
        throw new Error(errorData.detail || `Server error: ${response.status}`);
      }

      const result: LogParseResponse = await response.json();
      setData(result);
      // messages will be fetched via the useEffect above
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to upload and parse log file.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const handleStopDiscordFetch = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/v1/discord/fetch/stop`, { method: 'POST' });
    } catch (e) {
      console.error('Failed to stop fetch:', e);
    }
  };

  const handleDiscordTokenFetch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!discordToken.trim()) {
      setErrorMessage('Please enter your Discord Auth Token or Bot Token.');
      return;
    }
    if (!discordChannelId.trim()) {
      setErrorMessage('Please enter a Discord Channel ID or Channel Link.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setMessages([]);
    setData(null);
    setFetchProgress({
      status: 'starting',
      fetched: 0,
      target: discordFetchLimit,
      channelName: discordChannelId.trim(),
      rateLimitWaitMs: 0,
    });

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/discord/fetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: discordToken.trim(),
          channel_id: discordChannelId.trim(),
          limit: discordFetchLimit,
          async_mode: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Discord token fetch failed' }));
        throw new Error(errorData.detail || `Server error: ${response.status}`);
      }

      const initResult = await response.json();
      if (!initResult.async_job) {
        setData(initResult as LogParseResponse);
        setFetchProgress(null);
        setIsLoading(false);
        return;
      }

      setFetchProgress({
        status: initResult.status || 'fetching',
        fetched: initResult.fetched || 0,
        target: initResult.target || discordFetchLimit,
        channelName: initResult.channel_name || discordChannelId.trim(),
        rateLimitWaitMs: 0,
      });

      while (true) {
        await new Promise((r) => setTimeout(r, 800));
        const statusRes = await fetch(`${API_BASE_URL}/api/v1/discord/fetch/status`);
        if (!statusRes.ok) continue;
        const st = await statusRes.json();

        if (st.status === 'error') {
          throw new Error(st.detail || 'Discord fetch failed.');
        }

        if (st.status === 'completed' && st.result) {
          setData(st.result as LogParseResponse);
          setFetchProgress(null);
          break;
        }

        setFetchProgress({
          status: st.status,
          fetched: st.fetched || 0,
          target: st.target || discordFetchLimit,
          channelName: st.channel_name || discordChannelId.trim(),
          rateLimitWaitMs: st.rate_limit_wait_ms || 0,
        });
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to fetch channel messages via Discord token.');
      setFetchProgress(null);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSample = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setMessages([]);
    setData(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/sample`);
      if (!response.ok) {
        throw new Error(`Failed to load sample: ${response.status}`);
      }
      const result: LogParseResponse = await response.json();
      // Sample returns messages_preview directly
      setMessages(result.messages_preview || []);
      setTotalMessages(result.messages_preview?.length || 0);
      setTotalPages(1);
      setCurrentPage(1);
      setData({ ...result, messages_preview: [] });
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load sample log.');
    } finally {
      setIsLoading(false);
    }
  };

  // Load existing punishment log records AND persisted Discord session + channel names on mount
  const resolvePresetChannelNames = useCallback(async (tokenToUse: string) => {
    if (!tokenToUse.trim()) return;
    setIsResolvingChannels(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/discord/resolve-channels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenToUse.trim() }),
      });
      if (res.ok) {
        const s = await res.json();
        if (Array.isArray(s.preset_channels) && s.preset_channels.length > 0) {
          setPresetChannels(s.preset_channels);
          try {
            localStorage.setItem('discord_preset_channels', JSON.stringify(s.preset_channels));
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // ignore
    } finally {
      setIsResolvingChannels(false);
    }
  }, []);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/v1/punishments`)
      .then((r) => (r.ok ? r.json() : []))
      .then((list) => {
        if (Array.isArray(list)) setPunishments(list);
      })
      .catch(() => {});

    fetch(`${API_BASE_URL}/api/v1/discord/session`)
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => {
        if (!s) return;
        const restoredToken = s.token || localStorage.getItem('discord_token_saved') || '';
        if (restoredToken) {
          setDiscordToken((prev) => prev || restoredToken);
          try {
            localStorage.setItem('discord_token_saved', restoredToken);
          } catch {
            // ignore
          }
          resolvePresetChannelNames(restoredToken);
        }
        if (s.selected_channel_id) {
          setDiscordChannelId((prev) => prev || s.selected_channel_id);
        }
        if (s.staff_channel_id) {
          setStaffCommandChannelId((prev) => prev || s.staff_channel_id);
        }
        if (Array.isArray(s.preset_channels) && s.preset_channels.length > 0) {
          setPresetChannels(s.preset_channels);
        }
      })
      .catch(() => {});
  }, [resolvePresetChannelNames]);

  const inferPunishmentType = (msg: MessageRecord): string => {
    if (msg.categories.includes('threat') || msg.severity === 'critical') return 'Ban';
    if (msg.categories.includes('advertising')) return 'TempBan';
    if (
      msg.categories.includes('profanity') ||
      msg.categories.includes('slur') ||
      msg.categories.includes('harassment') ||
      msg.categories.includes('insult') ||
      msg.categories.includes('spam')
    ) {
      return 'Mute';
    }
    if (msg.severity === 'low') return 'Warn';
    return 'Mute';
  };

  const inferCleanReason = (msg: MessageRecord): string => {
    const catLabels: Record<string, string> = {
      threat: 'Death Threats / Severe Intimidation',
      slur: 'Hate Speech / Slurs',
      harassment: 'Targeted Player Harassment',
      advertising: 'Unauthorized Server / Discord Advertising',
      profanity: 'Excessive Profanity / Chat Violation',
      insult: 'Player Disrespect / Toxicity',
      spam: 'Chat Spam / Flooding',
    };
    if (msg.categories.length > 0) {
      const mapped = msg.categories.map((c) => catLabels[c] || c.replace('_', ' '));
      return mapped.join(', ');
    }
    if (msg.reasons.length > 0) {
      return msg.reasons[0];
    }
    return 'Chat Conduct Violation';
  };

  const buildMessageEvidenceLink = (msg: MessageRecord): string => {
    if (msg.discord_message_url) return msg.discord_message_url;
    const gId = data?.guild_id || 'guild';
    const cId = data?.channel_id || (discordChannelId.trim().match(/\d{15,22}/g)?.slice(-1)[0] ?? 'channel');
    return `https://discord.com/channels/${gId}/${cId}/line-${msg.line_number}`;
  };

  // Open Message Detail Modal & Fetch Surrounding Context + Autofill Punishment Form
  const handleOpenMessageModal = async (msg: MessageRecord) => {
    setActiveMessage(msg);
    setContextData(null);
    setModeratorNoteInput(msg.moderator_notes || '');
    setPunishmentFeedback(null);

    // Autofill everything EXCEPT punishment duration!
    // Evidence links autofills with the link of that message.
    setPunishmentType(inferPunishmentType(msg));
    setPunishmentDuration('');
    setPunishmentEvidenceLinks(buildMessageEvidenceLink(msg));
    setPunishmentUsername(msg.player);
    setPunishmentReason(inferCleanReason(msg));
    setPunishmentGamemode(data?.detected_gamemode || 'SMP');

    setIsLoadingContext(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/messages/${msg.id}/context?window=3`);
      if (res.ok) {
        const ctx: ContextAnalysisResult = await res.json();
        setContextData(ctx);
      }
    } catch (e) {
      console.error("Could not load context thread:", e);
    } finally {
      setIsLoadingContext(false);
    }
  };

  const handleCopyText = (key: string, text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey((prev) => (prev === key ? null : prev));
    }, 1800);
  };

  const handleLogPunishment = async (autoSendDiscord: boolean) => {
    if (!activeMessage) return;
    if (!punishmentDuration.trim()) {
      setPunishmentFeedback({
        type: 'error',
        text: 'Please enter the Punishment Duration (e.g., 1d, 12h, 7d, Permanent) before logging.',
      });
      return;
    }

    if (autoSendDiscord) {
      if (!discordToken.trim()) {
        setPunishmentFeedback({
          type: 'error',
          text: 'Please enter your Discord Token at the top of the page to execute /staff log punishment in Discord.',
        });
        return;
      }
      if (!staffCommandChannelId.trim()) {
        setPunishmentFeedback({
          type: 'error',
          text: 'Please enter your specific Staff Punishment Command Channel ID (or URL) so the command is only executed in that exact channel.',
        });
        return;
      }
    }

    setIsSubmittingPunishment(true);
    setPunishmentFeedback(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/punishments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message_id: activeMessage.id,
          username: punishmentUsername.trim(),
          punishment_type: punishmentType.trim(),
          duration: punishmentDuration.trim(),
          reason: punishmentReason.trim(),
          gamemode: punishmentGamemode.trim(),
          evidence_links: punishmentEvidenceLinks.trim(),
          message_excerpt: activeMessage.message,
          severity: activeMessage.severity,
          auto_send_discord: autoSendDiscord,
          token: discordToken.trim(),
          staff_channel_id: staffCommandChannelId.trim(),
        }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.detail || 'Failed to log punishment.');
      }

      const record = body as PunishmentRecord;
      setPunishments((prev) => [record, ...prev]);

      // Mark message as confirmed in local state
      const updatedMsg: MessageRecord = {
        ...activeMessage,
        review_status: 'confirmed',
        moderator_notes: `[${record.case_id}] ${record.punishment_type} (${record.duration}) - ${record.reason} [${record.gamemode}]`,
      };
      setActiveMessage(updatedMsg);
      setMessages((prev) => prev.map((m) => (m.id === updatedMsg.id ? updatedMsg : m)));

      if (autoSendDiscord) {
        setPunishmentFeedback({
          type: record.discord_status === 'sent_to_discord' ? 'success' : 'error',
          text: `${record.case_id}: ${record.discord_detail || 'Logged'}`,
        });
      } else {
        setPunishmentFeedback({
          type: 'success',
          text: `${record.case_id} logged to Punishment Log! Command copied to clipboard.`,
        });
        handleCopyText('slash-cmd', record.command_string);
      }
    } catch (e: any) {
      setPunishmentFeedback({
        type: 'error',
        text: e.message || 'Error logging punishment.',
      });
    } finally {
      setIsSubmittingPunishment(false);
    }
  };

  const handleDeletePunishment = async (id: number) => {
    try {
      await fetch(`${API_BASE_URL}/api/v1/punishments/${id}`, { method: 'DELETE' });
      setPunishments((prev) => prev.filter((p) => p.id !== id));
    } catch {
      // ignore
    }
  };

  // Submit Moderator Action
  const handleModeratorAction = async (action: 'confirmed' | 'false_positive' | 'reviewed' | 'ignored') => {
    if (!activeMessage) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/messages/${activeMessage.id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, notes: moderatorNoteInput }),
      });

      if (res.ok) {
        const updatedMsg: MessageRecord = await res.json();
        // Update local messages list
        setMessages(prev => prev.map(m => m.id === updatedMsg.id ? updatedMsg : m));
        setActiveMessage(updatedMsg);
      }
    } catch (e) {
      console.error("Failed to update moderator action:", e);
    }
  };

  // Export report
  const handleExport = (fmt: 'json' | 'csv') => {
    const link = document.createElement('a');
    link.href = `${API_BASE_URL}/api/v1/export/report?format=${fmt}`;
    link.download = `moderation_report.${fmt}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Open player dossier and load their messages
  const handleOpenPlayerDossier = async (profile: PlayerProfile) => {
    setActivePlayerDossier(profile);
    setDossierMessages([]);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/players/${encodeURIComponent(profile.username)}`);
      if (res.ok) {
        const d = await res.json();
        setDossierMessages(d.messages || []);
      }
    } catch (e) {
      console.error('Failed to load player dossier messages:', e);
    }
  };

  const filteredMessages = messages;

  return (
    <div className="app-container">
      {/* Top Bar Contract: Single-Row 3-Zone Header */}
      <header className="app-header">
        <a href="#top" onClick={(e) => { e.preventDefault(); setActiveTab('dashboard'); }} className="brand-wordmark">
          Moderation Studio
        </a>

        <nav className="top-nav-links" aria-label="Primary Navigation">
          <button
            type="button"
            className={`top-nav-link ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            Review Queue
          </button>
          <button
            type="button"
            className={`top-nav-link ${activeTab === 'players' ? 'active' : ''}`}
            onClick={() => setActiveTab('players')}
          >
            Player Dossiers{data ? ` (${data.unique_players_count})` : ''}
          </button>
          <button
            type="button"
            className={`top-nav-link ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            Analytics
          </button>
          <button
            type="button"
            className={`top-nav-link ${activeTab === 'punishments' ? 'active' : ''}`}
            onClick={() => setActiveTab('punishments')}
          >
            Punishment Log{punishments.length > 0 ? ` (${punishments.length})` : ''}
          </button>
        </nav>

        <div className="header-actions">
          <a
            href="/api/v1/download/portable-exe"
            download="ModerationStudio-Portable.exe"
            className="btn-secondary"
            style={{ height: '34px', padding: '0 0.75rem', fontSize: '0.76rem', textDecoration: 'none' }}
            title="Download the compiled standalone Windows desktop executable (ModerationStudio-Portable.exe)"
          >
            <Download size={13} /> Download .EXE
          </a>
          {!isStandaloneApp && deferredInstallPrompt && (
            <button
              type="button"
              className="btn-secondary"
              style={{ height: '34px', padding: '0 0.75rem', fontSize: '0.76rem' }}
              onClick={handleInstallDesktopApp}
              title="Install Moderation Studio as a standalone desktop app"
            >
              Install Desktop App
            </button>
          )}
          {data ? (
            <>
              <button
                type="button"
                className="btn-secondary"
                style={{ height: '34px', padding: '0 0.75rem', fontSize: '0.76rem' }}
                onClick={() => handleExport('csv')}
                title="Export CSV spreadsheet report"
              >
                <Download size={13} /> Export CSV
              </button>
              <button
                type="button"
                className="btn-primary"
                style={{ height: '34px', padding: '0 0.85rem', fontSize: '0.76rem' }}
                onClick={loadSample}
                disabled={isLoading}
              >
                Sample Dataset
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn-primary"
              style={{ height: '34px', padding: '0 0.85rem', fontSize: '0.76rem' }}
              id="sample-log-btn-token"
              onClick={loadSample}
              disabled={isLoading}
            >
              Load Sample Dataset
            </button>
          )}
        </div>
      </header>

      {/* Ingestion Zone: Discord Token Mode & File Upload Mode */}
      <section className="upload-card-wrapper">
        <div className="section-header-bar">
          <div>
            <h1 className="section-headline">Chat Log Moderation &amp; Enforcement</h1>
            <p className="section-subheadline">
              Ingest live Discord bridge channels or server log archives with automated rule + context analysis and one-click staff punishment dispatch.
            </p>
          </div>
          <div className="ingestion-mode-switcher">
            <button
              type="button"
              className={`mode-switch-btn ${ingestMode === 'token' ? 'active' : ''}`}
              onClick={() => { setIngestMode('token'); setErrorMessage(null); }}
            >
              Discord Live Channel
            </button>
            <button
              type="button"
              className={`mode-switch-btn ${ingestMode === 'file' ? 'active' : ''}`}
              onClick={() => { setIngestMode('file'); setErrorMessage(null); }}
            >
              Log File Upload
            </button>
          </div>
        </div>

        {ingestMode === 'token' ? (
          <form className="token-zone" onSubmit={handleDiscordTokenFetch}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h2 className="upload-title">
                  {isLoading ? 'Synchronizing Discord Channel Stream...' : 'Discord Bridge & Enforcement Configuration'}
                </h2>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                  Credentials and channel mappings persist automatically across sessions.
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <button
                  type="button"
                  onClick={() => resolvePresetChannelNames(discordToken)}
                  className="btn-secondary"
                  style={{ height: '34px', padding: '0 0.75rem', fontSize: '0.76rem' }}
                  title="Fetch live channel names from Discord"
                >
                  <RefreshCw size={13} />
                  {isResolvingChannels ? 'Syncing Names...' : 'Sync Channel Names'}
                </button>
              </div>
            </div>

            <div className="token-form-grid">
              <div className="input-field-group">
                <label className="input-field-label" htmlFor="discord-token-input">
                  <span>Discord Token (Persisted)</span>
                  <button
                    type="button"
                    onClick={() => setShowTokenText(!showTokenText)}
                    className="inline-link-btn"
                  >
                    {showTokenText ? 'Hide' : 'Reveal'}
                  </button>
                </label>
                <input
                  id="discord-token-input"
                  type={showTokenText ? 'text' : 'password'}
                  className="token-input"
                  placeholder="Paste Discord Token..."
                  value={discordToken}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDiscordToken(val);
                    try {
                      localStorage.setItem('discord_token_saved', val);
                    } catch {
                      // ignore
                    }
                    fetch(`${API_BASE_URL}/api/v1/discord/session`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ token: val }),
                    }).catch(() => {});
                  }}
                  onBlur={() => {
                    if (discordToken.trim()) {
                      resolvePresetChannelNames(discordToken);
                    }
                  }}
                  autoComplete="off"
                />
              </div>

              <div className="input-field-group">
                <label className="input-field-label" htmlFor="discord-channel-select">
                  <span>01. Source Chat Channel (Read)</span>
                </label>
                <select
                  id="discord-channel-select"
                  value={
                    presetChannels.some((p) => p.channel_id === discordChannelId)
                      ? discordChannelId
                      : 'custom'
                  }
                  onChange={(e) => {
                    const chosen = e.target.value;
                    if (chosen !== 'custom') {
                      setDiscordChannelId(chosen);
                      try {
                        localStorage.setItem('discord_selected_channel_id', chosen);
                      } catch {
                        // ignore
                      }
                      fetch(`${API_BASE_URL}/api/v1/discord/session`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ selected_channel_id: chosen }),
                      }).catch(() => {});
                    }
                  }}
                  className="filter-select"
                  style={{ height: '40px', width: '100%', fontFamily: 'var(--font-mono)' }}
                >
                  {presetChannels.map((ch) => (
                    <option key={ch.channel_id} value={ch.channel_id}>
                      {ch.name} ({ch.channel_id})
                    </option>
                  ))}
                  <option value="custom">Custom Channel ID / URL...</option>
                </select>
              </div>

              <div className="input-field-group">
                <label className="input-field-label" htmlFor="staff-command-channel-top-input">
                  <span>02. Staff Command Channel (Execute /staff)</span>
                </label>
                <input
                  id="staff-command-channel-top-input"
                  type="text"
                  className="token-input"
                  placeholder="Channel ID for /staff log punishment"
                  value={staffCommandChannelId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setStaffCommandChannelId(val);
                    try {
                      localStorage.setItem('staff_command_channel_id', val);
                    } catch {
                      // ignore
                    }
                    fetch(`${API_BASE_URL}/api/v1/discord/session`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ staff_channel_id: val }),
                    }).catch(() => {});
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-end' }}>
                <div className="input-field-group">
                  <label className="input-field-label" htmlFor="discord-limit-select">
                    <span>Batch Size</span>
                  </label>
                  <select
                    id="discord-limit-select"
                    value={discordFetchLimit}
                    onChange={(e) => setDiscordFetchLimit(Number(e.target.value))}
                    className="filter-select"
                    style={{ height: '40px', fontFamily: 'var(--font-mono)' }}
                  >
                    <option value={500}>500 msgs</option>
                    <option value={2500}>2,500 msgs</option>
                    <option value={10000}>10,000 msgs</option>
                    <option value={25000}>25,000 msgs</option>
                    <option value={50000}>50,000 msgs</option>
                    <option value={100000}>100,000 msgs</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="btn-primary"
                  id="fetch-token-btn"
                  disabled={isLoading}
                >
                  {isLoading ? <div className="spinner" style={{ width: '14px', height: '14px' }} /> : null}
                  {isLoading ? 'Fetching...' : 'Fetch & Analyze'}
                </button>
              </div>
            </div>

            {/* Quick 1-Click Channel Selector Bar */}
            <div className="channel-switcher-bar">
              <span className="channel-switcher-label">Preset Channels:</span>
              {presetChannels.map((ch) => {
                const isSelected = discordChannelId === ch.channel_id;
                return (
                  <button
                    key={ch.channel_id}
                    type="button"
                    className={`channel-tab-btn ${isSelected ? 'active' : ''}`}
                    onClick={() => {
                      setDiscordChannelId(ch.channel_id);
                      try {
                        localStorage.setItem('discord_selected_channel_id', ch.channel_id);
                      } catch {
                        // ignore
                      }
                      fetch(`${API_BASE_URL}/api/v1/discord/session`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ selected_channel_id: ch.channel_id }),
                      }).catch(() => {});
                    }}
                    title={ch.url}
                  >
                    {ch.name}
                  </button>
                );
              })}
            </div>

            {fetchProgress && (
              <div style={{ marginTop: '1.25rem', padding: '1rem 1.25rem', background: '#000000', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 500, color: '#ffffff', fontFamily: 'var(--font-mono)' }}>
                    {fetchProgress.status === 'analyzing'
                      ? `Analyzing ${fetchProgress.fetched.toLocaleString()} messages...`
                      : `Fetching ${fetchProgress.channelName}: ${fetchProgress.fetched.toLocaleString()} / ${fetchProgress.target.toLocaleString()} messages`}
                    {fetchProgress.rateLimitWaitMs > 0 && (
                      <span style={{ marginLeft: '0.6rem', color: 'var(--text-secondary)', fontSize: '0.76rem' }}>
                        (Rate-limit pause {(fetchProgress.rateLimitWaitMs / 1000).toFixed(1)}s)
                      </span>
                    )}
                  </div>
                  {fetchProgress.status === 'fetching' && fetchProgress.fetched > 0 && (
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ height: '30px', padding: '0 0.7rem', fontSize: '0.74rem' }}
                      onClick={handleStopDiscordFetch}
                    >
                      Stop &amp; Analyze ({fetchProgress.fetched.toLocaleString()})
                    </button>
                  )}
                </div>
                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${Math.min(100, Math.max(2, (fetchProgress.fetched / (fetchProgress.target || 1)) * 100))}%`,
                      transition: 'width 0.25s ease',
                    }}
                  />
                </div>
              </div>
            )}
          </form>
        ) : (
        <div 
          className={`upload-zone ${isDragOver ? 'dragover' : ''}`}
          id="dropzone-area"
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept=".log,.txt,.csv" 
            style={{ display: 'none' }} 
            id="log-file-input"
          />

          <div className="upload-icon-container">
            {isLoading ? <div className="spinner"></div> : <UploadCloud size={22} />}
          </div>

          <h2 className="upload-title">
            {isLoading ? 'Analyzing Log Archive...' : 'Drop server chat log here, or click to browse'}
          </h2>
          <p className="upload-description">
            Supports Minecraft (Vanilla, Spigot, Paper), Discord exports, and CSV transcripts.
          </p>

          <div style={{ marginBottom: '1.25rem' }}>
            <div className="metadata-inline">
              <span>.LOG</span>
              <span className="metadata-sep" aria-hidden="true">·</span>
              <span>.TXT</span>
              <span className="metadata-sep" aria-hidden="true">·</span>
              <span>.CSV</span>
            </div>
          </div>

          <div className="upload-actions" onClick={(e) => e.stopPropagation()}>
            <button 
              type="button" 
              className="btn-primary"
              id="browse-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
            >
              Browse Log File
            </button>

            <button 
              type="button" 
              className="btn-secondary"
              id="sample-log-btn"
              onClick={loadSample}
              disabled={isLoading}
            >
              Load Sample Log
            </button>

            <select
              id="format-selector"
              value={formatHint}
              onChange={(e) => setFormatHint(e.target.value)}
              className="filter-select"
              style={{ height: '40px' }}
            >
              <option value="auto">Auto-detect Format</option>
              <option value="discord">Discord Guild Export (»)</option>
              <option value="minecraft">Minecraft Vanilla/Paper</option>
              <option value="generic">Generic Text</option>
              <option value="csv">CSV Spreadsheet</option>
            </select>
          </div>
        </div>
        )}

        {errorMessage && (
          <div className="diagnostics-box" id="error-alert">
            <div className="diagnostics-title">
              <AlertTriangle size={16} />
              Ingestion Notice
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{errorMessage}</p>
          </div>
        )}
      </section>

      {/* Main Content Area */}
      {data && (
        <>
          {/* Architectural Hairline Stats Grid */}
          <section className="stats-grid" id="stats-summary">
            <div className="stat-card" id="stat-flagged">
              <div className="stat-label">Flagged Violations</div>
              <div className="stat-value">
                {data.flagged_messages_count.toLocaleString()}
              </div>
              <div className="stat-subtext">
                {((data.flagged_messages_count / (data.messages_detected || 1)) * 100).toFixed(1)}% rate · {data.critical_severity_count} critical
              </div>
            </div>

            <div className="stat-card" id="stat-messages">
              <div className="stat-label">Messages Analyzed</div>
              <div className="stat-value">{data.messages_detected.toLocaleString()}</div>
              <div className="stat-subtext">{data.lines_processed.toLocaleString()} lines scanned</div>
            </div>

            <div className="stat-card" id="stat-players">
              <div className="stat-label">Unique Players</div>
              <div className="stat-value">{data.unique_players_count.toLocaleString()}</div>
              <div className="stat-subtext">
                {Object.values(data.player_profiles).filter(p => p.flagged_messages > 0).length} with active flags
              </div>
            </div>

            <div className="stat-card" id="stat-file">
              <div className="stat-label">Active Source</div>
              <div className="stat-value" style={{ fontSize: '1.1rem', wordBreak: 'break-all', marginTop: '0.65rem' }}>
                {data.file_name}
              </div>
              <div className="stat-subtext">
                {data.detected_format.toUpperCase()} · {(data.file_size_bytes / 1024).toFixed(1)} KB
              </div>
            </div>
          </section>

          {/* TAB 1: MODERATION DASHBOARD */}
          {activeTab === 'dashboard' && (
            <>
              {/* Category Filter Buttons */}
              {Object.keys(data.category_breakdown).length > 0 && (
                <section className="category-summary-bar" id="category-summary-chips">
                  <span className="category-summary-title">Filter Category:</span>
                  {Object.entries(data.category_breakdown).map(([cat, count]) => (
                    <button
                      type="button"
                      key={cat}
                      className={`cat-filter-btn ${selectedCategory === cat ? 'active' : ''}`}
                      onClick={() => setSelectedCategory(selectedCategory === cat ? 'all' : cat)}
                      title={`Filter by ${cat}`}
                    >
                      <span>{cat.replace('_', ' ')}</span>
                      <span className="cat-filter-count">{count}</span>
                    </button>
                  ))}
                </section>
              )}

              {/* Table Container */}
              <section className="preview-container" id="messages-table-card">
                <div className="preview-header">
                  <div className="preview-title-box">
                    <h3 className="preview-title">Moderation Review Queue</h3>
                    <span className="count-text" id="filtered-count">
                      {totalMessages.toLocaleString()} results · Page {currentPage}/{totalPages}
                    </span>
                  </div>

                  <div className="filter-bar">
                    {/* Toggle: All vs Flagged */}
                    <div className="toggle-group" id="view-toggle-group">
                      <button
                        type="button"
                        className={`toggle-btn ${viewFilter === 'all' ? 'active' : ''}`}
                        onClick={() => setViewFilter('all')}
                        id="filter-all-btn"
                      >
                        All Messages
                      </button>
                      <button
                        type="button"
                        className={`toggle-btn ${viewFilter === 'flagged' ? 'active' : ''}`}
                        onClick={() => setViewFilter('flagged')}
                        id="filter-flagged-btn"
                      >
                        Flagged ({data.flagged_messages_count})
                      </button>
                    </div>

                    {/* Severity Filter */}
                    <select
                      id="severity-filter-select"
                      value={selectedSeverity}
                      onChange={(e) => setSelectedSeverity(e.target.value)}
                      className="filter-select"
                    >
                      <option value="all">All Severities</option>
                      <option value="critical">Critical</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                      <option value="none">Clean</option>
                    </select>

                    {/* Status Filter */}
                    <select
                      id="status-filter-select"
                      value={selectedStatus}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      className="filter-select"
                    >
                      <option value="all">All Statuses</option>
                      <option value="unreviewed">Unreviewed</option>
                      <option value="confirmed">Confirmed Violation</option>
                      <option value="false_positive">False Positive</option>
                      <option value="reviewed">Reviewed</option>
                      <option value="ignored">Ignored</option>
                    </select>

                    {/* Sorting */}
                    <select
                      id="sort-select"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="filter-select"
                    >
                      <option value="severity">Sort: Highest Severity</option>
                      <option value="confidence">Sort: Highest Confidence</option>
                      <option value="line_asc">Sort: Oldest First</option>
                      <option value="line_desc">Sort: Newest First</option>
                    </select>

                    {/* Player Filter */}
                    <select
                      id="player-filter-select"
                      value={selectedPlayer}
                      onChange={(e) => setSelectedPlayer(e.target.value)}
                      className="filter-select"
                    >
                      <option value="all">All Players ({data.unique_players_count})</option>
                      {data.unique_players.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>

                    {/* Search Box */}
                    <div className="search-box">
                      <Search size={14} style={{ position: 'absolute', left: '0.75rem', color: 'var(--text-muted)' }} />
                      <input
                        type="text"
                        id="search-filter-input"
                        placeholder="Search text, player, or reason..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="search-input"
                      />
                    </div>
                  </div>
                </div>

                <div className="table-wrapper">
                  <table className="log-table" id="parsed-records-table">
                    <thead>
                      <tr>
                        <th className="col-line">Line</th>
                        <th className="col-time">Timestamp</th>
                        <th className="col-player">Player</th>
                        <th className="col-msg">Message &amp; Categories</th>
                        <th className="col-mod">Severity</th>
                        <th className="col-status">Status</th>
                        <th className="col-reasons">Detection Summary</th>
                        <th style={{ width: '150px', textAlign: 'right' }}>Enforcement</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMessages.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="empty-state" style={{ border: 'none' }}>
                            No messages matching the current filter criteria.
                          </td>
                        </tr>
                      ) : (
                        filteredMessages.map((msg) => (
                          <tr
                            key={msg.id}
                            id={`msg-row-${msg.id}`}
                            className={`clickable-row ${msg.is_flagged ? 'flagged-row' : ''}`}
                            onClick={() => handleOpenMessageModal(msg)}
                          >
                            <td className="col-line">#{msg.line_number}</td>
                            <td className="col-time">{msg.timestamp}</td>
                            <td className="col-player">
                              <button
                                type="button"
                                className="player-link-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (data.player_profiles[msg.player]) {
                                    handleOpenPlayerDossier(data.player_profiles[msg.player]);
                                  }
                                }}
                                title="View player dossier"
                              >
                                {msg.player}
                              </button>
                            </td>
                            <td className="col-msg">
                              <div style={{ color: '#ffffff' }}>{msg.message}</div>
                              {msg.categories.length > 0 && (
                                <div className="unboxed-meta-row">
                                  {msg.categories.map((cat, ci) => (
                                    <React.Fragment key={ci}>
                                      {ci > 0 && <span className="metadata-sep" aria-hidden="true">·</span>}
                                      <span>{cat.replace('_', ' ')}</span>
                                    </React.Fragment>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="col-mod">
                              {msg.is_flagged ? (
                                <div>
                                  <span className={`severity-label ${msg.severity}`}>
                                    {msg.severity}
                                  </span>
                                  <div style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                                    {(msg.overall_score * 100).toFixed(0)}% conf
                                  </div>
                                </div>
                              ) : (
                                <span className="severity-label clean">Clean</span>
                              )}
                            </td>
                            <td className="col-status">
                              <span className={`status-text ${msg.review_status}`}>
                                {msg.review_status.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="col-reasons">
                              {msg.reasons.length > 0 ? (
                                msg.reasons.slice(0, 2).map((r, ri) => (
                                  <div key={ri} className="reason-line">
                                    {r}
                                  </div>
                                ))
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>&mdash;</span>
                              )}
                              {msg.reasons.length > 2 && (
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                                  +{msg.reasons.length - 2} more
                                </span>
                              )}
                            </td>
                            <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                className={msg.is_flagged ? 'btn-primary' : 'btn-secondary'}
                                style={{
                                  height: '32px',
                                  padding: '0 0.7rem',
                                  fontSize: '0.74rem',
                                }}
                                onClick={() => handleOpenMessageModal(msg)}
                                title="Open autofilled /staff log punishment builder"
                              >
                                Log Punishment
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination controls */}
                {totalPages > 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', padding: '1rem', borderTop: '1px solid var(--border-color)' }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ height: '34px', padding: '0 0.75rem', fontSize: '0.78rem' }}
                      disabled={currentPage <= 1 || isLoadingMessages}
                      onClick={() => fetchMessages(currentPage - 1, {
                        flaggedOnly: viewFilter === 'flagged',
                        severity: selectedSeverity,
                        category: selectedCategory,
                        player: selectedPlayer,
                        status: selectedStatus,
                        search: searchQuery,
                        sortBy,
                      })}
                    >
                      <ChevronLeft size={15} /> Prev
                    </button>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ height: '34px', padding: '0 0.75rem', fontSize: '0.78rem' }}
                      disabled={currentPage >= totalPages || isLoadingMessages}
                      onClick={() => fetchMessages(currentPage + 1, {
                        flaggedOnly: viewFilter === 'flagged',
                        severity: selectedSeverity,
                        category: selectedCategory,
                        player: selectedPlayer,
                        status: selectedStatus,
                        search: searchQuery,
                        sortBy,
                      })}
                    >
                      Next <ChevronRight size={15} />
                    </button>
                  </div>
                )}
              </section>
            </>
          )}

          {/* TAB 2: PLAYER BEHAVIOR DOSSIERS */}
          {activeTab === 'players' && (
            <section className="players-grid" id="player-dossiers-grid">
              {Object.values(data.player_profiles).map((profile) => (
                <div
                  key={profile.username}
                  className="player-card"
                  onClick={() => handleOpenPlayerDossier(profile)}
                >
                  <div className="player-card-header">
                    <span className="player-username">{profile.username}</span>
                    <span className="tier-text">
                      {profile.review_status_tier.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div className="player-metrics-row">
                    <span className="metric-label">Total Messages</span>
                    <span className="metric-val">{profile.total_messages}</span>
                  </div>

                  <div className="player-metrics-row">
                    <span className="metric-label">Flagged Messages</span>
                    <span className="metric-val">
                      {profile.flagged_messages} ({profile.flagged_percentage}%)
                    </span>
                  </div>

                  <div className="player-metrics-row">
                    <span className="metric-label">Avg. Toxicity</span>
                    <span className="metric-val">{(profile.average_toxicity * 100).toFixed(0)}%</span>
                  </div>

                  <div className="player-metrics-row">
                    <span className="metric-label">Breakdown</span>
                    <span className="metric-val" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {[
                        profile.critical_severity_count > 0 ? `${profile.critical_severity_count} crit` : null,
                        profile.high_severity_count > 0 ? `${profile.high_severity_count} high` : null,
                        profile.medium_severity_count > 0 ? `${profile.medium_severity_count} med` : null,
                        profile.low_severity_count > 0 ? `${profile.low_severity_count} low` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ') || 'Clean'}
                    </span>
                  </div>

                  {profile.common_categories.length > 0 && (
                    <div style={{ marginTop: '0.75rem', paddingTop: '0.65rem', borderTop: '1px solid #141414' }}>
                      <div className="unboxed-meta-row" style={{ marginTop: 0 }}>
                        {profile.common_categories.map((c, i) => (
                          <React.Fragment key={i}>
                            {i > 0 && <span className="metadata-sep" aria-hidden="true">·</span>}
                            <span>{c.replace('_', ' ')}</span>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </section>
          )}

          {/* TAB 3: SEARCH & ANALYTICS */}
          {activeTab === 'analytics' && (
            <section className="analytics-grid" id="analytics-section">
              {/* Severity Breakdown Card */}
              <div className="analytics-card">
                <h4 className="analytics-card-title">01. Severity Distribution</h4>
                {['critical', 'high', 'medium', 'low'].map((sev) => {
                  const count = data.severity_breakdown[sev] || 0;
                  const pct = data.flagged_messages_count > 0
                    ? ((count / data.flagged_messages_count) * 100).toFixed(0)
                    : 0;
                  return (
                    <div key={sev} className="bar-row">
                      <div className="bar-meta">
                        <span style={{ textTransform: 'capitalize' }}>{sev}</span>
                        <span style={{ fontFamily: 'var(--font-mono)' }}>{count} ({pct}%)</span>
                      </div>
                      <div className="progress-track">
                        <div className="progress-fill" style={{ width: `${pct}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Category Breakdown Card */}
              <div className="analytics-card">
                <h4 className="analytics-card-title">02. Detected Categories</h4>
                {Object.entries(data.category_breakdown).map(([cat, count]) => {
                  const pct = data.flagged_messages_count > 0
                    ? ((count / data.flagged_messages_count) * 100).toFixed(0)
                    : 0;
                  return (
                    <div key={cat} className="bar-row">
                      <div className="bar-meta">
                        <span style={{ textTransform: 'capitalize' }}>{cat.replace('_', ' ')}</span>
                        <span style={{ fontFamily: 'var(--font-mono)' }}>{count} ({pct}%)</span>
                      </div>
                      <div className="progress-track">
                        <div className="progress-fill" style={{ width: `${pct}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Top Flagged Players */}
              <div className="analytics-card">
                <h4 className="analytics-card-title">03. Highest Flagged Players</h4>
                {Object.values(data.player_profiles)
                  .filter(p => p.flagged_messages > 0)
                  .sort((a, b) => b.flagged_messages - a.flagged_messages)
                  .slice(0, 5)
                  .map((p) => (
                    <div key={p.username} className="bar-row">
                      <div className="bar-meta">
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{p.username}</span>
                        <span style={{ fontFamily: 'var(--font-mono)' }}>{p.flagged_messages} flags ({p.flagged_percentage}%)</span>
                      </div>
                      <div className="progress-track">
                        <div className="progress-fill" style={{ width: `${Math.min(100, p.flagged_percentage * 2)}%` }}></div>
                      </div>
                    </div>
                  ))}
              </div>

              {/* Review Disposition Status */}
              <div className="analytics-card">
                <h4 className="analytics-card-title">04. Moderator Review Progress</h4>
                {(() => {
                  const sourceMsgs = data.messages_preview.length > 0 ? data.messages_preview : messages;
                  const reviewed = sourceMsgs.filter(m => m.review_status !== 'unreviewed').length;
                  const confirmed = sourceMsgs.filter(m => m.review_status === 'confirmed').length;
                  const fp = sourceMsgs.filter(m => m.review_status === 'false_positive').length;
                  const unreviewed = sourceMsgs.filter(m => m.review_status === 'unreviewed' && m.is_flagged).length;
                  return (
                    <div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                        Decisions Recorded: <strong style={{ color: '#fff', fontFamily: 'var(--font-mono)' }}>{reviewed}</strong> / {data.flagged_messages_count} flagged
                      </div>
                      <div className="bar-row">
                        <div className="bar-meta">
                          <span>Confirmed Violations</span>
                          <span style={{ fontFamily: 'var(--font-mono)' }}>{confirmed}</span>
                        </div>
                        <div className="progress-track">
                          <div className="progress-fill" style={{ width: `${(confirmed / (data.flagged_messages_count || 1)) * 100}%` }}></div>
                        </div>
                      </div>

                      <div className="bar-row">
                        <div className="bar-meta">
                          <span>False Positives Cleared</span>
                          <span style={{ fontFamily: 'var(--font-mono)' }}>{fp}</span>
                        </div>
                        <div className="progress-track">
                          <div className="progress-fill muted" style={{ width: `${(fp / (data.flagged_messages_count || 1)) * 100}%` }}></div>
                        </div>
                      </div>

                      <div className="bar-row">
                        <div className="bar-meta">
                          <span>Awaiting Review</span>
                          <span style={{ fontFamily: 'var(--font-mono)' }}>{unreviewed}</span>
                        </div>
                        <div className="progress-track">
                          <div className="progress-fill muted" style={{ width: `${(unreviewed / (data.flagged_messages_count || 1)) * 100}%` }}></div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </section>
          )}

          {/* TAB 4: PUNISHMENT LOG */}
          {activeTab === 'punishments' && (
            <section className="preview-container" id="punishments-log-section">
              <div className="preview-header">
                <div className="preview-title-box">
                  <h3 className="preview-title">Staff Punishment Log</h3>
                  <span className="count-text">{punishments.length} cases</span>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  Select any message in the Review Queue to auto-fill <code>/staff log punishment</code>.
                </div>
              </div>

              <div className="table-wrapper">
                <table className="log-table">
                  <thead>
                    <tr>
                      <th>Case ID</th>
                      <th>Username</th>
                      <th>Action &amp; Duration</th>
                      <th>Reason</th>
                      <th>Gamemode</th>
                      <th>Evidence Message URL</th>
                      <th>Command &amp; Dispatch Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {punishments.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="empty-state" style={{ border: 'none' }}>
                          No punishments logged yet. Click <strong>Log Punishment</strong> on any message in the Review Queue.
                        </td>
                      </tr>
                    ) : (
                      punishments.map((p) => (
                        <tr key={p.id}>
                          <td className="col-line">
                            <strong style={{ color: '#fff' }}>{p.case_id}</strong>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{p.created_at}</div>
                          </td>
                          <td>
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#ffffff' }}>{p.username}</span>
                            {p.message_excerpt && (
                              <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '0.2rem', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                "{p.message_excerpt}"
                              </div>
                            )}
                          </td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
                            <strong style={{ color: '#ffffff' }}>{p.punishment_type}</strong>
                            <span className="metadata-sep"> · </span>
                            <span style={{ color: 'var(--text-secondary)' }}>{p.duration}</span>
                          </td>
                          <td style={{ maxWidth: '220px', color: '#ffffff' }}>{p.reason}</td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                            {p.gamemode}
                          </td>
                          <td style={{ maxWidth: '220px', wordBreak: 'break-all', fontFamily: 'var(--font-mono)', fontSize: '0.74rem' }}>
                            <a
                              href={p.evidence_links}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: '#ffffff', textDecoration: 'underline', textUnderlineOffset: '3px' }}
                            >
                              {p.evidence_links}
                            </a>
                          </td>
                          <td style={{ maxWidth: '280px' }}>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', background: '#000000', border: '1px solid var(--border-color)', padding: '0.35rem 0.5rem', borderRadius: '4px', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
                              {p.command_string}
                            </div>
                            <div style={{ marginTop: '0.25rem', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: p.discord_status === 'sent_to_discord' ? '#ffffff' : 'var(--text-muted)' }}>
                              {p.discord_detail || p.discord_status}
                            </div>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                              <button
                                type="button"
                                className="btn-secondary"
                                style={{ height: '30px', padding: '0 0.6rem', fontSize: '0.72rem' }}
                                onClick={() => handleCopyText(`cmd-${p.id}`, p.command_string)}
                                title="Copy /staff log punishment command"
                              >
                                <Copy size={12} />
                                {copiedKey === `cmd-${p.id}` ? 'Copied' : 'Copy'}
                              </button>
                              <button
                                type="button"
                                className="btn-secondary"
                                style={{ height: '30px', padding: '0 0.5rem', fontSize: '0.72rem' }}
                                onClick={() => handleDeletePunishment(p.id)}
                                title="Delete record"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Parsing Errors or Warnings */}
          {data.parsing_errors.length > 0 && (
            <section className="diagnostics-box" id="parsing-errors-list">
              <div className="diagnostics-title">
                <AlertTriangle size={16} />
                Parsing Warnings ({data.parsing_errors.length})
              </div>
              <ul className="diagnostics-list" style={{ listStyle: 'none', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {data.parsing_errors.map((err, i) => (
                  <li key={i} style={{ marginBottom: '0.25rem' }}>
                    <strong style={{ color: '#fff', fontFamily: 'var(--font-mono)' }}>Line {err.line_number}:</strong> {err.reason} &mdash; <code>{err.raw_line}</code>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {/* Empty State before upload */}
      {!data && !isLoading && (
        <div className="empty-state" id="initial-empty-state">
          <h3 style={{ color: '#ffffff', fontSize: '1.05rem', fontWeight: 600 }}>No Chat Stream Loaded</h3>
          <p style={{ marginTop: '0.4rem', maxWidth: '500px', marginInline: 'auto', fontSize: '0.85rem' }}>
            Select one of your 6 preset Discord channels above and click <strong>Fetch &amp; Analyze</strong>, or load the sample dataset to inspect violations and dispatch staff punishments.
          </p>
        </div>
      )}

      {/* DETAILED MODERATION REVIEW & AUTOFILL PUNISHMENT MODAL */}
      {activeMessage && (
        <div className="modal-overlay" onClick={() => setActiveMessage(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#ffffff' }}>
                  Case Review · Line #{activeMessage.line_number}
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', marginTop: '0.15rem' }}>
                  {activeMessage.player} · {activeMessage.timestamp}
                </p>
              </div>

              <button type="button" className="close-btn" onClick={() => setActiveMessage(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              {/* Message quote box */}
              <div style={{ background: '#000000', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1rem 1.25rem' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                  Captured Chat Message
                </div>
                <div style={{ fontSize: '1.05rem', color: '#ffffff', fontWeight: 500 }}>
                  "{activeMessage.message}"
                </div>
                <div style={{ marginTop: '0.5rem', fontFamily: 'var(--font-mono)', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  {activeMessage.raw_line}
                </div>
              </div>

              {/* Hybrid Scores & Explanations */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                <div style={{ background: '#000000', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '0.85rem 1rem' }}>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Severity &amp; Composite Score</div>
                  <div style={{ marginTop: '0.35rem', fontFamily: 'var(--font-mono)', fontSize: '0.88rem', color: '#ffffff' }}>
                    <strong style={{ textTransform: 'capitalize' }}>{activeMessage.severity}</strong> · {(activeMessage.overall_score * 100).toFixed(0)}%
                  </div>
                </div>

                <div style={{ background: '#000000', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '0.85rem 1rem' }}>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Rule vs. Context Confidence</div>
                  <div style={{ marginTop: '0.35rem', fontFamily: 'var(--font-mono)', fontSize: '0.88rem', color: '#ffffff' }}>
                    Rule {(activeMessage.rule_score * 100).toFixed(0)}% · Context {(activeMessage.ai_score * 100).toFixed(0)}%
                  </div>
                </div>
              </div>

              {/* Detection Reasons */}
              <div>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.45rem' }}>
                  Detection Triggers ({activeMessage.reasons.length})
                </div>
                {activeMessage.reasons.length > 0 ? (
                  <div style={{ background: '#000000', padding: '0.85rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                    {activeMessage.reasons.map((r, ri) => (
                      <div key={ri} className="reason-line" style={{ fontSize: '0.82rem' }}>
                        · {r}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>No automated violation triggers detected.</p>
                )}
              </div>

              {/* SURROUNDING CONTEXT THREAD */}
              <div className="context-thread-box">
                <div className="context-thread-title">
                  <span>Surrounding Context Dialogue</span>
                  {contextData && (
                    <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '0.74rem' }}>
                      {contextData.classification.replace(/_/g, ' ')}
                    </span>
                  )}
                </div>

                {isLoadingContext ? (
                  <div style={{ textAlign: 'center', padding: '1rem' }}>
                    <div className="spinner"></div>
                  </div>
                ) : contextData ? (
                  <div>
                    {contextData.preceding.map((p, pi) => (
                      <div key={`prec-${pi}`} className="thread-row">
                        <span className="thread-time">{p.timestamp}</span>
                        <span className="thread-player">{p.player}</span>
                        <span className="thread-msg" style={{ color: 'var(--text-secondary)' }}>{p.message}</span>
                      </div>
                    ))}

                    <div className="thread-row target">
                      <span className="thread-time">{contextData.target.timestamp}</span>
                      <span className="thread-player">{contextData.target.player}</span>
                      <span className="thread-msg" style={{ color: '#ffffff', fontWeight: 500 }}>{contextData.target.message}</span>
                    </div>

                    {contextData.succeeding.map((s, si) => (
                      <div key={`succ-${si}`} className="thread-row">
                        <span className="thread-time">{s.timestamp}</span>
                        <span className="thread-player">{s.player}</span>
                        <span className="thread-msg" style={{ color: 'var(--text-secondary)' }}>{s.message}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>No context available.</p>
                )}
              </div>

              {/* AUTOMATED /STAFF LOG PUNISHMENT + MODAL AUTOFILL */}
              <div className="punishment-panel" id="punishment-autofill-panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.95rem', color: '#ffffff' }}>
                    Punishment Dispatch (<code>/staff log punishment</code> + Modal)
                  </span>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                    Autofilled · Enter duration to execute
                  </span>
                </div>

                {/* STEP 1: SLASH COMMAND OPTIONS */}
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.5rem' }}>
                  01. Slash Command Options
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                      punishment_type (Autofilled)
                    </label>
                    <select
                      value={punishmentType}
                      onChange={(e) => setPunishmentType(e.target.value)}
                      className="filter-select"
                      style={{ width: '100%', height: '40px', fontFamily: 'var(--font-mono)' }}
                    >
                      <option value="Mute">Mute</option>
                      <option value="Ban">Ban</option>
                      <option value="TempBan">TempBan</option>
                      <option value="Warn">Warn</option>
                      <option value="Kick">Kick</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', color: '#ffffff', fontWeight: 600, marginBottom: '0.3rem' }}>
                      duration * (Required)
                    </label>
                    <input
                      type="text"
                      value={punishmentDuration}
                      onChange={(e) => setPunishmentDuration(e.target.value)}
                      placeholder="e.g. 1h, 12h, 1d, 7d, 30d, Perm"
                      className="token-input"
                      style={{
                        borderColor: punishmentDuration.trim() ? 'var(--border-color)' : '#ffffff',
                      }}
                    />
                    <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
                      {['30m', '1h', '12h', '1d', '7d', '30d', 'Permanent'].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setPunishmentDuration(preset)}
                          className={`preset-chip-btn ${punishmentDuration === preset ? 'active' : ''}`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                      <span>evidence_links (Message URL)</span>
                      <button
                        type="button"
                        onClick={() => handleCopyText('evidence-link', punishmentEvidenceLinks)}
                        className="inline-link-btn"
                      >
                        {copiedKey === 'evidence-link' ? 'Copied' : 'Copy'}
                      </button>
                    </label>
                    <input
                      type="text"
                      value={punishmentEvidenceLinks}
                      onChange={(e) => setPunishmentEvidenceLinks(e.target.value)}
                      className="token-input"
                    />
                  </div>
                </div>

                {/* STEP 2: POPUP MENU / MODAL FIELDS */}
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.5rem' }}>
                  02. Modal Fields (Username, Reason, Gamemode)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                      <span>Username</span>
                      <button
                        type="button"
                        onClick={() => handleCopyText('modal-user', punishmentUsername)}
                        className="inline-link-btn"
                      >
                        {copiedKey === 'modal-user' ? 'Copied' : 'Copy'}
                      </button>
                    </label>
                    <input
                      type="text"
                      value={punishmentUsername}
                      onChange={(e) => setPunishmentUsername(e.target.value)}
                      className="token-input"
                    />
                  </div>

                  <div>
                    <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                      <span>Reason</span>
                      <button
                        type="button"
                        onClick={() => handleCopyText('modal-reason', punishmentReason)}
                        className="inline-link-btn"
                      >
                        {copiedKey === 'modal-reason' ? 'Copied' : 'Copy'}
                      </button>
                    </label>
                    <input
                      type="text"
                      value={punishmentReason}
                      onChange={(e) => setPunishmentReason(e.target.value)}
                      className="token-input"
                    />
                  </div>

                  <div>
                    <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                      <span>Gamemode</span>
                      <button
                        type="button"
                        onClick={() => handleCopyText('modal-gamemode', punishmentGamemode)}
                        className="inline-link-btn"
                      >
                        {copiedKey === 'modal-gamemode' ? 'Copied' : 'Copy'}
                      </button>
                    </label>
                    <input
                      type="text"
                      value={punishmentGamemode}
                      onChange={(e) => setPunishmentGamemode(e.target.value)}
                      placeholder="SMP, Lifesteal, BoxPvP, Skyblock"
                      className="token-input"
                    />
                  </div>
                </div>

                {/* Live Command Preview Bar */}
                <div
                  style={{
                    background: '#000000',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.65rem 0.85rem',
                    marginBottom: '1rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.75rem',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-mono)', fontSize: '0.76rem', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
                    <Terminal size={13} color="#ffffff" />
                    <span>
                      /staff log punishment punishment_type:{punishmentType} duration:{punishmentDuration || '<duration>'} evidence_links:{punishmentEvidenceLinks}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ height: '30px', padding: '0 0.65rem', fontSize: '0.72rem' }}
                    onClick={() =>
                      handleCopyText(
                        'slash-preview',
                        `/staff log punishment punishment_type:${punishmentType} duration:${punishmentDuration || '1d'} evidence_links:${punishmentEvidenceLinks}`
                      )
                    }
                  >
                    <Copy size={12} />
                    {copiedKey === 'slash-preview' ? 'Copied' : 'Copy Command'}
                  </button>
                </div>

                {/* Target Staff Command Channel ID + Submit Buttons */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div style={{ flex: '1 1 280px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.74rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                      <Link size={12} />
                      <span>Target Staff Channel ID / URL</span>
                    </label>
                    <input
                      type="text"
                      value={staffCommandChannelId}
                      onChange={(e) => {
                        setStaffCommandChannelId(e.target.value);
                        try {
                          localStorage.setItem('staff_command_channel_id', e.target.value);
                        } catch {
                          // ignore
                        }
                      }}
                      placeholder="Staff Command Channel ID"
                      className="token-input"
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={isSubmittingPunishment}
                      onClick={() => handleLogPunishment(false)}
                    >
                      <Copy size={13} />
                      Log &amp; Copy Command
                    </button>

                    <button
                      type="button"
                      className="btn-primary"
                      disabled={isSubmittingPunishment}
                      onClick={() => handleLogPunishment(true)}
                      title="Automatically sends /staff log punishment and submits the popup modal via your Discord Token"
                    >
                      <Send size={13} />
                      {isSubmittingPunishment ? 'Executing /staff + Modal...' : 'Auto-Execute in Discord & Log'}
                    </button>
                  </div>
                </div>

                {punishmentFeedback && (
                  <div
                    style={{
                      marginTop: '0.85rem',
                      padding: '0.6rem 0.85rem',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.78rem',
                      fontFamily: 'var(--font-mono)',
                      background: '#000000',
                      border: `1px solid ${punishmentFeedback.type === 'success' ? '#ffffff' : 'var(--border-strong)'}`,
                      color: '#ffffff',
                    }}
                  >
                    {punishmentFeedback.text}
                  </div>
                )}
              </div>

              {/* Moderator Notes */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                  Moderator Notes
                </label>
                <textarea
                  id="moderator-note-textarea"
                  value={moderatorNoteInput}
                  onChange={(e) => setModeratorNoteInput(e.target.value)}
                  placeholder="Add investigatory notes, context findings, or disciplinary reasoning..."
                  style={{
                    width: '100%',
                    background: '#000000',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.65rem 0.85rem',
                    color: '#ffffff',
                    fontFamily: 'var(--font-main)',
                    fontSize: '0.84rem',
                    minHeight: '65px',
                    resize: 'vertical',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="modal-footer">
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                Status: <strong style={{ color: '#ffffff', textTransform: 'capitalize' }}>{activeMessage.review_status.replace('_', ' ')}</strong>
              </div>

              <div className="action-btn-group">
                <button
                  type="button"
                  className="btn-action confirm"
                  onClick={() => handleModeratorAction('confirmed')}
                >
                  Confirm Violation
                </button>
                <button
                  type="button"
                  className="btn-action"
                  onClick={() => handleModeratorAction('false_positive')}
                >
                  False Positive
                </button>
                <button
                  type="button"
                  className="btn-action"
                  onClick={() => handleModeratorAction('reviewed')}
                >
                  Mark Reviewed
                </button>
                <button
                  type="button"
                  className="btn-action"
                  onClick={() => handleModeratorAction('ignored')}
                >
                  Ignore
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DEDICATED PLAYER DOSSIER MODAL */}
      {activePlayerDossier && (
        <div className="modal-overlay" onClick={() => setActivePlayerDossier(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#ffffff', fontFamily: 'var(--font-mono)' }}>
                  {activePlayerDossier.username}
                </h3>
                <span className="tier-text">
                  {activePlayerDossier.review_status_tier.replace(/_/g, ' ')}
                </span>
              </div>

              <button type="button" className="close-btn" onClick={() => setActivePlayerDossier(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div className="stats-grid" style={{ marginBottom: 0, gridTemplateColumns: 'repeat(3, 1fr)' }}>
                <div className="stat-card" style={{ padding: '1rem' }}>
                  <div className="stat-label">Total Messages</div>
                  <div className="stat-value" style={{ fontSize: '1.4rem' }}>{activePlayerDossier.total_messages}</div>
                </div>

                <div className="stat-card" style={{ padding: '1rem' }}>
                  <div className="stat-label">Flagged Count</div>
                  <div className="stat-value" style={{ fontSize: '1.4rem' }}>
                    {activePlayerDossier.flagged_messages} ({activePlayerDossier.flagged_percentage}%)
                  </div>
                </div>

                <div className="stat-card" style={{ padding: '1rem' }}>
                  <div className="stat-label">Avg Toxicity</div>
                  <div className="stat-value" style={{ fontSize: '1.4rem' }}>
                    {(activePlayerDossier.average_toxicity * 100).toFixed(0)}%
                  </div>
                </div>
              </div>

              {/* Player's messages in this dataset */}
              <div>
                <h4 style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.65rem' }}>
                  Recorded Messages ({dossierMessages.length})
                </h4>
                <div style={{ maxHeight: '300px', overflowY: 'auto', background: '#000000', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                  {dossierMessages.length === 0 ? (
                    <div style={{ padding: '1.25rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <div className="spinner" style={{ margin: '0 auto 0.5rem' }}></div>
                      Loading messages...
                    </div>
                  ) : dossierMessages.map(m => (
                      <div
                        key={m.id}
                        style={{ padding: '0.6rem 0.85rem', borderBottom: '1px solid #141414', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}
                      >
                        <div>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.74rem', color: 'var(--text-muted)', marginRight: '10px' }}>
                            {m.timestamp}
                          </span>
                          <span style={{ color: '#ffffff', fontSize: '0.84rem' }}>{m.message}</span>
                        </div>
                        <span className={`severity-label ${m.is_flagged ? m.severity : 'clean'}`} style={{ fontSize: '0.72rem' }}>
                          {m.is_flagged ? m.severity : 'clean'}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setSelectedPlayer(activePlayerDossier.username);
                  setViewFilter('all');
                  setActiveTab('dashboard');
                  setActivePlayerDossier(null);
                }}
              >
                Filter Queue by {activePlayerDossier.username}
              </button>

              <button
                type="button"
                className="btn-secondary"
                onClick={() => setActivePlayerDossier(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
