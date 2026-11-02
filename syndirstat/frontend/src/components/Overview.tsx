import React from 'react';
import { ScanSnapshot, VolumeInfo } from '../types';
import { formatBytes } from '../api/client';

interface OverviewProps {
  snapshot: ScanSnapshot | null;
  volumes: VolumeInfo[];
  selectedPath: string;
  onNavigateTab: (tab: any) => void;
}

export const Overview: React.FC<OverviewProps> = ({ snapshot, volumes, selectedPath, onNavigateTab }) => {
  const currentVol = volumes.find(v => selectedPath.startsWith(v.mount_path)) || volumes[0];

  return (
    <div className="overview-container">
      {/* Top Storage Metric Cards */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-title">Volume Capacity</div>
          <div className="metric-val">{currentVol ? formatBytes(currentVol.total_bytes) : '-'}</div>
          <div className="metric-sub">
            {currentVol ? `${currentVol.name} (${currentVol.mount_path})` : 'No volume'}
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-title">Used Volume Space</div>
          <div className="metric-val text-primary">{currentVol ? formatBytes(currentVol.used_bytes) : '-'}</div>
          <div className="metric-sub">
            {currentVol ? `${currentVol.percent_used.toFixed(1)}% occupied` : '-'}
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-title">Free Volume Space</div>
          <div className="metric-val text-success">{currentVol ? formatBytes(currentVol.free_bytes) : '-'}</div>
          <div className="metric-sub">Available for new storage</div>
        </div>

        <div className="metric-card">
          <div className="metric-title">Filesystem Engine</div>
          <div className="metric-val" style={{ textTransform: 'uppercase' }}>
            {currentVol?.filesystem_type || 'Btrfs'}
          </div>
          <div className="metric-sub">Synology DSM Optimized</div>
        </div>
      </div>

      {/* Scan Statistics & Storage Consumption Discrepancy Note */}
      <div className="overview-split">
        <div className="panel-box">
          <h3>Latest Scan Summary</h3>
          {snapshot ? (
            <div className="summary-list">
              <div className="summary-row">
                <span>Scanned Root:</span>
                <strong className="mono">{snapshot.root_path}</strong>
              </div>
              <div className="summary-row">
                <span>Total Files:</span>
                <strong>{snapshot.total_files.toLocaleString()}</strong>
              </div>
              <div className="summary-row">
                <span>Total Directories:</span>
                <strong>{snapshot.total_dirs.toLocaleString()}</strong>
              </div>
              <div className="summary-row">
                <span>Total Logical File Size:</span>
                <strong>{formatBytes(snapshot.total_bytes)}</strong>
              </div>
              <div className="summary-row">
                <span>Physical Block Allocation:</span>
                <strong>{formatBytes(snapshot.total_allocated)}</strong>
              </div>
              <div className="summary-row">
                <span>Scan Duration:</span>
                <strong>{snapshot.duration_secs.toFixed(2)}s</strong>
              </div>
              <div className="summary-row">
                <span>Scan Timestamp:</span>
                <strong>{new Date(snapshot.created_at).toLocaleString()}</strong>
              </div>
              <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
                <button className="dsm-btn dsm-btn-primary" onClick={() => onNavigateTab('treemap')}>
                  Open Treemap ➔
                </button>
                <button className="dsm-btn" onClick={() => onNavigateTab('directories')}>
                  Explore Directories
                </button>
              </div>
            </div>
          ) : (
            <div className="empty-notice">
              <p>No active scan loaded. Select a target volume or folder and click <strong>Scan</strong>.</p>
            </div>
          )}
        </div>

        {/* Filesystem Architecture & Btrfs Explanation Box */}
        <div className="panel-box">
          <h3>Storage Consumption & Btrfs Insights</h3>
          <div className="info-callout">
            <p>
              <strong>Logical Size vs. Physical Disk Consumption:</strong>
            </p>
            <p style={{ marginTop: '6px' }}>
              Summing logical file sizes does <em>not</em> provide an exact measure of actual physical drive consumption on modern Synology DSM storage pools.
            </p>
            <ul style={{ paddingLeft: '20px', marginTop: '8px', lineHeight: '1.6' }}>
              <li>
                <strong>Btrfs Snapshots & Copy-on-Write (CoW):</strong> Files that are duplicated, snapshotted, or cloned share the same physical extents until modified.
              </li>
              <li>
                <strong>Filesystem Compression:</strong> Transparent Btrfs zlib/zstd or LZO compression reduces the physical disk blocks consumed relative to uncompressed file length.
              </li>
              <li>
                <strong>Small Files & Metadata:</strong> Small files (&lt; 2KB) may be stored directly inside metadata B-tree leaf nodes (inline extents), while block allocations for larger files round up to 4KB clusters.
              </li>
              <li>
                <strong>DSM Recycle Bins (#recycle):</strong> Files deleted by network clients frequently remain inside hidden <code>#recycle</code> folders until explicitly purged.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
