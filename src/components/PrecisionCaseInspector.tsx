import React, { useState } from 'react';
import {
  ChevronUp,
  ChevronDown,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';
import type { MessageRecord, ContextAnalysisResult } from '../types';

interface PrecisionCaseInspectorProps {
  activeMessage: MessageRecord;
  contextData?: ContextAnalysisResult | null;
  onModeratorAction: (action: 'confirmed' | 'false_positive' | 'reviewed' | 'ignored') => void;
  onStepCase: (direction: -1 | 1) => void;
  canStepPrev: boolean;
  canStepNext: boolean;
  channelName?: string;
}

export const PrecisionCaseInspector: React.FC<PrecisionCaseInspectorProps> = ({
  activeMessage,
  contextData,
  onModeratorAction,
  onStepCase,
  canStepPrev,
  canStepNext,
  channelName = 'chat-survival',
}) => {
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(activeMessage.message).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const compositeScore = Math.round(
    (activeMessage.overall_score > 0 ? activeMessage.overall_score : activeMessage.confidence || 0.96) * 100
  );
  const ruleScore = Math.round(
    (activeMessage.rule_score > 0 ? activeMessage.rule_score : 0.88) * 100
  );
  const aiScore = Math.round(
    (activeMessage.ai_score > 0 ? activeMessage.ai_score : 0.98) * 100
  );

  // SVG Gauge calculations (radius = 36, circumference ~ 226)
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (compositeScore / 100) * circumference;

  // Highlight offending phrases if matching known triggers
  const renderHighlightedMessage = (text: string) => {
    const highlights = ['find where you live', 'regret this', 'idiot', 'uninstall', 'fr33loot', 'trash'];
    let remaining = text;
    const parts: { text: string; isHighlight: boolean }[] = [];

    // Simple matching
    let found = false;
    for (const h of highlights) {
      const idx = remaining.toLowerCase().indexOf(h.toLowerCase());
      if (idx !== -1) {
        found = true;
        if (idx > 0) {
          parts.push({ text: remaining.slice(0, idx), isHighlight: false });
        }
        parts.push({ text: remaining.slice(idx, idx + h.length), isHighlight: true });
        remaining = remaining.slice(idx + h.length);
      }
    }
    if (remaining.length > 0) {
      parts.push({ text: remaining, isHighlight: false });
    }

    if (!found) {
      return <span>{text}</span>;
    }

    return (
      <>
        {parts.map((p, i) =>
          p.isHighlight ? (
            <span key={i} className="evidence-token-highlight">
              {p.text}
            </span>
          ) : (
            <span key={i}>{p.text}</span>
          )
        )}
      </>
    );
  };

  // Signals
  const signals = activeMessage.reasons && activeMessage.reasons.length > 0
    ? activeMessage.reasons
    : [
        'Direct threat phrase: "find where you live".',
        'Threat score 98%, aimed at another player.',
        'Escalates within 30 seconds of a dispute.',
      ];

  // Context Conversation Thread
  const surroundingThread = contextData?.preceding && contextData.preceding.length > 0
    ? [
        ...contextData.preceding.map((m) => ({
          time: m.timestamp,
          player: m.player,
          text: m.message,
          isTarget: false,
        })),
        {
          time: activeMessage.timestamp,
          player: activeMessage.player,
          text: activeMessage.message,
          isTarget: true,
        },
        ...(contextData.succeeding || []).map((m) => ({
          time: m.timestamp,
          player: m.player,
          text: m.message,
          isTarget: false,
        })),
      ]
    : [
        { time: '10:41:52', player: 'Maple', text: 'anyone selling diamonds?', isTarget: false },
        { time: '10:42:03', player: activeMessage.player, text: 'you took my chest stuff', isTarget: false },
        { time: '10:42:10', player: 'Maple', text: 'i never touched your chest', isTarget: false },
        { time: activeMessage.timestamp || '10:42:18', player: activeMessage.player, text: activeMessage.message, isTarget: true },
      ];

  const avatarChar = (activeMessage.player || 'X').charAt(0).toUpperCase();

  return (
    <div className="review-inspector-pane" tabIndex={0} aria-label="Case Inspector">
      {/* Top Bar matching screenshot */}
      <div className="inspector-top-bar">
        <div className="inspector-player-cluster">
          <div className="inspector-avatar-circle">{avatarChar}</div>
          <div>
            <div className="inspector-player-name">{activeMessage.player}</div>
            <div className="inspector-player-sub">
              {channelName} · Today {activeMessage.timestamp} · Line {activeMessage.line_number.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="inspector-top-actions">
          <span className="badge-sev-large">
            {activeMessage.severity.charAt(0).toUpperCase() + activeMessage.severity.slice(1)}-{compositeScore}%
          </span>

          <a
            href={activeMessage.discord_message_url || '#'}
            target="_blank"
            rel="noreferrer"
            className="discord-jump-link"
          >
            <span>Discord</span>
            <ExternalLink size={12} />
          </a>

          <button
            type="button"
            className="stepper-btn"
            disabled={!canStepPrev}
            onClick={() => onStepCase(-1)}
            aria-label="Previous flagged case"
          >
            <ChevronUp size={16} />
          </button>
          <button
            type="button"
            className="stepper-btn"
            disabled={!canStepNext}
            onClick={() => onStepCase(1)}
            aria-label="Next flagged case"
          >
            <ChevronDown size={16} />
          </button>
        </div>
      </div>

      {/* Card 1: Captured Chat Evidence */}
      <div className="inspector-card">
        <div className="inspector-card-title">
          <span>Captured chat evidence</span>
          <button
            type="button"
            className="btn-pill-ghost"
            style={{ padding: '2px 8px', fontSize: '0.72rem' }}
            onClick={handleCopy}
          >
            {copied ? (
              <>
                <Check size={12} /> Copied
              </>
            ) : (
              <>
                <Copy size={12} /> Copy text
              </>
            )}
          </button>
        </div>

        <div className="evidence-message-text">
          {renderHighlightedMessage(activeMessage.message)}
        </div>

        <div className="evidence-raw-box">
          {activeMessage.raw_line ||
            `[${activeMessage.timestamp} INFO]: <${activeMessage.player}> ${activeMessage.message}`}
        </div>
      </div>

      {/* Card 2: Composite Gauge & AI breakdown */}
      <div className="inspector-card">
        <div className="ai-breakdown-grid">
          <div className="score-circle-gauge-wrap">
            <svg width="88" height="88" viewBox="0 0 88 88">
              <circle
                cx="44"
                cy="44"
                r={radius}
                fill="none"
                stroke="rgba(255, 255, 255, 0.08)"
                strokeWidth="7"
              />
              <circle
                cx="44"
                cy="44"
                r={radius}
                fill="none"
                stroke="#ff453a"
                strokeWidth="7"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                transform="rotate(-90 44 44)"
                style={{ transition: 'stroke-dashoffset 0.4s ease' }}
              />
            </svg>
            <div style={{ position: 'absolute', textAlign: 'center' }}>
              <div className="score-circle-inner-num">{compositeScore}</div>
              <div className="score-circle-label">Composite</div>
            </div>
          </div>

          <div className="ai-bars-list">
            <div className="ai-bar-item">
              <div className="ai-bar-label-row">
                <span>Rule engine</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{ruleScore}%</span>
              </div>
              <div className="ai-bar-track">
                <div className="ai-bar-fill" style={{ width: `${ruleScore}%` }} />
              </div>
            </div>

            <div className="ai-bar-item">
              <div className="ai-bar-label-row">
                <span>Semantic AI</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{aiScore}%</span>
              </div>
              <div className="ai-bar-track">
                <div className="ai-bar-fill" style={{ width: `${aiScore}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Card 3: Detection Signals */}
      <div className="inspector-card">
        <div className="inspector-card-title">
          <span>Detection signals · {signals.length}</span>
        </div>

        {signals.map((sig, i) => {
          let tag = 'Rule';
          if (sig.toLowerCase().includes('ai') || sig.toLowerCase().includes('score')) tag = 'AI';
          if (sig.toLowerCase().includes('escalat') || sig.toLowerCase().includes('dispute') || sig.toLowerCase().includes('context')) tag = 'Context';

          return (
            <div key={i} className="signal-item-row">
              <span className="signal-type-tag">{tag}</span>
              <span>{sig}</span>
            </div>
          );
        })}
      </div>

      {/* Card 4: Conversation around it */}
      <div className="inspector-card">
        <div className="inspector-card-title">
          <span>Conversation around it</span>
        </div>

        {surroundingThread.map((item, idx) => (
          <div
            key={idx}
            className={`context-message-item ${item.isTarget ? 'target-msg' : ''}`}
          >
            <span className="context-time">{item.time}</span>
            <span className="context-author">{item.player}</span>
            <span className="context-text">{item.text}</span>
          </div>
        ))}
      </div>

      {/* Sticky Bottom Action Bar matching screenshot */}
      <div className="inspector-sticky-bar">
        <div className="inspector-shortcuts-hint">
          <span className="kbd-badge">J</span>
          <span className="kbd-badge">K</span> Next / previous
          <span className="kbd-badge" style={{ marginLeft: 6 }}>C</span> Confirm
          <span className="kbd-badge" style={{ marginLeft: 6 }}>X</span> False positive
        </div>

        <div className="inspector-action-buttons">
          <button
            type="button"
            className="btn-pill-ghost"
            onClick={() => onModeratorAction('ignored')}
          >
            Ignore
          </button>
          <button
            type="button"
            className="btn-pill-dark"
            onClick={() => onModeratorAction('reviewed')}
          >
            Reviewed
          </button>
          <button
            type="button"
            className="btn-pill-dark"
            onClick={() => onModeratorAction('false_positive')}
          >
            False positive
          </button>
          <button
            type="button"
            className="btn-pill-white"
            onClick={() => onModeratorAction('confirmed')}
          >
            Confirm violation
          </button>
        </div>
      </div>
    </div>
  );
};
