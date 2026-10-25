import React, { useState } from 'react';

interface PrecisionSettingsViewProps {
  discordToken: string;
  setDiscordToken: (token: string) => void;
  staffChannel: string;
  setStaffChannel: (channel: string) => void;
  fetchLimit: number;
  setFetchLimit: (limit: number) => void;
  onlyScanNew: boolean;
  setOnlyScanNew: (val: boolean) => void;
}

export const PrecisionSettingsView: React.FC<PrecisionSettingsViewProps> = ({
  discordToken,
  setDiscordToken,
  staffChannel,
  setStaffChannel,
  fetchLimit,
  setFetchLimit,
  onlyScanNew,
  setOnlyScanNew,
}) => {
  const [showToken, setShowToken] = useState<boolean>(false);
  const [monitoredChannels, setMonitoredChannels] = useState<Record<string, boolean>>({
    'chat-survival': true,
    'chat-lifesteal': true,
    'chat-random-kits': true,
    'chat-practice-pvp': true,
    'chat-genpvp': true,
    'chat-earth': true,
  });

  const toggleChannel = (name: string) => {
    setMonitoredChannels((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  };

  const scanLimits = [500, 2500, 10000, 25000];

  return (
    <div className="settings-view-wrap">
      <h1 className="live-view-title" style={{ marginBottom: 28 }}>
        Settings
      </h1>

      {/* Section 1: Discord */}
      <div className="settings-section-title">Discord</div>
      <div className="settings-card">
        {/* Connection row */}
        <div className="settings-row">
          <div>
            <div className="settings-row-label">Connection</div>
            <div className="settings-row-sub">
              Your bot token is stored on this device only.
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: '#30d158', fontWeight: 600 }}>
            <span className="status-dot-green" />
            <span>Connected</span>
          </div>
        </div>

        {/* Bot token row */}
        <div className="settings-row">
          <div className="settings-row-label" style={{ minWidth: 140 }}>
            Bot token
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, justifyContent: 'flex-end' }}>
            <input
              type={showToken ? 'text' : 'password'}
              value={discordToken || '••••••••••••••••••••••••'}
              onChange={(e) => setDiscordToken(e.target.value)}
              placeholder="Paste Discord Bot Token"
              style={{
                background: '#1c1c22',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 8,
                padding: '7px 12px',
                color: '#ffffff',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.8rem',
                width: '100%',
                maxWidth: 280,
                outline: 'none',
              }}
            />
            <button
              type="button"
              className="btn-pill-dark"
              onClick={() => setShowToken((prev) => !prev)}
            >
              {showToken ? 'Hide' : 'Reveal'}
            </button>
          </div>
        </div>

        {/* Staff command channel */}
        <div className="settings-row">
          <div>
            <div className="settings-row-label">Staff command channel</div>
            <div className="settings-row-sub">Where /staff commands are sent.</div>
          </div>
          <select
            value={staffChannel}
            onChange={(e) => setStaffChannel(e.target.value)}
            style={{
              background: '#1c1c22',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 8,
              padding: '7px 14px',
              color: '#ffffff',
              fontSize: '0.8rem',
              outline: 'none',
              cursor: 'pointer',
              minWidth: 200,
            }}
          >
            <option value="#staff-commands">#staff-commands</option>
            <option value="#mod-logs">#mod-logs</option>
            <option value="#punishments">#punishments</option>
            <option value="#bot-alerts">#bot-alerts</option>
          </select>
        </div>
      </div>

      {/* Section 2: Channels to monitor */}
      <div className="settings-section-title">Channels to monitor</div>
      <div className="settings-card" style={{ gap: 14 }}>
        {Object.entries(monitoredChannels).map(([channelName, enabled]) => (
          <div key={channelName} className="settings-row" style={{ padding: '4px 0' }}>
            <span style={{ fontSize: '0.84rem', color: '#f2f2f7', fontWeight: 500 }}>
              {channelName}
            </span>
            <label className="ios-toggle-switch">
              <input
                type="checkbox"
                checked={enabled}
                onChange={() => toggleChannel(channelName)}
              />
              <span className="ios-slider" />
            </label>
          </div>
        ))}
      </div>

      {/* Section 3: Scanning */}
      <div className="settings-section-title">Scanning</div>
      <div className="settings-card">
        {/* Messages to scan */}
        <div className="settings-row">
          <div>
            <div className="settings-row-label">Messages to scan</div>
            <div className="settings-row-sub">How far back each scan reaches.</div>
          </div>
          <div
            style={{
              display: 'flex',
              background: '#1c1c22',
              borderRadius: 8,
              padding: 3,
              border: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            {scanLimits.map((limit) => (
              <button
                key={limit}
                type="button"
                className={`review-segment-btn ${fetchLimit === limit ? 'active' : ''}`}
                style={{ padding: '5px 12px', minWidth: 60 }}
                onClick={() => setFetchLimit(limit)}
              >
                {limit.toLocaleString()}
              </button>
            ))}
          </div>
        </div>

        {/* Only scan new messages */}
        <div className="settings-row">
          <div>
            <div className="settings-row-label">Only scan new messages</div>
            <div className="settings-row-sub">Skips messages you have already scanned.</div>
          </div>
          <label className="ios-toggle-switch">
            <input
              type="checkbox"
              checked={onlyScanNew}
              onChange={(e) => setOnlyScanNew(e.target.checked)}
            />
            <span className="ios-slider" />
          </label>
        </div>
      </div>
    </div>
  );
};
