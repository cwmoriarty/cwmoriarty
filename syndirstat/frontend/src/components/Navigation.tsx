import React from 'react';
import { ViewTab, VolumeInfo, ScanProgress } from '../types';
import { formatBytes } from '../api/client';

interface NavigationProps {
  currentTab: ViewTab;
  onTabChange: (tab: ViewTab) => void;
  volumes: VolumeInfo[];
  selectedPath: string;
  onPathChange: (path: string) => void;
  onStartScan: () => void;
  onCancelScan: () => void;
  progress: ScanProgress;
  theme: string;
  onToggleTheme: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentTab,
  onTabChange,
  volumes,
  selectedPath,
  onPathChange,
  onStartScan,
  onCancelScan,
  progress,
  theme,
  onToggleTheme,
}) => {
  // Find matching volume for capacity bar
  const activeVol = volumes.find(v => selectedPath.startsWith(v.mount_path)) || volumes[0];

  const tabs: { id: ViewTab; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'treemap', label: 'Treemap', icon: '🌳' },
    { id: 'directories', label: 'Directories', icon: '📁' },
    { id: 'files', label: 'Files', icon: '📄' },
    { id: 'filetypes', label: 'File Types', icon: '🏷️' },
    { id: 'history', label: 'History', icon: '⏱️' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ];

  return (
    <header className="app-header">
      {/* Top DSM Title Bar */}
      <div className="dsm-bar">
        <div className="dsm-brand">
          <div className="dsm-logo-icon">🌳</div>
          <div className="dsm-app-name">SynDirStat</div>
          <span className="dsm-version-badge">DSM 7 Native</span>
        </div>

        {/* Volume Capacity Gauge */}
        {activeVol && activeVol.total_bytes > 0 && (
          <div className="vol-capacity-box">
            <div className="vol-cap-label">
              <span>{activeVol.name}</span>
              <strong>{formatBytes(activeVol.used_bytes)} / {formatBytes(activeVol.total_bytes)} ({activeVol.percent_used.toFixed(1)}%)</strong>
            </div>
            <div className="vol-cap-track">
              <div
                className={`vol-cap-fill ${activeVol.percent_used > 90 ? 'danger' : activeVol.percent_used > 75 ? 'warn' : ''}`}
                style={{ width: `${Math.min(100, activeVol.percent_used)}%` }}
              />
            </div>
          </div>
        )}

        <div className="dsm-controls">
          <button className="theme-btn" onClick={onToggleTheme} title="Toggle Dark/Light Mode">
            {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </button>
        </div>
      </div>

      {/* Action Toolbar */}
      <div className="app-toolbar">
        <div className="toolbar-scan-group">
          <label className="tb-label">Volume:</label>
          <select
            className="dsm-select"
            value={selectedPath}
            onChange={(e) => onPathChange(e.target.value)}
          >
            {volumes.map((v) => (
              <React.Fragment key={v.id}>
                <option value={v.mount_path}>
                  {v.name} ({v.mount_path}) {v.filesystem_type ? `[${v.filesystem_type}]` : ''}
                </option>
                {v.shares && v.shares.map((s) => (
                  <option key={s.path} value={s.path}>
                    &nbsp;&nbsp;📁 {s.name}
                  </option>
                ))}
              </React.Fragment>
            ))}
          </select>

          <input
            type="text"
            className="dsm-input path-input"
            value={selectedPath}
            onChange={(e) => onPathChange(e.target.value)}
            placeholder="/volume1/..."
          />

          <button
            className="dsm-btn dsm-btn-primary"
            onClick={onStartScan}
            disabled={progress.active}
          >
            ▶ Scan
          </button>
          <button
            className="dsm-btn dsm-btn-danger"
            onClick={onCancelScan}
            disabled={!progress.active}
          >
            ⏹ Stop
          </button>
        </div>

        {/* Navigation Tabs */}
        <nav className="tab-nav">
          {tabs.map((t) => (
            <button
              key={t.id}
              className={`tab-btn ${currentTab === t.id ? 'active' : ''}`}
              onClick={() => onTabChange(t.id)}
            >
              <span>{t.icon}</span> {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Real-time SSE Scan Progress Bar */}
      {progress.active && (
        <div className="scan-progress-strip">
          <div className="scan-progress-meta">
            <span>Files: <strong>{progress.scanned_files.toLocaleString()}</strong></span>
            <span>Speed: <strong>{progress.scan_rate.toLocaleString()} files/s</strong></span>
            <span>Elapsed: <strong>{progress.elapsed_seconds.toFixed(1)}s</strong></span>
          </div>
          <div className="scan-progress-path" title={progress.current_path}>
            Scanning: {progress.current_path}
          </div>
          <div className="scan-strip-bar">
            <div className="scan-strip-fill" />
          </div>
        </div>
      )}
    </header>
  );
};
