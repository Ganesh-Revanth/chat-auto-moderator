import React from 'react';
import { X, ChevronUp, ChevronDown, Copy, Send, ExternalLink, Zap } from 'lucide-react';
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
  /** Render as a floating sheet (used from the Live view) instead of the inline detail pane. */
  overlay?: boolean;
  onOpenPlayerByName: (username: string) => void;
}


const Ring: React.FC<{ value: number; label: string }> = ({ value, label }) => {
  const pct = Math.max(0, Math.min(1, value));
  const r = 15;
  const c = 2 * Math.PI * r;
  return (
    <div className="score">
      <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
        <circle cx="20" cy="20" r={r} fill="none" stroke="var(--line)" strokeWidth="4" />
        <circle
          className="kring"
          cx="20"
          cy="20"
          r={r}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${pct * c} ${c}`}
          transform="rotate(-90 20 20)"
        />
      </svg>
      <div>
        <b className="num">{Math.round(pct * 100)}%</b>
        <small>{label}</small>
      </div>
    </div>
  );
};

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
  overlay = false,
  onOpenPlayerByName,
}) => {
  const isRequestMode = staffActionMode === 'request';
  const activeSlashCmd = isRequestMode ? '/staff request punishment' : '/staff log punishment';
  const sev = activeMessage.is_flagged ? activeMessage.severity : 'none';
  const deobfuscatedText = computeDeobfuscatedPreview(activeMessage.message);
  const showDeobfuscatedDiff =
    deobfuscatedText && deobfuscatedText !== activeMessage.message.toLowerCase().trim();
  const commandPreview = `${activeSlashCmd} punishment_type:${punishmentType} duration:${
    punishmentDuration || (isRequestMode ? 'Permanent' : '1d')
  } evidence_links:${punishmentEvidenceLinks}`;
  const durations = isRequestMode
    ? ['Permanent', '30d', '14d', '7d', '3d', '1d', '12h']
    : ['30m', '1h', '12h', '1d', '7d', '30d', 'Permanent'];
  const status = activeMessage.review_status;

  const inner = (
    <section className={`case k-${sev}`} aria-label="Case" style={overlay ? { height: '100%' } : undefined}>
      <div className={`case-glow glow-${sev}`} aria-hidden="true" />
      <div className="case-inner" key={activeMessage.id}>
        <header className="case-head">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span className="sevpill">
                {activeMessage.is_flagged ? activeMessage.severity : 'clean'} ·{' '}
                {Math.round(activeMessage.overall_score * 100)}%
              </span>
              <span className="muted num">Line {activeMessage.line_number}</span>
            </div>
            <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em', wordBreak: 'break-word' }}>
              <button
                type="button"
                onClick={() => onOpenPlayerByName(activeMessage.player)}
                title="Open player dossier"
                style={{
                  all: 'unset',
                  cursor: 'pointer',
                  borderBottom: '1px dashed var(--hair)',
                }}
              >
                {activeMessage.player}
              </button>
            </h2>
            <div className="muted" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 13 }}>
              <span className="num">{activeMessage.timestamp}</span>
              {activeMessage.categories.map((c) => (
                <span key={c} className="tag">
                  {c.replace(/_/g, ' ')}
                </span>
              ))}
              {activeMessage.discord_message_url && (
                <a
                  href={activeMessage.discord_message_url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: 'var(--text)', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  Open in Discord <ExternalLink size={12} />
                </a>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              className="btn icon"
              disabled={!canStepPrev}
              onClick={() => onStepCase(-1)}
              title="Previous (K)"
              aria-label="Previous case"
            >
              <ChevronUp size={16} />
            </button>
            <button
              type="button"
              className="btn icon"
              disabled={!canStepNext}
              onClick={() => onStepCase(1)}
              title="Next (J)"
              aria-label="Next case"
            >
              <ChevronDown size={16} />
            </button>
            <button type="button" className="btn icon" onClick={onClose} title="Close (Esc)" aria-label="Close case">
              <X size={16} />
            </button>
          </div>
        </header>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>Message</h3>
            <button type="button" className="btn ghost sm" onClick={() => onCopyText('raw-msg', activeMessage.message)}>
              <Copy size={12} /> {copiedKey === 'raw-msg' ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="evidence">{activeMessage.message}</p>
          {showDeobfuscatedDiff && (
            <div className="code" style={{ marginTop: 12 }}>
              Normalized: {deobfuscatedText}
            </div>
          )}
          {activeMessage.raw_line && (
            <div className="code" style={{ marginTop: 10, fontSize: 11.5, opacity: 0.85 }}>
              {activeMessage.raw_line}
            </div>
          )}
        </div>

        <div className="card">
          <div className="scores">
            <Ring value={activeMessage.overall_score} label="Overall" />
            <Ring value={activeMessage.rule_score} label="Rules" />
            <Ring value={activeMessage.ai_score} label="AI" />
          </div>
          {activeMessage.reasons.length > 0 && (
            <ul
              style={{
                listStyle: 'none',
                margin: '16px 0 0',
                padding: '14px 0 0',
                borderTop: '1px solid var(--line)',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                fontSize: 13.5,
              }}
            >
              {activeMessage.reasons.map((r, ri) => (
                <li key={ri} style={{ display: 'flex', gap: 8 }}>
                  <span style={{ color: 'var(--c)' }}>•</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h3>Context</h3>
            {contextData && (
              <span className="tag">{contextData.classification.replace(/_/g, ' ')}</span>
            )}
          </div>
          {isLoadingContext ? (
            <div style={{ textAlign: 'center', padding: 16 }}>
              <span className="spinner" />
            </div>
          ) : contextData ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {contextData.preceding.map((p, pi) => (
                <div key={`p${pi}`} className="ctx muted">
                  <b>{p.player}</b>
                  <span style={{ wordBreak: 'break-word' }}>{p.message}</span>
                </div>
              ))}
              <div className="ctx on">
                <b>{contextData.target.player}</b>
                <span style={{ wordBreak: 'break-word', fontWeight: 600 }}>{contextData.target.message}</span>
              </div>
              {contextData.succeeding.map((x, si) => (
                <div key={`s${si}`} className="ctx muted">
                  <b>{x.player}</b>
                  <span style={{ wordBreak: 'break-word' }}>{x.message}</span>
                </div>
              ))}
              {contextData.context_notes.length > 0 && (
                <p className="hint" style={{ padding: '6px 14px' }}>
                  {contextData.context_notes.join(' ')}
                </p>
              )}
            </div>
          ) : (
            <p className="muted">No surrounding context available.</p>
          )}
        </div>

        <div className="card" id="punishment-autofill-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h3>Enforcement</h3>
            <div className="seg" role="group" aria-label="Action type" style={{ minWidth: 220 }}>
              <button type="button" className={!isRequestMode ? 'on' : ''} onClick={() => setStaffActionMode?.('log')}>
                Log
              </button>
              <button
                type="button"
                className={isRequestMode ? 'on' : ''}
                onClick={() => {
                  setStaffActionMode?.('request');
                  if (!punishmentDuration.trim()) setPunishmentDuration('Permanent');
                }}
              >
                Request
              </button>
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <span className="label">Punishment</span>
            <div className="chips">
              {['Mute', 'Ban', 'TempBan', 'Warn', 'Kick'].map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`chip big ${punishmentType === t ? 'on' : ''}`}
                  onClick={() => setPunishmentType(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <label className="label" htmlFor="pun-duration">
              Duration
            </label>
            <input
              id="pun-duration"
              type="text"
              className="field"
              value={punishmentDuration}
              onChange={(e) => setPunishmentDuration(e.target.value)}
              placeholder={isRequestMode ? 'e.g. Permanent, 30d, 7d' : 'e.g. 1h, 12h, 1d, 7d'}
              style={!punishmentDuration.trim() ? { borderColor: 'var(--high)' } : undefined}
            />
            <div className="chips" style={{ marginTop: 8 }}>
              {durations.map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`chip ${punishmentDuration === d ? 'on' : ''}`}
                  onClick={() => setPunishmentDuration(d)}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <label className="label" htmlFor="pun-reason">
              Reason
            </label>
            <input
              id="pun-reason"
              type="text"
              className="field"
              value={punishmentReason}
              onChange={(e) => setPunishmentReason(e.target.value)}
            />
          </div>

          <details style={{ marginTop: 14 }}>
            <summary className="muted" style={{ cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
              Details · username, gamemode, evidence, staff channel
            </summary>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
              <div>
                <label className="label" htmlFor="pun-user">
                  Username
                </label>
                <input
                  id="pun-user"
                  className="field"
                  value={punishmentUsername}
                  onChange={(e) => setPunishmentUsername(e.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor="pun-mode">
                  Gamemode
                </label>
                <input
                  id="pun-mode"
                  className="field"
                  value={punishmentGamemode}
                  onChange={(e) => setPunishmentGamemode(e.target.value)}
                  placeholder="SMP, Lifesteal, BoxPvP"
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="label" htmlFor="pun-ev">
                  Evidence link
                </label>
                <input
                  id="pun-ev"
                  className="field"
                  value={punishmentEvidenceLinks}
                  onChange={(e) => setPunishmentEvidenceLinks(e.target.value)}
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="label" htmlFor="pun-staff">
                  Staff command channel (ID or URL)
                </label>
                <input
                  id="pun-staff"
                  className="field"
                  value={staffCommandChannelId}
                  onChange={(e) => onUpdateStaffChannelId(e.target.value)}
                  placeholder="Staff command channel ID"
                />
              </div>
            </div>
          </details>

          <div className="code" style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ flex: 1, minWidth: 0 }}>{commandPreview}</span>
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => onCopyText('slash-preview', commandPreview)}
              aria-label="Copy command"
            >
              <Copy size={12} /> {copiedKey === 'slash-preview' ? 'Copied' : 'Copy'}
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
            <button
              type="button"
              className="btn primary"
              disabled={isSubmittingPunishment}
              onClick={() => onLogPunishment(false, staffActionMode, true)}
              title="Save to the punishment log, copy the command, and go to the next case"
            >
              <Zap size={14} /> {isRequestMode ? 'Request' : 'Log'} &amp; next <span className="kbd">P</span>
            </button>
            <button
              type="button"
              className="btn"
              disabled={isSubmittingPunishment}
              onClick={() => onLogPunishment(false, staffActionMode, false)}
            >
              <Copy size={14} /> {isRequestMode ? 'Request' : 'Log'} &amp; copy
            </button>
            <button
              type="button"
              className="btn"
              disabled={isSubmittingPunishment}
              onClick={() => onLogPunishment(true, staffActionMode, false)}
              title={`Send ${activeSlashCmd} to Discord with your token`}
            >
              <Send size={14} /> {isSubmittingPunishment ? 'Sending…' : 'Send to Discord'}
            </button>
            <button
              type="button"
              className="btn"
              disabled={isSubmittingPunishment}
              onClick={() => onLogPunishment(true, staffActionMode, true)}
              title="Send to Discord, then open the next flagged case"
            >
              <Send size={14} /> Send &amp; next
            </button>
          </div>

          {punishmentFeedback && (
            <div
              role="status"
              className="notice"
              style={{
                marginTop: 14,
                ['--c' as string]: punishmentFeedback.type === 'success' ? 'var(--ok)' : 'var(--crit)',
              }}
            >
              {punishmentFeedback.text}
            </div>
          )}
        </div>

        <div className="card">
          <label className="label" htmlFor="moderator-note-textarea">
            Notes
          </label>
          <textarea
            id="moderator-note-textarea"
            className="field"
            rows={3}
            value={moderatorNoteInput}
            onChange={(e) => setModeratorNoteInput(e.target.value)}
            placeholder="Context, repeat-offender history, appeal references…"
          />
        </div>
      </div>

      <div className="case-actions">
        <span className="muted" style={{ fontSize: 13, marginRight: 'auto' }}>
          Status: <b style={{ color: 'var(--text)', textTransform: 'capitalize' }}>{status.replace('_', ' ')}</b>
        </span>
        <button type="button" className="btn primary" onClick={() => onModeratorAction('confirmed')} title="Shortcut: C">
          Confirm <span className="kbd" style={{ borderColor: 'currentColor', color: 'inherit', opacity: 0.7 }}>C</span>
        </button>
        <button type="button" className="btn" onClick={() => onModeratorAction('false_positive')} title="Shortcut: X">
          False positive <span className="kbd">X</span>
        </button>
        <button type="button" className="btn" onClick={() => onModeratorAction('reviewed')} title="Shortcut: R">
          Reviewed <span className="kbd">R</span>
        </button>
        <button type="button" className="btn ghost" onClick={() => onModeratorAction('ignored')}>
          Ignore
        </button>
      </div>
    </section>
  );

  if (overlay) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div
          className="modal-content"
          style={{ width: 'min(900px, 100%)', maxHeight: '92vh', overflowY: 'auto' }}
          onClick={(e) => e.stopPropagation()}
        >
          {inner}
        </div>
      </div>
    );
  }
  return inner;
};
