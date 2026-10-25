import React, { useState, useEffect } from 'react';
import {
  X,
  Zap,
  Send,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  CheckSquare,
  Square,
  Trash2,
} from 'lucide-react';
import type { MessageRecord, PunishmentRecord } from '../types';

export interface BatchPunishmentItemCandidate {
  messageId?: number;
  username: string;
  punishmentType: string;
  duration: string;
  reason: string;
  gamemode: string;
  evidenceLinks: string;
  messageExcerpt: string;
  severity: string;
  enabled: boolean;
  status: 'idle' | 'executing' | 'success' | 'error';
  statusDetail?: string;
  generatedCaseId?: string;
}

interface BatchPunishmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  messages: MessageRecord[];
  initialMode?: 'log' | 'request';
  discordToken: string;
  staffCommandChannelId: string;
  onUpdateStaffChannelId: (id: string) => void;
  detectedGamemode?: string;
  apiBaseUrl: string;
  onComplete: (createdRecords: PunishmentRecord[]) => void;
}

function inferDefaultPunishmentType(severity: string, categories: string[]): string {
  if (severity === 'critical' || categories.includes('threat') || categories.includes('doxxing')) {
    return 'Ban';
  }
  if (severity === 'high' || categories.includes('hate_speech')) {
    return 'TempBan';
  }
  if (categories.includes('spam_advertising') || severity === 'low') {
    return 'Warn';
  }
  return 'Mute';
}

function inferDefaultDuration(punishmentType: string, isRequest: boolean): string {
  if (isRequest) return 'Permanent';
  if (punishmentType === 'Ban') return 'Permanent';
  if (punishmentType === 'TempBan') return '7d';
  if (punishmentType === 'Warn' || punishmentType === 'Kick') return '1h';
  return '1d';
}

function inferReasonFromMessage(msg: MessageRecord): string {
  if (msg.reasons && msg.reasons.length > 0) {
    return msg.reasons[0].slice(0, 90);
  }
  if (msg.categories && msg.categories.length > 0) {
    return msg.categories
      .map((c) => c.replace(/_/g, ' '))
      .join(', ')
      .slice(0, 90);
  }
  return 'In-game chat violation';
}

export const BatchPunishmentModal: React.FC<BatchPunishmentModalProps> = ({
  isOpen,
  onClose,
  messages,
  initialMode = 'request',
  discordToken,
  staffCommandChannelId,
  onUpdateStaffChannelId,
  detectedGamemode = 'SMP',
  apiBaseUrl,
  onComplete,
}) => {
  const [actionMode, setActionMode] = useState<'log' | 'request'>(initialMode);
  const [globalType, setGlobalType] = useState<string>(initialMode === 'request' ? 'Ban' : 'Mute');
  const [globalDuration, setGlobalDuration] = useState<string>(initialMode === 'request' ? 'Permanent' : '1d');
  const [globalGamemode, setGlobalGamemode] = useState<string>(detectedGamemode || 'SMP');
  const [useCustomReason, setUseCustomReason] = useState<boolean>(false);
  const [customReasonText, setCustomReasonText] = useState<string>('');

  const [candidates, setCandidates] = useState<BatchPunishmentItemCandidate[]>([]);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [executionProgress, setExecutionProgress] = useState<{ current: number; total: number } | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [copiedAll, setCopiedAll] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;
    const mode = initialMode || 'request';
    setActionMode(mode);
    const defaultType = mode === 'request' ? 'Ban' : 'Mute';
    const defaultDur = mode === 'request' ? 'Permanent' : '1d';
    setGlobalType(defaultType);
    setGlobalDuration(defaultDur);
    setGlobalGamemode(detectedGamemode || 'SMP');
    setUseCustomReason(false);
    setCustomReasonText('');
    setCandidates(
      messages.map((m) => {
        const pType = mode === 'request'
          ? (m.severity === 'critical' ? 'Ban' : 'TempBan')
          : inferDefaultPunishmentType(m.severity, m.categories);
        return {
          messageId: m.id,
          username: m.player || 'Player',
          punishmentType: pType,
          duration: inferDefaultDuration(pType, mode === 'request'),
          reason: inferReasonFromMessage(m),
          gamemode: detectedGamemode || 'SMP',
          evidenceLinks: m.discord_message_url || (m.raw_line ? m.raw_line.slice(0, 100) : 'discord.com'),
          messageExcerpt: m.message,
          severity: m.severity,
          enabled: true,
          status: 'idle',
        };
      })
    );
    setFeedback(null);
    setExecutionProgress(null);
  }, [isOpen, messages, initialMode, detectedGamemode]);

  if (!isOpen) return null;

  const enabledCount = candidates.filter((c) => c.enabled).length;

  const handleApplyPreset = (presetType: string, presetDuration: string, isReq: boolean = false) => {
    setActionMode(isReq ? 'request' : 'log');
    setGlobalType(presetType);
    setGlobalDuration(presetDuration);
    setCandidates((prev) =>
      prev.map((c) => ({
        ...c,
        punishmentType: presetType,
        duration: presetDuration,
      }))
    );
  };

  const removeCandidate = (index: number) => {
    setCandidates((prev) => prev.filter((_, i) => i !== index));
  };

  const handleApplyDurationToAll = (dur: string) => {
    setGlobalDuration(dur);
    setCandidates((prev) =>
      prev.map((c) => ({
        ...c,
        duration: dur,
      }))
    );
  };

  const handleApplyGlobalChanges = () => {
    setCandidates((prev) =>
      prev.map((c) => ({
        ...c,
        punishmentType: globalType,
        duration: globalDuration,
        gamemode: globalGamemode,
        reason: useCustomReason && customReasonText.trim() ? customReasonText.trim() : c.reason,
      }))
    );
  };

  const toggleCandidate = (index: number) => {
    setCandidates((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], enabled: !copy[index].enabled };
      return copy;
    });
  };

  const toggleAll = () => {
    const allEnabled = candidates.every((c) => c.enabled);
    setCandidates((prev) => prev.map((c) => ({ ...c, enabled: !allEnabled })));
  };

  const handleCopyAllSlashCommands = () => {
    const active = candidates.filter((c) => c.enabled);
    if (active.length === 0) return;

    const commands = active
      .map(
        (c) =>
          `/staff ${actionMode} punishment punishment_type:${c.punishmentType} duration:${c.duration} evidence_links:${c.evidenceLinks}`
      )
      .join('\n');

    try {
      navigator.clipboard.writeText(commands);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2500);
    } catch {
      // ignore clipboard error
    }
  };

  const handleExecuteBatch = async (autoSendDiscord: boolean) => {
    const targets = candidates.filter((c) => c.enabled);
    if (targets.length === 0) {
      setFeedback({ type: 'error', message: 'No candidates selected for punishment.' });
      return;
    }

    if (autoSendDiscord) {
      if (!discordToken.trim()) {
        setFeedback({
          type: 'error',
          message: 'Discord Token is required in Stream Configuration to auto-send to Discord.',
        });
        return;
      }
      if (!staffCommandChannelId.trim()) {
        setFeedback({
          type: 'error',
          message: 'Staff Command Channel ID is required to auto-send to Discord.',
        });
        return;
      }
    }

    setIsExecuting(true);
    setFeedback(null);
    setExecutionProgress({ current: 0, total: targets.length });

    try {
      const payloadItems = targets.map((c) => ({
        message_id: c.messageId,
        staff_action_mode: actionMode,
        username: c.username,
        punishment_type: c.punishmentType,
        duration: c.duration,
        reason: c.reason,
        gamemode: c.gamemode || globalGamemode || 'SMP',
        evidence_links: c.evidenceLinks || 'discord.com',
        message_excerpt: c.messageExcerpt,
        severity: c.severity,
      }));

      const res = await fetch(`${apiBaseUrl}/api/v1/punishments/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          punishments: payloadItems,
          auto_send_discord: autoSendDiscord,
          token: discordToken.trim(),
          staff_channel_id: staffCommandChannelId.trim(),
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || `Server error: ${res.status}`);
      }

      const result = await res.json();
      const records: PunishmentRecord[] = result.records || [];
      onComplete(records);

      setCandidates((prev) =>
        prev.map((c) => {
          const matching = records.find((r) => r.message_id === c.messageId);
          if (matching) {
            return {
              ...c,
              status: matching.discord_status === 'failed' ? 'error' : 'success',
              statusDetail: matching.discord_detail,
              generatedCaseId: matching.case_id,
            };
          }
          return c;
        })
      );

      const actionWord = actionMode === 'request' ? 'punishment requests' : 'punishments';
      if (autoSendDiscord) {
        setFeedback({
          type: 'success',
          message: `Successfully processed ${records.length} ${actionWord} to Discord (#staff-commands)!`,
        });
      } else {
        setFeedback({
          type: 'success',
          message: `Logged ${records.length} ${actionWord} to Ledger! Slash commands copied to clipboard.`,
        });
        handleCopyAllSlashCommands();
      }
    } catch (e: any) {
      setFeedback({ type: 'error', message: e.message || 'Failed to dispatch batch punishments.' });
    } finally {
      setIsExecuting(false);
      setExecutionProgress(null);
    }
  };

  const isRequestMode = actionMode === 'request';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: '1080px', width: '96vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header" style={{ paddingBottom: '0.85rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span
                className="standby-badge-live"
                style={{
                  background: isRequestMode ? 'rgba(239, 68, 68, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                  color: isRequestMode ? 'var(--sev-critical)' : 'var(--accent-primary)',
                }}
              >
                <Zap size={13} />
                <span>{isRequestMode ? 'BATCH PUNISHMENT REQUESTS' : 'BATCH PUNISHMENT LOGS'}</span>
              </span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                {enabledCount} of {candidates.length} Violations Selected
              </span>
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.35rem' }}>
              {isRequestMode
                ? '⚡ Fast Batch Escalation (/staff request punishment)'
                : '⚡ Seamless Batch Enforcement (/staff log punishment)'}
            </h3>
          </div>

          <button type="button" className="close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ overflowY: 'auto', flex: 1, padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Quick Presets Bar */}
          <div style={{ background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', padding: '0.75rem 1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.73rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                  ⚡ MODE &amp; PRESETS:
                </span>
                <div className="scope-mode-toggle-group">
                  <button
                    type="button"
                    className={`scope-mode-btn ${isRequestMode ? 'active' : ''}`}
                    style={isRequestMode ? { background: 'rgba(239, 68, 68, 0.2)', borderColor: 'var(--sev-critical)', color: 'var(--sev-critical)' } : {}}
                    onClick={() => {
                      setActionMode('request');
                      setGlobalType('Ban');
                      setGlobalDuration('Permanent');
                      setCandidates((prev) =>
                        prev.map((c) => ({
                          ...c,
                          punishmentType: 'Ban',
                          duration: 'Permanent',
                        }))
                      );
                    }}
                  >
                    /staff request
                  </button>
                  <button
                    type="button"
                    className={`scope-mode-btn ${!isRequestMode ? 'active' : ''}`}
                    onClick={() => {
                      setActionMode('log');
                      setGlobalType('Mute');
                      setGlobalDuration('1d');
                      setCandidates((prev) =>
                        prev.map((c) => ({
                          ...c,
                          punishmentType: 'Mute',
                          duration: '1d',
                        }))
                      );
                    }}
                  >
                    /staff log
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                {isRequestMode ? (
                  <>
                    <button
                      type="button"
                      className="cat-filter-btn"
                      style={{ color: 'var(--sev-critical)', fontWeight: 700 }}
                      onClick={() => handleApplyPreset('Ban', 'Permanent', true)}
                      title="Set all selected to Permanent Ban Request"
                    >
                      ⚡ Perm Ban Request
                    </button>
                    <button
                      type="button"
                      className="cat-filter-btn"
                      onClick={() => handleApplyPreset('Ban', '30d', true)}
                      title="Set all selected to 30d Ban Request"
                    >
                      ⚡ 30d Ban Request
                    </button>
                    <button
                      type="button"
                      className="cat-filter-btn"
                      onClick={() => handleApplyPreset('Ban', '14d', true)}
                      title="Set all selected to 14d Ban Request"
                    >
                      ⚡ 14d Ban Request
                    </button>
                    <button
                      type="button"
                      className="cat-filter-btn"
                      onClick={() => handleApplyPreset('Ban', '7d', true)}
                      title="Set all selected to 7d Ban Request"
                    >
                      ⚡ 7d Ban Request
                    </button>
                    <button
                      type="button"
                      className="cat-filter-btn"
                      onClick={() => handleApplyPreset('Mute', 'Permanent', true)}
                      title="Set all selected to Permanent Mute Request"
                    >
                      ⚡ Perm Mute Request
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="cat-filter-btn"
                      onClick={() => handleApplyPreset('Mute', '1d', false)}
                      title="Set all selected to 1d Mute (/staff log)"
                    >
                      ⚡ Mute 1d
                    </button>
                    <button
                      type="button"
                      className="cat-filter-btn"
                      onClick={() => handleApplyPreset('Mute', '7d', false)}
                      title="Set all selected to 7d Mute (/staff log)"
                    >
                      ⚡ Mute 7d
                    </button>
                    <button
                      type="button"
                      className="cat-filter-btn"
                      onClick={() => handleApplyPreset('Mute', '2h', false)}
                      title="Set all selected to 2h Mute (/staff log)"
                    >
                      ⚡ Mute 2h
                    </button>
                    <button
                      type="button"
                      className="cat-filter-btn"
                      onClick={() => handleApplyPreset('TempBan', '7d', false)}
                      title="Set all selected to 7d TempBan (/staff log)"
                    >
                      ⚡ TempBan 7d
                    </button>
                    <button
                      type="button"
                      className="cat-filter-btn"
                      onClick={() => handleApplyPreset('Warn', '1h', false)}
                      title="Set all selected to Warn"
                    >
                      ⚡ Warn 1h
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Quick Duration Pills Bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.45rem', paddingTop: '0.45rem', borderTop: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '0.69rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                Quick Duration Sync:
              </span>
              {(isRequestMode
                ? ['Permanent', '30d', '14d', '7d', '3d', '1d', '12h']
                : ['30m', '1h', '2h', '12h', '1d', '3d', '7d', '30d', 'Permanent']
              ).map((presetDur) => (
                <button
                  key={presetDur}
                  type="button"
                  className={`preset-chip-btn ${globalDuration === presetDur ? 'active' : ''}`}
                  onClick={() => handleApplyDurationToAll(presetDur)}
                  title={`Apply ${presetDur} duration to all candidate rows`}
                  style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem' }}
                >
                  {presetDur}
                </button>
              ))}
            </div>

            {/* Template Configuration */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.65rem', alignItems: 'flex-end', marginTop: '0.65rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>
                  Action Mode
                </label>
                <select
                  value={actionMode}
                  onChange={(e) => setActionMode(e.target.value as 'log' | 'request')}
                  className="filter-select"
                  style={{ width: '100%', height: '34px', fontFamily: 'var(--font-mono)' }}
                >
                  <option value="request">/staff request punishment</option>
                  <option value="log">/staff log punishment</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>
                  Punishment Type
                </label>
                <select
                  value={globalType}
                  onChange={(e) => setGlobalType(e.target.value)}
                  className="filter-select"
                  style={{ width: '100%', height: '34px', fontFamily: 'var(--font-mono)' }}
                >
                  <option value="Ban">Ban</option>
                  <option value="Mute">Mute</option>
                  <option value="TempBan">TempBan</option>
                  <option value="Warn">Warn</option>
                  <option value="Kick">Kick</option>
                  <option value="Blacklist">Blacklist</option>
                  <option value="IP-Ban">IP-Ban</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>
                  Duration
                </label>
                <input
                  type="text"
                  value={globalDuration}
                  onChange={(e) => setGlobalDuration(e.target.value)}
                  placeholder="e.g. Permanent, 1d, 7d"
                  className="token-input"
                  style={{ height: '34px', fontSize: '0.76rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>
                  Gamemode
                </label>
                <input
                  type="text"
                  value={globalGamemode}
                  onChange={(e) => setGlobalGamemode(e.target.value)}
                  placeholder="SMP, Lifesteal, KitPvP"
                  className="token-input"
                  style={{ height: '34px', fontSize: '0.76rem' }}
                />
              </div>

              <div>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ height: '34px', width: '100%', fontSize: '0.74rem' }}
                  onClick={handleApplyGlobalChanges}
                  title="Push global type, duration, and gamemode to all candidate rows below"
                >
                  <Layers size={13} />
                  Sync to All Rows
                </button>
              </div>
            </div>

            {/* Custom Unified Reason Toggle */}
            <div style={{ marginTop: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.74rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={useCustomReason}
                  onChange={(e) => setUseCustomReason(e.target.checked)}
                />
                <span>Use custom unified reason for all candidates</span>
              </label>

              {useCustomReason && (
                <input
                  type="text"
                  value={customReasonText}
                  onChange={(e) => setCustomReasonText(e.target.value)}
                  placeholder="Enter unified reason (e.g., Repeated severe toxicity in bridge chat)"
                  className="token-input"
                  style={{ flex: 1, minWidth: '220px', height: '30px', fontSize: '0.74rem' }}
                />
              )}
            </div>
          </div>

          {/* Feedback Toast */}
          {feedback && (
            <div
              style={{
                padding: '0.65rem 0.9rem',
                borderRadius: 'var(--radius-xs)',
                fontSize: '0.78rem',
                fontFamily: 'var(--font-mono)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: feedback.type === 'success' ? 'var(--status-confirmed-bg)' : 'var(--sev-critical-bg)',
                border: `1px solid ${feedback.type === 'success' ? 'var(--status-confirmed)' : 'var(--sev-critical-border)'}`,
                color: 'var(--text-primary)',
              }}
            >
              {feedback.type === 'success' ? <CheckCircle2 size={15} style={{ color: 'var(--status-confirmed)' }} /> : <AlertTriangle size={15} style={{ color: 'var(--sev-critical)' }} />}
              <span>{feedback.message}</span>
            </div>
          )}

          {/* Execution Progress */}
          {executionProgress && (
            <div style={{ background: 'var(--bg-input)', padding: '0.65rem 0.9rem', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', fontFamily: 'var(--font-mono)', marginBottom: '0.35rem' }}>
                <span>Executing bulk Discord slash commands &amp; modals...</span>
                <span>{executionProgress.current} / {executionProgress.total}</span>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{
                    width: `${Math.min(100, (executionProgress.current / (executionProgress.total || 1)) * 100)}%`,
                    transition: 'width 0.2s ease',
                  }}
                />
              </div>
            </div>
          )}

          {/* Candidates Table */}
          <div style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
            <div style={{ padding: '0.55rem 0.85rem', background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ padding: 0, height: '20px' }}
                  onClick={toggleAll}
                  title="Toggle select all"
                >
                  {candidates.every((c) => c.enabled) ? <CheckSquare size={14} /> : <Square size={14} />}
                </button>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                  TARGET CANDIDATES ({candidates.length})
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.71rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  Target Channel:
                </span>
                <input
                  type="text"
                  value={staffCommandChannelId}
                  onChange={(e) => onUpdateStaffChannelId(e.target.value)}
                  placeholder="Staff Command Channel ID"
                  className="token-input"
                  style={{ height: '26px', fontSize: '0.71rem', width: '180px' }}
                  title="Target Discord channel for /staff commands"
                />
              </div>
            </div>

            <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
              <table className="log-table" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th style={{ width: '32px' }}></th>
                    <th style={{ width: '140px' }}>Player</th>
                    <th>Evidence &amp; Excerpt</th>
                    <th style={{ width: '110px' }}>Type</th>
                    <th style={{ width: '90px' }}>Duration</th>
                    <th style={{ width: '85px' }}>Gamemode</th>
                    <th style={{ width: '170px' }}>Reason</th>
                    <th style={{ width: '95px', textAlign: 'right' }}>Status</th>
                    <th style={{ width: '32px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.map((c, idx) => (
                    <tr
                      key={idx}
                      style={{ opacity: c.enabled ? 1 : 0.45, background: c.enabled ? undefined : 'rgba(0,0,0,0.15)' }}
                    >
                      <td>
                        <button
                          type="button"
                          className="btn-ghost"
                          style={{ padding: 0, height: '20px' }}
                          onClick={() => toggleCandidate(idx)}
                        >
                          {c.enabled ? <CheckSquare size={14} /> : <Square size={14} />}
                        </button>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                        <span style={{ color: 'var(--text-primary)' }}>{c.username}</span>
                        {c.severity && (
                          <span
                            className={`severity-label ${c.severity}`}
                            style={{ display: 'inline-block', marginLeft: '0.4rem', fontSize: '0.62rem', padding: '0.1rem 0.35rem' }}
                          >
                            {c.severity}
                          </span>
                        )}
                      </td>
                      <td>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', maxHeight: '36px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          "{c.messageExcerpt}"
                        </div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '0.15rem' }}>
                          {c.evidenceLinks}
                        </div>
                      </td>
                      <td>
                        <select
                          value={c.punishmentType}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCandidates((prev) => {
                              const copy = [...prev];
                              copy[idx] = { ...copy[idx], punishmentType: val };
                              return copy;
                            });
                          }}
                          className="filter-select"
                          style={{ height: '28px', fontSize: '0.72rem', width: '100%' }}
                        >
                          <option value="Ban">Ban</option>
                          <option value="Mute">Mute</option>
                          <option value="TempBan">TempBan</option>
                          <option value="Warn">Warn</option>
                          <option value="Kick">Kick</option>
                          <option value="Blacklist">Blacklist</option>
                          <option value="IP-Ban">IP-Ban</option>
                        </select>
                      </td>
                      <td>
                        <input
                          type="text"
                          value={c.duration}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCandidates((prev) => {
                              const copy = [...prev];
                              copy[idx] = { ...copy[idx], duration: val };
                              return copy;
                            });
                          }}
                          className="token-input"
                          style={{ height: '28px', fontSize: '0.72rem', width: '100%' }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={c.gamemode}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCandidates((prev) => {
                              const copy = [...prev];
                              copy[idx] = { ...copy[idx], gamemode: val };
                              return copy;
                            });
                          }}
                          className="token-input"
                          style={{ height: '28px', fontSize: '0.72rem', width: '100%' }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={c.reason}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCandidates((prev) => {
                              const copy = [...prev];
                              copy[idx] = { ...copy[idx], reason: val };
                              return copy;
                            });
                          }}
                          className="token-input"
                          style={{ height: '28px', fontSize: '0.72rem', width: '100%' }}
                        />
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '0.71rem' }}>
                        {c.generatedCaseId ? (
                          <span style={{ color: 'var(--status-confirmed)', fontWeight: 700 }}>
                            {c.generatedCaseId} ✓
                          </span>
                        ) : c.status === 'executing' ? (
                          <span style={{ color: 'var(--sev-medium)' }}>⏳ Sending...</span>
                        ) : c.status === 'error' ? (
                          <span style={{ color: 'var(--sev-critical)' }} title={c.statusDetail || 'Error'}>
                            ✗ Failed
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>Ready</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="btn-ghost"
                          style={{ padding: 0, height: '22px', width: '22px', color: 'var(--text-muted)' }}
                          onClick={() => removeCandidate(idx)}
                          title="Remove player from this batch"
                        >
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleCopyAllSlashCommands}
              title={`Copy all formatted /staff ${actionMode} punishment slash commands to clipboard`}
            >
              <Copy size={13} />
              {copiedAll ? 'Commands Copied!' : `Copy All Slash Commands (${enabledCount})`}
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => handleExecuteBatch(false)}
              disabled={isExecuting || enabledCount === 0}
              title="Instantly logs all punishments to ledger, generates Case IDs, marks messages confirmed, and copies slash commands"
            >
              <Clock size={13} />
              {isRequestMode ? `Save Requests to Ledger (${enabledCount})` : `Save Logs to Ledger (${enabledCount})`}
            </button>

            <button
              type="button"
              className={isRequestMode ? 'btn-danger' : 'btn-primary'}
              onClick={() => handleExecuteBatch(true)}
              disabled={isExecuting || enabledCount === 0}
              title={`Automatically executes /staff ${actionMode} punishment and submits the modal for each candidate via Discord Token`}
            >
              <Send size={13} />
              {isExecuting
                ? 'Executing Batch...'
                : isRequestMode
                ? `⚡ Auto-Request All in Discord (${enabledCount})`
                : `⚡ Auto-Log All in Discord (${enabledCount})`}
            </button>

            <button type="button" className="btn-ghost" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
