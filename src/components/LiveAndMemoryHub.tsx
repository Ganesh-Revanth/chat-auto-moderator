import React, { useState } from 'react';
import {
  Radio,
  Play,
  Square,
  Zap,
  Bell,
  Volume2,
  VolumeX,
  Database,
  Trash2,
  RefreshCw,
  ShieldAlert,
  CheckCircle2,
  ExternalLink,
  Gavel,
} from 'lucide-react';
import type {
  ChannelCacheSummary,
  LiveFeedAlertItem,
  LiveMonitorStatusResponse,
  MessageRecord,
} from '../types';

interface SmartScanMemoryPanelProps {
  cachedChannels: ChannelCacheSummary[];
  activeChannelId: string;
  useSmartCache: boolean;
  onToggleSmartCache: (enabled: boolean) => void;
  onLoadCachedChannel: (channelId: string) => void;
  onDeleteCachedChannel: (channelId: string) => void;
  onForceRescanChannel: (channelId: string) => void;
  isLoading: boolean;
}

export const SmartScanMemoryPanel: React.FC<SmartScanMemoryPanelProps> = ({
  cachedChannels,
  activeChannelId,
  useSmartCache,
  onToggleSmartCache,
  onLoadCachedChannel,
  onDeleteCachedChannel,
  onForceRescanChannel,
  isLoading,
}) => {
  return (
    <div
      style={{
        marginTop: '1rem',
        padding: '0.95rem 1.15rem',
        background: 'var(--bg-elevated)',
        border: 'var(--border-width) solid var(--border-default)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-btn)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontFamily: 'var(--font-display)',
              fontSize: '0.84rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
            }}
          >
            <Database size={15} style={{ color: 'var(--accent-brand)' }} />
            SMART SCAN MEMORY VAULT
          </span>
          <span className="brand-tag-pill">
            {cachedChannels.length} CACHED CHANNEL{cachedChannels.length === 1 ? '' : 'S'}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Skips already-scanned message history and only fetches new messages since your last scan.
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              fontSize: '0.76rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              cursor: 'pointer',
              background: 'var(--bg-input)',
              padding: '0.32rem 0.7rem',
              borderRadius: 'var(--radius-xs)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <input
              type="checkbox"
              checked={useSmartCache}
              onChange={(e) => onToggleSmartCache(e.target.checked)}
            />
            <span>Incremental Memory Sync (Skip Redundant Scans)</span>
          </label>

          {cachedChannels.length > 0 && (
            <button
              type="button"
              className="btn-secondary"
              style={{ height: '30px', padding: '0 0.65rem', fontSize: '0.72rem' }}
              onClick={() => onDeleteCachedChannel('all')}
              title="Clear all saved channel scan memories"
            >
              <Trash2 size={12} /> Clear All Memory
            </button>
          )}
        </div>
      </div>

      {cachedChannels.length > 0 ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(265px, 1fr))',
            gap: '0.65rem',
            marginTop: '0.85rem',
          }}
        >
          {cachedChannels.map((item) => {
            const isCurrent = item.channel_id === activeChannelId;
            return (
              <div
                key={item.channel_id}
                style={{
                  background: 'var(--bg-surface)',
                  border: `var(--border-width) solid ${
                    isCurrent ? 'var(--accent-brand)' : 'var(--border-default)'
                  }`,
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.7rem 0.85rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.4rem' }}>
                  <div>
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        color: 'var(--text-primary)',
                      }}
                    >
                      {item.channel_name}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                      Synced: {item.last_synced_at}
                    </div>
                  </div>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      color: 'var(--status-confirmed)',
                      background: 'var(--bg-input)',
                      padding: '0.12rem 0.45rem',
                      borderRadius: '4px',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    ● CACHED
                  </span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.73rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <span>{item.cached_messages_count.toLocaleString()} msgs stored</span>
                  <span style={{ color: item.flagged_messages_count > 0 ? 'var(--sev-critical)' : 'var(--text-muted)', fontWeight: 700 }}>
                    {item.flagged_messages_count.toLocaleString()} flags
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.15rem' }}>
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ flex: 1, height: '28px', padding: '0 0.55rem', fontSize: '0.71rem' }}
                    disabled={isLoading}
                    onClick={() => onLoadCachedChannel(item.channel_id)}
                    title="Instant 0-second load directly from saved memory without calling Discord API"
                  >
                    <Zap size={12} /> Instant Load
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ height: '28px', padding: '0 0.5rem', fontSize: '0.71rem' }}
                    disabled={isLoading}
                    onClick={() => onForceRescanChannel(item.channel_id)}
                    title="Fetch only new messages since last sync"
                  >
                    <RefreshCw size={11} /> Sync Delta
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ height: '28px', padding: '0 0.45rem', fontSize: '0.71rem' }}
                    onClick={() => onDeleteCachedChannel(item.channel_id)}
                    title="Delete cached memory for this channel"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div
          style={{
            marginTop: '0.65rem',
            fontSize: '0.76rem',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          No channels cached yet — once you run <strong>Fetch &amp; Analyze</strong> on any Discord channel, its history is stored in memory so future scans only fetch new messages.
        </div>
      )}
    </div>
  );
};

interface LiveModerationRadarViewProps {
  liveStatus: LiveMonitorStatusResponse | null;
  discordToken: string;
  selectedChannelId: string;
  presetChannels: { channel_id: string; guild_id: string; url: string; name: string }[];
  soundAlertsEnabled: boolean;
  onToggleSoundAlerts: () => void;
  onStartLiveMonitor: (channelIdOrAll: string, intervalMs: number, channelIds?: string[]) => void;
  onStopLiveMonitor: () => void;
  onClearLiveAlerts: () => void;
  onSimulateLiveEvent: (
    customPlayer?: string,
    customMessage?: string,
    channelId?: string,
    multiChannelBurst?: boolean
  ) => void;
  onInspectLiveAlert: (item: LiveFeedAlertItem, initialMode?: 'log' | 'request') => void;
  onBatchPunishLiveAlerts?: (alerts: LiveFeedAlertItem[]) => void;
  showTestTools?: boolean;
}

export const LiveModerationRadarView: React.FC<LiveModerationRadarViewProps> = ({
  liveStatus,
  presetChannels,
  soundAlertsEnabled,
  onToggleSoundAlerts,
  onStartLiveMonitor,
  onStopLiveMonitor,
  onClearLiveAlerts,
  onSimulateLiveEvent,
  onInspectLiveAlert,
  onBatchPunishLiveAlerts,
  showTestTools = false,
}) => {
  const [monitorTarget, setMonitorTarget] = useState<string>('all');
  const [pollIntervalMs, setPollIntervalMs] = useState<number>(liveStatus?.poll_interval_ms || 4000);
  const [simPlayer, setSimPlayer] = useState<string>('');
  const [simMessage, setSimMessage] = useState<string>('');
  const [feedFilter, setFeedFilter] = useState<'all' | 'flagged'>('all');
  const [selectedChannelFilter, setSelectedChannelFilter] = useState<string>('all');

  const isRunning = Boolean(liveStatus?.running);
  const monitoredChannels = liveStatus?.monitored_channels || [];
  const recentMessages = liveStatus?.recent_messages || [];
  const activeAlerts = liveStatus?.active_alerts || [];

  const filteredAlerts =
    selectedChannelFilter === 'all'
      ? activeAlerts
      : activeAlerts.filter((a) => a.channel_id === selectedChannelFilter);

  const channelFilteredStream =
    selectedChannelFilter === 'all'
      ? recentMessages
      : recentMessages.filter((m) => m.channel_id === selectedChannelFilter);

  const displayedStream =
    feedFilter === 'flagged'
      ? channelFilteredStream.filter((m) => m.is_flagged)
      : channelFilteredStream;

  const workingCount = monitoredChannels.filter((c) => c.status === 'working').length;

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Live Radar Control Header */}
      <div className="preview-container" style={{ padding: '1.2rem 1.4rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: 'var(--radius-md)',
                background: isRunning ? 'var(--sev-critical-bg)' : 'var(--bg-elevated)',
                border: `var(--border-width) solid ${
                  isRunning ? 'var(--sev-critical)' : 'var(--border-default)'
                }`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isRunning ? 'var(--sev-critical)' : 'var(--text-secondary)',
              }}
            >
              <Radio size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <h2 className="preview-title" style={{ fontSize: '1.1rem' }}>
                  OMNI-CHANNEL LIVE CHAT RADAR &amp; REAL-TIME ALERTS
                </h2>
                <span
                  className="brand-tag-pill"
                  style={{
                    background: isRunning ? 'var(--status-confirmed)' : 'var(--bg-elevated)',
                    color: isRunning ? '#ffffff' : 'var(--text-secondary)',
                  }}
                >
                  {isRunning
                    ? `● MONITORING ${
                        liveStatus?.mode === 'all'
                          ? `ALL WORKING CHANNELS (${workingCount || monitoredChannels.length})`
                          : liveStatus?.channel_name
                      }`
                    : '○ STANDBY — READY FOR ALL CHANNELS'}
                </span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                Monitors <strong>every working Discord bridge channel simultaneously</strong>, flags live chat violations across all gamemodes, and pre-fills 1-click <code>/staff log punishment</code>.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
            <select
              value={monitorTarget}
              onChange={(e) => setMonitorTarget(e.target.value)}
              className="filter-select"
              style={{ height: '36px', fontFamily: 'var(--font-mono)', fontWeight: 700 }}
              title="Choose to monitor all working channels simultaneously or a single channel"
            >
              <option value="all">
                ★ Monitor ALL Working Channels ({presetChannels.length} Channels)
              </option>
              {presetChannels.map((ch) => (
                <option key={ch.channel_id} value={ch.channel_id}>
                  Single: {ch.name} ({ch.channel_id})
                </option>
              ))}
            </select>

            <select
              value={pollIntervalMs}
              onChange={(e) => setPollIntervalMs(Number(e.target.value))}
              className="filter-select"
              style={{ height: '36px', fontFamily: 'var(--font-mono)' }}
              title="Live polling interval"
            >
              <option value={3500}>Poll: 3.5s (Fast)</option>
              <option value={5000}>Poll: 5s (Balanced)</option>
              <option value={10000}>Poll: 10s (Eco)</option>
            </select>

            {isRunning ? (
              <button
                type="button"
                className="btn-danger"
                style={{ height: '36px' }}
                onClick={onStopLiveMonitor}
              >
                <Square size={14} /> Stop Live Radar
              </button>
            ) : (
              <button
                type="button"
                className="btn-primary"
                style={{ height: '36px' }}
                onClick={() =>
                  onStartLiveMonitor(
                    monitorTarget,
                    pollIntervalMs,
                    monitorTarget === 'all' ? presetChannels.map((p) => p.channel_id) : [monitorTarget]
                  )
                }
              >
                <Play size={14} />{' '}
                {monitorTarget === 'all' ? 'Monitor All Channels Live' : 'Start Channel Radar'}
              </button>
            )}

            <button
              type="button"
              className="btn-secondary"
              style={{ height: '36px' }}
              onClick={onToggleSoundAlerts}
              title="Toggle audio chime when a critical/high violation arrives from any channel"
            >
              {soundAlertsEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
              <span>{soundAlertsEnabled ? 'Audio Chime: ON' : 'Audio Chime: OFF'}</span>
            </button>

            {showTestTools && (
              <>
            <button
              type="button"
              className="btn-secondary"
              style={{ height: '36px' }}
              onClick={() => onSimulateLiveEvent(undefined, undefined, undefined, true)}
              title="Simulate live chat messages and flags arriving across all working channels at once"
            >
              <Zap size={14} /> Simulate All-Channel Burst
            </button>

            <button
              type="button"
              className="btn-secondary"
              style={{ height: '36px' }}
              onClick={() =>
                onSimulateLiveEvent(
                  undefined,
                  undefined,
                  selectedChannelFilter !== 'all' ? selectedChannelFilter : undefined,
                  false
                )
              }
              title="Simulate a single live message"
            >
              <Zap size={14} /> +1 Live Event
            </button>
              </>
            )}

            {(recentMessages.length > 0 || activeAlerts.length > 0) && (
              <button
                type="button"
                className="btn-secondary"
                style={{ height: '36px' }}
                onClick={onClearLiveAlerts}
              >
                <Trash2 size={14} /> Clear Feed
              </button>
            )}
          </div>
        </div>

        {/* Multi-Channel Live Health & Filter Matrix */}
        {monitoredChannels.length > 0 && (
          <div style={{ marginTop: '1.1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.65rem',
                flexWrap: 'wrap',
                gap: '0.5rem',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.73rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--text-secondary)',
                }}
              >
                ACTIVE MULTI-CHANNEL RADAR MATRIX — CLICK ANY CHANNEL TO FILTER LIVE STREAM ({monitoredChannels.length} CHANNELS)
              </span>
              {selectedChannelFilter !== 'all' && (
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ height: '24px', padding: '0 0.55rem', fontSize: '0.68rem' }}
                  onClick={() => setSelectedChannelFilter('all')}
                >
                  Show All Channels ({activeAlerts.length} Flags)
                </button>
              )}
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(215px, 1fr))',
                gap: '0.6rem',
              }}
            >
              {/* All Channels Unified Card */}
              <button
                type="button"
                onClick={() => setSelectedChannelFilter('all')}
                style={{
                  textAlign: 'left',
                  background:
                    selectedChannelFilter === 'all' ? 'var(--bg-surface)' : 'var(--bg-elevated)',
                  border: `var(--border-width) solid ${
                    selectedChannelFilter === 'all'
                      ? 'var(--accent-primary)'
                      : 'var(--border-default)'
                  }`,
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.65rem 0.8rem',
                  boxShadow: selectedChannelFilter === 'all' ? 'var(--shadow-btn)' : 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.3rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                    }}
                  >
                    ★ ALL CHANNELS
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      padding: '0.1rem 0.4rem',
                      borderRadius: 'var(--radius-xs)',
                      background: 'var(--accent-primary)',
                      color: 'var(--text-inverse)',
                    }}
                  >
                    UNIFIED
                  </span>
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.71rem',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>Seen: {liveStatus?.total_seen_live || 0}</span>
                  <span style={{ color: 'var(--sev-critical)', fontWeight: 700 }}>
                    Flags: {liveStatus?.total_flagged_live || 0}
                  </span>
                </div>
              </button>

              {monitoredChannels.map((ch) => {
                const isSelected = selectedChannelFilter === ch.channel_id;
                const statusColor =
                  ch.status === 'working'
                    ? 'var(--status-confirmed)'
                    : ch.status === 'rate_limited'
                    ? 'var(--sev-medium)'
                    : ch.status === 'unreachable'
                    ? 'var(--sev-critical)'
                    : 'var(--text-muted)';
                const statusLabel =
                  ch.status === 'working'
                    ? '● WORKING'
                    : ch.status === 'rate_limited'
                    ? '◐ RATE LIMIT'
                    : ch.status === 'unreachable'
                    ? '✕ OFFLINE'
                    : '○ READY';

                return (
                  <button
                    key={ch.channel_id}
                    type="button"
                    onClick={() =>
                      setSelectedChannelFilter(
                        selectedChannelFilter === ch.channel_id ? 'all' : ch.channel_id
                      )
                    }
                    title={`Filter live alerts by ${ch.channel_name} (${ch.channel_id})`}
                    style={{
                      textAlign: 'left',
                      background: isSelected ? 'var(--bg-surface)' : 'var(--bg-elevated)',
                      border: `var(--border-width) solid ${
                        isSelected ? 'var(--accent-primary)' : 'var(--border-default)'
                      }`,
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.65rem 0.8rem',
                      boxShadow: isSelected ? 'var(--shadow-btn)' : 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.3rem',
                      opacity: ch.status === 'unreachable' ? 0.65 : 1,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '0.35rem',
                      }}
                    >
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.76rem',
                          fontWeight: 700,
                          color: 'var(--text-primary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {ch.channel_name}
                      </span>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.64rem',
                          fontWeight: 700,
                          color: statusColor,
                          flexShrink: 0,
                        }}
                      >
                        {statusLabel}
                      </span>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.7rem',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <span>
                        Seen: <strong>{ch.messages_seen}</strong> · Flags:{' '}
                        <strong
                          style={{
                            color: ch.flags_detected > 0 ? 'var(--sev-critical)' : 'inherit',
                          }}
                        >
                          {ch.flags_detected}
                        </strong>
                      </span>
                      {ch.detected_gamemode && (
                        <span
                          style={{
                            fontSize: '0.63rem',
                            padding: '0.05rem 0.35rem',
                            background: 'var(--bg-input)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-xs)',
                          }}
                        >
                          {ch.detected_gamemode}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Live Telemetry Strip & Custom Test Injector */}
        <div
          style={{
            marginTop: '1rem',
            paddingTop: '0.9rem',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.85rem',
          }}
        >
          <div className="metadata-inline" style={{ gap: '1rem', flexWrap: 'wrap' }}>
            <span>
              TOTAL LIVE SEEN:{' '}
              <strong style={{ color: 'var(--text-primary)' }}>{liveStatus?.total_seen_live || 0}</strong>
            </span>
            <span className="metadata-sep">·</span>
            <span>
              TOTAL LIVE FLAGS:{' '}
              <strong style={{ color: 'var(--sev-critical)' }}>{liveStatus?.total_flagged_live || 0}</strong>
            </span>
            <span className="metadata-sep">·</span>
            <span>
              WORKING CHANNELS:{' '}
              <strong style={{ color: 'var(--status-confirmed)' }}>
                {workingCount || monitoredChannels.length} / {monitoredChannels.length}
              </strong>
            </span>
            <span className="metadata-sep">·</span>
            <span>
              LAST HEARTBEAT:{' '}
              <strong style={{ color: 'var(--text-primary)' }}>{liveStatus?.last_polled_at || '—'}</strong>
            </span>
            {liveStatus?.error && (
              <span style={{ color: 'var(--sev-critical)', fontWeight: 700 }}>
                ⚠ {liveStatus.error}
              </span>
            )}
          </div>

          {showTestTools && (
          <form
            style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', flexWrap: 'wrap' }}
            onSubmit={(e) => {
              e.preventDefault();
              if (simMessage.trim()) {
                onSimulateLiveEvent(
                  simPlayer.trim() || 'TestPlayer99',
                  simMessage.trim(),
                  selectedChannelFilter !== 'all' ? selectedChannelFilter : undefined,
                  false
                );
                setSimMessage('');
              }
            }}
          >
            <input
              type="text"
              placeholder="Player (e.g. Griefer99)"
              value={simPlayer}
              onChange={(e) => setSimPlayer(e.target.value)}
              className="search-input"
              style={{ minWidth: '140px', paddingLeft: '0.65rem', height: '32px' }}
            />
            <input
              type="text"
              placeholder="Type a test chat message to test live alert..."
              value={simMessage}
              onChange={(e) => setSimMessage(e.target.value)}
              className="search-input"
              style={{ minWidth: '250px', paddingLeft: '0.65rem', height: '32px' }}
            />
            <button type="submit" className="btn-secondary" style={{ height: '32px', padding: '0 0.7rem' }}>
              Test Message
            </button>
          </form>
          )}
        </div>
      </div>

      {/* Split Live View: Left = Real-Time Flagged Alerts | Right = Live Incoming Chat Feed */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(640px, 1fr))',
          gap: '1.25rem',
          alignItems: 'start',
        }}
      >
        {/* Priority Column: Real-Time Flagged Alerts Across All Channels */}
        <div className="preview-container">
          <div className="preview-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="preview-title-box">
              <Bell size={16} style={{ color: 'var(--sev-critical)' }} />
              <h3 className="preview-title">
                Real-Time Flagged Alerts{' '}
                {selectedChannelFilter !== 'all' ? '(Filtered Channel)' : '(All Channels)'}
              </h3>
              <span className="count-text">{filteredAlerts.length} active alerts</span>
            </div>

            {filteredAlerts.length > 0 && onBatchPunishLiveAlerts && (
              <button
                type="button"
                className="btn-danger"
                style={{
                  height: '28px',
                  padding: '0 0.65rem',
                  fontSize: '0.72rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontWeight: 700,
                }}
                onClick={() => onBatchPunishLiveAlerts(filteredAlerts)}
                title="Launch batch punishment speed runner for all active live alerts"
              >
                <Zap size={12} />
                <span>⚡ Bulk Punish All ({filteredAlerts.length})</span>
              </button>
            )}
          </div>

          <div
            style={{
              maxHeight: '580px',
              overflowY: 'auto',
              padding: '0.9rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.7rem',
            }}
          >
            {filteredAlerts.length === 0 ? (
              <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <ShieldAlert size={28} style={{ margin: '0 auto 0.5rem auto', opacity: 0.6 }} />
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                  Zero Active Live Violations
                </div>
                <div style={{ fontSize: '0.78rem', marginTop: '0.25rem' }}>
                  Click <strong>Monitor All Channels Live</strong> to poll every working Discord channel simultaneously, or click <strong>Simulate All-Channel Burst</strong> to test multi-channel flagging.
                </div>
              </div>
            ) : (
              filteredAlerts.map((alert) => (
                <div
                  key={alert.id}
                  style={{
                    background: 'var(--bg-elevated)',
                    border: 'var(--border-width) solid var(--border-default)',
                    borderLeft: `4px solid ${
                      alert.severity === 'critical'
                        ? 'var(--sev-critical)'
                        : alert.severity === 'high'
                        ? 'var(--sev-high)'
                        : 'var(--sev-medium)'
                    }`,
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.85rem 1rem',
                    boxShadow: 'var(--shadow-btn)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.45rem',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '0.5rem',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                      <span className={`severity-label ${alert.severity}`}>
                        ● {alert.severity.toUpperCase()} ({Math.round(alert.overall_score * 100)}%)
                      </span>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 700,
                          fontSize: '0.86rem',
                          color: 'var(--text-primary)',
                        }}
                      >
                        {alert.player}
                      </span>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          padding: '0.12rem 0.45rem',
                          borderRadius: 'var(--radius-xs)',
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border-default)',
                          color: 'var(--text-primary)',
                        }}
                      >
                        {alert.channel_name}
                        {alert.detected_gamemode ? ` · ${alert.detected_gamemode}` : ''}
                      </span>
                    </div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.71rem', color: 'var(--text-muted)' }}>
                      {alert.timestamp}
                    </span>
                  </div>

                  <div
                    style={{
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-xs)',
                      padding: '0.55rem 0.75rem',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                    }}
                  >
                    {alert.message}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                    }}
                  >
                    <div className="unboxed-meta-row" style={{ marginTop: 0 }}>
                      {alert.categories.map((cat, idx) => (
                        <React.Fragment key={cat}>
                          {idx > 0 && <span className="metadata-sep">·</span>}
                          <span>{cat.replace('_', ' ')}</span>
                        </React.Fragment>
                      ))}
                      {alert.reasons[0] && (
                        <>
                          <span className="metadata-sep">—</span>
                          <span>{alert.reasons[0]}</span>
                        </>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                      {alert.discord_message_url && (
                        <a
                          href={alert.discord_message_url}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-secondary"
                          style={{ height: '28px', padding: '0 0.55rem', fontSize: '0.71rem' }}
                        >
                          <ExternalLink size={11} /> Jump
                        </a>
                      )}
                      <button
                        type="button"
                        className="btn-primary"
                        style={{ height: '28px', padding: '0 0.6rem', fontSize: '0.71rem' }}
                        onClick={() => onInspectLiveAlert(alert, 'log')}
                        title="Open /staff log punishment inspector"
                      >
                        <Gavel size={11} /> Log Punishment
                      </button>
                      <button
                        type="button"
                        className="btn-danger"
                        style={{ height: '28px', padding: '0 0.6rem', fontSize: '0.71rem' }}
                        onClick={() => onInspectLiveAlert(alert, 'request')}
                        title="Open /staff request punishment inspector for higher duration"
                      >
                        <Gavel size={11} /> Request Punishment
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Stream Column: All Incoming Live Chat Stream Across Channels */}
        <div className="preview-container">
          <div className="preview-header">
            <div className="preview-title-box">
              <h3 className="preview-title">Live Incoming Chat Feed</h3>
              <span className="count-text">{displayedStream.length} messages</span>
            </div>
            <div className="toggle-group">
              <button
                type="button"
                className={`toggle-btn ${feedFilter === 'all' ? 'active' : ''}`}
                onClick={() => setFeedFilter('all')}
              >
                All Live ({channelFilteredStream.length})
              </button>
              <button
                type="button"
                className={`toggle-btn ${feedFilter === 'flagged' ? 'active' : ''}`}
                onClick={() => setFeedFilter('flagged')}
              >
                Flagged Only ({filteredAlerts.length})
              </button>
            </div>
          </div>

          <div style={{ maxHeight: '580px', overflowY: 'auto' }}>
            {displayedStream.length === 0 ? (
              <div
                style={{
                  padding: '2.5rem 1rem',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: '0.82rem',
                }}
              >
                Waiting for live messages... Click <strong>Monitor All Channels Live</strong> or{' '}
                <strong>Simulate All-Channel Burst</strong> to test.
              </div>
            ) : (
              <table className="log-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Channel</th>
                    <th>Player</th>
                    <th>Message</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedStream.map((item) => (
                    <tr
                      key={item.id}
                      className={`clickable-row ${item.is_flagged ? `sev-border-${item.severity}` : ''}`}
                      onClick={() => onInspectLiveAlert(item)}
                    >
                      <td className="col-time">{item.received_at}</td>
                      <td>
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '0.1rem 0.4rem',
                            borderRadius: 'var(--radius-xs)',
                            background: 'var(--bg-elevated)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-secondary)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {item.channel_name}
                        </span>
                      </td>
                      <td className="col-player" style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                        {item.player}
                      </td>
                      <td className="col-msg">{item.message}</td>
                      <td>
                        {item.is_flagged ? (
                          <span className={`severity-label ${item.severity}`}>{item.severity}</span>
                        ) : (
                          <span className="severity-label clean">
                            <CheckCircle2 size={11} /> Clean
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className={item.is_flagged ? 'btn-danger' : 'btn-secondary'}
                          style={{ height: '26px', padding: '0 0.55rem', fontSize: '0.7rem' }}
                          onClick={() => onInspectLiveAlert(item)}
                        >
                          {item.is_flagged ? 'Punish' : 'Inspect'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export function convertLiveItemToMessageRecord(item: LiveFeedAlertItem): MessageRecord {
  return {
    id: 0,
    timestamp: item.timestamp,
    player: item.player,
    message: item.message,
    raw_line: `[${item.timestamp}] ${item.player} » ${item.message}`,
    line_number: 1,
    discord_message_url: item.discord_message_url,
    is_flagged: item.is_flagged,
    overall_score: item.overall_score,
    rule_score: item.overall_score,
    ai_score: item.overall_score,
    severity: item.severity,
    confidence: item.confidence,
    primary_category: item.primary_category,
    categories: item.categories,
    reasons: item.reasons,
    ai_breakdown: {},
    review_status: 'unreviewed',
    moderator_notes: '',
  };
}
