import React from 'react';

interface SettingsViewProps {
  shadingMode: 'cushion' | 'flat';
  onShadingChange: (mode: 'cushion' | 'flat') => void;
  colorBy: 'extension' | 'folder' | 'depth';
  onColorByChange: (mode: 'extension' | 'folder' | 'depth') => void;
  minRectSize: number;
  onMinRectSizeChange: (size: number) => void;
  theme: string;
  onToggleTheme: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  shadingMode,
  onShadingChange,
  colorBy,
  onColorByChange,
  minRectSize,
  onMinRectSizeChange,
  theme,
  onToggleTheme,
}) => {
  return (
    <div className="settings-container">
      <div className="panel-box" style={{ marginBottom: '16px' }}>
        <h3>Visualization Preferences</h3>

        <div className="setting-row">
          <div>
            <strong>Treemap Shading Engine:</strong>
            <div className="text-muted" style={{ fontSize: '12px' }}>
              Select between SequoiaView/WinDirStat parabolic 3D cushion lighting and flat modern rectangles.
            </div>
          </div>
          <select
            className="dsm-select"
            value={shadingMode}
            onChange={(e) => onShadingChange(e.target.value as any)}
          >
            <option value="cushion">Cushion 3D (SequoiaView Style)</option>
            <option value="flat">Flat Modern</option>
          </select>
        </div>

        <div className="setting-row">
          <div>
            <strong>Color Coding Scheme:</strong>
            <div className="text-muted" style={{ fontSize: '12px' }}>
              Color treemap blocks by file extension, folder hierarchy, or tree depth.
            </div>
          </div>
          <select
            className="dsm-select"
            value={colorBy}
            onChange={(e) => onColorByChange(e.target.value as any)}
          >
            <option value="extension">By File Extension (WizTree Palette)</option>
            <option value="folder">By Directory Branch</option>
            <option value="depth">By Tree Depth</option>
          </select>
        </div>

        <div className="setting-row">
          <div>
            <strong>Minimum Rectangle Threshold:</strong>
            <div className="text-muted" style={{ fontSize: '12px' }}>
              Skip rendering rectangles smaller than this pixel area to maximize rendering speed.
            </div>
          </div>
          <select
            className="dsm-select"
            value={minRectSize}
            onChange={(e) => onMinRectSizeChange(Number(e.target.value))}
          >
            <option value={1}>1 px² (Dense)</option>
            <option value={4}>4 px² (Balanced - Recommended)</option>
            <option value={16}>16 px² (Large blocks only)</option>
          </select>
        </div>

        <div className="setting-row">
          <div>
            <strong>Application Theme:</strong>
            <div className="text-muted" style={{ fontSize: '12px' }}>
              Synology DSM 7 Dark Mode or Light Mode.
            </div>
          </div>
          <button className="dsm-btn" onClick={onToggleTheme}>
            {theme === 'dark' ? '☀️ Switch to Light Mode' : '🌙 Switch to Dark Mode'}
          </button>
        </div>
      </div>

      <div className="panel-box" style={{ marginBottom: '16px' }}>
        <h3>Synology Community Package Repository</h3>
        <p className="text-muted" style={{ fontSize: '12px', lineHeight: '1.6' }}>
          SynDirStat is distributed as a native Synology DSM 7 package. Users can subscribe to automatic updates by adding the community repository URL to DSM Package Center:
        </p>

        <div className="repo-url-display">
          <code>https://cpan.zip</code>
        </div>

        <h4 style={{ marginTop: '14px', fontSize: '13px' }}>How to add in Synology DSM:</h4>
        <ol style={{ paddingLeft: '20px', fontSize: '12px', lineHeight: '1.8', color: 'var(--text-muted)' }}>
          <li>Open <strong>Package Center</strong> in DSM.</li>
          <li>Click <strong>Settings</strong> ➔ <strong>Package Sources</strong> ➔ <strong>Add</strong>.</li>
          <li>Name: <code>cpan.zip</code>, Location: <code>https://cpan.zip</code>.</li>
          <li>Click <strong>OK</strong>. SynDirStat will now appear under the <strong>Community</strong> catalog tab.</li>
        </ol>
      </div>

      <div className="panel-box">
        <h3>About SynDirStat</h3>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
          Version 1.0.0 • Developed as open-source software under the MIT License.<br />
          Built with Go, React, TypeScript, and D3.js. Designed specifically for Synology DSM 7.x & 6.x.
        </p>
      </div>
    </div>
  );
};
