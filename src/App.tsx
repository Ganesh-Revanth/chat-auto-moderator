import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, ChevronLeft, ChevronRight, ChevronDown, X } from 'lucide-react';
import type {
  LogParseResponse,
  MessageRecord,
  ContextAnalysisResult,
  PlayerProfile,
  PunishmentRecord,
  ChannelCacheSummary,
  LiveFeedAlertItem,
  LiveMonitorStatusResponse,
} from './types';
import { CaseInspectorPanel } from './components/CaseInspectorPanel';
import {
  PlayersDossiersView,
  AnalyticsWorkbenchView,
  PunishmentsLogView,
  PlayerDossierModal,
} from './components/AnalyticsAndDossiers';
import {
  SmartScanMemoryPanel,
  LiveModerationRadarView,
  convertLiveItemToMessageRecord,
} from './components/LiveAndMemoryHub';
import { BrandLogoMark } from './components/BrandLogoMark';
import { BatchPunishmentModal } from './components/BatchPunishmentModal';

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

type Appearance = 'dark' | 'light';
type View = 'dashboard' | 'live' | 'players' | 'analytics' | 'punishments' | 'settings';

const NAV_ICONS: Record<string, React.ReactNode> = {
  dashboard: <path d="M3 13l2.5-7h13L21 13M3 13v5a1 1 0 001 1h16a1 1 0 001-1v-5M3 13h5l1 2h6l1-2h5" />,
  live: (
    <>
      <circle cx="12" cy="12" r="2" />
      <path d="M7.8 7.8a6 6 0 000 8.4M16.2 7.8a6 6 0 010 8.4M4.9 4.9a10 10 0 000 14.2M19.1 4.9a10 10 0 010 14.2" />
    </>
  ),
  players: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 19c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
      <path d="M16 5.2a3 3 0 010 5.6M18 14c2 .7 3.2 2.4 3.2 5" />
    </>
  ),
  analytics: <path d="M5 20v-7M12 20V5M19 20v-10" />,
  punishments: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4.5h6M9 10h6M9 14h6" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" />
    </>
  ),
};

const NavIcon: React.FC<{ id: string }> = ({ id }) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {NAV_ICONS[id]}
  </svg>
);

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low'] as const;

const SHORTCUTS: [string, string][] = [
  ['J / K', 'Next / previous case'],
  ['C', 'Confirm violation'],
  ['X', 'Mark false positive'],
  ['R', 'Mark reviewed'],
  ['P', 'Log punishment & go to next'],
  ['B', 'Batch punish selection'],
  ['Esc', 'Close case'],
];

export const App: React.FC = () => {
  const [appearance, setAppearance] = useState<Appearance>(() => {
    try {
      return localStorage.getItem('modstudio_appearance') === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });
  const [showDevTools, setShowDevTools] = useState<boolean>(() => {
    try {
      return localStorage.getItem('modstudio_dev_tools') === 'true';
    } catch {
      return false;
    }
  });
  const [isSourceOpen, setIsSourceOpen] = useState<boolean>(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', appearance);
    try {
      localStorage.setItem('modstudio_appearance', appearance);
    } catch {
      // ignore
    }
  }, [appearance]);

  const showToast = useCallback((text: string) => {
    setToast(text);
    setTimeout(() => setToast((prev) => (prev === text ? null : prev)), 2400);
  }, []);

  const [data, setData] = useState<LogParseResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [formatHint, setFormatHint] = useState<string>('auto');

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
    mode?: 'date' | 'limit';
  } | null>(null);

  // Active Tab
  const [activeTab, setActiveTab] = useState<View>('dashboard');

  // Smart Scan Memory Cache State
  const [cachedChannels, setCachedChannels] = useState<ChannelCacheSummary[]>([]);
  const [useSmartCache, setUseSmartCache] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('modstudio_use_smart_cache');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  // Live Chat Moderation Radar State
  const [liveStatus, setLiveStatus] = useState<LiveMonitorStatusResponse | null>(null);
  const [soundAlertsEnabled, setSoundAlertsEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('modstudio_sound_alerts');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });
  const lastAlertCountRef = useRef<number>(0);

  const playViolationAlertChime = useCallback(() => {
    if (!soundAlertsEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.28);
    } catch {
      // ignore audio context restrictions
    }
  }, [soundAlertsEnabled]);

  const refreshCachedChannels = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/cache/channels`);
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list)) setCachedChannels(list);
      }
    } catch {
      // ignore
    }
  }, []);

  const refreshLiveStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/live/status`);
      if (res.ok) {
        const st: LiveMonitorStatusResponse = await res.json();
        if (st.active_alerts.length > lastAlertCountRef.current && lastAlertCountRef.current > 0) {
          playViolationAlertChime();
        }
        lastAlertCountRef.current = st.active_alerts.length;
        setLiveStatus(st);
      }
    } catch {
      // ignore
    }
  }, [playViolationAlertChime]);

  useEffect(() => {
    refreshCachedChannels();
    refreshLiveStatus();
  }, [refreshCachedChannels, refreshLiveStatus]);

  useEffect(() => {
    if (!liveStatus?.running && activeTab !== 'live') return;
    const timer = setInterval(() => {
      refreshLiveStatus();
    }, 2500);
    return () => clearInterval(timer);
  }, [liveStatus?.running, activeTab, refreshLiveStatus]);

  const handleLoadCachedChannel = async (channelId: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/cache/channels/${channelId}/load`, {
        method: 'POST',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Failed to load cached channel' }));
        throw new Error(err.detail || 'Failed to load cached channel');
      }
      const result: LogParseResponse = await res.json();
      setData(result);
      setDiscordChannelId(channelId);
      setActiveTab('dashboard');
      setActiveTab('dashboard');
    } catch (e: any) {
      setErrorMessage(e?.message || 'Could not load channel from memory.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteCachedChannel = async (channelId: string) => {
    try {
      await fetch(`${API_BASE_URL}/api/v1/cache/channels/${channelId}`, {
        method: 'DELETE',
      });
      await refreshCachedChannels();
    } catch {
      // ignore
    }
  };

  const handleStartLiveMonitor = async (
    channelIdOrAll: string,
    intervalMs: number,
    channelIds?: string[]
  ) => {
    try {
      const isAll = channelIdOrAll === 'all' || (Array.isArray(channelIds) && channelIds.length > 1);
      const res = await fetch(`${API_BASE_URL}/api/v1/live/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: discordToken.trim(),
          mode: isAll ? 'all' : 'single',
          channel_id: channelIdOrAll,
          channel_ids:
            channelIds && channelIds.length > 0
              ? channelIds
              : isAll
              ? presetChannels.map((p) => p.channel_id)
              : [channelIdOrAll],
          poll_interval_ms: intervalMs,
        }),
      });
      if (res.ok) {
        const st: LiveMonitorStatusResponse = await res.json();
        lastAlertCountRef.current = st.active_alerts.length;
        setLiveStatus(st);
        await refreshCachedChannels();
      }
    } catch {
      // ignore
    }
  };

  const handleStopLiveMonitor = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/v1/live/stop`, { method: 'POST' });
      await refreshLiveStatus();
    } catch {
      // ignore
    }
  };

  const handleClearLiveAlerts = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/v1/live/clear-alerts`, { method: 'POST' });
      lastAlertCountRef.current = 0;
      await refreshLiveStatus();
    } catch {
      // ignore
    }
  };

  const handleSimulateLiveEvent = async (
    customPlayer?: string,
    customMessage?: string,
    channelId?: string,
    multiChannelBurst?: boolean
  ) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/live/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player: customPlayer,
          message: customMessage,
          channel_id: channelId,
          multi_channel_burst: Boolean(multiChannelBurst),
        }),
      });
      if (res.ok) {
        const payload: any = await res.json();
        if (payload?.multi_channel_burst || Array.isArray(payload?.items)) {
          const anyFlagged = payload.items.some((i: LiveFeedAlertItem) => i.is_flagged);
          if (anyFlagged) playViolationAlertChime();
        } else if (payload?.is_flagged) {
          playViolationAlertChime();
        }
        await refreshLiveStatus();
      }
    } catch {
      // ignore
    }
  };

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
  const [staffActionMode, setStaffActionMode] = useState<'log' | 'request'>('log');
  const [punishmentDuration, setPunishmentDuration] = useState<string>('');
  const [punishmentEvidenceLinks, setPunishmentEvidenceLinks] = useState<string>('');
  const [punishmentUsername, setPunishmentUsername] = useState<string>('');
  const [punishmentReason, setPunishmentReason] = useState<string>('');
  const [punishmentGamemode, setPunishmentGamemode] = useState<string>('SMP');
  const [isSubmittingPunishment, setIsSubmittingPunishment] = useState<boolean>(false);
  const [punishmentFeedback, setPunishmentFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<any>(null);
  const [isStandaloneApp, setIsStandaloneApp] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    );
  });

  useEffect(() => {
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
  const [startDateFilter, setStartDateFilter] = useState<string>('');
  const [endDateFilter, setEndDateFilter] = useState<string>('');
  const [todayDateStr] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [past7DateStr] = useState<string>(() => new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10));

  // Moderation Scope Mode: 'date' vs 'limit'
  // When moderating by date, message limit is IRRELEVANT (analyzing all messages in date range)
  // When moderating by message limit, dates are IRRELEVANT (analyzing newest N messages with zero date cutoff)
  const [scopeMode, setScopeMode] = useState<'date' | 'limit'>('limit');

  const handleSelectDateScope = (start?: string, end?: string) => {
    setScopeMode('date');
    if (start !== undefined) {
      setStartDateFilter(start);
    } else if (!startDateFilter) {
      setStartDateFilter(todayDateStr);
    }
    if (end !== undefined) {
      setEndDateFilter(end);
    }
  };

  const handleSelectLimitScope = (newLimit?: number) => {
    setScopeMode('limit');
    setStartDateFilter('');
    setEndDateFilter('');
    if (newLimit) setDiscordFetchLimit(newLimit);
  };

  // Batch Selection State
  const [selectedMsgIds, setSelectedMsgIds] = useState<number[]>([]);
  const [isBatchPunishmentOpen, setIsBatchPunishmentOpen] = useState<boolean>(false);
  const [batchPunishmentMode, setBatchPunishmentMode] = useState<'log' | 'request'>('request');
  const [batchTargetMessages, setBatchTargetMessages] = useState<MessageRecord[]>([]);

  // Case Inspector State (Split-Pane Docked by default, expandable to modal)
  const [activeMessage, setActiveMessage] = useState<MessageRecord | null>(null);
  const [contextData, setContextData] = useState<ContextAnalysisResult | null>(null);
  const [isLoadingContext, setIsLoadingContext] = useState<boolean>(false);
  const [moderatorNoteInput, setModeratorNoteInput] = useState<string>('');

  // Player dossier modal
  const [activePlayerDossier, setActivePlayerDossier] = useState<PlayerProfile | null>(null);
  const [dossierMessages, setDossierMessages] = useState<MessageRecord[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchMessages = useCallback(
    async (
      page: number,
      filters?: {
        flaggedOnly?: boolean;
        severity?: string;
        category?: string;
        player?: string;
        status?: string;
        search?: string;
        sortBy?: string;
        startDate?: string;
        endDate?: string;
      }
    ) => {
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
        if (filters?.startDate?.trim()) params.set('start_date', filters.startDate.trim());
        if (filters?.endDate?.trim()) params.set('end_date', filters.endDate.trim());

        const res = await fetch(`${API_BASE_URL}/api/v1/messages?${params.toString()}`);
        if (res.ok) {
          const result = await res.json();
          setMessages(result.messages);
          setTotalMessages(result.total);
          setTotalPages(result.total_pages);
          setCurrentPage(page);
          setSelectedMsgIds([]);
        }
      } catch (e) {
        console.error('Failed to fetch messages:', e);
      } finally {
        setIsLoadingMessages(false);
      }
    },
    []
  );

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
      startDate: scopeMode === 'date' ? startDateFilter : undefined,
      endDate: scopeMode === 'date' ? endDateFilter : undefined,
    });
  }, [
    data,
    viewFilter,
    selectedSeverity,
    selectedCategory,
    selectedPlayer,
    selectedStatus,
    searchQuery,
    sortBy,
    scopeMode,
    startDateFilter,
    endDateFilter,
    fetchMessages,
  ]);

  const handleFileUpload = async (file: File) => {
    setIsLoading(true);
    setErrorMessage(null);
    setMessages([]);
    setData(null);
    setActiveMessage(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      let url = `${API_BASE_URL}/api/v1/upload`;
      const queryParams = new URLSearchParams();
      if (formatHint !== 'auto') queryParams.set('format_hint', formatHint);
      if (scopeMode === 'date') {
        if (startDateFilter?.trim()) queryParams.set('start_date', startDateFilter.trim());
        if (endDateFilter?.trim()) queryParams.set('end_date', endDateFilter.trim());
      }
      if (queryParams.toString()) url += `?${queryParams.toString()}`;

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
      setActiveTab('dashboard');
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

  const handleDiscordTokenFetch = async (
    e?: React.FormEvent,
    overrideChannelId?: string,
    forceRescan = false
  ) => {
    if (e) e.preventDefault();
    const targetChannel = (overrideChannelId || discordChannelId).trim();
    if (!discordToken.trim()) {
      setErrorMessage('Please enter your Discord Auth Token or Bot Token.');
      return;
    }
    if (!targetChannel) {
      setErrorMessage('Please enter a Discord Channel ID or Channel Link.');
      return;
    }

    const isModeratingByDate = scopeMode === 'date';
    const activeStartDate = isModeratingByDate
      ? (startDateFilter?.trim() || todayDateStr)
      : undefined;
    const activeEndDate = isModeratingByDate
      ? (endDateFilter?.trim() || undefined)
      : undefined;

    if (isModeratingByDate && !startDateFilter) {
      setStartDateFilter(todayDateStr);
    }

    setIsLoading(true);
    setErrorMessage(null);
    setMessages([]);
    setData(null);
    setActiveMessage(null);
    setFetchProgress({
      status: 'starting',
      fetched: 0,
      target: isModeratingByDate ? 0 : discordFetchLimit,
      channelName: targetChannel,
      rateLimitWaitMs: 0,
      mode: isModeratingByDate ? 'date' : 'limit',
    });

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/discord/fetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: discordToken.trim(),
          channel_id: targetChannel,
          moderate_by: isModeratingByDate ? 'date' : 'limit',
          limit: isModeratingByDate ? undefined : discordFetchLimit,
          start_date: activeStartDate,
          end_date: activeEndDate,
          async_mode: true,
          use_cache: useSmartCache,
          force_rescan: forceRescan,
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
        setActiveTab('dashboard');
        refreshCachedChannels();
        return;
      }

      setFetchProgress({
        status: initResult.status || 'fetching',
        fetched: initResult.fetched || 0,
        target: isModeratingByDate ? 0 : (initResult.target || discordFetchLimit),
        channelName: initResult.channel_name || targetChannel,
        rateLimitWaitMs: 0,
        mode: isModeratingByDate ? 'date' : 'limit',
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
          setActiveTab('dashboard');
          refreshCachedChannels();
          break;
        }

        setFetchProgress({
          status: st.status,
          fetched: st.fetched || 0,
          target: isModeratingByDate ? 0 : (st.target || discordFetchLimit),
          channelName: st.channel_name || targetChannel,
          rateLimitWaitMs: st.rate_limit_wait_ms || 0,
          mode: isModeratingByDate ? 'date' : 'limit',
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
    setActiveMessage(null);
    try {
      const queryParams = new URLSearchParams();
      if (scopeMode === 'date') {
        if (startDateFilter?.trim()) queryParams.set('start_date', startDateFilter.trim());
        if (endDateFilter?.trim()) queryParams.set('end_date', endDateFilter.trim());
      }
      const queryStr = queryParams.toString() ? `?${queryParams.toString()}` : '';
      const response = await fetch(`${API_BASE_URL}/api/v1/sample${queryStr}`);
      if (!response.ok) {
        throw new Error(`Failed to load sample: ${response.status}`);
      }
      const result: LogParseResponse = await response.json();
      setMessages(result.messages_preview || []);
      setTotalMessages(result.messages_preview?.length || 0);
      setTotalPages(1);
      setCurrentPage(1);
      setData({ ...result, messages_preview: [] });
      setActiveTab('dashboard');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load sample log.');
    } finally {
      setIsLoading(false);
    }
  };

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
    if (msg.categories.includes('advertising') || msg.categories.includes('suspicious_url')) return 'TempBan';
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
      suspicious_url: 'Unauthorized External Link / Server Advertisement',
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

  const buildMessageEvidenceLink = useCallback(
    (msg: MessageRecord): string => {
      if (msg.discord_message_url) return msg.discord_message_url;
      const gId = data?.guild_id || 'guild';
      const cId =
        data?.channel_id || (discordChannelId.trim().match(/\d{15,22}/g)?.slice(-1)[0] ?? 'channel');
      return `https://discord.com/channels/${gId}/${cId}/line-${msg.line_number}`;
    },
    [data, discordChannelId]
  );

  const handleOpenMessageModal = useCallback(
    async (msg: MessageRecord, initialMode: 'log' | 'request' = 'log') => {
      setActiveMessage(msg);
      setContextData(null);
      setModeratorNoteInput(msg.moderator_notes || '');
      setPunishmentFeedback(null);

      setStaffActionMode(initialMode);
      setPunishmentType(inferPunishmentType(msg));
      setPunishmentDuration(initialMode === 'request' ? 'Permanent' : '');
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
        console.error('Could not load context thread:', e);
      } finally {
        setIsLoadingContext(false);
      }
    },
    [buildMessageEvidenceLink, data]
  );

  const handleCopyText = (key: string, text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    showToast('Copied to clipboard');
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey((prev) => (prev === key ? null : prev));
    }, 1800);
  };

  const handleLogPunishment = async (
    autoSendDiscord: boolean,
    overrideActionMode?: 'log' | 'request',
    andStepNext?: boolean
  ) => {
    if (!activeMessage) return;
    const effectiveMode: 'log' | 'request' = overrideActionMode || staffActionMode;
    const slashCmdName =
      effectiveMode === 'request' ? '/staff request punishment' : '/staff log punishment';

    if (!punishmentDuration.trim()) {
      setPunishmentFeedback({
        type: 'error',
        text: `Please enter the Punishment Duration (e.g., 1d, 12h, 7d, Permanent) before executing ${slashCmdName}.`,
      });
      return;
    }

    if (autoSendDiscord) {
      if (!discordToken.trim()) {
        setPunishmentFeedback({
          type: 'error',
          text: `Please enter your Discord Token in the Stream Configuration bar to execute ${slashCmdName} in Discord.`,
        });
        return;
      }
      if (!staffCommandChannelId.trim()) {
        setPunishmentFeedback({
          type: 'error',
          text: 'Please enter your specific Staff Punishment Command Channel ID (or URL).',
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
          staff_action_mode: effectiveMode,
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
        throw new Error(body.detail || `Failed to execute ${slashCmdName}.`);
      }

      const record = body as PunishmentRecord;
      setPunishments((prev) => [record, ...prev]);

      const updatedMsg: MessageRecord = {
        ...activeMessage,
        review_status: 'confirmed',
        moderator_notes: `[${record.case_id}] (${effectiveMode.toUpperCase()}) ${record.punishment_type} (${record.duration}) - ${record.reason} [${record.gamemode}]`,
      };
      setActiveMessage(updatedMsg);
      setMessages((prev) => prev.map((m) => (m.id === updatedMsg.id ? updatedMsg : m)));

      if (autoSendDiscord) {
        setPunishmentFeedback({
          type: record.discord_status === 'sent_to_discord' ? 'success' : 'error',
          text: `${record.case_id}: ${record.discord_detail || 'Submitted'}`,
        });
      } else {
        setPunishmentFeedback({
          type: 'success',
          text: `${record.case_id} saved to Ledger! (${slashCmdName}) copied to clipboard.`,
        });
        handleCopyText('slash-cmd', record.command_string);
      }

      if (andStepNext) {
        const nextFlagged = filteredMessages.find(
          (m) => m.id !== activeMessage.id && m.is_flagged && m.review_status === 'unreviewed'
        ) || filteredMessages.find((m) => m.id !== activeMessage.id && m.is_flagged);
        if (nextFlagged) {
          setTimeout(() => {
            handleOpenMessageModal(nextFlagged, effectiveMode);
          }, 350);
        }
      }
    } catch (e: any) {
      setPunishmentFeedback({
        type: 'error',
        text: e.message || `Error executing ${slashCmdName}.`,
      });
    } finally {
      setIsSubmittingPunishment(false);
    }
  };

  const handleOpenBatchPunishment = (
    initialMode: 'log' | 'request' = 'request',
    explicitMsgs?: MessageRecord[]
  ) => {
    let targets: MessageRecord[] = [];
    if (explicitMsgs && explicitMsgs.length > 0) {
      targets = explicitMsgs;
    } else if (selectedMsgIds.length > 0) {
      targets = filteredMessages.filter((m) => selectedMsgIds.includes(m.id));
    } else {
      targets = filteredMessages.filter((m) => m.is_flagged);
    }

    if (targets.length === 0) {
      targets = filteredMessages.slice(0, 10);
    }

    setBatchTargetMessages(targets);
    setBatchPunishmentMode(initialMode);
    setIsBatchPunishmentOpen(true);
  };

  const handleSelectAllFlagged = () => {
    const flaggedIds = filteredMessages.filter((m) => m.is_flagged).map((m) => m.id);
    setSelectedMsgIds(flaggedIds);
  };

  const handleBatchPunishmentComplete = (createdRecords: PunishmentRecord[]) => {
    if (!createdRecords || createdRecords.length === 0) return;
    setPunishments((prev) => [...createdRecords, ...prev]);

    const recordMap = new Map<number, PunishmentRecord>();
    for (const r of createdRecords) {
      if (typeof r.message_id === 'number') {
        recordMap.set(r.message_id, r);
      }
    }

    setMessages((prev) =>
      prev.map((m) => {
        const rec = recordMap.get(m.id);
        if (rec) {
          const modeTag = (rec.staff_action_mode || 'log').toUpperCase();
          return {
            ...m,
            review_status: 'confirmed',
            moderator_notes: `[${rec.case_id}] (${modeTag}) ${rec.punishment_type} (${rec.duration}) - ${rec.reason} [${rec.gamemode}]`,
          };
        }
        return m;
      })
    );

    if (activeMessage && recordMap.has(activeMessage.id)) {
      const rec = recordMap.get(activeMessage.id)!;
      const modeTag = (rec.staff_action_mode || 'log').toUpperCase();
      setActiveMessage({
        ...activeMessage,
        review_status: 'confirmed',
        moderator_notes: `[${rec.case_id}] (${modeTag}) ${rec.punishment_type} (${rec.duration}) - ${rec.reason} [${rec.gamemode}]`,
      });
    }

    setSelectedMsgIds([]);
  };

  const handleDeletePunishment = async (id: number) => {
    try {
      await fetch(`${API_BASE_URL}/api/v1/punishments/${id}`, { method: 'DELETE' });
      setPunishments((prev) => prev.filter((p) => p.id !== id));
    } catch {
      // ignore
    }
  };

  const handleModeratorAction = useCallback(
    async (action: 'confirmed' | 'false_positive' | 'reviewed' | 'ignored') => {
      if (!activeMessage) return;

      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/messages/${activeMessage.id}/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, notes: moderatorNoteInput }),
        });

        if (res.ok) {
          const updatedMsg: MessageRecord = await res.json();
          setMessages((prev) => prev.map((m) => (m.id === updatedMsg.id ? updatedMsg : m)));
          setActiveMessage(updatedMsg);
        }
      } catch (e) {
        console.error('Failed to update moderator action:', e);
      }
    },
    [activeMessage, moderatorNoteInput]
  );

  // Batch Disposition Handler
  const handleBatchModeratorAction = async (action: 'confirmed' | 'false_positive' | 'reviewed' | 'ignored') => {
    if (selectedMsgIds.length === 0) return;
    try {
      await Promise.all(
        selectedMsgIds.map((id) =>
          fetch(`${API_BASE_URL}/api/v1/messages/${id}/action`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action }),
          })
        )
      );
      setMessages((prev) =>
        prev.map((m) => (selectedMsgIds.includes(m.id) ? { ...m, review_status: action } : m))
      );
      if (activeMessage && selectedMsgIds.includes(activeMessage.id)) {
        setActiveMessage({ ...activeMessage, review_status: action });
      }
      setSelectedMsgIds([]);
    } catch (e) {
      console.error('Batch update failed:', e);
    }
  };

  const handleExport = (fmt: 'json' | 'csv') => {
    const link = document.createElement('a');
    link.href = `${API_BASE_URL}/api/v1/export/report?format=${fmt}`;
    link.download = `moderation_report.${fmt}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
  const activeIdx = activeMessage ? filteredMessages.findIndex((m) => m.id === activeMessage.id) : -1;
  const canStepPrev = activeIdx > 0;
  const canStepNext = activeIdx >= 0 && activeIdx < filteredMessages.length - 1;

  const handleStepCase = useCallback(
    (direction: -1 | 1) => {
      if (activeIdx < 0) return;
      const target = filteredMessages[activeIdx + direction];
      if (target) {
        handleOpenMessageModal(target);
      }
    },
    [activeIdx, filteredMessages, handleOpenMessageModal]
  );

  // Keyboard-First Rapid Triage Shortcuts (J/K, C, X, R, Esc)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      if (e.key === 'Escape' && activeMessage) {
        setActiveMessage(null);
        return;
      }

      if (activeTab !== 'dashboard' || filteredMessages.length === 0) return;

      if (e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        if (!activeMessage) {
          handleOpenMessageModal(filteredMessages[0]);
        } else if (canStepNext) {
          handleStepCase(1);
        }
      } else if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        if (activeMessage && canStepPrev) {
          handleStepCase(-1);
        }
      } else if (activeMessage && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        handleModeratorAction('confirmed');
      } else if (activeMessage && (e.key === 'x' || e.key === 'X')) {
        e.preventDefault();
        handleModeratorAction('false_positive');
      } else if (activeMessage && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault();
        handleModeratorAction('reviewed');
      } else if (activeMessage && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        handleLogPunishment(Boolean(discordToken.trim()), staffActionMode, true);
      } else if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        handleOpenBatchPunishment('request');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    activeMessage,
    activeTab,
    canStepNext,
    canStepPrev,
    filteredMessages,
    handleModeratorAction,
    handleOpenMessageModal,
    handleStepCase,
    handleLogPunishment,
    handleOpenBatchPunishment,
    staffActionMode,
    discordToken,
  ]);

  const toggleSelectMessage = (id: number) => {
    setSelectedMsgIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAllOnPage = () => {
    if (selectedMsgIds.length === filteredMessages.length && filteredMessages.length > 0) {
      setSelectedMsgIds([]);
    } else {
      setSelectedMsgIds(filteredMessages.map((m) => m.id));
    }
  };
  /* ------------------------------------------------------------------ */
  /* Presentation helpers                                                */
  /* ------------------------------------------------------------------ */
  const persistSession = (patch: Record<string, string>) => {
    fetch(`${API_BASE_URL}/api/v1/discord/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).catch(() => {});
  };

  const handleTokenChange = (val: string) => {
    setDiscordToken(val);
    try {
      localStorage.setItem('discord_token_saved', val);
    } catch {
      // ignore
    }
    persistSession({ token: val });
  };

  const handleSelectChannel = (id: string) => {
    setDiscordChannelId(id);
    try {
      localStorage.setItem('discord_selected_channel_id', id);
    } catch {
      // ignore
    }
    persistSession({ selected_channel_id: id });
  };

  const handleStaffChannelChange = (val: string) => {
    setStaffCommandChannelId(val);
    try {
      localStorage.setItem('staff_command_channel_id', val);
    } catch {
      // ignore
    }
    persistSession({ staff_channel_id: val });
  };

  const handleToggleDevTools = (on: boolean) => {
    setShowDevTools(on);
    try {
      localStorage.setItem('modstudio_dev_tools', String(on));
    } catch {
      // ignore
    }
  };

  const handleToggleSmartCache = (enabled: boolean) => {
    setUseSmartCache(enabled);
    try {
      localStorage.setItem('modstudio_use_smart_cache', String(enabled));
    } catch {
      // ignore
    }
  };

  const handleToggleSound = () => {
    const next = !soundAlertsEnabled;
    setSoundAlertsEnabled(next);
    try {
      localStorage.setItem('modstudio_sound_alerts', String(next));
    } catch {
      // ignore
    }
  };

  const currentFilters = () => ({
    flaggedOnly: viewFilter === 'flagged',
    severity: selectedSeverity,
    category: selectedCategory,
    player: selectedPlayer,
    status: selectedStatus,
    search: searchQuery,
    sortBy,
    startDate: scopeMode === 'date' ? startDateFilter : undefined,
    endDate: scopeMode === 'date' ? endDateFilter : undefined,
  });

  const tokenReady = discordToken.trim().length > 0;
  const selectedChannel = presetChannels.find((p) => p.channel_id === discordChannelId);
  const selectedChannelName = selectedChannel?.name || discordChannelId || 'No channel selected';
  const sevCounts = data?.severity_breakdown || {};
  const sevTotal = SEVERITY_ORDER.reduce((n, k) => n + (sevCounts[k] || 0), 0);
  const liveAlertCount = liveStatus?.active_alerts.length || 0;
  const scopeLabel =
    scopeMode === 'date'
      ? `${startDateFilter || todayDateStr}${endDateFilter ? ` → ${endDateFilter}` : ' → now'}`
      : `Latest ${discordFetchLimit.toLocaleString()} messages`;
  const hasActiveFilters =
    selectedSeverity !== 'all' ||
    selectedCategory !== 'all' ||
    selectedStatus !== 'all' ||
    selectedPlayer !== 'all' ||
    searchQuery.trim() !== '';

  const NAV: { id: View; label: string }[] = [
    { id: 'dashboard', label: 'Review' },
    { id: 'live', label: 'Live' },
    { id: 'players', label: 'Players' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'punishments', label: 'Punishments' },
  ];

  const inspectorProps = activeMessage
    ? {
        activeMessage,
        contextData,
        isLoadingContext,
        moderatorNoteInput,
        setModeratorNoteInput,
        staffActionMode,
        setStaffActionMode,
        punishmentType,
        setPunishmentType,
        punishmentDuration,
        setPunishmentDuration,
        punishmentEvidenceLinks,
        setPunishmentEvidenceLinks,
        punishmentUsername,
        setPunishmentUsername,
        punishmentReason,
        setPunishmentReason,
        punishmentGamemode,
        setPunishmentGamemode,
        staffCommandChannelId,
        onUpdateStaffChannelId: handleStaffChannelChange,
        isSubmittingPunishment,
        punishmentFeedback,
        copiedKey,
        onCopyText: handleCopyText,
        onLogPunishment: handleLogPunishment,
        onModeratorAction: handleModeratorAction,
        onClose: () => setActiveMessage(null),
        onStepCase: handleStepCase,
        canStepPrev,
        canStepNext,
        onOpenPlayerByName: (uname: string) => {
          if (data?.player_profiles[uname]) {
            handleOpenPlayerDossier(data.player_profiles[uname]);
          }
        },
      }
    : null;

  const progressPct =
    fetchProgress && fetchProgress.target > 0
      ? Math.min(100, Math.round((fetchProgress.fetched / fetchProgress.target) * 100))
      : null;

  const progressCard = fetchProgress && (
    <div className="card" role="status" aria-live="polite" style={{ padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span className="spinner" />
        <div style={{ minWidth: 0 }}>
          <b style={{ fontSize: 13.5 }}>Scanning {fetchProgress.channelName}</b>
          <div className="hint" style={{ marginTop: 2 }}>
            {fetchProgress.fetched.toLocaleString()}
            {fetchProgress.target > 0 ? ` of ${fetchProgress.target.toLocaleString()}` : ''} messages
            {fetchProgress.rateLimitWaitMs > 0
              ? ` · waiting ${Math.ceil(fetchProgress.rateLimitWaitMs / 1000)}s (Discord rate limit)`
              : ''}
          </div>
        </div>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${progressPct ?? 35}%` }} />
      </div>
      <button type="button" className="btn sm" style={{ marginTop: 12 }} onClick={handleStopDiscordFetch}>
        Stop &amp; analyze what we have
      </button>
    </div>
  );

  const errorNotice = errorMessage && (
    <div className="notice" role="alert" style={{ ['--c' as string]: 'var(--crit)' }}>
      <span style={{ flex: 1 }}>{errorMessage}</span>
      <button
        type="button"
        className="btn ghost icon"
        style={{ width: 24, height: 24, padding: 0 }}
        onClick={() => setErrorMessage(null)}
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );

  /* ------------------------------------------------------------------ */
  /* Views                                                               */
  /* ------------------------------------------------------------------ */
  const sourcePopover = isSourceOpen && (
    <div
      className="card glass"
      role="menu"
      style={{ position: 'absolute', zIndex: 30, left: 18, right: 18, top: 128, padding: 8, maxHeight: '60vh', overflowY: 'auto' }}
    >
      <div className="eyebrow" style={{ padding: '8px 10px 4px' }}>
        Channels
      </div>
      {presetChannels.map((ch) => (
        <button
          key={ch.channel_id}
          type="button"
          role="menuitem"
          className="nav"
          onClick={() => {
            setIsSourceOpen(false);
            handleSelectChannel(ch.channel_id);
            handleDiscordTokenFetch(undefined, ch.channel_id);
          }}
        >
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {ch.name}
          </span>
          {ch.channel_id === discordChannelId && <span className="count">current</span>}
        </button>
      ))}
      {cachedChannels.length > 0 && (
        <>
          <div className="eyebrow" style={{ padding: '10px 10px 4px' }}>
            Saved scans
          </div>
          {cachedChannels.map((c) => (
            <button
              key={c.channel_id}
              type="button"
              role="menuitem"
              className="nav"
              onClick={() => {
                setIsSourceOpen(false);
                handleLoadCachedChannel(c.channel_id);
              }}
            >
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.channel_name}
              </span>
              <span className="count">{c.flagged_messages_count} flagged</span>
            </button>
          ))}
        </>
      )}
      <div className="eyebrow" style={{ padding: '10px 10px 4px' }}>
        Other
      </div>
      <button
        type="button"
        role="menuitem"
        className="nav"
        onClick={() => {
          setIsSourceOpen(false);
          fileInputRef.current?.click();
        }}
      >
        Open a log file…
      </button>
      <button
        type="button"
        role="menuitem"
        className="nav"
        onClick={() => {
          setIsSourceOpen(false);
          setActiveTab('settings');
        }}
      >
        Scan settings…
      </button>
    </div>
  );

  const reviewView = !data ? (
    <div className="page" style={{ display: 'flex' }}>
      <div className="empty" style={{ maxWidth: 520, margin: '0 auto' }}>
        {isLoading && fetchProgress ? (
          <div style={{ width: '100%', textAlign: 'left' }}>{progressCard}</div>
        ) : isLoading ? (
          <span className="spinner" />
        ) : (
          <>
            <BrandLogoMark size={56} />
            <h2>Choose what to review</h2>
            <p>
              {tokenReady
                ? 'Scan a Discord channel or open a chat log file. Flagged messages appear here, most severe first.'
                : 'Add your Discord token in Settings to scan a channel, or open a chat log file.'}
            </p>
            {errorNotice && <div style={{ width: '100%', textAlign: 'left' }}>{errorNotice}</div>}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 6 }}>
              {tokenReady ? (
                <button type="button" className="btn primary" onClick={() => handleDiscordTokenFetch()}>
                  Scan {selectedChannelName}
                </button>
              ) : (
                <button type="button" className="btn primary" onClick={() => setActiveTab('settings')}>
                  Open Settings
                </button>
              )}
              <button type="button" className="btn" onClick={() => fileInputRef.current?.click()}>
                Open log file
              </button>
              <button type="button" className="btn ghost" onClick={loadSample}>
                Try sample data
              </button>
            </div>
            {cachedChannels.length > 0 && (
              <div style={{ width: '100%', marginTop: 18, textAlign: 'left' }}>
                <div className="eyebrow" style={{ marginBottom: 6 }}>
                  Saved scans
                </div>
                {cachedChannels.map((c) => (
                  <button
                    key={c.channel_id}
                    type="button"
                    className="nav"
                    onClick={() => handleLoadCachedChannel(c.channel_id)}
                  >
                    <span>{c.channel_name}</span>
                    <span className="count">{c.flagged_messages_count} flagged</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  ) : (
    <>
      <section className="queue" aria-label="Queue" style={{ position: 'relative' }}>
        <div className="queue-head">
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <h1 className="page-title">Review</h1>
            <span className="muted num" style={{ fontSize: 12.5 }}>
              {data.flagged_messages_count.toLocaleString()} flagged · {data.messages_detected.toLocaleString()} total
            </span>
          </div>
          <button
            type="button"
            className="sourcebtn"
            aria-haspopup="menu"
            aria-expanded={isSourceOpen}
            onClick={() => setIsSourceOpen((o) => !o)}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{data.file_name}</span>
            <span className="muted" style={{ fontWeight: 400, whiteSpace: 'nowrap' }}>
              · {data.cache_metadata ? 'Saved scan' : scopeLabel}
            </span>
            <ChevronDown size={16} style={{ marginLeft: 'auto', flex: 'none' }} className="muted" />
          </button>
          {sourcePopover}
          {isLoading && progressCard}
          {errorNotice}
          <div>
            <div className="sevbar" aria-hidden="true">
              {SEVERITY_ORDER.map((k) =>
                sevCounts[k] ? (
                  <span key={k} className={`k-${k}`} style={{ width: `${(sevCounts[k] / Math.max(sevTotal, 1)) * 100}%` }} />
                ) : null
              )}
            </div>
            <div className="muted num" style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 12.5, flexWrap: 'wrap' }}>
              {SEVERITY_ORDER.map((k) => (
                <span key={k} className={`k-${k}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <i style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--c)' }} />
                  {sevCounts[k] || 0} {k}
                </span>
              ))}
            </div>
          </div>
          <div className="search-wrap">
            <Search size={15} />
            <input
              className="search"
              type="search"
              placeholder="Search messages or players"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search messages or players"
            />
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div className="seg" role="group" aria-label="Show" style={{ flex: 1 }}>
              <button type="button" className={viewFilter === 'flagged' ? 'on' : ''} onClick={() => setViewFilter('flagged')}>
                Flagged
              </button>
              <button type="button" className={viewFilter === 'all' ? 'on' : ''} onClick={() => setViewFilter('all')}>
                All messages
              </button>
            </div>
          </div>
          <div className="chips">
            {['all', ...SEVERITY_ORDER].map((s) => (
              <button
                key={s}
                type="button"
                className={`chip ${selectedSeverity === s ? 'on' : ''}`}
                onClick={() => setSelectedSeverity(s)}
                style={{ textTransform: 'capitalize' }}
              >
                {s === 'all' ? 'Any severity' : s}
              </button>
            ))}
          </div>
          <details>
            <summary className="muted" style={{ cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
              More filters{hasActiveFilters ? ' · active' : ''}
            </summary>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
              <select className="field" aria-label="Status" value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
                <option value="all">Any status</option>
                <option value="unreviewed">Unreviewed</option>
                <option value="confirmed">Confirmed</option>
                <option value="false_positive">False positive</option>
                <option value="reviewed">Reviewed</option>
                <option value="ignored">Ignored</option>
              </select>
              <select className="field" aria-label="Sort" value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}>
                <option value="severity">Most severe</option>
                <option value="confidence">Highest confidence</option>
                <option value="line_desc">Newest first</option>
                <option value="line_asc">Oldest first</option>
              </select>
              <select className="field" aria-label="Category" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
                <option value="all">Any category</option>
                {Object.keys(data.category_breakdown).map((c) => (
                  <option key={c} value={c}>
                    {c.replace(/_/g, ' ')} ({data.category_breakdown[c]})
                  </option>
                ))}
              </select>
              <select className="field" aria-label="Player" value={selectedPlayer} onChange={(e) => setSelectedPlayer(e.target.value)}>
                <option value="all">All players ({data.unique_players_count})</option>
                {data.unique_players.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                className="btn ghost sm"
                style={{ marginTop: 8 }}
                onClick={() => {
                  setSelectedSeverity('all');
                  setSelectedCategory('all');
                  setSelectedStatus('all');
                  setSelectedPlayer('all');
                  setSearchQuery('');
                }}
              >
                Clear filters
              </button>
            )}
          </details>
        </div>

        <div className="queue-list" role="list" aria-busy={isLoadingMessages}>
          {filteredMessages.length > 0 && (
            <label
              className="muted"
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px 6px 16px', fontSize: 12.5 }}
            >
              <input
                type="checkbox"
                className="cb"
                style={{ margin: 0 }}
                checked={selectedMsgIds.length === filteredMessages.length}
                onChange={toggleSelectAllOnPage}
              />
              Select all on page
              <button
                type="button"
                className="btn ghost sm"
                style={{ marginLeft: 'auto' }}
                onClick={handleSelectAllFlagged}
              >
                Select flagged
              </button>
            </label>
          )}
          {filteredMessages.map((m) => {
            const sev = m.is_flagged ? m.severity : 'none';
            return (
              <div
                key={m.id}
                role="listitem"
                className={`row k-${sev} ${activeMessage?.id === m.id ? 'on' : ''}`}
              >
                <input
                  type="checkbox"
                  className="cb"
                  checked={selectedMsgIds.includes(m.id)}
                  onChange={() => toggleSelectMessage(m.id)}
                  aria-label={`Select message from ${m.player}`}
                />
                <button type="button" className="rowmain" onClick={() => handleOpenMessageModal(m)}>
                  <span className="rowline">
                    <b style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.player}</b>
                    <span className="muted num" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                      {m.timestamp.split(' ').pop()}
                    </span>
                    <span className="sevpill sm" style={{ marginLeft: 'auto' }}>
                      {m.is_flagged ? m.severity : 'clean'}
                    </span>
                  </span>
                  <span className="clamp">{m.message}</span>
                  {(m.categories.length > 0 || m.review_status !== 'unreviewed') && (
                    <span className="rowline" style={{ flexWrap: 'wrap' }}>
                      {m.categories.slice(0, 2).map((c) => (
                        <span key={c} className="tag">
                          {c.replace(/_/g, ' ')}
                        </span>
                      ))}
                      {m.review_status !== 'unreviewed' && (
                        <span className="tag" style={{ color: 'var(--ok)', borderColor: 'var(--ok)' }}>
                          {m.review_status.replace('_', ' ')}
                        </span>
                      )}
                    </span>
                  )}
                </button>
              </div>
            );
          })}
          {filteredMessages.length === 0 && !isLoadingMessages && (
            <div className="empty-state">
              {viewFilter === 'flagged' && !hasActiveFilters ? 'No flagged messages. All clear.' : 'Nothing matches these filters.'}
            </div>
          )}
        </div>

        {selectedMsgIds.length > 0 && (
          <div className="batchbar" role="toolbar" aria-label="Batch actions">
            <b className="num" style={{ fontSize: 13 }}>
              {selectedMsgIds.length} selected
            </b>
            <button type="button" className="btn primary sm" onClick={() => handleOpenBatchPunishment('log')}>
              Log
            </button>
            <button type="button" className="btn sm" onClick={() => handleOpenBatchPunishment('request')}>
              Request <span className="kbd">B</span>
            </button>
            <button type="button" className="btn sm" onClick={() => handleBatchModeratorAction('confirmed')}>
              Confirm
            </button>
            <button type="button" className="btn sm" onClick={() => handleBatchModeratorAction('false_positive')}>
              False positive
            </button>
            <button type="button" className="btn ghost sm" onClick={() => handleBatchModeratorAction('ignored')}>
              Ignore
            </button>
            <button type="button" className="btn ghost sm" style={{ marginLeft: 'auto' }} onClick={() => setSelectedMsgIds([])}>
              Clear
            </button>
          </div>
        )}

        {totalPages > 1 && (
          <div className="batchbar" style={{ justifyContent: 'space-between' }}>
            <button
              type="button"
              className="btn sm"
              disabled={currentPage <= 1 || isLoadingMessages}
              onClick={() => fetchMessages(currentPage - 1, currentFilters())}
            >
              <ChevronLeft size={14} /> Prev
            </button>
            <span className="muted num" style={{ fontSize: 12.5 }}>
              Page {currentPage} of {totalPages} · {totalMessages.toLocaleString()}
            </span>
            <button
              type="button"
              className="btn sm"
              disabled={currentPage >= totalPages || isLoadingMessages}
              onClick={() => fetchMessages(currentPage + 1, currentFilters())}
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        )}
      </section>

      {inspectorProps ? (
        <CaseInspectorPanel {...inspectorProps} />
      ) : (
        <div className="case">
          <div className="empty" style={{ height: '100%' }}>
            <h2>Select a message</h2>
            <p>
              Pick a case from the queue, or press <span className="kbd">J</span> to start with the first one.
            </p>
          </div>
        </div>
      )}
    </>
  );

  const liveView = (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">Live</h1>
      </div>
      <LiveModerationRadarView
        liveStatus={liveStatus}
        discordToken={discordToken}
        selectedChannelId={discordChannelId}
        presetChannels={presetChannels}
        soundAlertsEnabled={soundAlertsEnabled}
        onToggleSoundAlerts={handleToggleSound}
        onStartLiveMonitor={handleStartLiveMonitor}
        onStopLiveMonitor={handleStopLiveMonitor}
        onClearLiveAlerts={handleClearLiveAlerts}
        onSimulateLiveEvent={handleSimulateLiveEvent}
        showTestTools={showDevTools}
        onInspectLiveAlert={(alertItem, initialMode = 'log') => {
          const msgRec = convertLiveItemToMessageRecord(alertItem);
          handleOpenMessageModal(msgRec, initialMode);
          if (alertItem.detected_gamemode) {
            setPunishmentGamemode(alertItem.detected_gamemode);
          }
        }}
      />
      {inspectorProps && <CaseInspectorPanel {...inspectorProps} overlay />}
    </div>
  );

  const emptyTab = (title: string, text: string) => (
    <div className="empty">
      <h2>{title}</h2>
      <p>{text}</p>
      <button type="button" className="btn primary" onClick={() => setActiveTab('dashboard')}>
        Choose what to review
      </button>
    </div>
  );

  const settingsView = (
    <div className="page">
      <div className="settings">
        <div className="page-head">
          <h1 className="page-title">Settings</h1>
        </div>

        <h2 className="group-title" style={{ marginTop: 0 }}>
          Discord
        </h2>
        <div className="group">
          <div className="srow stack">
            <label className="label" htmlFor="discord-token-input" style={{ margin: 0 }}>
              Discord token
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                id="discord-token-input"
                type={showTokenText ? 'text' : 'password'}
                className="field"
                placeholder="Paste your token"
                value={discordToken}
                onChange={(e) => handleTokenChange(e.target.value)}
                onBlur={() => {
                  if (discordToken.trim()) resolvePresetChannelNames(discordToken);
                }}
                autoComplete="off"
              />
              <button type="button" className="btn" onClick={() => setShowTokenText(!showTokenText)}>
                {showTokenText ? 'Hide' : 'Reveal'}
              </button>
            </div>
            <span className="hint">Saved on this computer and used to read channels and send /staff commands.</span>
          </div>
          <div className="srow stack">
            <label className="label" htmlFor="staff-command-channel-input" style={{ margin: 0 }}>
              Staff command channel
            </label>
            <input
              id="staff-command-channel-input"
              className="field"
              placeholder="Channel ID or link where /staff commands run"
              value={staffCommandChannelId}
              onChange={(e) => handleStaffChannelChange(e.target.value)}
            />
          </div>
        </div>

        <h2 className="group-title">Channels</h2>
        <div className="group">
          {presetChannels.map((ch) => (
            <div key={ch.channel_id} className="srow">
              <label style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="source-channel"
                  checked={ch.channel_id === discordChannelId}
                  onChange={() => handleSelectChannel(ch.channel_id)}
                />
                <span style={{ minWidth: 0 }}>
                  <b>{ch.name}</b>
                  <small className="num">{ch.channel_id}</small>
                </span>
              </label>
              <button type="button" className="btn sm" onClick={() => handleDiscordTokenFetch(undefined, ch.channel_id)}>
                Scan
              </button>
            </div>
          ))}
          <div className="srow stack">
            <label className="label" htmlFor="custom-channel-input" style={{ margin: 0 }}>
              Another channel
            </label>
            <input
              id="custom-channel-input"
              className="field"
              placeholder="Channel ID or link"
              value={presetChannels.some((p) => p.channel_id === discordChannelId) ? '' : discordChannelId}
              onChange={(e) => handleSelectChannel(e.target.value)}
            />
          </div>
          <div className="srow">
            <span>
              <b>Sync channel names</b>
              <small>Look up readable names for your channels.</small>
            </span>
            <button type="button" className="btn" disabled={!tokenReady} onClick={() => resolvePresetChannelNames(discordToken)}>
              {isResolvingChannels ? 'Syncing…' : 'Sync'}
            </button>
          </div>
          <div className="srow">
            <span>
              <b>Monitor all channels live</b>
              <small>Watch every channel above in real time.</small>
            </span>
            <button
              type="button"
              className="btn primary"
              disabled={!tokenReady}
              onClick={() => {
                handleStartLiveMonitor('all', 4000);
                setActiveTab('live');
              }}
            >
              Start
            </button>
          </div>
        </div>

        <h2 className="group-title">Scan</h2>
        <div className="group">
          <div className="srow stack">
            <div className="seg" role="group" aria-label="Scan scope">
              <button type="button" className={scopeMode === 'limit' ? 'on' : ''} onClick={() => handleSelectLimitScope()}>
                Latest messages
              </button>
              <button type="button" className={scopeMode === 'date' ? 'on' : ''} onClick={() => handleSelectDateScope()}>
                Date range
              </button>
            </div>
            {scopeMode === 'limit' ? (
              <select
                className="field"
                aria-label="How many messages"
                value={discordFetchLimit}
                onChange={(e) => handleSelectLimitScope(Number(e.target.value))}
              >
                {[500, 2500, 10000, 25000, 50000, 100000].map((n) => (
                  <option key={n} value={n}>
                    Latest {n.toLocaleString()} messages
                  </option>
                ))}
              </select>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <label className="label" htmlFor="scan-start">
                      From
                    </label>
                    <input
                      id="scan-start"
                      type="date"
                      className="field"
                      value={startDateFilter}
                      max={todayDateStr}
                      onChange={(e) => handleSelectDateScope(e.target.value, undefined)}
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="scan-end">
                      To
                    </label>
                    <input
                      id="scan-end"
                      type="date"
                      className="field"
                      value={endDateFilter}
                      max={todayDateStr}
                      onChange={(e) => handleSelectDateScope(undefined, e.target.value)}
                    />
                  </div>
                </div>
                <div className="chips">
                  <button type="button" className="chip" onClick={() => handleSelectDateScope(todayDateStr, '')}>
                    Today
                  </button>
                  <button type="button" className="chip" onClick={() => handleSelectDateScope(past7DateStr, '')}>
                    Last 7 days
                  </button>
                </div>
              </>
            )}
          </div>
          <div className="srow">
            <span>
              <b>Selected channel</b>
              <small>{selectedChannelName}</small>
            </span>
            <span style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn primary"
                disabled={isLoading}
                onClick={() => handleDiscordTokenFetch()}
              >
                {isLoading ? 'Scanning…' : 'Scan now'}
              </button>
              <button
                type="button"
                className="btn"
                disabled={isLoading}
                onClick={() => handleDiscordTokenFetch(undefined, undefined, true)}
                title="Ignore saved scans and fetch everything again"
              >
                Full rescan
              </button>
            </span>
          </div>
          {isLoading && fetchProgress && <div className="srow stack">{progressCard}</div>}
          {errorMessage && <div className="srow stack">{errorNotice}</div>}
        </div>

        <h2 className="group-title">Saved scans</h2>
        <div className="group">
          <div className="srow stack" style={{ padding: 0 }}>
            <SmartScanMemoryPanel
              cachedChannels={cachedChannels}
              activeChannelId={discordChannelId}
              useSmartCache={useSmartCache}
              onToggleSmartCache={handleToggleSmartCache}
              onLoadCachedChannel={handleLoadCachedChannel}
              onDeleteCachedChannel={handleDeleteCachedChannel}
              onForceRescanChannel={(cid) => {
                setDiscordChannelId(cid);
                handleDiscordTokenFetch(undefined, cid, false);
              }}
              isLoading={isLoading}
            />
          </div>
        </div>

        <h2 className="group-title">Chat log file</h2>
        <div className="group">
          <div className="srow stack">
            <div
              className={`dropzone ${isDragOver ? 'drag' : ''}`}
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
            >
              Drop a chat log here, or click to choose a file
            </div>
            <select className="field" aria-label="File format" value={formatHint} onChange={(e) => setFormatHint(e.target.value)}>
              <option value="auto">Detect format automatically</option>
              <option value="discord">Discord guild export</option>
              <option value="minecraft">Minecraft (Vanilla / Paper)</option>
              <option value="generic">Plain text</option>
              <option value="csv">CSV spreadsheet</option>
            </select>
          </div>
        </div>

        <h2 className="group-title">Appearance &amp; alerts</h2>
        <div className="group">
          <div className="srow">
            <b>Appearance</b>
            <div className="seg" role="group" aria-label="Appearance" style={{ width: 200 }}>
              <button type="button" className={appearance === 'dark' ? 'on' : ''} onClick={() => setAppearance('dark')}>
                Dark
              </button>
              <button type="button" className={appearance === 'light' ? 'on' : ''} onClick={() => setAppearance('light')}>
                Light
              </button>
            </div>
          </div>
          <div className="srow">
            <span>
              <b>Sound on new violations</b>
              <small>A soft chime when a critical or high alert arrives.</small>
            </span>
            <input type="checkbox" className="sw" role="switch" aria-label="Sound alerts" checked={soundAlertsEnabled} onChange={handleToggleSound} />
          </div>
        </div>

        <h2 className="group-title">Data</h2>
        <div className="group">
          <div className="srow">
            <span>
              <b>Export report</b>
              <small>Download the current results.</small>
            </span>
            <span style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn" disabled={!data} onClick={() => handleExport('csv')}>
                CSV
              </button>
              <button type="button" className="btn" disabled={!data} onClick={() => handleExport('json')}>
                JSON
              </button>
            </span>
          </div>
          <div className="srow">
            <span>
              <b>Sample data</b>
              <small>Explore the app with a demo dataset.</small>
            </span>
            <button type="button" className="btn" onClick={loadSample}>
              Load sample
            </button>
          </div>
          <div className="srow">
            <span>
              <b>Desktop app</b>
              <small>Run Moderation Studio as its own window.</small>
            </span>
            <span style={{ display: 'flex', gap: 8 }}>
              {deferredInstallPrompt && !isStandaloneApp && (
                <button type="button" className="btn" onClick={handleInstallDesktopApp}>
                  Install
                </button>
              )}
              <a className="btn" href="/api/v1/download/portable-exe" download="ModerationStudio-Portable.exe">
                Download .exe
              </a>
            </span>
          </div>
        </div>

        <h2 className="group-title">Keyboard shortcuts</h2>
        <div className="group">
          {SHORTCUTS.map(([k, label]) => (
            <div key={k} className="srow" style={{ paddingBlock: 10 }}>
              <span>{label}</span>
              <span className="kbd" style={{ margin: 0 }}>
                {k}
              </span>
            </div>
          ))}
        </div>

        <h2 className="group-title">Developer</h2>
        <div className="group">
          <div className="srow">
            <span>
              <b>Show test tools</b>
              <small>Adds simulated chat messages to the Live view.</small>
            </span>
            <input
              type="checkbox"
              className="sw"
              role="switch"
              aria-label="Show test tools"
              checked={showDevTools}
              onChange={(e) => handleToggleDevTools(e.target.checked)}
            />
          </div>
        </div>
      </div>
    </div>
  );

  let content: React.ReactNode;
  switch (activeTab) {
    case 'dashboard':
      content = reviewView;
      break;
    case 'live':
      content = liveView;
      break;
    case 'players':
      content = (
        <div className="page">
          <div className="page-head">
            <h1 className="page-title">Players</h1>
          </div>
          {data ? (
            <PlayersDossiersView data={data} onOpenPlayerDossier={handleOpenPlayerDossier} />
          ) : (
            emptyTab('No players yet', 'Scan a channel or open a log to see each player’s history.')
          )}
        </div>
      );
      break;
    case 'analytics':
      content = (
        <div className="page">
          <div className="page-head">
            <h1 className="page-title">Analytics</h1>
          </div>
          {data ? (
            <AnalyticsWorkbenchView
              data={data}
              messages={messages}
              onFilterByCategory={(cat) => {
                setSelectedCategory(cat);
                setViewFilter('flagged');
                setActiveTab('dashboard');
              }}
              onFilterByPlayer={(uname) => {
                setSelectedPlayer(uname);
                setViewFilter('all');
                setActiveTab('dashboard');
              }}
            />
          ) : (
            emptyTab('No analytics yet', 'Scan a channel or open a log to see what is being flagged and by whom.')
          )}
        </div>
      );
      break;
    case 'punishments':
      content = (
        <div className="page">
          <div className="page-head">
            <h1 className="page-title">Punishments</h1>
          </div>
          <PunishmentsLogView
            punishments={punishments}
            copiedKey={copiedKey}
            onCopyText={handleCopyText}
            onDeletePunishment={handleDeletePunishment}
          />
        </div>
      );
      break;
    default:
      content = settingsView;
  }

  return (
    <div className="shell">
      <input
        ref={fileInputRef}
        type="file"
        hidden
        onChange={(e) => {
          handleFileChange(e);
          e.target.value = '';
        }}
      />

      <nav className="sidebar glass" aria-label="Main">
        <div className="brand">
          <BrandLogoMark size={30} />
          <span>Moderation Studio</span>
        </div>
        {NAV.map((n) => (
          <button
            key={n.id}
            type="button"
            className={`nav ${activeTab === n.id ? 'on' : ''}`}
            aria-current={activeTab === n.id ? 'page' : undefined}
            onClick={() => {
              // The Live view shows cases in a sheet, so don't carry a Review case across.
              if (n.id === 'live' || activeTab === 'live') setActiveMessage(null);
              setActiveTab(n.id);
            }}
          >
            <NavIcon id={n.id} />
            <span>{n.label}</span>
            {n.id === 'dashboard' && data && <span className="count">{data.flagged_messages_count}</span>}
            {n.id === 'live' && liveStatus?.running && (
              <span className="count live">{liveAlertCount > 0 ? `${liveAlertCount} alerts` : 'On'}</span>
            )}
            {n.id === 'punishments' && punishments.length > 0 && <span className="count">{punishments.length}</span>}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <div className={`status-dot ${tokenReady ? 'on' : ''}`}>
          <i />
          <span>{tokenReady ? `Discord ready · ${presetChannels.length} channels` : 'Discord not connected'}</span>
        </div>
        <button
          type="button"
          className={`nav ${activeTab === 'settings' ? 'on' : ''}`}
          aria-current={activeTab === 'settings' ? 'page' : undefined}
          onClick={() => {
            if (activeTab === 'live') setActiveMessage(null);
            setActiveTab('settings');
          }}
        >
          <NavIcon id="settings" />
          <span>Settings</span>
        </button>
      </nav>

      <main className="main">{content}</main>

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}

      {activePlayerDossier && (
        <PlayerDossierModal
          profile={activePlayerDossier}
          messages={dossierMessages}
          onClose={() => setActivePlayerDossier(null)}
          onFilterQueueByPlayer={(uname) => {
            setSelectedPlayer(uname);
            setViewFilter('all');
            setActiveTab('dashboard');
            setActivePlayerDossier(null);
          }}
          onSelectMessageFromDossier={(msg) => {
            setActiveTab('dashboard');
            handleOpenMessageModal(msg);
          }}
        />
      )}

      <BatchPunishmentModal
        isOpen={isBatchPunishmentOpen}
        onClose={() => setIsBatchPunishmentOpen(false)}
        messages={batchTargetMessages}
        initialMode={batchPunishmentMode}
        discordToken={discordToken}
        staffCommandChannelId={staffCommandChannelId}
        onUpdateStaffChannelId={setStaffCommandChannelId}
        detectedGamemode={data?.detected_gamemode || 'SMP'}
        apiBaseUrl={API_BASE_URL}
        onComplete={handleBatchPunishmentComplete}
      />
    </div>
  );
};

export default App;
