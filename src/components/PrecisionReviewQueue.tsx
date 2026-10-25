import React, { useState, useMemo } from 'react';
import { Search, ChevronDown, CheckSquare, Square } from 'lucide-react';
import type { MessageRecord } from '../types';

interface PrecisionReviewQueueProps {
  messages: MessageRecord[];
  activeMessageId: number | null;
  onSelectMessage: (msg: MessageRecord) => void;
  selectedMsgIds: number[];
  onToggleSelectMsg: (id: number) => void;
  onToggleSelectAll: () => void;
  channelName?: string;
  totalScanLimit?: number;
}

export const PrecisionReviewQueue: React.FC<PrecisionReviewQueueProps> = ({
  messages,
  activeMessageId,
  onSelectMessage,
  selectedMsgIds,
  onToggleSelectMsg,
  onToggleSelectAll,
  channelName = 'chat-survival',
  totalScanLimit = 25000,
}) => {
  const [tabSegment, setTabSegment] = useState<'to_review' | 'reviewed' | 'all'>('to_review');
  const [filterSev, setFilterSev] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Counts
  const critCount = messages.filter((m) => m.severity === 'critical').length;
  const highCount = messages.filter((m) => m.severity === 'high').length;
  const medCount = messages.filter((m) => m.severity === 'medium').length;
  const lowCount = messages.filter((m) => m.severity === 'low').length;
  const total = messages.length || 1;

  const toReviewCount = messages.filter((m) => m.review_status === 'unreviewed').length;
  const reviewedCount = messages.filter((m) => m.review_status !== 'unreviewed').length;

  const filtered = useMemo(() => {
    return messages.filter((msg) => {
      // Review status tab
      if (tabSegment === 'to_review' && msg.review_status !== 'unreviewed') return false;
      if (tabSegment === 'reviewed' && msg.review_status === 'unreviewed') return false;

      // Severity filter pill
      if (filterSev !== 'all' && msg.severity !== filterSev) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesPlayer = msg.player.toLowerCase().includes(q);
        const matchesText = msg.message.toLowerCase().includes(q);
        if (!matchesPlayer && !matchesText) return false;
      }

      return true;
    });
  }, [messages, tabSegment, filterSev, searchQuery]);

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((m) => selectedMsgIds.includes(m.id));

  return (
    <div className="review-queue-pane">
      <h1 className="review-pane-title">Review</h1>

      {/* Channel selector dropdown pill */}
      <button type="button" className="review-channel-dropdown-btn">
        <span>
          # {channelName} · Latest {totalScanLimit.toLocaleString()} messages
        </span>
        <ChevronDown size={14} />
      </button>

      {/* Stacked multi-color severity ratio bar */}
      <div className="severity-bar-stacked">
        <div className="sev-bar-segment crit" style={{ width: `${(critCount / total) * 100}%` }} />
        <div className="sev-bar-segment high" style={{ width: `${(highCount / total) * 100}%` }} />
        <div className="sev-bar-segment med" style={{ width: `${(medCount / total) * 100}%` }} />
        <div className="sev-bar-segment low" style={{ width: `${(lowCount / total) * 100}%` }} />
      </div>

      <div className="severity-counts-summary">
        <span>
          <span className="sev-dot critical" style={{ marginRight: 4 }} />
          {critCount} Critical
        </span>
        <span>
          <span className="sev-dot high" style={{ marginRight: 4 }} />
          {highCount} High
        </span>
        <span>
          <span className="sev-dot medium" style={{ marginRight: 4 }} />
          {medCount} Medium
        </span>
        <span>
          <span className="sev-dot low" style={{ marginRight: 4 }} />
          {lowCount} Low
        </span>
      </div>

      {/* Segmented tabs: To review / Reviewed / All */}
      <div className="review-tab-segments">
        <button
          type="button"
          className={`review-segment-btn ${tabSegment === 'to_review' ? 'active' : ''}`}
          onClick={() => setTabSegment('to_review')}
        >
          To review {toReviewCount}
        </button>
        <button
          type="button"
          className={`review-segment-btn ${tabSegment === 'reviewed' ? 'active' : ''}`}
          onClick={() => setTabSegment('reviewed')}
        >
          Reviewed {reviewedCount}
        </button>
        <button
          type="button"
          className={`review-segment-btn ${tabSegment === 'all' ? 'active' : ''}`}
          onClick={() => setTabSegment('all')}
        >
          All {messages.length}
        </button>
      </div>

      {/* Search Input */}
      <div className="review-search-wrap">
        <Search size={14} className="review-search-icon" />
        <input
          type="text"
          className="review-search-input"
          placeholder="Search messages or players"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Filter Pills */}
      <div className="filter-pills-row">
        {['all', 'critical', 'high', 'medium', 'low'].map((sev) => (
          <button
            key={sev}
            type="button"
            className={`filter-pill ${filterSev === sev ? 'active' : ''}`}
            onClick={() => setFilterSev(sev)}
          >
            {sev.charAt(0).toUpperCase() + sev.slice(1)}
          </button>
        ))}
      </div>

      {/* Select All Row */}
      <div className="review-select-all-line">
        <button
          type="button"
          onClick={onToggleSelectAll}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            color: 'inherit',
          }}
        >
          {allFilteredSelected ? (
            <CheckSquare size={14} style={{ color: '#ffffff' }} />
          ) : (
            <Square size={14} />
          )}
        </button>
        <span>Select all</span>
      </div>

      {/* Message Cards List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        {filtered.map((msg) => {
          const isSelected = selectedMsgIds.includes(msg.id);
          const isActive = activeMessageId === msg.id;
          const scorePercent = Math.round(
            (msg.overall_score > 0 ? msg.overall_score : msg.confidence || 0.8) * 100
          );
          const primaryCat = msg.categories[0]
            ? msg.categories[0].charAt(0).toUpperCase() + msg.categories[0].slice(1)
            : 'Flag';

          return (
            <div
              key={msg.id}
              className={`review-card-item ${isActive ? 'active' : ''}`}
              onClick={() => onSelectMessage(msg)}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSelectMsg(msg.id);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '2px 0 0 0',
                  color: isSelected ? '#ffffff' : '#636366',
                }}
              >
                {isSelected ? <CheckSquare size={15} /> : <Square size={15} />}
              </button>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="review-card-header">
                  <span className="review-card-username">{msg.player}</span>
                  <span className="review-card-time">{msg.timestamp}</span>
                </div>

                <div className="review-card-msg">{msg.message}</div>

                <div className="review-card-footer">
                  <div className="review-card-badges">
                    <span className={`badge-sev ${msg.severity}`}>
                      {msg.severity.charAt(0).toUpperCase() + msg.severity.slice(1)}
                    </span>
                    <span className="badge-cat-label">{primaryCat}</span>
                  </div>
                  <span className="review-card-score">{scorePercent}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
