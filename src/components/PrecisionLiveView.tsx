import React, { useState } from 'react';

interface LiveAttentionItem {
  id: number;
  severity: 'critical' | 'high' | 'medium';
  category: string;
  channel: string;
  time: string;
  player: string;
  message: string;
}

interface LiveChatFeedItem {
  id: string;
  time: string;
  player: string;
  message: string;
  channel: string;
  flagHint?: string;
}

const INITIAL_ATTENTION_ITEMS: LiveAttentionItem[] = [
  {
    id: 101,
    severity: 'critical',
    category: 'Threat',
    channel: 'chat-survival',
    time: '10:42',
    player: 'xX_Griefer99',
    message: 'i will find where you live and make you regret this',
  },
  {
    id: 102,
    severity: 'high',
    category: 'Harassment',
    channel: 'chat-lifesteal',
    time: '10:39',
    player: 'Cobalt_',
    message: "you're a total idiot, just uninstall the game",
  },
  {
    id: 103,
    severity: 'high',
    category: 'Advertising',
    channel: 'chat-genpvp',
    time: '10:36',
    player: 'nova_pvp',
    message: 'join discord.gg/fr33loot for free ranks!!',
  },
];

const INITIAL_CHAT_FEED: LiveChatFeedItem[] = [
  { id: '1', time: '10:48:12', player: 'Maple', message: 'anyone want to trade iron for wood?', channel: 'chat-survival' },
  { id: '2', time: '10:48:05', player: 'Riverstone', message: 'the new spawn looks great', channel: 'chat-earth' },
  { id: '3', time: '10:47:51', player: 'Pixel', message: 'who has spare hearts?', channel: 'chat-lifesteal' },
  { id: '4', time: '10:47:40', player: 'Orbit', message: 'gg that was close', channel: 'chat-genpvp' },
  { id: '5', time: '10:47:22', player: 'Jules', message: 'heading to the nether, back in 10', channel: 'chat-survival', flagHint: 'Possible low severity issue' },
  { id: '6', time: '10:47:03', player: 'Zed', message: 'new kit is so strong', channel: 'chat-random-kits' },
  { id: '7', time: '10:46:48', player: 'Cal', message: 'duel me at spawn', channel: 'chat-practice-pvp' },
  { id: '8', time: '10:46:30', player: 'Fern', message: 'just finished my town hall', channel: 'chat-earth' },
  { id: '9', time: '10:46:11', player: 'Cobalt_', message: 'you are all so bad at this', channel: 'chat-lifesteal', flagHint: 'Possible medium severity issue' },
  { id: '10', time: '10:45:55', player: 'Lio', message: 'is the market open yet?', channel: 'chat-survival' },
  { id: '11', time: '10:45:30', player: 'Sam', message: 'anyone up for pvp?', channel: 'chat-practice-pvp' },
];

interface PrecisionLiveViewProps {
  onReviewAttentionItem: (item: LiveAttentionItem) => void;
  soundAlertsEnabled: boolean;
  onToggleSoundAlerts: () => void;
}

export const PrecisionLiveView: React.FC<PrecisionLiveViewProps> = ({
  onReviewAttentionItem,
  soundAlertsEnabled,
  onToggleSoundAlerts,
}) => {
  const [attentionItems, setAttentionItems] = useState<LiveAttentionItem[]>(INITIAL_ATTENTION_ITEMS);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [selectedChannel, setSelectedChannel] = useState<string>('all');

  const channelPills = [
    { id: 'all', label: 'All channels · 3' },
    { id: 'survival', label: 'survival · 1' },
    { id: 'lifesteal', label: 'lifesteal · 1' },
    { id: 'random-kits', label: 'random-kits' },
    { id: 'practice-pvp', label: 'practice-pvp' },
    { id: 'genpvp', label: 'genpvp · 1' },
    { id: 'earth', label: 'earth' },
  ];

  const handleDismiss = (id: number) => {
    setAttentionItems((prev) => prev.filter((item) => item.id !== id));
  };

  const filteredAttention = selectedChannel === 'all'
    ? attentionItems
    : attentionItems.filter((item) => item.channel.includes(selectedChannel));

  return (
    <div className="live-view-wrap">
      {/* Header */}
      <div className="live-view-header">
        <div>
          <h1 className="live-view-title">Live</h1>
          <div className="live-view-sub">
            <span className="status-dot-green" />
            <span>
              Monitoring 6 channels · checks every 3.5 seconds · Last check 10:48:12
            </span>
          </div>
        </div>

        <div className="live-top-controls">
          {/* Audio Equalizer */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div className="equalizer-wrap">
              <span className="equalizer-bar" style={{ height: '6px' }} />
              <span className="equalizer-bar" style={{ height: '14px' }} />
              <span className="equalizer-bar" style={{ height: '9px' }} />
              <span className="equalizer-bar" style={{ height: '18px' }} />
              <span className="equalizer-bar" style={{ height: '11px' }} />
              <span className="equalizer-bar" style={{ height: '16px' }} />
              <span className="equalizer-bar" style={{ height: '8px' }} />
              <span className="equalizer-bar" style={{ height: '22px' }} />
            </div>
            <span style={{ fontSize: '0.66rem', color: '#8e8e9a' }}>Flags in the last hour</span>
          </div>

          <button
            type="button"
            className="btn-pill-dark"
            onClick={onToggleSoundAlerts}
          >
            {soundAlertsEnabled ? 'Sound on' : 'Sound off'}
          </button>

          <button
            type="button"
            className="btn-pill-white"
            onClick={() => setIsPaused((prev) => !prev)}
          >
            {isPaused ? 'Resume monitoring' : 'Pause monitoring'}
          </button>
        </div>
      </div>

      {/* Filter Pill Row */}
      <div className="filter-pills-row" style={{ marginBottom: 20 }}>
        {channelPills.map((cp) => (
          <button
            key={cp.id}
            type="button"
            className={`filter-pill ${selectedChannel === cp.id ? 'active' : ''}`}
            onClick={() => setSelectedChannel(cp.id)}
          >
            {cp.label}
          </button>
        ))}
      </div>

      {/* Two Column Grid */}
      <div className="live-two-col-grid">
        {/* Left Column: Needs your attention */}
        <div className="live-col">
          <div className="live-col-heading">
            Needs your attention · {filteredAttention.length}
          </div>

          {filteredAttention.map((item) => (
            <div
              key={item.id}
              className={`attention-card ${item.severity}`}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className={`badge-sev ${item.severity}`}>
                    {item.severity.charAt(0).toUpperCase() + item.severity.slice(1)}
                  </span>
                  <span style={{ fontSize: '0.74rem', color: '#8e8e9a' }}>
                    {item.category} · {item.channel}
                  </span>
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: '#636366' }}>
                  {item.time}
                </span>
              </div>

              <div style={{ fontSize: '0.86rem', color: '#f2f2f7', fontWeight: 500, marginBottom: 14 }}>
                <span style={{ fontWeight: 700, marginRight: 6 }}>{item.player}</span>
                <span>{item.message}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  type="button"
                  className="btn-pill-ghost"
                  onClick={() => handleDismiss(item.id)}
                >
                  Dismiss
                </button>
                <button
                  type="button"
                  className="btn-pill-white"
                  onClick={() => onReviewAttentionItem(item)}
                >
                  Review
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Right Column: Chat Feed */}
        <div className="live-col">
          <div className="live-col-heading">Chat feed</div>
          <div className="chat-feed-box">
            {INITIAL_CHAT_FEED.map((msg) => (
              <div
                key={msg.id}
                className={`chat-feed-row ${msg.flagHint ? 'flagged' : ''}`}
              >
                <span style={{ fontFamily: 'var(--font-mono)', color: '#636366', fontSize: '0.72rem' }}>
                  {msg.time}
                </span>
                <span style={{ fontWeight: 600, color: '#ffffff' }}>
                  {msg.player}
                </span>
                <div>
                  <div style={{ color: '#d1d1d6' }}>{msg.message}</div>
                  <div style={{ fontSize: '0.68rem', color: '#8e8e9a', marginTop: 2 }}>
                    <span>{msg.channel}</span>
                    {msg.flagHint && (
                      <span style={{ color: '#ffd60a', marginLeft: 8 }}>· {msg.flagHint}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
