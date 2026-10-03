import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  UploadCloud, 
  FileText, 
  Users, 
  MessageSquare, 
  AlertTriangle, 
  RefreshCw, 
  Search, 
  Sliders,
  ShieldAlert,
  ShieldCheck,
  Flame,
  AlertOctagon,
  Download,
  BarChart2,
  X,
  Check,
  CheckCircle,
  EyeOff,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import type { LogParseResponse, MessageRecord, ContextAnalysisResult, PlayerProfile } from './types';

const API_BASE_URL = 'http://127.0.0.1:8000';

export const App: React.FC = () => {
  const [data, setData] = useState<LogParseResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [formatHint, setFormatHint] = useState<string>('auto');

  // Active Tab: 'dashboard' | 'players' | 'analytics'
  const [activeTab, setActiveTab] = useState<'dashboard' | 'players' | 'analytics'>('dashboard');

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

  // Open Message Detail Modal & Fetch Surrounding Context
  const handleOpenMessageModal = async (msg: MessageRecord) => {
    setActiveMessage(msg);
    setContextData(null);
    setModeratorNoteInput(msg.moderator_notes || '');
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
    window.open(`${API_BASE_URL}/api/v1/export/report?format=${fmt}`, '_blank');
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
      {/* Header */}
      <header className="app-header">
        <div className="brand-section">
          <div className="logo-badge" id="app-logo">
            <ShieldAlert size={28} />
          </div>
          <div>
            <h1 className="brand-title">Chat Log Moderation Analyzer</h1>
            <p className="brand-subtitle">Explainable Human-in-the-Loop Community Moderation</p>
          </div>
        </div>

        <div className="header-actions">
          {data && (
            <div className="tab-nav">
              <button 
                type="button" 
                className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
                onClick={() => setActiveTab('dashboard')}
              >
                <MessageSquare size={16} />
                Dashboard
              </button>
              <button 
                type="button" 
                className={`tab-btn ${activeTab === 'players' ? 'active' : ''}`}
                onClick={() => setActiveTab('players')}
              >
                <Users size={16} />
                Player Dossiers ({data.unique_players_count})
              </button>
              <button 
                type="button" 
                className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
                onClick={() => setActiveTab('analytics')}
              >
                <BarChart2 size={16} />
                Analytics
              </button>
            </div>
          )}

          {data && (
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button 
                type="button" 
                className="btn-secondary" 
                style={{ padding: '0.45rem 0.8rem', fontSize: '0.8rem' }}
                onClick={() => handleExport('json')}
                title="Export structured JSON report"
              >
                <Download size={14} /> JSON
              </button>
              <button 
                type="button" 
                className="btn-secondary" 
                style={{ padding: '0.45rem 0.8rem', fontSize: '0.8rem' }}
                onClick={() => handleExport('csv')}
                title="Export CSV spreadsheet report"
              >
                <Download size={14} /> CSV
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Upload Zone */}
      <section className="upload-card-wrapper">
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
            {isLoading ? <div className="spinner"></div> : <UploadCloud size={30} />}
          </div>

          <h2 className="upload-title">
            {isLoading ? 'Analyzing Log with Rule & AI Engine...' : 'Drop server chat log here, or click to browse'}
          </h2>
          <p className="upload-description">
            Supports Minecraft (Vanilla, Spigot, Paper), generic timestamps, and CSV spreadsheets with explainable dual-engine moderation.
          </p>

          <div className="file-format-tags">
            <span className="format-tag">.LOG</span>
            <span className="format-tag">.TXT</span>
            <span className="format-tag">.CSV</span>
          </div>

          <div className="upload-actions" onClick={(e) => e.stopPropagation()}>
            <button 
              type="button" 
              className="btn-primary"
              id="browse-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
            >
              <FileText size={16} />
              Browse Log File
            </button>

            <button 
              type="button" 
              className="btn-secondary"
              id="sample-log-btn"
              onClick={loadSample}
              disabled={isLoading}
            >
              <RefreshCw size={16} />
              Load Interactive Sample Log
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginLeft: '0.5rem' }}>
              <Sliders size={15} color="var(--text-secondary)" />
              <select
                id="format-selector"
                value={formatHint}
                onChange={(e) => setFormatHint(e.target.value)}
                className="filter-select"
              >
                <option value="auto">Auto-detect Format</option>
                <option value="discord">Discord Guild Export (»)</option>
                <option value="minecraft">Minecraft Vanilla/Paper</option>
                <option value="generic">Generic Text</option>
                <option value="csv">CSV Spreadsheet</option>
              </select>
            </div>
          </div>
        </div>

        {errorMessage && (
          <div className="diagnostics-box" style={{ borderColor: 'var(--accent-rose)', background: 'rgba(244, 63, 94, 0.1)', color: '#fecdd3' }} id="error-alert">
            <div className="diagnostics-title" style={{ color: 'var(--accent-rose)' }}>
              <AlertTriangle size={18} />
              Ingestion Error
            </div>
            <p>{errorMessage}</p>
          </div>
        )}
      </section>

      {/* Main Content Area */}
      {data && (
        <>
          {/* Global Stat Cards */}
          <section className="stats-grid" id="stats-summary">
            {/* Flagged Count Card */}
            <div className="stat-card alert-border" id="stat-flagged">
              <div className="stat-icon rose">
                <Flame size={22} />
              </div>
              <div className="stat-content">
                <div className="stat-label">Flagged Messages</div>
                <div className="stat-value" style={{ color: 'var(--accent-rose)' }}>
                  {data.flagged_messages_count}
                </div>
                <div className="stat-subtext">
                  {((data.flagged_messages_count / (data.messages_detected || 1)) * 100).toFixed(1)}% violation rate &bull; {data.critical_severity_count} critical
                </div>
              </div>
            </div>

            {/* Total Messages Card */}
            <div className="stat-card" id="stat-messages">
              <div className="stat-icon emerald">
                <MessageSquare size={22} />
              </div>
              <div className="stat-content">
                <div className="stat-label">Messages Analyzed</div>
                <div className="stat-value">{data.messages_detected.toLocaleString()}</div>
                <div className="stat-subtext">From {data.lines_processed.toLocaleString()} lines scanned</div>
              </div>
            </div>

            {/* Unique Players Card */}
            <div className="stat-card" id="stat-players">
              <div className="stat-icon amber">
                <Users size={22} />
              </div>
              <div className="stat-content">
                <div className="stat-label">Players Analyzed</div>
                <div className="stat-value">{data.unique_players_count}</div>
                <div className="stat-subtext">
                  {Object.values(data.player_profiles).filter(p => p.flagged_messages > 0).length} players with flags
                </div>
              </div>
            </div>

            {/* File Info Card */}
            <div className="stat-card" id="stat-file">
              <div className="stat-icon blue">
                <FileText size={22} />
              </div>
              <div className="stat-content">
                <div className="stat-label">File Processed</div>
                <div className="stat-value" style={{ fontSize: '1.15rem', wordBreak: 'break-all' }}>
                  {data.file_name}
                </div>
                <div className="stat-subtext">
                  {data.detected_format.toUpperCase()} &bull; {(data.file_size_bytes / 1024).toFixed(1)} KB
                </div>
              </div>
            </div>
          </section>

          {/* TAB 1: MODERATION DASHBOARD */}
          {activeTab === 'dashboard' && (
            <>
              {/* Category Filter Chips Bar */}
              {Object.keys(data.category_breakdown).length > 0 && (
                <section className="category-summary-bar" id="category-summary-chips">
                  <span className="category-summary-title">Categories:</span>
                  {Object.entries(data.category_breakdown).map(([cat, count]) => (
                    <span 
                      key={cat} 
                      className={`cat-pill ${selectedCategory === cat ? 'active' : ''}`}
                      onClick={() => setSelectedCategory(selectedCategory === cat ? 'all' : cat)}
                      title={`Filter by ${cat}`}
                    >
                      {cat.replace('_', ' ')}
                      <span className="cat-pill count">{count}</span>
                    </span>
                  ))}
                </section>
              )}

              {/* Table Container */}
              <section className="preview-container" id="messages-table-card">
                <div className="preview-header">
                  <div className="preview-title-box">
                    <h3 className="preview-title">Moderation Review Table</h3>
                    <span className="count-badge" id="filtered-count">
                      {totalMessages.toLocaleString()} results &bull; Page {currentPage}/{totalPages}
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
                      <option value="all">All Review Statuses</option>
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
                        <th className="col-time">Time</th>
                        <th className="col-player">Player</th>
                        <th className="col-msg">Message Content</th>
                        <th className="col-mod">Severity</th>
                        <th className="col-status">Status</th>
                        <th className="col-reasons">Key Detection Reasons</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMessages.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="empty-state">
                            No messages matching the filter criteria.
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
                              <span 
                                className="player-tag" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (data.player_profiles[msg.player]) {
                                    setActivePlayerDossier(data.player_profiles[msg.player]);
                                  }
                                }}
                                title="Click to view player dossier"
                              >
                                {msg.player}
                              </span>
                            </td>
                            <td className="col-msg">
                              <div>{msg.message}</div>
                              {msg.categories.length > 0 && (
                                <div className="category-chip-container">
                                  {msg.categories.map((cat, ci) => (
                                    <span key={ci} className={`category-chip ${cat}`}>
                                      {cat.replace('_', ' ')}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="col-mod">
                              {msg.is_flagged ? (
                                <div>
                                  <span className={`severity-badge ${msg.severity}`}>
                                    {msg.severity === 'critical' && <AlertOctagon size={12} />}
                                    {msg.severity === 'high' && <Flame size={12} />}
                                    {msg.severity}
                                  </span>
                                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                    Score: {(msg.overall_score * 100).toFixed(0)}%
                                  </div>
                                </div>
                              ) : (
                                <span className="severity-badge clean">
                                  <ShieldCheck size={12} />
                                  Clean
                                </span>
                              )}
                            </td>
                            <td className="col-status">
                              <span className={`status-badge ${msg.review_status}`}>
                                {msg.review_status.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="col-reasons">
                              {msg.reasons.length > 0 ? (
                                msg.reasons.slice(0, 2).map((r, ri) => (
                                  <div key={ri} className="reason-bullet">
                                    {r}
                                  </div>
                                ))
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>&mdash;</span>
                              )}
                              {msg.reasons.length > 2 && (
                                <span style={{ fontSize: '0.72rem', color: 'var(--accent-primary)' }}>
                                  +{msg.reasons.length - 2} more...
                                </span>
                              )}
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
                      style={{ padding: '0.4rem 0.75rem' }}
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
                      <ChevronLeft size={16} /> Prev
                    </button>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ padding: '0.4rem 0.75rem' }}
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
                      Next <ChevronRight size={16} />
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
                    <span className={`tier-badge ${profile.review_status_tier}`}>
                      {profile.review_status_tier.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="player-metrics-row">
                    <span className="metric-label">Total Messages</span>
                    <span className="metric-val">{profile.total_messages}</span>
                  </div>

                  <div className="player-metrics-row">
                    <span className="metric-label">Flagged Messages</span>
                    <span className="metric-val" style={{ color: profile.flagged_messages > 0 ? 'var(--accent-rose)' : 'inherit' }}>
                      {profile.flagged_messages} ({profile.flagged_percentage}%)
                    </span>
                  </div>

                  <div className="player-metrics-row">
                    <span className="metric-label">Avg. Toxicity</span>
                    <span className="metric-val">{(profile.average_toxicity * 100).toFixed(0)}%</span>
                  </div>

                  <div className="player-metrics-row">
                    <span className="metric-label">Severities</span>
                    <span className="metric-val" style={{ fontSize: '0.8rem' }}>
                      {profile.critical_severity_count > 0 && <span style={{ color: '#fda4af', marginRight: '6px' }}>{profile.critical_severity_count} crit</span>}
                      {profile.high_severity_count > 0 && <span style={{ color: '#f43f5e', marginRight: '6px' }}>{profile.high_severity_count} high</span>}
                      {profile.medium_severity_count > 0 && <span style={{ color: '#fbbf24', marginRight: '6px' }}>{profile.medium_severity_count} med</span>}
                      {profile.low_severity_count > 0 && <span style={{ color: '#38bdf8' }}>{profile.low_severity_count} low</span>}
                      {profile.flagged_messages === 0 && <span style={{ color: '#6ee7b7' }}>Clean</span>}
                    </span>
                  </div>

                  {profile.common_categories.length > 0 && (
                    <div style={{ marginTop: '0.75rem' }}>
                      <span className="metric-label" style={{ fontSize: '0.75rem' }}>Common violations: </span>
                      <div className="category-chip-container" style={{ display: 'inline-flex' }}>
                        {profile.common_categories.map((c, i) => (
                          <span key={i} className={`category-chip ${c}`}>{c.replace('_', ' ')}</span>
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
                <h4 className="analytics-card-title">Severity Distribution</h4>
                {['critical', 'high', 'medium', 'low'].map((sev) => {
                  const count = data.severity_breakdown[sev] || 0;
                  const pct = data.flagged_messages_count > 0 
                    ? ((count / data.flagged_messages_count) * 100).toFixed(0) 
                    : 0;
                  const colorClass = sev === 'critical' || sev === 'high' ? 'rose' : (sev === 'medium' ? 'amber' : 'cyan');
                  return (
                    <div key={sev} className="bar-row">
                      <div className="bar-meta">
                        <span style={{ textTransform: 'capitalize' }}>{sev}</span>
                        <span>{count} ({pct}%)</span>
                      </div>
                      <div className="progress-track">
                        <div className={`progress-fill ${colorClass}`} style={{ width: `${pct}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Category Breakdown Card */}
              <div className="analytics-card">
                <h4 className="analytics-card-title">Detected Categories</h4>
                {Object.entries(data.category_breakdown).map(([cat, count]) => {
                  const pct = data.flagged_messages_count > 0 
                    ? ((count / data.flagged_messages_count) * 100).toFixed(0) 
                    : 0;
                  return (
                    <div key={cat} className="bar-row">
                      <div className="bar-meta">
                        <span style={{ textTransform: 'capitalize' }}>{cat.replace('_', ' ')}</span>
                        <span>{count} ({pct}%)</span>
                      </div>
                      <div className="progress-track">
                        <div className="progress-fill indigo" style={{ width: `${pct}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Top Flagged Players */}
              <div className="analytics-card">
                <h4 className="analytics-card-title">Highest Flagged Players</h4>
                {Object.values(data.player_profiles)
                  .filter(p => p.flagged_messages > 0)
                  .sort((a, b) => b.flagged_messages - a.flagged_messages)
                  .slice(0, 5)
                  .map((p) => (
                    <div key={p.username} className="bar-row">
                      <div className="bar-meta">
                        <span style={{ fontWeight: 600 }}>{p.username}</span>
                        <span>{p.flagged_messages} flags ({p.flagged_percentage}%)</span>
                      </div>
                      <div className="progress-track">
                        <div className="progress-fill rose" style={{ width: `${Math.min(100, p.flagged_percentage * 2)}%` }}></div>
                      </div>
                    </div>
                  ))}
              </div>

              {/* Review Disposition Status */}
              <div className="analytics-card">
                <h4 className="analytics-card-title">Moderator Review Progress</h4>
                {(() => {
                  const reviewed = data.messages_preview.filter(m => m.review_status !== 'unreviewed').length;
                  const confirmed = data.messages_preview.filter(m => m.review_status === 'confirmed').length;
                  const fp = data.messages_preview.filter(m => m.review_status === 'false_positive').length;
                  const unreviewed = data.messages_preview.filter(m => m.review_status === 'unreviewed' && m.is_flagged).length;
                  return (
                    <div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                        Total Decisions Made: <strong style={{ color: '#fff' }}>{reviewed}</strong> of {data.flagged_messages_count} flagged
                      </div>
                      <div className="bar-row">
                        <div className="bar-meta">
                          <span>Confirmed Violations</span>
                          <span>{confirmed}</span>
                        </div>
                        <div className="progress-track">
                          <div className="progress-fill rose" style={{ width: `${(confirmed / (data.flagged_messages_count || 1)) * 100}%` }}></div>
                        </div>
                      </div>

                      <div className="bar-row">
                        <div className="bar-meta">
                          <span>False Positives Cleared</span>
                          <span>{fp}</span>
                        </div>
                        <div className="progress-track">
                          <div className="progress-fill emerald" style={{ width: `${(fp / (data.flagged_messages_count || 1)) * 100}%` }}></div>
                        </div>
                      </div>

                      <div className="bar-row">
                        <div className="bar-meta">
                          <span>Awaiting Review</span>
                          <span>{unreviewed}</span>
                        </div>
                        <div className="progress-track">
                          <div className="progress-fill amber" style={{ width: `${(unreviewed / (data.flagged_messages_count || 1)) * 100}%` }}></div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </section>
          )}

          {/* Parsing Errors or Warnings */}
          {data.parsing_errors.length > 0 && (
            <section className="diagnostics-box" id="parsing-errors-list">
              <div className="diagnostics-title">
                <AlertTriangle size={18} />
                Parsing Warnings ({data.parsing_errors.length})
              </div>
              <ul className="diagnostics-list">
                {data.parsing_errors.map((err, i) => (
                  <li key={i} style={{ marginBottom: '0.25rem' }}>
                    <strong>Line {err.line_number}:</strong> {err.reason} &mdash; <code>{err.raw_line}</code>
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
          <FileText size={48} className="empty-state-icon" />
          <h3>No Chat Log Ingested Yet</h3>
          <p style={{ marginTop: '0.5rem' }}>
            Upload a Minecraft or community server log file above, or click <strong>Load Interactive Sample Log</strong> to view dual-engine moderation, context analysis, and player dossiers in action.
          </p>
        </div>
      )}

      {/* PHASE 8: DETAILED MODERATION REVIEW MODAL */}
      {activeMessage && (
        <div className="modal-overlay" onClick={() => setActiveMessage(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>
                  Moderation Review &bull; #{activeMessage.line_number}
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Author: <strong style={{ color: '#fff' }}>{activeMessage.player}</strong> &bull; {activeMessage.timestamp}
                </p>
              </div>

              <button type="button" className="close-btn" onClick={() => setActiveMessage(null)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              {/* Message quote box */}
              <div style={{ background: 'rgba(255, 255, 255, 0.04)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1rem 1.25rem' }}>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.35rem', letterSpacing: '0.04em' }}>
                  Chat Message Body
                </div>
                <div style={{ fontSize: '1.1rem', color: '#fff', fontWeight: 500 }}>
                  "{activeMessage.message}"
                </div>
                <div style={{ marginTop: '0.5rem', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Raw: {activeMessage.raw_line}
                </div>
              </div>

              {/* Hybrid Scores & Explanations */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '0.85rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Overall Severity</div>
                  <div style={{ marginTop: '0.35rem' }}>
                    <span className={`severity-badge ${activeMessage.severity}`}>
                      {activeMessage.severity}
                    </span>
                    <span style={{ marginLeft: '8px', fontSize: '0.85rem', fontWeight: 600 }}>
                      Score: {(activeMessage.overall_score * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '0.85rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Rule Engine vs AI Confidence</div>
                  <div style={{ marginTop: '0.35rem', fontSize: '0.85rem' }}>
                    Rule: <strong>{(activeMessage.rule_score * 100).toFixed(0)}%</strong> &bull; AI: <strong>{(activeMessage.ai_score * 100).toFixed(0)}%</strong>
                  </div>
                </div>
              </div>

              {/* Detection Reasons */}
              <div>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                  Explainable Reasons ({activeMessage.reasons.length})
                </div>
                {activeMessage.reasons.length > 0 ? (
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                    {activeMessage.reasons.map((r, ri) => (
                      <div key={ri} className="reason-bullet" style={{ fontSize: '0.85rem' }}>
                        {r}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No automated violation triggers detected.</p>
                )}
              </div>

              {/* PHASE 5: SURROUNDING CONTEXT THREAD */}
              <div className="context-thread-box">
                <div className="context-thread-title">
                  <span>Surrounding Context Dialogue Thread</span>
                  {contextData && (
                    <span style={{ color: 'var(--accent-amber)', fontSize: '0.75rem', textTransform: 'none' }}>
                      Context: {contextData.classification.replace('_', ' ')}
                    </span>
                  )}
                </div>

                {isLoadingContext ? (
                  <div style={{ textAlign: 'center', padding: '1rem' }}>
                    <div className="spinner"></div>
                  </div>
                ) : contextData ? (
                  <div>
                    {/* Preceding Messages */}
                    {contextData.preceding.map((p, pi) => (
                      <div key={`prec-${pi}`} className="thread-row">
                        <span className="thread-time">{p.timestamp}</span>
                        <span className="thread-player">{p.player}</span>
                        <span className="thread-msg">{p.message}</span>
                      </div>
                    ))}

                    {/* Target Flagged Message */}
                    <div className="thread-row target">
                      <span className="thread-time">{contextData.target.timestamp}</span>
                      <span className="thread-player" style={{ color: 'var(--accent-rose)' }}>{contextData.target.player}</span>
                      <span className="thread-msg" style={{ color: '#fff' }}>{contextData.target.message}</span>
                    </div>

                    {/* Succeeding Messages */}
                    {contextData.succeeding.map((s, si) => (
                      <div key={`succ-${si}`} className="thread-row">
                        <span className="thread-time">{s.timestamp}</span>
                        <span className="thread-player">{s.player}</span>
                        <span className="thread-msg">{s.message}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No context available.</p>
                )}
              </div>

              {/* Moderator Notes */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                  Moderator Notes
                </label>
                <textarea
                  id="moderator-note-textarea"
                  value={moderatorNoteInput}
                  onChange={(e) => setModeratorNoteInput(e.target.value)}
                  placeholder="Add investigatory notes, context findings, or disciplinary reasoning..."
                  style={{
                    width: '100%',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.65rem 0.85rem',
                    color: '#fff',
                    fontFamily: 'var(--font-main)',
                    fontSize: '0.85rem',
                    minHeight: '65px',
                    resize: 'vertical'
                  }}
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="modal-footer">
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Current Status: <strong style={{ color: '#fff' }}>{activeMessage.review_status.replace('_', ' ')}</strong>
              </div>

              <div className="action-btn-group">
                <button 
                  type="button" 
                  className="btn-action confirm"
                  onClick={() => handleModeratorAction('confirmed')}
                >
                  <Flame size={14} /> Confirm Flag
                </button>
                <button 
                  type="button" 
                  className="btn-action fp"
                  onClick={() => handleModeratorAction('false_positive')}
                >
                  <Check size={14} /> False Positive
                </button>
                <button 
                  type="button" 
                  className="btn-action reviewed"
                  onClick={() => handleModeratorAction('reviewed')}
                >
                  <CheckCircle size={14} /> Mark Reviewed
                </button>
                <button 
                  type="button" 
                  className="btn-action ignore"
                  onClick={() => handleModeratorAction('ignored')}
                >
                  <EyeOff size={14} /> Ignore
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PHASE 9: DEDICATED PLAYER DOSSIER MODAL */}
      {activePlayerDossier && (
        <div className="modal-overlay" onClick={() => setActivePlayerDossier(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Users size={22} color="var(--accent-primary)" />
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>
                    Player Profile: {activePlayerDossier.username}
                  </h3>
                  <span className={`tier-badge ${activePlayerDossier.review_status_tier}`} style={{ marginTop: '0.2rem' }}>
                    {activePlayerDossier.review_status_tier.replace('_', ' ')}
                  </span>
                </div>
              </div>

              <button type="button" className="close-btn" onClick={() => setActivePlayerDossier(null)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div className="stats-grid" style={{ marginBottom: 0 }}>
                <div className="stat-card" style={{ padding: '1rem' }}>
                  <div className="stat-content">
                    <div className="stat-label">Total Messages</div>
                    <div className="stat-value" style={{ fontSize: '1.4rem' }}>{activePlayerDossier.total_messages}</div>
                  </div>
                </div>

                <div className="stat-card" style={{ padding: '1rem' }}>
                  <div className="stat-content">
                    <div className="stat-label">Flagged Count</div>
                    <div className="stat-value" style={{ fontSize: '1.4rem', color: activePlayerDossier.flagged_messages > 0 ? 'var(--accent-rose)' : 'inherit' }}>
                      {activePlayerDossier.flagged_messages} ({activePlayerDossier.flagged_percentage}%)
                    </div>
                  </div>
                </div>

                <div className="stat-card" style={{ padding: '1rem' }}>
                  <div className="stat-content">
                    <div className="stat-label">Avg Toxicity</div>
                    <div className="stat-value" style={{ fontSize: '1.4rem' }}>
                      {(activePlayerDossier.average_toxicity * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Player's messages in this dataset */}
              <div>
                <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                  Message History ({activePlayerDossier.username}) — {dossierMessages.length} messages
                </h4>
                <div style={{ maxHeight: '300px', overflowY: 'auto', background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                  {dossierMessages.length === 0 ? (
                    <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <div className="spinner" style={{ margin: '0 auto 0.5rem' }}></div>
                      Loading messages...
                    </div>
                  ) : dossierMessages.map(m => (
                      <div 
                        key={m.id} 
                        style={{ padding: '0.6rem 0.85rem', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      >
                        <div>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)', marginRight: '8px' }}>
                            {m.timestamp}
                          </span>
                          <span style={{ color: '#fff', fontSize: '0.85rem' }}>{m.message}</span>
                        </div>
                        {m.is_flagged ? (
                          <span className={`severity-badge ${m.severity}`} style={{ fontSize: '0.65rem' }}>
                            {m.severity}
                          </span>
                        ) : (
                          <span className="severity-badge clean" style={{ fontSize: '0.65rem' }}>clean</span>
                        )}
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
                Inspect All Messages By {activePlayerDossier.username}
              </button>

              <button 
                type="button" 
                className="btn-secondary"
                onClick={() => setActivePlayerDossier(null)}
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
