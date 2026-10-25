import React from 'react';
import {
  X,
  ChevronUp,
  ChevronDown,
  Copy,
  Send,
  Link,
  Terminal,
  Maximize2,
  Minimize2,
  ExternalLink,
  Zap,
} from 'lucide-react';
import type { MessageRecord, ContextAnalysisResult } from '../types';

const LEET_PREVIEW_MAP: Record<string, string> = {
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

function computeDeobfuscatedPreview(raw: string): string {
  if (!raw) return '';
  const normalized = raw
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  const collapsed = normalized.replace(/(.)\1{2,}/g, '$1$1');
  const deLeeted = collapsed
    .split('')
    .map((c) => LEET_PREVIEW_MAP[c] ?? c)
    .join('');
  return deLeeted.replace(/(?<=\b[a-z])[\s.\-_/\\*~]+(?=[a-z]\b)/g, '');
}

interface CaseInspectorPanelProps {
  activeMessage: MessageRecord;
  contextData: ContextAnalysisResult | null;
  isLoadingContext: boolean;
  moderatorNoteInput: string;
  setModeratorNoteInput: (val: string) => void;
  staffActionMode?: 'log' | 'request';
  setStaffActionMode?: (val: 'log' | 'request') => void;
  punishmentType: string;
  setPunishmentType: (val: string) => void;
  punishmentDuration: string;
  setPunishmentDuration: (val: string) => void;
  punishmentEvidenceLinks: string;
  setPunishmentEvidenceLinks: (val: string) => void;
  punishmentUsername: string;
  setPunishmentUsername: (val: string) => void;
  punishmentReason: string;
  setPunishmentReason: (val: string) => void;
  punishmentGamemode: string;
  setPunishmentGamemode: (val: string) => void;
  staffCommandChannelId: string;
  onUpdateStaffChannelId: (val: string) => void;
  isSubmittingPunishment: boolean;
  punishmentFeedback: { type: 'success' | 'error'; text: string } | null;
  copiedKey: string | null;
  onCopyText: (key: string, text: string) => void;
  onLogPunishment: (
    autoSendDiscord: boolean,
    overrideActionMode?: 'log' | 'request',
    andStepNext?: boolean
  ) => void;
  onModeratorAction: (action: 'confirmed' | 'false_positive' | 'reviewed' | 'ignored') => void;
  onClose: () => void;
  onStepCase: (direction: -1 | 1) => void;
  canStepPrev: boolean;
  canStepNext: boolean;
  isExpandedModal: boolean;
  onToggleExpandModal: () => void;
  onOpenPlayerByName: (username: string) => void;
}

export const CaseInspectorPanel: React.FC<CaseInspectorPanelProps> = ({
  activeMessage,
  contextData,
  isLoadingContext,
  moderatorNoteInput,
  setModeratorNoteInput,
  staffActionMode = 'log',
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
  onUpdateStaffChannelId,
  isSubmittingPunishment,
  punishmentFeedback,
  copiedKey,
  onCopyText,
  onLogPunishment,
  onModeratorAction,
  onClose,
  onStepCase,
  canStepPrev,
  canStepNext,
  isExpandedModal,
  onToggleExpandModal,
  onOpenPlayerByName,
}) => {
  const isRequestMode = staffActionMode === 'request';
  const activeSlashCmd = isRequestMode ? '/staff request punishment' : '/staff log punishment';
  const deobfuscatedText = computeDeobfuscatedPreview(activeMessage.message);
  const showDeobfuscatedDiff =
    deobfuscatedText &&
    deobfuscatedText !== activeMessage.message.toLowerCase().trim();

  const inspectorInner = (
    <>
      <div className="inspector-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <h3 style={{ fontSize: '0.96rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Case Inspector · Line #{activeMessage.line_number}
            </h3>
            <span className={`severity-label ${activeMessage.is_flagged ? activeMessage.severity : 'clean'}`}>
              · {activeMessage.is_flagged ? activeMessage.severity : 'clean'} ({(activeMessage.overall_score * 100).toFixed(0)}%)
            </span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', marginTop: '0.15rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <button
              type="button"
              className="player-link-btn"
              onClick={() => onOpenPlayerByName(activeMessage.player)}
              title="Open Player Dossier"
            >
              {activeMessage.player}
            </button>
            <span className="metadata-sep">·</span>
            <span>{activeMessage.timestamp}</span>
            {activeMessage.discord_message_url && (
              <>
                <span className="metadata-sep">·</span>
                <a
                  href={activeMessage.discord_message_url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: 'var(--accent-brand)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
                >
                  Discord Jump <ExternalLink size={11} />
                </a>
              </>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <button
            type="button"
            className="btn-primary"
            style={{
              height: '28px',
              padding: '0 0.6rem',
              fontSize: '0.71rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              background: 'var(--accent-primary)',
              color: 'var(--accent-primary-text)',
            }}
            disabled={isSubmittingPunishment}
            onClick={() => onLogPunishment(false, staffActionMode, true)}
            title="Log punishment to Ledger & instantly advance to next flagged case (Shortcut: P)"
          >
            <Zap size={12} />
            <span>Fast Log &amp; Next [P]</span>
          </button>
          <button
            type="button"
            className="close-btn"
            disabled={!canStepPrev}
            onClick={() => onStepCase(-1)}
            title="Previous Message in Queue (K)"
            style={{ opacity: canStepPrev ? 1 : 0.35 }}
          >
            <ChevronUp size={16} />
          </button>
          <button
            type="button"
            className="close-btn"
            disabled={!canStepNext}
            onClick={() => onStepCase(1)}
            title="Next Message in Queue (J)"
            style={{ opacity: canStepNext ? 1 : 0.35 }}
          >
            <ChevronDown size={16} />
          </button>
          <button
            type="button"
            className="close-btn"
            onClick={onToggleExpandModal}
            title={isExpandedModal ? 'Dock to Split View' : 'Expand Full Modal'}
          >
            {isExpandedModal ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
          <button
            type="button"
            className="close-btn"
            onClick={onClose}
            title="Close Inspector (Esc)"
          >
            <X size={17} />
          </button>
        </div>
      </div>

      <div className="inspector-body" key={activeMessage.id}>
        {/* Captured Evidence Specimen */}
        <div className="evidence-specimen-box">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.71rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              Captured Chat Evidence
            </span>
            <button
              type="button"
              className="inline-link-btn"
              onClick={() => onCopyText('raw-msg', activeMessage.message)}
            >
              {copiedKey === 'raw-msg' ? 'Copied' : 'Copy Text'}
            </button>
          </div>
          <div style={{ fontSize: '0.98rem', color: 'var(--text-primary)', fontWeight: 600, wordBreak: 'break-word' }}>
            "{activeMessage.message}"
          </div>
          {showDeobfuscatedDiff && (
            <div style={{ marginTop: '0.45rem', paddingTop: '0.45rem', borderTop: '1px dashed var(--border-subtle)', fontFamily: 'var(--font-mono)', fontSize: '0.73rem', color: 'var(--sev-medium)' }}>
              Normalized scan: "{deobfuscatedText}"
            </div>
          )}
          <div style={{ marginTop: '0.4rem', fontFamily: 'var(--font-mono)', fontSize: '0.71rem', color: 'var(--text-muted)', wordBreak: 'break-all' }}>
            {activeMessage.raw_line}
          </div>
        </div>

        {/* Rule vs Semantic AI Telemetry Breakdown */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.6rem' }}>
          <div style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '0.65rem 0.75rem' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Composite</div>
            <div style={{ marginTop: '0.2rem', fontFamily: 'var(--font-mono)', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {(activeMessage.overall_score * 100).toFixed(0)}%
            </div>
          </div>
          <div style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '0.65rem 0.75rem' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Rule Engine</div>
            <div style={{ marginTop: '0.2rem', fontFamily: 'var(--font-mono)', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {(activeMessage.rule_score * 100).toFixed(0)}%
            </div>
          </div>
          <div style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '0.65rem 0.75rem' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Semantic AI</div>
            <div style={{ marginTop: '0.2rem', fontFamily: 'var(--font-mono)', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {(activeMessage.ai_score * 100).toFixed(0)}%
            </div>
          </div>
        </div>

        {/* Detection Triggers */}
        {activeMessage.reasons.length > 0 && (
          <div style={{ background: 'var(--bg-input)', padding: '0.7rem 0.9rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
              Detection Signals ({activeMessage.reasons.length})
            </div>
            {activeMessage.reasons.map((r, ri) => (
              <div key={ri} className="reason-line">
                · {r}
              </div>
            ))}
          </div>
        )}

        {/* Surrounding Context Dialogue */}
        <div className="context-thread-box">
          <div className="context-thread-title">
            <span>Surrounding Chat Context (±3 lines)</span>
            {contextData && (
              <span style={{ color: 'var(--accent-brand)', fontFamily: 'var(--font-mono)', fontSize: '0.71rem' }}>
                {contextData.classification.replace(/_/g, ' ')}
              </span>
            )}
          </div>

          {isLoadingContext ? (
            <div style={{ textAlign: 'center', padding: '0.85rem' }}>
              <div className="spinner" style={{ margin: '0 auto' }} />
            </div>
          ) : contextData ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {contextData.preceding.map((p, pi) => (
                <div key={`prec-${pi}`} className="thread-row">
                  <span className="thread-time">{p.timestamp.split(' ').pop()}</span>
                  <span className="thread-player">{p.player}</span>
                  <span style={{ color: 'var(--text-secondary)', wordBreak: 'break-word' }}>{p.message}</span>
                </div>
              ))}

              <div className="thread-row target">
                <span className="thread-time">{contextData.target.timestamp.split(' ').pop()}</span>
                <span className="thread-player">{contextData.target.player}</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600, wordBreak: 'break-word' }}>
                  {contextData.target.message}
                </span>
              </div>

              {contextData.succeeding.map((s, si) => (
                <div key={`succ-${si}`} className="thread-row">
                  <span className="thread-time">{s.timestamp.split(' ').pop()}</span>
                  <span className="thread-player">{s.player}</span>
                  <span style={{ color: 'var(--text-secondary)', wordBreak: 'break-word' }}>{s.message}</span>
                </div>
              ))}

              {contextData.context_notes.length > 0 && (
                <div style={{ marginTop: '0.45rem', paddingTop: '0.45rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.73rem', color: 'var(--sev-high)' }}>
                  {contextData.context_notes.join(' ')}
                </div>
              )}
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>No surrounding context available.</p>
          )}
        </div>

        {/* AUTOMATED /STAFF LOG OR REQUEST PUNISHMENT + MODAL AUTOFILL */}
        <div className="punishment-panel" id="punishment-autofill-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.65rem', paddingBottom: '0.55rem', borderBottom: '1px solid var(--border-default)' }}>
            <span style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--text-primary)' }}>
              2-Step Discord Enforcement (<code>{activeSlashCmd}</code>)
            </span>
            <span style={{ fontSize: '0.69rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
              {isRequestMode ? 'High-Duration Request Mode' : 'Direct Moderator Log Mode'}
            </span>
          </div>

          {/* Mode Switcher: Log Punishment vs Request Punishment */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '0.45rem',
              marginBottom: '0.85rem',
              background: 'var(--bg-input)',
              padding: '0.3rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-default)',
            }}
          >
            <button
              type="button"
              onClick={() => setStaffActionMode && setStaffActionMode('log')}
              style={{
                padding: '0.45rem 0.6rem',
                borderRadius: 'var(--radius-xs)',
                border: !isRequestMode ? '1px solid var(--border-default)' : '1px solid transparent',
                background: !isRequestMode ? 'var(--accent-primary)' : 'transparent',
                color: !isRequestMode ? 'var(--text-inverse)' : 'var(--text-secondary)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.72rem',
                fontWeight: 700,
                cursor: 'pointer',
                textAlign: 'center',
              }}
              title="Standard moderator logged punishment (/staff log punishment)"
            >
              Log Punishment (/staff log)
            </button>
            <button
              type="button"
              onClick={() => {
                if (setStaffActionMode) setStaffActionMode('request');
                if (!punishmentDuration.trim()) {
                  setPunishmentDuration('Permanent');
                }
              }}
              style={{
                padding: '0.45rem 0.6rem',
                borderRadius: 'var(--radius-xs)',
                border: isRequestMode ? '1px solid var(--sev-critical)' : '1px solid transparent',
                background: isRequestMode ? 'var(--sev-critical)' : 'transparent',
                color: isRequestMode ? '#ffffff' : 'var(--text-secondary)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.72rem',
                fontWeight: 700,
                cursor: 'pointer',
                textAlign: 'center',
              }}
              title="Request higher-time punishment such as Permanent Ban or Mute (/staff request punishment)"
            >
              Request Punishment (/staff request)
            </button>
          </div>

          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.4rem' }}>
            01. Slash Command Options (<code>{activeSlashCmd}</code>)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '0.65rem', marginBottom: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.71rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                punishment_type
              </label>
              <select
                value={punishmentType}
                onChange={(e) => setPunishmentType(e.target.value)}
                className="filter-select"
                style={{ width: '100%', height: '38px', fontFamily: 'var(--font-mono)' }}
              >
                <option value="Mute">Mute</option>
                <option value="Ban">Ban</option>
                <option value="TempBan">TempBan</option>
                <option value="Warn">Warn</option>
                <option value="Kick">Kick</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.71rem', color: 'var(--text-primary)', fontWeight: 600, marginBottom: '0.25rem' }}>
                duration * (Required)
              </label>
              <input
                type="text"
                value={punishmentDuration}
                onChange={(e) => setPunishmentDuration(e.target.value)}
                placeholder={isRequestMode ? 'e.g. Permanent, 30d, 14d, 7d' : 'e.g. 1h, 12h, 1d, 7d, Perm'}
                className="token-input"
                style={{
                  borderColor: punishmentDuration.trim() ? 'var(--border-default)' : 'var(--sev-high)',
                }}
              />
            </div>
          </div>

          {/* Quick Duration Preset Bar */}
          <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
            {(isRequestMode
              ? ['Permanent', '30d', '14d', '7d', '3d', '1d', '12h']
              : ['30m', '1h', '12h', '1d', '7d', '30d', 'Permanent']
            ).map((preset) => (
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

          <div style={{ marginBottom: '0.85rem' }}>
            <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.71rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
              <span>evidence_links (Discord Message URL)</span>
              <button
                type="button"
                onClick={() => onCopyText('evidence-link', punishmentEvidenceLinks)}
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

          {/* STEP 2: MODAL FIELDS */}
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.4rem' }}>
            02. Follow-Up Sub-Menu / Modal Fields (Username, Reason, Gamemode)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', marginBottom: '0.65rem' }}>
            <div>
              <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.71rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                <span>Username</span>
                <button
                  type="button"
                  onClick={() => onCopyText('modal-user', punishmentUsername)}
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
              <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.71rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                <span>Gamemode</span>
                <button
                  type="button"
                  onClick={() => onCopyText('modal-gamemode', punishmentGamemode)}
                  className="inline-link-btn"
                >
                  {copiedKey === 'modal-gamemode' ? 'Copied' : 'Copy'}
                </button>
              </label>
              <input
                type="text"
                value={punishmentGamemode}
                onChange={(e) => setPunishmentGamemode(e.target.value)}
                placeholder="SMP, Lifesteal, BoxPvP"
                className="token-input"
              />
            </div>
          </div>

          <div style={{ marginBottom: '0.85rem' }}>
            <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.71rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
              <span>Reason</span>
              <button
                type="button"
                onClick={() => onCopyText('modal-reason', punishmentReason)}
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

          {/* Live Command Preview */}
          <div
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-xs)',
              padding: '0.5rem 0.7rem',
              marginBottom: '0.85rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontFamily: 'var(--font-mono)', fontSize: '0.71rem', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
              <Terminal size={12} style={{ flexShrink: 0, color: 'var(--text-primary)' }} />
              <span>
                {activeSlashCmd} punishment_type:{punishmentType} duration:{punishmentDuration || '<duration>'} evidence_links:{punishmentEvidenceLinks}
              </span>
            </div>
            <button
              type="button"
              className="btn-secondary"
              style={{ height: '26px', padding: '0 0.5rem', fontSize: '0.69rem' }}
              onClick={() =>
                onCopyText(
                  'slash-preview',
                  `${activeSlashCmd} punishment_type:${punishmentType} duration:${punishmentDuration || (isRequestMode ? 'Permanent' : '1d')} evidence_links:${punishmentEvidenceLinks}`
                )
              }
            >
              <Copy size={11} />
              {copiedKey === 'slash-preview' ? 'Copied' : 'Copy'}
            </button>
          </div>

          {/* Target Staff Channel & Submit Buttons */}
          <div style={{ marginBottom: '0.75rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.71rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
              <Link size={11} />
              <span>Target Staff Command Channel ID / URL</span>
            </label>
            <input
              type="text"
              value={staffCommandChannelId}
              onChange={(e) => onUpdateStaffChannelId(e.target.value)}
              placeholder="Staff Command Channel ID"
              className="token-input"
            />
          </div>

          <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', marginBottom: '0.45rem' }}>
            <button
              type="button"
              className="btn-secondary"
              style={{ flex: 1 }}
              disabled={isSubmittingPunishment}
              onClick={() => onLogPunishment(false, staffActionMode, false)}
            >
              <Copy size={13} />
              {isRequestMode ? 'Request & Copy' : 'Log & Copy'}
            </button>

            <button
              type="button"
              className={isRequestMode ? 'btn-danger' : 'btn-primary'}
              style={{ flex: 1.4 }}
              disabled={isSubmittingPunishment}
              onClick={() => onLogPunishment(true, staffActionMode, false)}
              title={`Automatically sends ${activeSlashCmd} and submits the follow-up modal (username, reason, gamemode) via your Discord Token`}
            >
              <Send size={13} />
              {isSubmittingPunishment
                ? `Executing ${activeSlashCmd} + Modal...`
                : isRequestMode
                ? 'Auto-Request in Discord'
                : 'Auto-Log in Discord'}
            </button>
          </div>

          {/* Seamless Speed-Runner Button */}
          <button
            type="button"
            className="btn-primary"
            style={{
              width: '100%',
              height: '38px',
              background: 'linear-gradient(135deg, var(--accent-primary) 0%, rgba(56, 189, 248, 0.85) 100%)',
              color: '#000000',
              fontWeight: 800,
              fontSize: '0.78rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
            }}
            disabled={isSubmittingPunishment}
            onClick={() => onLogPunishment(true, staffActionMode, true)}
            title="Auto-dispatch punishment via Discord Token and immediately advance to next flagged case (Keyboard shortcut: P)"
          >
            <Zap size={14} />
            <span>⚡ Instant Auto-Dispatch &amp; Next Case [P]</span>
          </button>

          {punishmentFeedback && (
            <div
              style={{
                marginTop: '0.75rem',
                padding: '0.55rem 0.75rem',
                borderRadius: 'var(--radius-xs)',
                fontSize: '0.74rem',
                fontFamily: 'var(--font-mono)',
                background: punishmentFeedback.type === 'success' ? 'var(--status-confirmed-bg)' : 'var(--sev-critical-bg)',
                border: `1px solid ${punishmentFeedback.type === 'success' ? 'var(--status-confirmed)' : 'var(--sev-critical-border)'}`,
                color: 'var(--text-primary)',
              }}
            >
              {punishmentFeedback.text}
            </div>
          )}
        </div>

        {/* Moderator Investigatory Notes */}
        <div>
          <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
            Moderator Case Notes
          </label>
          <textarea
            id="moderator-note-textarea"
            value={moderatorNoteInput}
            onChange={(e) => setModeratorNoteInput(e.target.value)}
            placeholder="Record investigatory notes, repeat-offender context, or appeal references..."
            style={{
              width: '100%',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.55rem 0.75rem',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-main)',
              fontSize: '0.8rem',
              minHeight: '56px',
              resize: 'vertical',
              outline: 'none',
            }}
          />
        </div>
      </div>

      {/* Quick Disposition Footer */}
      <div className="inspector-footer">
        <div style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
          Status:{' '}
          <span className={`status-text ${activeMessage.review_status}`}>
            {activeMessage.review_status.replace('_', ' ')}
          </span>
        </div>

        <div className="action-btn-group">
          <button
            type="button"
            className="btn-action confirm"
            onClick={() => onModeratorAction('confirmed')}
            title="Shortcut: C"
          >
            Confirm
          </button>
          <button
            type="button"
            className="btn-action"
            onClick={() => onModeratorAction('false_positive')}
            title="Shortcut: X"
          >
            False Positive
          </button>
          <button
            type="button"
            className="btn-action"
            onClick={() => onModeratorAction('reviewed')}
            title="Shortcut: R"
          >
            Reviewed
          </button>
          <button
            type="button"
            className="btn-action"
            onClick={() => onModeratorAction('ignored')}
          >
            Ignore
          </button>
        </div>
      </div>
    </>
  );

  if (isExpandedModal) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          {inspectorInner}
        </div>
      </div>
    );
  }

  return (
    <aside className="case-inspector-dock" aria-label="Case Inspector">
      {inspectorInner}
    </aside>
  );
};
