import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  UploadCloud,
  AlertTriangle,
  RefreshCw,
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Square,
  SlidersHorizontal,
  Palette,
  Sparkles,
  Check,
  Calendar,
  X,
} from 'lucide-react';
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
import { LightRays } from './components/LightRays';
import { CustomCursor } from './components/CustomCursor';
import { BrandLogoMark } from './components/BrandLogoMark';

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

export type AppThemeId =
  | 'forensic-rays'
  | 'tactical-obsidian'
  | 'daylight-paper'
  | 'acid-brutalist'
  | 'neutral-mono'
  | 'emerald-matrix'
  | 'crimson-sentinel'
  | 'cobalt-blueprint'
  | 'synthwave-prism'
  | 'archival-amber';

interface ThemePresetMeta {
  id: AppThemeId;
  name: string;
  badge: string;
  subtitle: string;
  swatches: [string, string, string];
  raysColor: string;
  raysOpacity: number;
  defaultRaysEnabled: boolean;
  defaultBrutalistCursor: boolean;
  isBrutalistArt: boolean;
}

const THEME_PRESETS: ThemePresetMeta[] = [
  {
    id: 'forensic-rays',
    name: 'Forensic LightRays',
    badge: 'CHECKPOINT 3',
    subtitle: 'Full-viewport interactive cyan WebGL rays & translucent glass',
    swatches: ['#06080b', '#141922', '#38bdf8'],
    raysColor: '#38bdf8',
    raysOpacity: 0.56,
    defaultRaysEnabled: true,
    defaultBrutalistCursor: false,
    isBrutalistArt: false,
  },
  {
    id: 'neutral-mono',
    name: 'Soft Stone Brutalism',
    badge: 'NEUTRALIZED B&W',
    subtitle: 'Warm limestone & soft charcoal brutalism (easy on the eyes)',
    swatches: ['#EFECE6', '#F9F8F5', '#292826'],
    raysColor: '#57534E',
    raysOpacity: 0.22,
    defaultRaysEnabled: false,
    defaultBrutalistCursor: false,
    isBrutalistArt: true,
  },
  {
    id: 'acid-brutalist',
    name: 'Acid Neo-Brutalism',
    badge: 'CHECKPOINT 4',
    subtitle: 'Paper #F8F4E8, ink-black hard shadows & #D2E823 Acid highlights',
    swatches: ['#F8F4E8', '#09090B', '#D2E823'],
    raysColor: '#D2E823',
    raysOpacity: 0.42,
    defaultRaysEnabled: true,
    defaultBrutalistCursor: true,
    isBrutalistArt: true,
  },
  {
    id: 'tactical-obsidian',
    name: 'Tactical Obsidian',
    badge: 'CHECKPOINT 1',
    subtitle: 'Original matte dark forensic telemetry & sentinel shield',
    swatches: ['#090b0f', '#141922', '#f8fafc'],
    raysColor: '#38bdf8',
    raysOpacity: 0.25,
    defaultRaysEnabled: false,
    defaultBrutalistCursor: false,
    isBrutalistArt: false,
  },
  {
    id: 'daylight-paper',
    name: 'Daylight Paper',
    badge: 'CHECKPOINT 2',
    subtitle: 'Clean daylight slate surfaces with crisp cobalt accents',
    swatches: ['#f1f5f9', '#ffffff', '#0284c7'],
    raysColor: '#0284c7',
    raysOpacity: 0.26,
    defaultRaysEnabled: false,
    defaultBrutalistCursor: false,
    isBrutalistArt: false,
  },
  {
    id: 'emerald-matrix',
    name: 'Emerald Matrix SOC',
    badge: 'CYBER RAYS',
    subtitle: 'Deep terminal obsidian with emerald WebGL atmospheric beams',
    swatches: ['#040907', '#0c1a14', '#10b981'],
    raysColor: '#10b981',
    raysOpacity: 0.52,
    defaultRaysEnabled: true,
    defaultBrutalistCursor: false,
    isBrutalistArt: false,
  },
  {
    id: 'crimson-sentinel',
    name: 'Crimson Sentinel',
    badge: 'DEFCON RAYS',
    subtitle: 'High-alert crimson & tactical rose WebGL command center',
    swatches: ['#0a0507', '#1e0e14', '#f43f5e'],
    raysColor: '#f43f5e',
    raysOpacity: 0.5,
    defaultRaysEnabled: true,
    defaultBrutalistCursor: false,
    isBrutalistArt: false,
  },
  {
    id: 'cobalt-blueprint',
    name: 'Cobalt Blueprint',
    badge: 'CAD BRUTAL',
    subtitle: 'Architectural navy blueprint with cyan hard shadows & grid',
    swatches: ['#0a192f', '#112240', '#64ffda'],
    raysColor: '#64ffda',
    raysOpacity: 0.35,
    defaultRaysEnabled: true,
    defaultBrutalistCursor: false,
    isBrutalistArt: true,
  },
  {
    id: 'synthwave-prism',
    name: 'Synthwave Prism',
    badge: 'VIOLET RAYS',
    subtitle: 'Deep amethyst glass with interactive magenta/violet light rays',
    swatches: ['#080510', '#19102a', '#d946ef'],
    raysColor: '#d946ef',
    raysOpacity: 0.52,
    defaultRaysEnabled: true,
    defaultBrutalistCursor: false,
    isBrutalistArt: false,
  },
  {
    id: 'archival-amber',
    name: 'Archival Amber Ledger',
    badge: 'WARM PAPER',
    subtitle: 'Warm parchment ledger with espresso ink & brass highlights',
    swatches: ['#F5EFE6', '#FFFDF9', '#B45309'],
    raysColor: '#B45309',
    raysOpacity: 0.22,
    defaultRaysEnabled: false,
    defaultBrutalistCursor: false,
    isBrutalistArt: true,
  },
];

export const App: React.FC = () => {
  const [theme, setTheme] = useState<AppThemeId>(() => {
    try {
      const saved = localStorage.getItem('modstudio_theme') as AppThemeId;
      if (saved && THEME_PRESETS.some((t) => t.id === saved)) {
        return saved;
      }
      return 'forensic-rays';
    } catch {
      return 'forensic-rays';
    }
  });

  const activeThemeMeta = THEME_PRESETS.find((t) => t.id === theme) || THEME_PRESETS[0];

  const [enableLightRaysBg, setEnableLightRaysBg] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('modstudio_rays_enabled');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const [enableCustomCursor, setEnableCustomCursor] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('modstudio_cursor_enabled');
      return saved !== null ? saved === 'true' : false;
    } catch {
      return false;
    }
  });

  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState<boolean>(false);
  const themeMenuRef = useRef<HTMLDivElement>(null);

  // Choreographed Landing Gate State:
  // 1) Start with Moderation Studio title animation
  // 2) Light rays appear (850ms)
  // 3) "ENTER STUDIO" button appears in the middle (1450ms)
  // 4) Clicking "ENTER STUDIO" transitions into the full current page
  const [hasEnteredStudio, setHasEnteredStudio] = useState<boolean>(false);
  const [landingRaysVisible, setLandingRaysVisible] = useState<boolean>(false);
  const [landingButtonVisible, setLandingButtonVisible] = useState<boolean>(false);
  const [landingExiting, setLandingExiting] = useState<boolean>(false);

  useEffect(() => {
    if (hasEnteredStudio) return;
    setLandingRaysVisible(false);
    setLandingButtonVisible(false);
    setLandingExiting(false);

    const raysTimer = setTimeout(() => {
      setLandingRaysVisible(true);
    }, 850);

    const btnTimer = setTimeout(() => {
      setLandingButtonVisible(true);
    }, 1450);

    return () => {
      clearTimeout(raysTimer);
      clearTimeout(btnTimer);
    };
  }, [hasEnteredStudio]);

  const handleEnterStudio = useCallback(() => {
    if (landingExiting) return;
    setLandingExiting(true);
    setTimeout(() => {
      setHasEnteredStudio(true);
      setLandingExiting(false);
    }, 420);
  }, [landingExiting]);

  useEffect(() => {
    if (hasEnteredStudio) return;
    const onLandingKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && landingButtonVisible) {
        e.preventDefault();
        handleEnterStudio();
      }
    };
    window.addEventListener('keydown', onLandingKey);
    return () => window.removeEventListener('keydown', onLandingKey);
  }, [hasEnteredStudio, landingButtonVisible, handleEnterStudio]);

  const handleSelectTheme = (preset: ThemePresetMeta) => {
    setTheme(preset.id);
    setEnableLightRaysBg(preset.defaultRaysEnabled);
    setEnableCustomCursor(preset.defaultBrutalistCursor);
    try {
      localStorage.setItem('modstudio_theme', preset.id);
      localStorage.setItem('modstudio_rays_enabled', String(preset.defaultRaysEnabled));
      localStorage.setItem('modstudio_cursor_enabled', String(preset.defaultBrutalistCursor));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target as Node)) {
        setIsThemeMenuOpen(false);
      }
    };
    if (isThemeMenuOpen) {
      window.addEventListener('mousedown', onClickOutside);
    }
    return () => window.removeEventListener('mousedown', onClickOutside);
  }, [isThemeMenuOpen]);

  const currentHeroImg = activeThemeMeta.isBrutalistArt
    ? '/src/assets/images/monochrome_brutalist_hero_1791140988678.jpg'
    : '/src/assets/images/hero_tactical_mesh_1791138520706.jpg';

  const [data, setData] = useState<LogParseResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [formatHint, setFormatHint] = useState<string>('auto');
  const [ingestMode, setIngestMode] = useState<'token' | 'file'>('token');
  const [isIngestionExpanded, setIsIngestionExpanded] = useState<boolean>(true);

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

  // Active Tab
  const [activeTab, setActiveTab] = useState<'dashboard' | 'live' | 'players' | 'analytics' | 'punishments'>('dashboard');

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
      setIsIngestionExpanded(false);
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

  // Batch Selection State
  const [selectedMsgIds, setSelectedMsgIds] = useState<number[]>([]);

  // Case Inspector State (Split-Pane Docked by default, expandable to modal)
  const [activeMessage, setActiveMessage] = useState<MessageRecord | null>(null);
  const [isExpandedModal, setIsExpandedModal] = useState<boolean>(false);
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
      startDate: startDateFilter,
      endDate: endDateFilter,
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
      if (startDateFilter?.trim()) queryParams.set('start_date', startDateFilter.trim());
      if (endDateFilter?.trim()) queryParams.set('end_date', endDateFilter.trim());
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
      setIsIngestionExpanded(false);
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

    setIsLoading(true);
    setErrorMessage(null);
    setMessages([]);
    setData(null);
    setActiveMessage(null);
    setFetchProgress({
      status: 'starting',
      fetched: 0,
      target: discordFetchLimit,
      channelName: targetChannel,
      rateLimitWaitMs: 0,
    });

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/discord/fetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: discordToken.trim(),
          channel_id: targetChannel,
          limit: discordFetchLimit,
          start_date: startDateFilter?.trim() || undefined,
          end_date: endDateFilter?.trim() || undefined,
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
        setIsIngestionExpanded(false);
        refreshCachedChannels();
        return;
      }

      setFetchProgress({
        status: initResult.status || 'fetching',
        fetched: initResult.fetched || 0,
        target: initResult.target || discordFetchLimit,
        channelName: initResult.channel_name || targetChannel,
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
          setIsIngestionExpanded(false);
          refreshCachedChannels();
          break;
        }

        setFetchProgress({
          status: st.status,
          fetched: st.fetched || 0,
          target: st.target || discordFetchLimit,
          channelName: st.channel_name || targetChannel,
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
    setActiveMessage(null);
    try {
      const queryParams = new URLSearchParams();
      if (startDateFilter?.trim()) queryParams.set('start_date', startDateFilter.trim());
      if (endDateFilter?.trim()) queryParams.set('end_date', endDateFilter.trim());
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
      setIsIngestionExpanded(false);
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
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey((prev) => (prev === key ? null : prev));
    }, 1800);
  };

  const handleLogPunishment = async (
    autoSendDiscord: boolean,
    overrideActionMode?: 'log' | 'request'
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
    } catch (e: any) {
      setPunishmentFeedback({
        type: 'error',
        text: e.message || `Error executing ${slashCmdName}.`,
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

  const dropsScrollRef = useRef<HTMLDivElement>(null);
  const [newsletterEmail, setNewsletterEmail] = useState<string>('');
  const [newsletterJoined, setNewsletterJoined] = useState<boolean>(false);

  const scrollDrops = (dir: -1 | 1) => {
    if (!dropsScrollRef.current) return;
    dropsScrollRef.current.scrollBy({ left: dir * 340, behavior: 'smooth' });
  };

  if (!hasEnteredStudio) {
    return (
      <div className={`studio-landing-gate ${landingExiting ? 'exiting' : ''}`}>
        <div className="acid-noise-overlay" aria-hidden="true" />
        {enableCustomCursor && <CustomCursor />}

        {/* Stage 2: Volumetric Light Rays appear after title animation */}
        <div className={`landing-rays-layer ${landingRaysVisible ? 'visible' : ''}`}>
          <LightRays
            raysOrigin="top-center"
            raysColor={activeThemeMeta.raysColor}
            raysSpeed={1.35}
            lightSpread={1.45}
            rayLength={2.45}
            pulsating={true}
            followMouse={true}
            mouseInfluence={0.32}
            noiseAmount={0.03}
            distortion={0.07}
            opacity={0.78}
          />
        </div>

        <div className="landing-vignette-layer" aria-hidden="true" />

        {/* Stage 1 & Stage 3: Moderation Studio Animation + Middle "ENTER STUDIO" Button */}
        <div className="landing-centerpiece">
          <div className="landing-emblem-box">
            <BrandLogoMark size={64} />
          </div>

          <div className="landing-title-stack">
            <span className="landing-title-line line-1">MODERATION</span>
            <span className="landing-title-line line-2">STUDIO</span>
          </div>

          <div className="landing-scanline-bar" aria-hidden="true" />

          <div className={`landing-cta-wrap ${landingButtonVisible ? 'visible' : ''}`}>
            <button
              type="button"
              className="btn-enter-studio"
              onClick={handleEnterStudio}
            >
              <span>ENTER STUDIO</span>
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {/* Global 3% Opacity SVG Noise Overlay & Optional Mix-Blend-Difference Cursor */}
      <div className="acid-noise-overlay" aria-hidden="true" />
      {enableCustomCursor && <CustomCursor />}

      {/* Unified Full-Viewport WebGL LightRays Background (Theme-Adaptive) */}
      {enableLightRaysBg && (
        <div className="ambient-shell-rays">
          <LightRays
            raysOrigin="top-center"
            raysColor={activeThemeMeta.raysColor}
            raysSpeed={1.15}
            lightSpread={1.3}
            rayLength={2.2}
            pulsating={true}
            followMouse={true}
            mouseInfluence={0.26}
            noiseAmount={0.03}
            distortion={0.06}
            opacity={activeThemeMeta.raysOpacity}
          />
        </div>
      )}

      {/* Sticky Navigation Bar */}
      <header className="app-header">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('dashboard');
          }}
          className="brand-wordmark glitch-hover"
        >
          <BrandLogoMark size={38} />
          <span>MODSTUDIO</span>
          <span className="brand-tag-pill">{activeThemeMeta.badge}</span>
        </a>

        <nav className="top-nav-links" aria-label="Primary Navigation">
          <button
            type="button"
            className={`top-nav-link ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            Review Queue{data ? ` (${data.flagged_messages_count})` : ''}
          </button>
          <button
            type="button"
            className={`top-nav-link ${activeTab === 'live' ? 'active' : ''}`}
            onClick={() => setActiveTab('live')}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: liveStatus?.running ? 'var(--status-confirmed)' : 'var(--sev-critical)',
                display: 'inline-block',
              }}
            />
            <span>
              Live Chat Radar
              {liveStatus && liveStatus.active_alerts.length > 0
                ? ` (${liveStatus.active_alerts.length} ALERTS)`
                : ''}
            </span>
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

        <div className="header-actions" ref={themeMenuRef}>
          {/* Theme & Checkpoint Studio Switcher */}
          <button
            type="button"
            className="btn-secondary"
            style={{ height: '34px', padding: '0 0.75rem', fontSize: '0.75rem' }}
            onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)}
            title="Open Theme & Checkpoint Studio (10 Themes + WebGL Background)"
          >
            <Palette size={14} />
            <span>Themes ({THEME_PRESETS.length})</span>
            <div className="theme-swatches" style={{ marginLeft: '2px' }}>
              {activeThemeMeta.swatches.map((hex, i) => (
                <span key={i} className="theme-swatch-dot" style={{ background: hex, width: '10px', height: '10px' }} />
              ))}
            </div>
          </button>

          {isThemeMenuOpen && (
            <div className="theme-studio-popover" role="dialog" aria-label="Theme and Checkpoint Studio">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.6rem', borderBottom: '1px solid var(--border-subtle)' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Sparkles size={14} /> Theme &amp; Checkpoint Studio
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    Switch between earlier design checkpoints, neutralized soft brutalism, and WebGL themes
                  </div>
                </div>
              </div>

              <div className="theme-studio-grid">
                {THEME_PRESETS.map((preset) => {
                  const isCurrent = preset.id === theme;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      className={`theme-preset-card ${isCurrent ? 'active' : ''}`}
                      onClick={() => handleSelectTheme(preset)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                        <div className="theme-swatches">
                          {preset.swatches.map((hex, idx) => (
                            <span key={idx} className="theme-swatch-dot" style={{ background: hex }} />
                          ))}
                        </div>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                          {preset.badge}
                        </span>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                        <span>{preset.name}</span>
                        {isCurrent && <Check size={13} />}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', lineHeight: 1.25 }}>
                        {preset.subtitle}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Independent Background & Effect Controls */}
              <div style={{ marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.76rem', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600 }}>
                  <span>Full-Viewport WebGL LightRays Background</span>
                  <input
                    type="checkbox"
                    checked={enableLightRaysBg}
                    onChange={(e) => {
                      setEnableLightRaysBg(e.target.checked);
                      try {
                        localStorage.setItem('modstudio_rays_enabled', String(e.target.checked));
                      } catch {
                        // ignore
                      }
                    }}
                  />
                </label>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.76rem', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600 }}>
                  <span>Mix-Blend-Difference Brutalist Cursor</span>
                  <input
                    type="checkbox"
                    checked={enableCustomCursor}
                    onChange={(e) => {
                      setEnableCustomCursor(e.target.checked);
                      try {
                        localStorage.setItem('modstudio_cursor_enabled', String(e.target.checked));
                      } catch {
                        // ignore
                      }
                    }}
                  />
                </label>
              </div>
            </div>
          )}

          <a
            href="/api/v1/download/portable-exe"
            download="ModerationStudio-Portable.exe"
            className="btn-secondary"
            style={{ height: '34px', padding: '0 0.7rem', fontSize: '0.75rem' }}
            title="Download standalone Windows executable"
          >
            <Download size={13} /> .EXE
          </a>

          {!isStandaloneApp && deferredInstallPrompt && (
            <button
              type="button"
              className="btn-secondary"
              style={{ height: '34px', padding: '0 0.7rem', fontSize: '0.75rem' }}
              onClick={handleInstallDesktopApp}
            >
              Install App
            </button>
          )}

          <button
            type="button"
            className="btn-secondary"
            style={{ height: '34px', padding: '0 0.65rem', fontSize: '0.74rem' }}
            title="Replay the Moderation Studio landing animation"
            onClick={() => setHasEnteredStudio(false)}
          >
            Intro Gate
          </button>

          {data ? (
            <>
              <button
                type="button"
                className="btn-secondary"
                style={{ height: '34px', padding: '0 0.7rem', fontSize: '0.75rem' }}
                onClick={() => handleExport('csv')}
              >
                <Download size={13} /> Export CSV
              </button>
              <button
                type="button"
                className="btn-primary"
                style={{ height: '34px', padding: '0 0.8rem', fontSize: '0.75rem' }}
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
              style={{ height: '34px', padding: '0 0.85rem', fontSize: '0.75rem' }}
              id="sample-log-btn-token"
              onClick={loadSample}
              disabled={isLoading}
            >
              Load Sample Dataset
            </button>
          )}
        </div>
      </header>

      <main className="app-main">
        {/* 12-COLUMN HERO SECTION (7 COLS LEFT / 5 COLS RIGHT) */}
        {(!data || isIngestionExpanded) && (
          <section className="acid-hero-grid" aria-label="Hero Overview">
            <div className="acid-hero-left">
              <div>
                <div className="acid-sticker-badge">
                  <span>■ FORENSIC CHAT TELEMETRY // {activeThemeMeta.name.toUpperCase()}</span>
                </div>
                <h1 className="hero-mega-title glitch-hover">
                  CHAT LOG <span className="hero-mega-highlight">TRIAGE</span> &amp; ENFORCE
                </h1>
                <p className="hero-lead-copy">
                  High-contrast forensic chat log ingestion, deobfuscated toxicity detection, and instant 2-step Discord <code>/staff log punishment</code> modal automation.
                </p>
              </div>

              <div className="hero-cta-row">
                <button
                  type="button"
                  className="btn-hero-cta"
                  onClick={loadSample}
                  disabled={isLoading}
                >
                  {isLoading ? 'LOADING STREAM...' : 'LOAD SAMPLE DATASET →'}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ padding: '13px 20px', fontSize: '0.84rem' }}
                  onClick={() => setActiveTab('live')}
                >
                  ● LIVE CHAT RADAR
                  {liveStatus && liveStatus.active_alerts.length > 0
                    ? ` (${liveStatus.active_alerts.length})`
                    : ''}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ padding: '13px 20px', fontSize: '0.84rem' }}
                  onClick={() => setIsThemeMenuOpen(true)}
                >
                  <Palette size={15} /> SWITCH THEME ({THEME_PRESETS.length})
                </button>
              </div>
            </div>

            <div className="acid-hero-right">
              <div className="acid-floating-asset-card">
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent-brand)' }}>
                  ● LIVE SENTINEL CORE
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', lineHeight: 1.1, marginTop: '0.25rem' }}>
                  {data ? `${data.flagged_messages_count} FLAGS DETECTED` : '6 PRESET CHANNELS'}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 700, marginTop: '0.35rem', color: 'var(--text-secondary)' }}>
                  THEME: {activeThemeMeta.name}
                </div>
              </div>

              <div className="acid-hero-image-card">
                <img
                  src={currentHeroImg}
                  alt="ModStudio Telemetry Grid"
                  referrerPolicy="no-referrer"
                  className="hero-bg-visual"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--bg-surface)', border: 'var(--border-width-heavy) solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '0.95rem 1.15rem', boxShadow: 'var(--shadow-btn)' }}>
                  <BrandLogoMark size={50} />
                  <div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                      SENTINEL ENGINE V2.4
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Rule + Context Classifier · 100K Batch Support
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* HORIZONTAL SCROLLING CHANNEL STREAMS SECTION */}
        <section className="acid-drops-section" aria-label="Live Channel Streams">
          <div className="acid-drops-header">
            <div className="drops-title glitch-hover">
              <span>LIVE CHANNEL STREAMS</span>
              <span className="brand-tag-pill">{presetChannels.length} FEEDS</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => scrollDrops(-1)}
                title="Scroll Left"
                aria-label="Scroll Left"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => scrollDrops(1)}
                title="Scroll Right"
                aria-label="Scroll Right"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          <div className="drops-scroll-container" ref={dropsScrollRef}>
            {presetChannels.map((ch, idx) => {
              const isSelected = discordChannelId === ch.channel_id;
              const isArchivedSlot = idx === presetChannels.length - 1 && !isSelected;
              return (
                <div
                  key={ch.channel_id}
                  className={`drop-card ${isSelected ? 'active' : ''} ${isArchivedSlot ? 'sold-out' : ''}`}
                  onClick={() => {
                    setDiscordChannelId(ch.channel_id);
                    setIngestMode('token');
                    setIsIngestionExpanded(true);
                    try {
                      localStorage.setItem('discord_selected_channel_id', ch.channel_id);
                    } catch {
                      // ignore
                    }
                  }}
                >
                  <div>
                    <div className="drop-square-visual">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', fontWeight: 700, background: 'rgba(255,255,255,0.14)', color: '#f8fafc', padding: '0.1rem 0.45rem', borderRadius: '4px' }}>
                          STREAM #{idx + 1}
                        </span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: '#cbd5e1' }}>
                          {isArchivedSlot ? 'STANDBY' : isSelected ? '● ARMED' : 'LIVE BRIDGE'}
                        </span>
                      </div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.98rem', color: '#f8fafc', lineHeight: 1.15 }}>
                        {ch.name}
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: '#94a3b8' }}>
                        ID: {ch.channel_id}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      GUILD {ch.guild_id.slice(0, 8)}...
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', fontWeight: 700, background: 'var(--accent-primary)', color: 'var(--accent-primary-text)', padding: '0.22rem 0.55rem', borderRadius: 'var(--radius-xs)' }}>
                      {isSelected ? 'SELECTED' : 'SELECT →'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* INGESTION WORKBENCH / COMPACT ACTIVE STREAM BAR */}
        <section className="ingestion-section">
          {data && !isIngestionExpanded ? (
            <div className="active-stream-bar">
              <div className="stream-source-info">
                <BrandLogoMark size={32} />
                <span className="stream-pulse" />
                <span style={{ fontWeight: 600, fontSize: '0.84rem', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                  {data.file_name}
                </span>
                <span className="metadata-inline">
                  <span>{data.detected_format.toUpperCase()}</span>
                  <span className="metadata-sep">·</span>
                  <span>{(data.file_size_bytes / 1024).toFixed(1)} KB</span>
                  {data.detected_gamemode && (
                    <>
                      <span className="metadata-sep">·</span>
                      <span>Mode: {data.detected_gamemode}</span>
                    </>
                  )}
                  {data.earliest_timestamp && (
                    <>
                      <span className="metadata-sep">·</span>
                      <span title="Earliest to latest message timestamp in dataset">
                        Range: {data.earliest_timestamp} → {data.latest_timestamp || 'Present'}
                      </span>
                    </>
                  )}
                  {data.cache_metadata && (
                    <>
                      <span className="metadata-sep">·</span>
                      <span style={{ color: 'var(--status-confirmed)', fontWeight: 700 }}>
                        ● MEMORY SYNC ({data.cache_metadata.cached_messages_reused.toLocaleString()} cached + {data.cache_metadata.newly_scanned_messages.toLocaleString()} new)
                      </span>
                    </>
                  )}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                {presetChannels.slice(0, 4).map((ch) => (
                  <button
                    key={ch.channel_id}
                    type="button"
                    className={`channel-tab-btn ${discordChannelId === ch.channel_id ? 'active' : ''}`}
                    onClick={() => {
                      setDiscordChannelId(ch.channel_id);
                      setIngestMode('token');
                      setIsIngestionExpanded(true);
                    }}
                    title={`Switch to ${ch.name}`}
                  >
                    {ch.name}
                  </button>
                ))}

                <button
                  type="button"
                  className="btn-secondary"
                  style={{ height: '30px', padding: '0 0.65rem', fontSize: '0.74rem' }}
                  onClick={() => setIsIngestionExpanded(true)}
                >
                  <SlidersHorizontal size={12} /> Configure Stream / Upload
                  <ChevronDown size={13} />
                </button>
              </div>
            </div>
          ) : (
            <div className="ingestion-drawer">
              <div className="hero-command-banner">
                <img
                  src={currentHeroImg}
                  alt="Tactical Telemetry Grid"
                  referrerPolicy="no-referrer"
                  className="hero-banner-bg-media"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <div className="hero-banner-scrim" />
                <div className="hero-banner-content">
                  <div className="hero-identity-cluster">
                    <BrandLogoMark size={48} />
                    <div>
                      <h1 className="section-headline">Forensic Chat Log Triage &amp; Discord Enforcement</h1>
                      <p className="section-subheadline">
                        Ingest live Discord bridge streams or server log archives with hybrid rule + context scoring and automated 2-step <code>/staff log punishment</code> execution.
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div className="ingestion-mode-switcher">
                      <button
                        type="button"
                        className={`mode-switch-btn ${ingestMode === 'token' ? 'active' : ''}`}
                        onClick={() => {
                          setIngestMode('token');
                          setErrorMessage(null);
                        }}
                      >
                        Discord Live Channel
                      </button>
                      <button
                        type="button"
                        className={`mode-switch-btn ${ingestMode === 'file' ? 'active' : ''}`}
                        onClick={() => {
                          setIngestMode('file');
                          setErrorMessage(null);
                        }}
                      >
                        Log File Upload
                      </button>
                    </div>

                    {data && (
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ height: '34px', padding: '0 0.65rem', fontSize: '0.75rem' }}
                        onClick={() => setIsIngestionExpanded(false)}
                        title="Collapse stream configuration"
                      >
                        Collapse <ChevronUp size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="ingestion-drawer-body">

              {ingestMode === 'token' ? (
                <form onSubmit={handleDiscordTokenFetch}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      Credentials and channel mappings persist across sessions.
                    </div>
                    <button
                      type="button"
                      onClick={() => resolvePresetChannelNames(discordToken)}
                      className="btn-secondary"
                      style={{ height: '30px', padding: '0 0.65rem', fontSize: '0.73rem' }}
                    >
                      <RefreshCw size={12} />
                      {isResolvingChannels ? 'Syncing Names...' : 'Sync Channel Names'}
                    </button>
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
                        style={{ height: '38px', width: '100%', fontFamily: 'var(--font-mono)' }}
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

                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
                      <div className="input-field-group">
                        <label className="input-field-label" htmlFor="discord-limit-select">
                          <span>Batch Size</span>
                        </label>
                        <select
                          id="discord-limit-select"
                          value={discordFetchLimit}
                          onChange={(e) => setDiscordFetchLimit(Number(e.target.value))}
                          className="filter-select"
                          style={{ height: '38px', fontFamily: 'var(--font-mono)' }}
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
                        style={{ height: '38px' }}
                        disabled={isLoading}
                      >
                        {isLoading ? <div className="spinner" style={{ width: '14px', height: '14px' }} /> : null}
                        {isLoading ? 'Fetching...' : 'Fetch & Analyze'}
                      </button>
                    </div>
                  </div>

                  {/* Date Timeline Filter on Initial Ingestion Form */}
                  <div className="ingestion-date-filter-row">
                    <div className="date-field-header">
                      <div className="date-field-title">
                        <Calendar size={15} style={{ color: startDateFilter ? 'var(--accent-brand)' : 'var(--text-muted)' }} />
                        <span>Check Messages From Date (Timeline to Present)</span>
                        <span className="date-hint-badge">
                          {startDateFilter ? `Active Scope: ${startDateFilter} → ${endDateFilter || 'Present'}` : 'All Available History'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className={`cat-filter-btn ${!startDateFilter && !endDateFilter ? 'active' : ''}`}
                          onClick={() => {
                            setStartDateFilter('');
                            setEndDateFilter('');
                          }}
                          title="Check all available history without date restriction"
                        >
                          All Time
                        </button>
                        <button
                          type="button"
                          className={`cat-filter-btn ${startDateFilter === todayDateStr && !endDateFilter ? 'active' : ''}`}
                          onClick={() => {
                            setStartDateFilter(todayDateStr);
                            setEndDateFilter('');
                          }}
                          title="Check messages from Today to Present"
                        >
                          Today
                        </button>
                        <button
                          type="button"
                          className={`cat-filter-btn ${startDateFilter === past7DateStr && !endDateFilter ? 'active' : ''}`}
                          onClick={() => {
                            setStartDateFilter(past7DateStr);
                            setEndDateFilter('');
                          }}
                          title="Check messages from Past 7 Days to Present"
                        >
                          Past 7 Days
                        </button>
                      </div>
                    </div>

                    <div className="date-inputs-cluster">
                      <div className="date-filter-box" title="Start date: only analyze messages from this date onwards">
                        <span className="date-input-prefix">From:</span>
                        <input
                          type="date"
                          className="date-filter-input"
                          value={startDateFilter}
                          onChange={(e) => setStartDateFilter(e.target.value)}
                          title="Filter messages starting from this date"
                        />
                        {startDateFilter && (
                          <button
                            type="button"
                            className="date-clear-btn"
                            onClick={() => setStartDateFilter('')}
                            title="Clear start date"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>

                      <div className="date-filter-box" title="End date: defaults to Present if left blank">
                        <span className="date-input-prefix">To:</span>
                        <input
                          type="date"
                          className="date-filter-input"
                          value={endDateFilter}
                          onChange={(e) => setEndDateFilter(e.target.value)}
                          title="End date (defaults to Present if left blank)"
                        />
                        {endDateFilter && (
                          <button
                            type="button"
                            className="date-clear-btn"
                            onClick={() => setEndDateFilter('')}
                            title="Clear end date"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>

                      {startDateFilter ? (
                        <span className="date-status-pill active">
                          ● Scanning will check flags from {startDateFilter} to {endDateFilter || 'Present'}
                        </span>
                      ) : (
                        <span className="date-status-pill">
                          Full historical scan (select a date above to check from that date to present)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Quick 1-Click Channel Selector Bar */}
                  <div className="channel-switcher-bar">
                    <span className="channel-switcher-label">Preset Channels:</span>
                    {presetChannels.map((ch) => {
                      const isSelected = discordChannelId === ch.channel_id;
                      const cachedInfo = cachedChannels.find((c) => c.channel_id === ch.channel_id);
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
                          {cachedInfo ? ` (${cachedInfo.cached_messages_count.toLocaleString()} cached)` : ''}
                        </button>
                      );
                    })}

                    <button
                      type="button"
                      className="btn-primary"
                      style={{ height: '30px', padding: '0 0.7rem', fontSize: '0.73rem', marginLeft: 'auto' }}
                      onClick={() => {
                        setActiveTab('live');
                        handleStartLiveMonitor(
                          'all',
                          4000,
                          presetChannels.map((p) => p.channel_id)
                        );
                      }}
                      title="Start live real-time chat moderation across ALL working Discord channels simultaneously"
                    >
                      ● Monitor All {presetChannels.length} Channels Live
                    </button>
                  </div>

                  {/* SMART SCAN MEMORY VAULT PANEL */}
                  <SmartScanMemoryPanel
                    cachedChannels={cachedChannels}
                    activeChannelId={discordChannelId}
                    useSmartCache={useSmartCache}
                    onToggleSmartCache={(enabled) => {
                      setUseSmartCache(enabled);
                      try {
                        localStorage.setItem('modstudio_use_smart_cache', String(enabled));
                      } catch {
                        // ignore
                      }
                    }}
                    onLoadCachedChannel={handleLoadCachedChannel}
                    onDeleteCachedChannel={handleDeleteCachedChannel}
                    onForceRescanChannel={(cid) => {
                      setDiscordChannelId(cid);
                      handleDiscordTokenFetch(undefined, cid, false);
                    }}
                    isLoading={isLoading}
                  />

                  {fetchProgress && (
                    <div
                      style={{
                        marginTop: '1rem',
                        padding: '0.85rem 1rem',
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border-default)',
                        borderRadius: 'var(--radius-sm)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                          {fetchProgress.status === 'analyzing'
                            ? `Analyzing ${fetchProgress.fetched.toLocaleString()} messages...`
                            : `Fetching ${fetchProgress.channelName}: ${fetchProgress.fetched.toLocaleString()} / ${fetchProgress.target.toLocaleString()} messages`}
                          {fetchProgress.rateLimitWaitMs > 0 && (
                            <span style={{ marginLeft: '0.6rem', color: 'var(--sev-medium)', fontSize: '0.74rem' }}>
                              (Rate-limit pause {(fetchProgress.rateLimitWaitMs / 1000).toFixed(1)}s)
                            </span>
                          )}
                        </div>
                        {fetchProgress.status === 'fetching' && fetchProgress.fetched > 0 && (
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ height: '28px', padding: '0 0.65rem', fontSize: '0.72rem' }}
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
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
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
                    {isLoading ? <div className="spinner" /> : <UploadCloud size={20} />}
                  </div>

                  <h2 className="upload-title">
                    {isLoading ? 'Analyzing Log Archive...' : 'Drop server chat log here, or click to browse'}
                  </h2>
                  <p className="upload-description">
                    Supports Minecraft (Vanilla, Spigot, Paper), Discord exports, and CSV transcripts.
                  </p>

                  <div style={{ marginBottom: '1rem' }}>
                    <div className="metadata-inline">
                      <span>.LOG</span>
                      <span className="metadata-sep" aria-hidden="true">·</span>
                      <span>.TXT</span>
                      <span className="metadata-sep" aria-hidden="true">·</span>
                      <span>.CSV</span>
                    </div>
                  </div>

                  {/* Date Timeline Filter on File Upload Zone */}
                  <div
                    className="ingestion-date-filter-row"
                    style={{ maxWidth: '620px', margin: '0 auto 1.25rem auto', textAlign: 'left' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="date-field-header">
                      <div className="date-field-title">
                        <Calendar size={15} style={{ color: startDateFilter ? 'var(--accent-brand)' : 'var(--text-muted)' }} />
                        <span>Check From Date</span>
                        <span className="date-hint-badge">
                          {startDateFilter ? `Active: ${startDateFilter} → ${endDateFilter || 'Present'}` : 'All File Lines'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className={`cat-filter-btn ${!startDateFilter && !endDateFilter ? 'active' : ''}`}
                          onClick={() => {
                            setStartDateFilter('');
                            setEndDateFilter('');
                          }}
                        >
                          All Time
                        </button>
                        <button
                          type="button"
                          className={`cat-filter-btn ${startDateFilter === todayDateStr && !endDateFilter ? 'active' : ''}`}
                          onClick={() => {
                            setStartDateFilter(todayDateStr);
                            setEndDateFilter('');
                          }}
                        >
                          Today
                        </button>
                        <button
                          type="button"
                          className={`cat-filter-btn ${startDateFilter === past7DateStr && !endDateFilter ? 'active' : ''}`}
                          onClick={() => {
                            setStartDateFilter(past7DateStr);
                            setEndDateFilter('');
                          }}
                        >
                          Past 7 Days
                        </button>
                      </div>
                    </div>

                    <div className="date-inputs-cluster">
                      <div className="date-filter-box">
                        <span className="date-input-prefix">From:</span>
                        <input
                          type="date"
                          className="date-filter-input"
                          value={startDateFilter}
                          onChange={(e) => setStartDateFilter(e.target.value)}
                        />
                        {startDateFilter && (
                          <button
                            type="button"
                            className="date-clear-btn"
                            onClick={() => setStartDateFilter('')}
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>

                      <div className="date-filter-box">
                        <span className="date-input-prefix">To:</span>
                        <input
                          type="date"
                          className="date-filter-input"
                          value={endDateFilter}
                          onChange={(e) => setEndDateFilter(e.target.value)}
                        />
                        {endDateFilter && (
                          <button
                            type="button"
                            className="date-clear-btn"
                            onClick={() => setEndDateFilter('')}
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
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
                      style={{ height: '36px' }}
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
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="diagnostics-box" id="error-alert">
              <div className="diagnostics-title">
                <AlertTriangle size={15} />
                Ingestion Diagnostic
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>{errorMessage}</p>
            </div>
          )}
        </section>

        {/* LIVE CHAT MODERATION RADAR TAB (Accessible anytime, even before batch log load) */}
        {activeTab === 'live' && (
          <div className={`workbench-split ${activeMessage && !isExpandedModal ? 'inspector-open' : ''}`}>
            <LiveModerationRadarView
              liveStatus={liveStatus}
              discordToken={discordToken}
              selectedChannelId={discordChannelId}
              presetChannels={presetChannels}
              soundAlertsEnabled={soundAlertsEnabled}
              onToggleSoundAlerts={() => {
                const next = !soundAlertsEnabled;
                setSoundAlertsEnabled(next);
                try {
                  localStorage.setItem('modstudio_sound_alerts', String(next));
                } catch {
                  // ignore
                }
              }}
              onStartLiveMonitor={handleStartLiveMonitor}
              onStopLiveMonitor={handleStopLiveMonitor}
              onClearLiveAlerts={handleClearLiveAlerts}
              onSimulateLiveEvent={handleSimulateLiveEvent}
              onInspectLiveAlert={(alertItem, initialMode = 'log') => {
                const msgRec = convertLiveItemToMessageRecord(alertItem);
                handleOpenMessageModal(msgRec, initialMode);
                if (alertItem.detected_gamemode) {
                  setPunishmentGamemode(alertItem.detected_gamemode);
                }
              }}
            />

            {activeMessage && (
              <CaseInspectorPanel
                activeMessage={activeMessage}
                contextData={contextData}
                isLoadingContext={isLoadingContext}
                moderatorNoteInput={moderatorNoteInput}
                setModeratorNoteInput={setModeratorNoteInput}
                staffActionMode={staffActionMode}
                setStaffActionMode={setStaffActionMode}
                punishmentType={punishmentType}
                setPunishmentType={setPunishmentType}
                punishmentDuration={punishmentDuration}
                setPunishmentDuration={setPunishmentDuration}
                punishmentEvidenceLinks={punishmentEvidenceLinks}
                setPunishmentEvidenceLinks={setPunishmentEvidenceLinks}
                punishmentUsername={punishmentUsername}
                setPunishmentUsername={setPunishmentUsername}
                punishmentReason={punishmentReason}
                setPunishmentReason={setPunishmentReason}
                punishmentGamemode={punishmentGamemode}
                setPunishmentGamemode={setPunishmentGamemode}
                staffCommandChannelId={staffCommandChannelId}
                onUpdateStaffChannelId={(val) => {
                  setStaffCommandChannelId(val);
                  try {
                    localStorage.setItem('staff_command_channel_id', val);
                  } catch {
                    // ignore
                  }
                }}
                isSubmittingPunishment={isSubmittingPunishment}
                punishmentFeedback={punishmentFeedback}
                copiedKey={copiedKey}
                onCopyText={handleCopyText}
                onLogPunishment={handleLogPunishment}
                onModeratorAction={handleModeratorAction}
                onClose={() => setActiveMessage(null)}
                onStepCase={handleStepCase}
                canStepPrev={canStepPrev}
                canStepNext={canStepNext}
                isExpandedModal={isExpandedModal}
                onToggleExpandModal={() => setIsExpandedModal(!isExpandedModal)}
                onOpenPlayerByName={(uname) => {
                  if (data?.player_profiles[uname]) {
                    handleOpenPlayerDossier(data.player_profiles[uname]);
                  }
                }}
              />
            )}
          </div>
        )}

        {/* MAIN WORKSPACE */}
        {activeTab !== 'live' && (
          <>
            {/* BENTO CATEGORY & TELEMETRY GRID (When Data Loaded) */}
            {data && (
              <section className="bento-telemetry-grid" id="stats-summary">
                <div className="bento-card bento-large-2x2" id="stat-flagged">
                  <img
                    src={currentHeroImg}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="bento-bg-overlay"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  <div style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', background: 'rgba(255,255,255,0.14)', color: '#f8fafc', padding: '0.22rem 0.6rem', borderRadius: 'var(--radius-xs)' }}>
                      01 // CRITICAL THREAT MATRIX
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.76rem', fontWeight: 600, color: '#cbd5e1' }}>
                      {data.file_name} ({data.detected_format.toUpperCase()})
                    </span>
                  </div>

                  <div style={{ position: 'relative', zIndex: 2, margin: '1.15rem 0' }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.3rem, 4vw, 3.6rem)', lineHeight: 0.95, color: '#f8fafc' }} className="glitch-hover">
                      {data.flagged_messages_count.toLocaleString()} FLAGS
                    </div>
                    <div style={{ fontFamily: 'var(--font-main)', fontSize: '0.9rem', fontWeight: 600, color: '#cbd5e1', marginTop: '0.45rem' }}>
                      {((data.flagged_messages_count / (data.messages_detected || 1)) * 100).toFixed(1)}% Violation Density · {data.critical_severity_count} Critical · {data.high_severity_count} High
                    </div>
                  </div>

                  <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
                    {Object.entries(data.category_breakdown).map(([cat, count]) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          setSelectedCategory(selectedCategory === cat ? 'all' : cat);
                          setViewFilter('flagged');
                          setActiveTab('dashboard');
                        }}
                        style={{
                          background: selectedCategory === cat ? '#f8fafc' : 'rgba(255, 255, 255, 0.12)',
                          color: selectedCategory === cat ? '#090b0f' : '#f8fafc',
                          border: '1px solid rgba(255, 255, 255, 0.28)',
                          borderRadius: 'var(--radius-xs)',
                          padding: '0.28rem 0.6rem',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          cursor: 'pointer',
                        }}
                      >
                        {cat.replace('_', ' ')}: {count}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bento-card bento-acid">
                  <div className="stat-label">
                    <span>HIGH / CRITICAL PRIORITY</span>
                  </div>
                  <div className="stat-value">
                    {(data.critical_severity_count + data.high_severity_count).toLocaleString()}
                  </div>
                  <div className="stat-subtext">
                    {data.critical_severity_count} CRIT · {data.high_severity_count} HIGH
                  </div>
                </div>

                <div className="bento-card" id="stat-messages">
                  <div className="stat-label">
                    <span>MESSAGES ANALYZED</span>
                  </div>
                  <div className="stat-value">{data.messages_detected.toLocaleString()}</div>
                  <div className="stat-subtext">{data.lines_processed.toLocaleString()} RAW LINES</div>
                </div>

                <div className="bento-card" id="stat-players">
                  <div className="stat-label">
                    <span>UNIQUE PLAYERS</span>
                  </div>
                  <div className="stat-value">{data.unique_players_count.toLocaleString()}</div>
                  <div className="stat-subtext">
                    {Object.values(data.player_profiles).filter((p) => p.flagged_messages > 0).length} FLAGGED PROFILES
                  </div>
                </div>

                <div className="bento-card" id="stat-file">
                  <div className="stat-label">
                    <span>DISPATCHED PUNISHMENTS</span>
                  </div>
                  <div className="stat-value">{punishments.length}</div>
                  <div className="stat-subtext">
                    /STAFF LOG LEDGER
                  </div>
                </div>
              </section>
            )}

            {/* TAB 1: SPLIT-PANE REVIEW QUEUE + DOCKED CASE INSPECTOR */}
            {activeTab === 'dashboard' && (
              <>
                <section className="category-summary-bar" id="category-summary-chips">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                    <span className="category-summary-title">Category Filter:</span>
                    <button
                      type="button"
                      className={`cat-filter-btn ${selectedCategory === 'all' ? 'active' : ''}`}
                      onClick={() => setSelectedCategory('all')}
                    >
                      All Categories
                    </button>
                    {data ? (
                      Object.entries(data.category_breakdown).map(([cat, count]) => (
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
                      ))
                    ) : (
                      ['hate_speech', 'harassment', 'toxicity', 'severe_profanity', 'sexual_content', 'spam_advertising'].map((cat) => (
                        <button
                          type="button"
                          key={cat}
                          className={`cat-filter-btn ${selectedCategory === cat ? 'active' : ''}`}
                          onClick={() => setSelectedCategory(selectedCategory === cat ? 'all' : cat)}
                        >
                          <span>{cat.replace('_', ' ')}</span>
                        </button>
                      ))
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {/* Date Timeline Filter Controls */}
                    <div className="date-filter-box" title="Filter chat flags from a specific date to present">
                      <Calendar size={13} style={{ color: startDateFilter ? 'var(--accent-brand)' : 'var(--text-muted)', flexShrink: 0 }} />
                      <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>From:</span>
                      <input
                        type="date"
                        className="date-filter-input"
                        value={startDateFilter}
                        onChange={(e) => setStartDateFilter(e.target.value)}
                        title="Start date (flags from this date onwards)"
                      />
                      {startDateFilter && (
                        <button
                          type="button"
                          className="date-clear-btn"
                          onClick={() => setStartDateFilter('')}
                          title="Clear start date"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>

                    <div className="date-filter-box" title="To date (optional ceiling, defaults to present)">
                      <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>To:</span>
                      <input
                        type="date"
                        className="date-filter-input"
                        value={endDateFilter}
                        onChange={(e) => setEndDateFilter(e.target.value)}
                        title="End date (defaults to present if blank)"
                      />
                      {endDateFilter && (
                        <button
                          type="button"
                          className="date-clear-btn"
                          onClick={() => setEndDateFilter('')}
                          title="Clear end date"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>

                    {/* Quick Date Presets: Today, Last 7d */}
                    <button
                      type="button"
                      className={`cat-filter-btn ${startDateFilter === todayDateStr && !endDateFilter ? 'active' : ''}`}
                      onClick={() => {
                        if (startDateFilter === todayDateStr && !endDateFilter) {
                          setStartDateFilter('');
                        } else {
                          setStartDateFilter(todayDateStr);
                          setEndDateFilter('');
                        }
                      }}
                      title="Filter messages from Today to Present"
                    >
                      Today
                    </button>

                    <button
                      type="button"
                      className={`cat-filter-btn ${startDateFilter === past7DateStr && !endDateFilter ? 'active' : ''}`}
                      onClick={() => {
                        if (startDateFilter === past7DateStr && !endDateFilter) {
                          setStartDateFilter('');
                        } else {
                          setStartDateFilter(past7DateStr);
                          setEndDateFilter('');
                        }
                      }}
                      title="Filter messages from past 7 days to present"
                    >
                      Past 7 Days
                    </button>

                    {(startDateFilter || endDateFilter) && (
                      <button
                        type="button"
                        className="cat-filter-btn"
                        style={{ color: 'var(--sev-critical)' }}
                        onClick={() => {
                          setStartDateFilter('');
                          setEndDateFilter('');
                        }}
                        title="Clear all date restrictions"
                      >
                        Reset Dates
                      </button>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                      <span>Shortcuts:</span>
                      <span className="kbd-hint">J/K</span>
                      <span>Step</span>
                      <span className="kbd-hint">C</span>
                      <span>Confirm</span>
                      <span className="kbd-hint">X</span>
                      <span>False Pos</span>
                    </div>
                  </div>
                </section>

                {/* If no data loaded: Show Armed Standby Triage Panel with Date Scope */}
                {!data ? (
                  <section className="standby-queue-banner" id="standby-triage-panel">
                    <div className="standby-queue-header">
                      <div>
                        <div className="standby-badge-live">
                          <Calendar size={13} />
                          <span>
                            {startDateFilter
                              ? `DATE SCOPE ARMED: FROM ${startDateFilter} TO ${endDateFilter || 'PRESENT'}`
                              : 'DATE SCOPE: ALL AVAILABLE LOGS (SELECT DATE TO RESTRICT)'}
                          </span>
                        </div>
                        <h3 className="standby-queue-title" style={{ marginTop: '0.65rem' }}>
                          Forensic Moderation Triage Queue
                        </h3>
                        <p className="standby-queue-desc">
                          {startDateFilter ? (
                            <>
                              Studio is armed to check chat logs and flags from <strong>{startDateFilter}</strong> to <strong>{endDateFilter || 'Present'}</strong>. Choose a live channel stream or load sample data below to inspect violations.
                            </>
                          ) : (
                            <>
                              Select a date above (or click <strong>Today</strong> / <strong>Past 7 Days</strong>) to check messages and flags from a specific date to present, then fetch a live channel stream or load sample logs.
                            </>
                          )}
                        </p>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', alignItems: 'flex-end' }}>
                        <button
                          type="button"
                          className="btn-primary"
                          style={{ padding: '0.65rem 1.15rem', fontSize: '0.82rem' }}
                          onClick={() => handleDiscordTokenFetch(undefined, discordChannelId, false)}
                          disabled={isLoading}
                        >
                          <RefreshCw size={13} className={isLoading ? 'spin' : ''} />
                          {isLoading ? 'Scanning Stream...' : `Scan ${presetChannels.find(p => p.channel_id === discordChannelId)?.name || 'Selected Channel'} →`}
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ padding: '0.55rem 0.95rem', fontSize: '0.78rem' }}
                          onClick={loadSample}
                          disabled={isLoading}
                        >
                          Load Sample Dataset
                        </button>
                      </div>
                    </div>

                    {cachedChannels.length > 0 && (
                      <div style={{ marginTop: '0.6rem', paddingTop: '0.85rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                          Instant Memory Vault ({cachedChannels.length} cached channels):
                        </span>
                        {cachedChannels.map((c) => (
                          <button
                            key={c.channel_id}
                            type="button"
                            className="cat-filter-btn"
                            onClick={() => handleLoadCachedChannel(c.channel_id)}
                          >
                            {c.channel_name} ({c.cached_messages_count.toLocaleString()} msgs)
                          </button>
                        ))}
                      </div>
                    )}
                  </section>
                ) : (

                <div className={`workbench-split ${activeMessage && !isExpandedModal ? 'inspector-open' : ''}`}>
                  {/* Left Pane: High-Density Forensic Queue */}
                  <section className="preview-container" id="messages-table-card">
                    <div className="preview-header">
                      <div className="preview-title-box">
                        <h3 className="preview-title">Moderation Triage Queue</h3>
                        <span className="count-text" id="filtered-count">
                          {totalMessages.toLocaleString()} results · Page {currentPage}/{totalPages}
                          {startDateFilter && (
                            <span style={{ color: 'var(--accent-brand)', marginLeft: '0.4rem', fontWeight: 700 }}>
                              (From {startDateFilter}{endDateFilter ? ` to ${endDateFilter}` : ' to Present'})
                            </span>
                          )}
                        </span>
                      </div>

                      <div className="filter-bar">
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

                        <select
                          id="player-filter-select"
                          value={selectedPlayer}
                          onChange={(e) => setSelectedPlayer(e.target.value)}
                          className="filter-select"
                        >
                          <option value="all">All Players ({data.unique_players_count})</option>
                          {data.unique_players.map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>

                        <div className="search-box">
                          <Search
                            size={13}
                            style={{ position: 'absolute', left: '0.65rem', color: 'var(--text-muted)' }}
                          />
                          <input
                            type="text"
                            id="search-filter-input"
                            placeholder="Search message or player..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="search-input"
                          />
                        </div>

                        {/* Inline Table Date Range Filter */}
                        <div className="date-filter-box" title="Filter from specific date to present">
                          <Calendar size={13} style={{ color: startDateFilter ? 'var(--accent-brand)' : 'var(--text-muted)', flexShrink: 0 }} />
                          <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>Date:</span>
                          <input
                            type="date"
                            className="date-filter-input"
                            value={startDateFilter}
                            onChange={(e) => setStartDateFilter(e.target.value)}
                            title="Filter flags from this date to present"
                          />
                          {startDateFilter && (
                            <button
                              type="button"
                              className="date-clear-btn"
                              onClick={() => setStartDateFilter('')}
                              title="Clear date filter"
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Multi-Row Batch Disposition Bar */}
                    {selectedMsgIds.length > 0 && (
                      <div className="batch-action-bar">
                        <div style={{ fontSize: '0.78rem', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                          {selectedMsgIds.length} message(s) selected for batch disposition
                        </div>
                        <div className="action-btn-group">
                          <button
                            type="button"
                            className="btn-action confirm"
                            onClick={() => handleBatchModeratorAction('confirmed')}
                          >
                            Batch Confirm
                          </button>
                          <button
                            type="button"
                            className="btn-action"
                            onClick={() => handleBatchModeratorAction('false_positive')}
                          >
                            Batch False Positive
                          </button>
                          <button
                            type="button"
                            className="btn-action"
                            onClick={() => handleBatchModeratorAction('ignored')}
                          >
                            Batch Ignore
                          </button>
                          <button
                            type="button"
                            className="btn-ghost"
                            onClick={() => setSelectedMsgIds([])}
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="table-wrapper">
                      <table className="log-table" id="parsed-records-table">
                        <thead>
                          <tr>
                            <th style={{ width: '36px' }}>
                              <button
                                type="button"
                                className="btn-ghost"
                                style={{ padding: 0, height: '20px' }}
                                onClick={toggleSelectAllOnPage}
                                title="Select all visible rows"
                              >
                                {selectedMsgIds.length > 0 &&
                                selectedMsgIds.length === filteredMessages.length ? (
                                  <CheckSquare size={14} />
                                ) : (
                                  <Square size={14} />
                                )}
                              </button>
                            </th>
                            <th className="col-line">Line</th>
                            <th className="col-time">Timestamp</th>
                            <th className="col-player">Player</th>
                            <th className="col-msg">Message &amp; Categories</th>
                            <th className="col-mod">Severity</th>
                            <th className="col-status">Status</th>
                            {!activeMessage && <th className="col-reasons">Detection Summary</th>}
                            <th style={{ width: '130px', textAlign: 'right' }}>Enforcement</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredMessages.length === 0 ? (
                            <tr>
                              <td colSpan={9} className="empty-state" style={{ border: 'none' }}>
                                No messages matching the current filter criteria.
                              </td>
                            </tr>
                          ) : (
                            filteredMessages.map((msg) => {
                              const isSelectedCase = activeMessage?.id === msg.id;
                              const isChecked = selectedMsgIds.includes(msg.id);
                              const sevBorderClass = msg.is_flagged ? `sev-border-${msg.severity}` : '';
                              return (
                                <tr
                                  key={msg.id}
                                  id={`msg-row-${msg.id}`}
                                  className={`clickable-row ${sevBorderClass} ${isSelectedCase ? 'selected-case-row' : ''}`}
                                  onClick={() => handleOpenMessageModal(msg)}
                                >
                                  <td onClick={(e) => e.stopPropagation()}>
                                    <button
                                      type="button"
                                      className="btn-ghost"
                                      style={{ padding: 0, height: '20px' }}
                                      onClick={() => toggleSelectMessage(msg.id)}
                                    >
                                      {isChecked ? <CheckSquare size={14} /> : <Square size={14} />}
                                    </button>
                                  </td>
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
                                    <div style={{ color: 'var(--text-primary)', fontWeight: msg.is_flagged ? 500 : 400 }}>
                                      {msg.message}
                                    </div>
                                    {msg.categories.length > 0 && (
                                      <div className="unboxed-meta-row">
                                        {msg.categories.map((cat, ci) => (
                                          <React.Fragment key={ci}>
                                            {ci > 0 && (
                                              <span className="metadata-sep" aria-hidden="true">
                                                ·
                                              </span>
                                            )}
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
                                        <div
                                          style={{
                                            fontSize: '0.7rem',
                                            fontFamily: 'var(--font-mono)',
                                            color: 'var(--text-muted)',
                                            marginTop: '0.1rem',
                                          }}
                                        >
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
                                  {!activeMessage && (
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
                                        <span
                                          style={{
                                            fontSize: '0.7rem',
                                            color: 'var(--text-muted)',
                                            fontFamily: 'var(--font-mono)',
                                          }}
                                        >
                                          +{msg.reasons.length - 2} more
                                        </span>
                                      )}
                                    </td>
                                  )}
                                  <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                                    <div style={{ display: 'inline-flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                                      <button
                                        type="button"
                                        className={
                                          isSelectedCase && staffActionMode === 'log'
                                            ? 'btn-primary'
                                            : msg.is_flagged
                                            ? 'btn-primary'
                                            : 'btn-secondary'
                                        }
                                        style={{
                                          height: '28px',
                                          padding: '0 0.55rem',
                                          fontSize: '0.7rem',
                                        }}
                                        onClick={() => handleOpenMessageModal(msg, 'log')}
                                        title="Open autofilled /staff log punishment inspector"
                                      >
                                        Log
                                      </button>
                                      <button
                                        type="button"
                                        className={
                                          isSelectedCase && staffActionMode === 'request'
                                            ? 'btn-danger'
                                            : msg.is_flagged
                                            ? 'btn-danger'
                                            : 'btn-secondary'
                                        }
                                        style={{
                                          height: '28px',
                                          padding: '0 0.55rem',
                                          fontSize: '0.7rem',
                                        }}
                                        onClick={() => handleOpenMessageModal(msg, 'request')}
                                        title="Open autofilled /staff request punishment inspector for higher durations"
                                      >
                                        Request
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>

                    {totalPages > 1 && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.75rem',
                          padding: '0.85rem',
                          borderTop: '1px solid var(--border-subtle)',
                        }}
                      >
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ height: '32px', padding: '0 0.7rem', fontSize: '0.75rem' }}
                          disabled={currentPage <= 1 || isLoadingMessages}
                          onClick={() =>
                            fetchMessages(currentPage - 1, {
                              flaggedOnly: viewFilter === 'flagged',
                              severity: selectedSeverity,
                              category: selectedCategory,
                              player: selectedPlayer,
                              status: selectedStatus,
                              search: searchQuery,
                              sortBy,
                            })
                          }
                        >
                          <ChevronLeft size={14} /> Prev
                        </button>
                        <span
                          style={{
                            color: 'var(--text-secondary)',
                            fontSize: '0.78rem',
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          Page {currentPage} of {totalPages}
                        </span>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ height: '32px', padding: '0 0.7rem', fontSize: '0.75rem' }}
                          disabled={currentPage >= totalPages || isLoadingMessages}
                          onClick={() =>
                            fetchMessages(currentPage + 1, {
                              flaggedOnly: viewFilter === 'flagged',
                              severity: selectedSeverity,
                              category: selectedCategory,
                              player: selectedPlayer,
                              status: selectedStatus,
                              search: searchQuery,
                              sortBy,
                            })
                          }
                        >
                          Next <ChevronRight size={14} />
                        </button>
                      </div>
                    )}
                  </section>

                  {/* Right Pane: Docked Split-Pane Case Inspector & /staff Dispatch Console */}
                  {activeMessage && (
                    <CaseInspectorPanel
                      activeMessage={activeMessage}
                      contextData={contextData}
                      isLoadingContext={isLoadingContext}
                      moderatorNoteInput={moderatorNoteInput}
                      setModeratorNoteInput={setModeratorNoteInput}
                      staffActionMode={staffActionMode}
                      setStaffActionMode={setStaffActionMode}
                      punishmentType={punishmentType}
                      setPunishmentType={setPunishmentType}
                      punishmentDuration={punishmentDuration}
                      setPunishmentDuration={setPunishmentDuration}
                      punishmentEvidenceLinks={punishmentEvidenceLinks}
                      setPunishmentEvidenceLinks={setPunishmentEvidenceLinks}
                      punishmentUsername={punishmentUsername}
                      setPunishmentUsername={setPunishmentUsername}
                      punishmentReason={punishmentReason}
                      setPunishmentReason={setPunishmentReason}
                      punishmentGamemode={punishmentGamemode}
                      setPunishmentGamemode={setPunishmentGamemode}
                      staffCommandChannelId={staffCommandChannelId}
                      onUpdateStaffChannelId={(val) => {
                        setStaffCommandChannelId(val);
                        try {
                          localStorage.setItem('staff_command_channel_id', val);
                        } catch {
                          // ignore
                        }
                      }}
                      isSubmittingPunishment={isSubmittingPunishment}
                      punishmentFeedback={punishmentFeedback}
                      copiedKey={copiedKey}
                      onCopyText={handleCopyText}
                      onLogPunishment={handleLogPunishment}
                      onModeratorAction={handleModeratorAction}
                      onClose={() => setActiveMessage(null)}
                      onStepCase={handleStepCase}
                      canStepPrev={canStepPrev}
                      canStepNext={canStepNext}
                      isExpandedModal={isExpandedModal}
                      onToggleExpandModal={() => setIsExpandedModal(!isExpandedModal)}
                      onOpenPlayerByName={(uname) => {
                        if (data?.player_profiles[uname]) {
                          handleOpenPlayerDossier(data.player_profiles[uname]);
                        }
                      }}
                    />
                  )}
                </div>
                )}
              </>
            )}

            {/* TAB 2: PLAYER BEHAVIOR DOSSIERS */}
            {activeTab === 'players' && (
              data ? (
                <PlayersDossiersView data={data} onOpenPlayerDossier={handleOpenPlayerDossier} />
              ) : (
                <div className="empty-state" style={{ marginTop: '1.5rem' }}>
                  <BrandLogoMark size={44} />
                  <h3 style={{ marginTop: '0.75rem', color: 'var(--text-primary)' }}>Player Dossiers</h3>
                  <p style={{ marginTop: '0.35rem', color: 'var(--text-secondary)', fontSize: '0.84rem' }}>
                    Load a log dataset or scan a live Discord channel to inspect individual player toxicity history.
                  </p>
                </div>
              )
            )}

            {/* TAB 3: ANALYTICS WORKBENCH */}
            {activeTab === 'analytics' && (
              data ? (
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
                <div className="empty-state" style={{ marginTop: '1.5rem' }}>
                  <BrandLogoMark size={44} />
                  <h3 style={{ marginTop: '0.75rem', color: 'var(--text-primary)' }}>Telemetry Analytics</h3>
                  <p style={{ marginTop: '0.35rem', color: 'var(--text-secondary)', fontSize: '0.84rem' }}>
                    Scan a Discord channel or load sample data to generate heuristic distribution charts and severity matrices.
                  </p>
                </div>
              )
            )}

            {/* TAB 4: STAFF PUNISHMENT CASE LEDGER */}
            {activeTab === 'punishments' && (
              <PunishmentsLogView
                punishments={punishments}
                copiedKey={copiedKey}
                onCopyText={handleCopyText}
                onDeletePunishment={handleDeletePunishment}
              />
            )}

            {/* Parsing Warnings */}
            {data && data.parsing_errors.length > 0 && (
              <section className="diagnostics-box" id="parsing-errors-list">
                <div className="diagnostics-title">
                  <AlertTriangle size={15} />
                  Parsing Warnings ({data.parsing_errors.length})
                </div>
                <ul style={{ listStyle: 'none', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  {data.parsing_errors.map((err, i) => (
                    <li key={i} style={{ marginBottom: '0.2rem' }}>
                      <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                        Line {err.line_number}:
                      </strong>{' '}
                      {err.reason} &mdash; <code>{err.raw_line}</code>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </main>

      {/* FULL-WIDTH FOOTER */}
      <footer className="acid-footer">
        <div className="acid-footer-inner">
          <div>
            <span className="footer-col-label">00 // MODSTUDIO · {activeThemeMeta.name.toUpperCase()}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <BrandLogoMark size={40} />
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.35rem', color: '#FAF8F5', lineHeight: 1.1 }} className="glitch-hover">
                MODERATION STUDIO
              </div>
            </div>
            <p style={{ fontSize: '0.84rem', color: '#A1A1AA', marginTop: '0.6rem', maxWidth: '38ch' }}>
              Production-grade chat log ingestion, deobfuscated rule + context analysis, and 2-step Discord <code>/staff log punishment</code> dispatch.
            </p>
            <form
              className="footer-newsletter-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (newsletterEmail.trim()) {
                  setNewsletterJoined(true);
                  setNewsletterEmail('');
                }
              }}
            >
              <input
                type="email"
                className="footer-newsletter-input"
                placeholder={newsletterJoined ? 'SUBSCRIBED TO ALERTS!' : 'STAFF ALERT DISPATCH EMAIL...'}
                value={newsletterEmail}
                onChange={(e) => setNewsletterEmail(e.target.value)}
              />
              <button type="submit" className="footer-newsletter-submit">
                {newsletterJoined ? 'JOINED' : 'JOIN'}
              </button>
            </form>
          </div>

          <div>
            <span className="footer-col-label">01 // STORE &amp; MODULES</span>
            <ul className="footer-link-list">
              <li>
                <button type="button" className="footer-link-item" onClick={() => setActiveTab('dashboard')}>
                  REVIEW QUEUE
                </button>
              </li>
              <li>
                <button type="button" className="footer-link-item" onClick={() => setActiveTab('players')}>
                  PLAYER DOSSIERS
                </button>
              </li>
              <li>
                <button type="button" className="footer-link-item" onClick={() => setActiveTab('analytics')}>
                  ANALYTICS MATRIX
                </button>
              </li>
              <li>
                <button type="button" className="footer-link-item" onClick={() => setActiveTab('punishments')}>
                  PUNISHMENT LEDGER
                </button>
              </li>
            </ul>
          </div>

          <div>
            <span className="footer-col-label">02 // INFO &amp; EXPORTS</span>
            <ul className="footer-link-list">
              <li>
                <button type="button" className="footer-link-item" onClick={loadSample}>
                  SAMPLE DATASET
                </button>
              </li>
              <li>
                <button type="button" className="footer-link-item" onClick={() => handleExport('csv')}>
                  EXPORT CSV REPORT
                </button>
              </li>
              <li>
                <button type="button" className="footer-link-item" onClick={() => handleExport('json')}>
                  EXPORT JSON ARCHIVE
                </button>
              </li>
              <li>
                <a href="/api/v1/download/portable-exe" download="ModerationStudio-Portable.exe" className="footer-link-item">
                  PORTABLE .EXE BUILD
                </a>
              </li>
            </ul>
          </div>

          <div>
            <span className="footer-col-label">03 // SOCIAL &amp; BRIDGE</span>
            <ul className="footer-link-list">
              <li>
                <button
                  type="button"
                  className="footer-link-item"
                  onClick={() => {
                    setIngestMode('token');
                    setIsIngestionExpanded(true);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                >
                  DISCORD GATEWAY
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="footer-link-item"
                  onClick={() => {
                    setIngestMode('file');
                    setIsIngestionExpanded(true);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                >
                  MINECRAFT LOG PARSER
                </button>
              </li>
              <li>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#FAF8F5' }}>
                  STATUS: ● ONLINE (PORT 3000)
                </span>
              </li>
            </ul>
          </div>
        </div>
      </footer>

      {/* DEDICATED PLAYER DOSSIER MODAL */}
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
    </div>
  );
};

export default App;
