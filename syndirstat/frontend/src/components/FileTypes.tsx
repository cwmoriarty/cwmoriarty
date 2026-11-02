import React from 'react';
import { ExtensionStat } from '../types';
import { formatBytes } from '../api/client';

interface FileTypesProps {
  extensions: ExtensionStat[];
}

export const FileTypes: React.FC<FileTypesProps> = ({ extensions }) => {
  return (
    <div className="table-view-container">
      <div className="table-filter-bar">
        <h3>File Type Distribution</h3>
        <span className="text-muted" style={{ fontSize: '12px' }}>
          {extensions.length} unique file extensions detected
        </span>
      </div>

      <div tabIndex={0} role="region" aria-label="File Types Breakdown" className="table-scroll-wrapper">
        <table className="dsm-table">
          <thead>
            <tr>
              <th style={{ width: '120px' }}>Extension</th>
              <th style={{ width: '150px' }}>% of Total Storage</th>
              <th style={{ width: '110px' }}>Logical Size</th>
              <th style={{ width: '110px' }}>Allocated</th>
              <th style={{ width: '90px' }}>File Count</th>
            </tr>
          </thead>
          <tbody>
            {extensions.map((ext) => (
              <tr key={ext.ext}>
                <td>
                  <strong className="mono">{ext.ext}</strong>
                </td>
                <td>
                  <div className="pct-bar-wrap">
                    <div className="pct-bar-track">
                      <div className="pct-bar-fill" style={{ width: `${ext.percentage}%` }} />
                    </div>
                    <span className="pct-val">{ext.percentage.toFixed(1)}%</span>
                  </div>
                </td>
                <td><strong>{formatBytes(ext.size)}</strong></td>
                <td className="text-muted">{formatBytes(ext.allocated)}</td>
                <td>{ext.count.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
