import React, { useState } from 'react';
import { Copy, Trash2, X, Search, Zap } from 'lucide-react';
import type { LogParseResponse, MessageRecord, PlayerProfile, PunishmentRecord } from '../types';

interface PlayersDossiersViewProps {
  data: LogParseResponse;
  onOpenPlayerDossier: (profile: PlayerProfile) => void;
}

export const PlayersDossiersView: React.FC<PlayersDossiersViewProps> = ({
  data,
  onOpenPlayerDossier,
}) => {
  const [playerQuery, setPlayerQuery] = useState<string>('');
  const [tierFilter, setTierFilter] = useState<string>('all');

  const allProfiles = Object.values(data.player_profiles).sort((a, b) => {
    if (b.flagged_messages !== a.flagged_messages) {
      return b.flagged_messages - a.flagged_messages;
    }
    return b.average_toxicity - a.average_toxicity;
  });

  const filteredProfiles = allProfiles.filter((p) => {
    if (tierFilter === 'flagged_only' && p.flagged_messages === 0) return false;
    if (tierFilter === 'high_priority' && p.review_status_tier !== 'high_priority_review') return false;
    if (playerQuery.trim() && !p.username.toLowerCase().includes(playerQuery.trim().toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <section>
      <div className="category-summary-bar" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span className="category-summary-title">Player Risk Filter:</span>
          {[
            { id: 'all', label: `All Players (${allProfiles.length})` },
            {
              id: 'flagged_only',
              label: `With Violations (${allProfiles.filter((p) => p.flagged_messages > 0).length})`,
            },
            {
              id: 'high_priority',
              label: `High Priority (${allProfiles.filter((p) => p.review_status_tier === 'high_priority_review').length})`,
            },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              className={`cat-filter-btn ${tierFilter === t.id ? 'active' : ''}`}
              onClick={() => setTierFilter(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="search-box">
          <Search size={14} style={{ position: 'absolute', left: '0.7rem', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Find username..."
            value={playerQuery}
            onChange={(e) => setPlayerQuery(e.target.value)}
            className="search-input"
          />
        </div>
      </div>

      <div className="players-grid" id="player-dossiers-grid">
        {filteredProfiles.map((profile, idx) => {
          const isHighRisk = profile.review_status_tier === 'high_priority_review';
          return (
            <div
              key={profile.username}
              className="player-card"
              style={{
                animationDelay: `${Math.min(idx * 25, 250)}ms`,
                borderLeft: isHighRisk
                  ? '3px solid var(--sev-critical)'
                  : profile.flagged_messages > 0
                  ? '3px solid var(--sev-medium)'
                  : undefined,
              }}
              onClick={() => onOpenPlayerDossier(profile)}
            >
              <div className="player-card-header">
                <span className="player-username">{profile.username}</span>
                <span
                  className="tier-text"
                  style={{
                    color: isHighRisk
                      ? 'var(--sev-critical)'
                      : profile.flagged_messages > 0
                      ? 'var(--sev-medium)'
                      : 'var(--text-muted)',
                  }}
                >
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
                <span className="metric-label">Severity Profile</span>
                <span className="metric-val" style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
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
                <div style={{ marginTop: '0.7rem', paddingTop: '0.6rem', borderTop: '1px solid var(--border-subtle)' }}>
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
          );
        })}
      </div>
    </section>
  );
};

interface AnalyticsWorkbenchViewProps {
  data: LogParseResponse;
  messages: MessageRecord[];
  onFilterByCategory: (cat: string) => void;
  onFilterByPlayer: (username: string) => void;
}

export const AnalyticsWorkbenchView: React.FC<AnalyticsWorkbenchViewProps> = ({
  data,
  messages,
  onFilterByCategory,
  onFilterByPlayer,
}) => {
  const sourceMsgs = data.messages_preview.length > 0 ? data.messages_preview : messages;
  const reviewed = sourceMsgs.filter((m) => m.review_status !== 'unreviewed').length;
  const confirmed = sourceMsgs.filter((m) => m.review_status === 'confirmed').length;
  const fp = sourceMsgs.filter((m) => m.review_status === 'false_positive').length;
  const unreviewed = sourceMsgs.filter((m) => m.review_status === 'unreviewed' && m.is_flagged).length;

  return (
    <section className="analytics-grid" id="analytics-section">
      {/* 01. Severity Distribution */}
      <div className="analytics-card">
        <h4 className="analytics-card-title">01. Severity Distribution</h4>
        {(['critical', 'high', 'medium', 'low'] as const).map((sev) => {
          const count = data.severity_breakdown[sev] || 0;
          const pct =
            data.flagged_messages_count > 0
              ? ((count / data.flagged_messages_count) * 100).toFixed(0)
              : 0;
          return (
            <div key={sev} className="bar-row">
              <div className="bar-meta">
                <span className={`severity-label ${sev}`}>{sev}</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>
                  {count} ({pct}%)
                </span>
              </div>
              <div className="progress-track">
                <div className={`progress-fill ${sev}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* 02. Detected Categories */}
      <div className="analytics-card">
        <h4 className="analytics-card-title">02. Detected Violation Categories</h4>
        {Object.entries(data.category_breakdown).length === 0 ? (
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>No flagged categories recorded.</p>
        ) : (
          Object.entries(data.category_breakdown).map(([cat, count]) => {
            const pct =
              data.flagged_messages_count > 0
                ? ((count / data.flagged_messages_count) * 100).toFixed(0)
                : 0;
            return (
              <div
                key={cat}
                className="bar-row"
                style={{ cursor: 'pointer' }}
                onClick={() => onFilterByCategory(cat)}
                title={`Click to filter Review Queue by ${cat}`}
              >
                <div className="bar-meta">
                  <span style={{ textTransform: 'capitalize', textDecoration: 'underline', textUnderlineOffset: '3px', textDecorationColor: 'var(--border-strong)' }}>
                    {cat.replace('_', ' ')}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>
                    {count} ({pct}%)
                  </span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 03. Highest Flagged Players */}
      <div className="analytics-card">
        <h4 className="analytics-card-title">03. Highest Flagged Offenders</h4>
        {Object.values(data.player_profiles)
          .filter((p) => p.flagged_messages > 0)
          .sort((a, b) => b.flagged_messages - a.flagged_messages)
          .slice(0, 6)
          .map((p) => (
            <div
              key={p.username}
              className="bar-row"
              style={{ cursor: 'pointer' }}
              onClick={() => onFilterByPlayer(p.username)}
              title={`Filter Review Queue by ${p.username}`}
            >
              <div className="bar-meta">
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{p.username}</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>
                  {p.flagged_messages} flags ({p.flagged_percentage}%)
                </span>
              </div>
              <div className="progress-track">
                <div
                  className={`progress-fill ${p.critical_severity_count > 0 ? 'critical' : 'high'}`}
                  style={{ width: `${Math.min(100, p.flagged_percentage * 1.5)}%` }}
                />
              </div>
            </div>
          ))}
      </div>

      {/* 04. Moderator Review Progress */}
      <div className="analytics-card">
        <h4 className="analytics-card-title">04. Moderator Triage Progress</h4>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.9rem' }}>
          Decisions Recorded:{' '}
          <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{reviewed}</strong> /{' '}
          {data.flagged_messages_count} flagged
        </div>

        <div className="bar-row">
          <div className="bar-meta">
            <span>Confirmed Violations</span>
            <span style={{ fontFamily: 'var(--font-mono)' }}>{confirmed}</span>
          </div>
          <div className="progress-track">
            <div
              className="progress-fill confirmed"
              style={{ width: `${(confirmed / (data.flagged_messages_count || 1)) * 100}%` }}
            />
          </div>
        </div>

        <div className="bar-row">
          <div className="bar-meta">
            <span>False Positives Cleared</span>
            <span style={{ fontFamily: 'var(--font-mono)' }}>{fp}</span>
          </div>
          <div className="progress-track">
            <div
              className="progress-fill muted"
              style={{ width: `${(fp / (data.flagged_messages_count || 1)) * 100}%` }}
            />
          </div>
        </div>

        <div className="bar-row">
          <div className="bar-meta">
            <span>Awaiting Review</span>
            <span style={{ fontFamily: 'var(--font-mono)' }}>{unreviewed}</span>
          </div>
          <div className="progress-track">
            <div
              className="progress-fill medium"
              style={{ width: `${(unreviewed / (data.flagged_messages_count || 1)) * 100}%` }}
            />
          </div>
        </div>
      </div>
    </section>
  );
};

interface PunishmentsLogViewProps {
  punishments: PunishmentRecord[];
  copiedKey: string | null;
  onCopyText: (key: string, text: string) => void;
  onDeletePunishment: (id: number) => void;
}

export const PunishmentsLogView: React.FC<PunishmentsLogViewProps> = ({
  punishments,
  copiedKey,
  onCopyText,
  onDeletePunishment,
}) => {
  return (
    <section className="preview-container" id="punishments-log-section">
      <div className="preview-header">
        <div className="preview-title-box">
          <h3 className="preview-title">Staff Punishment &amp; Request Case Ledger</h3>
          <span className="count-text">{punishments.length} cases</span>
        </div>
        <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
          Select any message in the Review Queue or Live Radar to execute <code>/staff log punishment</code> or <code>/staff request punishment</code>.
        </div>
      </div>

      <div className="table-wrapper">
        <table className="log-table">
          <thead>
            <tr>
              <th>Case ID &amp; Mode</th>
              <th>Username</th>
              <th>Action &amp; Duration</th>
              <th>Reason</th>
              <th>Gamemode</th>
              <th>Evidence URL</th>
              <th>Command &amp; Dispatch Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {punishments.length === 0 ? (
              <tr>
                <td colSpan={8} className="empty-state" style={{ border: 'none' }}>
                  No punishments or requests logged yet. Click <strong>Log Punishment</strong> or <strong>Request Punishment</strong> on any message.
                </td>
              </tr>
            ) : (
              punishments.map((p) => {
                const isReq =
                  p.staff_action_mode === 'request' ||
                  p.case_id.startsWith('REQ-') ||
                  p.command_string.includes('/staff request');
                return (
                  <tr key={p.id}>
                    <td className="col-line">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                        <strong style={{ color: 'var(--text-primary)' }}>{p.case_id}</strong>
                        <span
                          style={{
                            fontSize: '0.62rem',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 700,
                            padding: '0.08rem 0.35rem',
                            borderRadius: 'var(--radius-xs)',
                            background: isReq ? 'var(--sev-critical)' : 'var(--bg-elevated)',
                            color: isReq ? '#ffffff' : 'var(--text-primary)',
                            border: '1px solid var(--border-default)',
                          }}
                        >
                          {isReq ? 'REQUEST' : 'LOGGED'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.69rem', color: 'var(--text-muted)' }}>{p.created_at}</div>
                    </td>
                  <td>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {p.username}
                    </span>
                    {p.message_excerpt && (
                      <div
                        style={{
                          fontSize: '0.72rem',
                          color: 'var(--text-muted)',
                          marginTop: '0.18rem',
                          maxWidth: '180px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        "{p.message_excerpt}"
                      </div>
                    )}
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.76rem' }}>
                    <strong style={{ color: 'var(--text-primary)' }}>{p.punishment_type}</strong>
                    <span className="metadata-sep"> · </span>
                    <span style={{ color: 'var(--text-secondary)' }}>{p.duration}</span>
                  </td>
                  <td style={{ maxWidth: '220px', color: 'var(--text-primary)' }}>{p.reason}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                    {p.gamemode}
                  </td>
                  <td style={{ maxWidth: '210px', wordBreak: 'break-all', fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>
                    <a
                      href={p.evidence_links}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: 'var(--accent-brand)', textDecoration: 'underline', textUnderlineOffset: '3px' }}
                    >
                      {p.evidence_links}
                    </a>
                  </td>
                  <td style={{ maxWidth: '280px' }}>
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.71rem',
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border-subtle)',
                        padding: '0.3rem 0.5rem',
                        borderRadius: '4px',
                        color: 'var(--text-secondary)',
                        wordBreak: 'break-all',
                      }}
                    >
                      {p.command_string}
                    </div>
                    <div
                      style={{
                        marginTop: '0.22rem',
                        fontSize: '0.71rem',
                        fontFamily: 'var(--font-mono)',
                        color:
                          p.discord_status === 'sent_to_discord'
                            ? 'var(--status-confirmed)'
                            : p.discord_status === 'failed'
                            ? 'var(--sev-critical)'
                            : 'var(--text-muted)',
                      }}
                    >
                      {p.discord_detail || p.discord_status}
                    </div>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ height: '28px', padding: '0 0.55rem', fontSize: '0.71rem' }}
                        onClick={() => onCopyText(`cmd-${p.id}`, p.command_string)}
                        title="Copy /staff log punishment command"
                      >
                        <Copy size={12} />
                        {copiedKey === `cmd-${p.id}` ? 'Copied' : 'Copy'}
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ height: '28px', padding: '0 0.45rem', fontSize: '0.71rem' }}
                        onClick={() => onDeletePunishment(p.id)}
                        title="Delete record"
                      >
                        <Trash2 size={12} />
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
    </section>
  );
};

interface PlayerDossierModalProps {
  profile: PlayerProfile;
  messages: MessageRecord[];
  onClose: () => void;
  onFilterQueueByPlayer: (username: string) => void;
  onSelectMessageFromDossier: (msg: MessageRecord) => void;
  onBatchPunishPlayer?: (messages: MessageRecord[]) => void;
}

export const PlayerDossierModal: React.FC<PlayerDossierModalProps> = ({
  profile,
  messages,
  onClose,
  onFilterQueueByPlayer,
  onSelectMessageFromDossier,
  onBatchPunishPlayer,
}) => {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
              {profile.username}
            </h3>
            <span className="tier-text">{profile.review_status_tier.replace(/_/g, ' ')}</span>
          </div>

          <button type="button" className="close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <div className="stats-grid" style={{ marginBottom: 0, gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="stat-card" style={{ padding: '0.9rem' }}>
              <div className="stat-label">Total Messages</div>
              <div className="stat-value" style={{ fontSize: '1.35rem' }}>
                {profile.total_messages}
              </div>
            </div>

            <div className="stat-card" style={{ padding: '0.9rem' }}>
              <div className="stat-label">Flagged Count</div>
              <div className="stat-value" style={{ fontSize: '1.35rem' }}>
                {profile.flagged_messages} ({profile.flagged_percentage}%)
              </div>
            </div>

            <div className="stat-card" style={{ padding: '0.9rem' }}>
              <div className="stat-label">Avg Toxicity</div>
              <div className="stat-value" style={{ fontSize: '1.35rem' }}>
                {(profile.average_toxicity * 100).toFixed(0)}%
              </div>
            </div>
          </div>

          <div>
            <h4 style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.55rem' }}>
              Recorded Messages ({messages.length}) — Click any message to inspect &amp; enforce
            </h4>
            <div
              style={{
                maxHeight: '320px',
                overflowY: 'auto',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              {messages.length === 0 ? (
                <div style={{ padding: '1.25rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <div className="spinner" style={{ margin: '0 auto 0.5rem' }} />
                  Loading messages...
                </div>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className="clickable-row"
                    onClick={() => {
                      onClose();
                      onSelectMessageFromDossier(m);
                    }}
                    style={{
                      padding: '0.55rem 0.85rem',
                      borderBottom: '1px solid var(--border-subtle)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '1rem',
                    }}
                  >
                    <div>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.72rem',
                          color: 'var(--text-muted)',
                          marginRight: '10px',
                        }}
                      >
                        #{m.line_number} · {m.timestamp}
                      </span>
                      <span style={{ color: 'var(--text-primary)', fontSize: '0.82rem' }}>{m.message}</span>
                    </div>
                    <span
                      className={`severity-label ${m.is_flagged ? m.severity : 'clean'}`}
                      style={{ fontSize: '0.71rem' }}
                    >
                      {m.is_flagged ? m.severity : 'clean'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '0.45rem' }}>
            {messages.some((m) => m.is_flagged) && onBatchPunishPlayer && (
              <button
                type="button"
                className="btn-danger"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 700 }}
                onClick={() => {
                  onBatchPunishPlayer(messages.filter((m) => m.is_flagged));
                  onClose();
                }}
                title="Launch batch punishment speed runner for all flagged messages from this player"
              >
                <Zap size={13} />
                ⚡ Punish All {messages.filter((m) => m.is_flagged).length} Violations
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.45rem' }}>
            <button
              type="button"
              className="btn-primary"
              onClick={() => onFilterQueueByPlayer(profile.username)}
            >
              Filter Queue by {profile.username}
            </button>

            <button type="button" className="btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
