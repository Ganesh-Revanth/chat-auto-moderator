import React from 'react';
import {
  Inbox,
  Radio,
  Users,
  BarChart2,
  ShieldAlert,
  Settings,
} from 'lucide-react';
import { BrandLogoMark } from './BrandLogoMark';

export type StudioTab =
  | 'dashboard' // Review
  | 'live'
  | 'players'
  | 'analytics'
  | 'punishments'
  | 'settings';

interface PrecisionSidebarProps {
  activeTab: StudioTab;
  onSelectTab: (tab: StudioTab) => void;
  reviewCount?: number;
  liveAlertsCount?: number;
  isConnected?: boolean;
  channelCount?: number;
}

export const PrecisionSidebar: React.FC<PrecisionSidebarProps> = ({
  activeTab,
  onSelectTab,
  reviewCount = 7,
  liveAlertsCount = 3,
  isConnected = true,
  channelCount = 6,
}) => {
  return (
    <aside className="studio-sidebar" aria-label="Studio navigation">
      <div>
        {/* Brand header matching mockup */}
        <div className="studio-brand-header">
          <BrandLogoMark size={26} />
          <span className="studio-brand-title">Moderation Studio</span>
        </div>

        {/* Navigation list */}
        <nav className="sidebar-nav-group" aria-label="Main Navigation">
          <button
            type="button"
            className={`sidebar-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => onSelectTab('dashboard')}
          >
            <div className="sidebar-nav-label">
              <Inbox size={16} />
              <span>Review</span>
            </div>
            {reviewCount > 0 && <span className="sidebar-badge">{reviewCount}</span>}
          </button>

          <button
            type="button"
            className={`sidebar-nav-item ${activeTab === 'live' ? 'active' : ''}`}
            onClick={() => onSelectTab('live')}
          >
            <div className="sidebar-nav-label">
              <Radio size={16} />
              <span>Live</span>
            </div>
            {liveAlertsCount > 0 && (
              <span className="sidebar-badge alert-pill">{liveAlertsCount} alerts</span>
            )}
          </button>

          <button
            type="button"
            className={`sidebar-nav-item ${activeTab === 'players' ? 'active' : ''}`}
            onClick={() => onSelectTab('players')}
          >
            <div className="sidebar-nav-label">
              <Users size={16} />
              <span>Players</span>
            </div>
          </button>

          <button
            type="button"
            className={`sidebar-nav-item ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => onSelectTab('analytics')}
          >
            <div className="sidebar-nav-label">
              <BarChart2 size={16} />
              <span>Analytics</span>
            </div>
          </button>

          <button
            type="button"
            className={`sidebar-nav-item ${activeTab === 'punishments' ? 'active' : ''}`}
            onClick={() => onSelectTab('punishments')}
          >
            <div className="sidebar-nav-label">
              <ShieldAlert size={16} />
              <span>Punishments</span>
            </div>
          </button>
        </nav>
      </div>

      {/* Footer with connection status & Settings button */}
      <div className="sidebar-footer">
        <div className="sidebar-connection-status">
          <span className="status-dot-green" />
          <span>
            {isConnected ? `Discord connected · ${channelCount} channels` : 'Offline'}
          </span>
        </div>

        <button
          type="button"
          className={`sidebar-settings-btn ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => onSelectTab('settings')}
        >
          <Settings size={15} />
          <span>Settings</span>
        </button>
      </div>
    </aside>
  );
};
