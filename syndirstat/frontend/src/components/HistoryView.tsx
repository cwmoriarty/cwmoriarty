import React, { useState, useEffect } from 'react';
import { SnapshotSummary, ComparisonResult } from '../types';
import { fetchHistory, compareSnapshots, deleteSnapshot, formatBytes } from '../api/client';

interface HistoryViewProps {
  onLoadSnapshot: (id: string) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ onLoadSnapshot }) => {
  const [snapshots, setSnapshots] = useState<SnapshotSummary[]>([]);
  const [baseId, setBaseId] = useState<string>('');
  const [targetId, setTargetId] = useState<string>('');
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadList = async () => {
    try {
      const list = await fetchHistory(50);
      setSnapshots(list);
      if (list.length >= 2 && !baseId && !targetId) {
        setBaseId(list[1].id);
        setTargetId(list[0].id);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    loadList();
  }, []);

  const handleCompare = async () => {
    if (!baseId || !targetId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await compareSnapshots(baseId, targetId);
      setComparison(res);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this historical snapshot?')) return;
    try {
      await deleteSnapshot(id);
      await loadList();
      if (comparison?.base_snapshot_id === id || comparison?.target_snapshot_id === id) {
        setComparison(null);
      }
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  return (
    <div className="history-container">
      {/* Top Comparison Controls */}
      <div className="panel-box" style={{ marginBottom: '16px' }}>
        <h3>Historical Snapshot Comparison (Differential Analysis)</h3>
        <p className="text-muted" style={{ fontSize: '12px', marginBottom: '12px' }}>
          Select two historical scan snapshots to analyze storage growth, newly created files, deleted items, and expanding directories.
        </p>

        <div className="compare-controls">
          <div className="control-col">
            <label>Base (Older) Scan:</label>
            <select
              className="dsm-select"
              value={baseId}
              onChange={(e) => setBaseId(e.target.value)}
            >
              <option value="">Select Base Snapshot...</option>
              {snapshots.map((s) => (
                <option key={s.id} value={s.id}>
                  {new Date(s.created_at).toLocaleString()} — {s.root_path} ({formatBytes(s.total_bytes)})
                </option>
              ))}
            </select>
          </div>

          <div className="control-col">
            <label>Target (Newer) Scan:</label>
            <select
              className="dsm-select"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
            >
              <option value="">Select Target Snapshot...</option>
              {snapshots.map((s) => (
                <option key={s.id} value={s.id}>
                  {new Date(s.created_at).toLocaleString()} — {s.root_path} ({formatBytes(s.total_bytes)})
                </option>
              ))}
            </select>
          </div>

          <button
            className="dsm-btn dsm-btn-primary"
            disabled={!baseId || !targetId || baseId === targetId || loading}
            onClick={handleCompare}
          >
            {loading ? 'Analyzing...' : 'Compare Scans ➔'}
          </button>
        </div>

        {error && <div className="error-banner">{error}</div>}
      </div>

      {/* Comparison Results */}
      {comparison && (
        <div className="panel-box" style={{ marginBottom: '16px' }}>
          <h3>Comparison Findings</h3>
          <div className="diff-stats-strip">
            <div className="diff-stat-item">
              <span>Net Storage Change:</span>
              <strong className={comparison.net_bytes_diff > 0 ? 'text-danger' : 'text-success'}>
                {comparison.net_bytes_diff > 0 ? '+' : ''}{formatBytes(comparison.net_bytes_diff)}
              </strong>
            </div>
            <div className="diff-stat-item">
              <span>Net File Count Change:</span>
              <strong>{comparison.net_files_diff > 0 ? `+${comparison.net_files_diff}` : comparison.net_files_diff} files</strong>
            </div>
            <div className="diff-stat-item">
              <span>New Files:</span>
              <strong className="text-primary">{comparison.created_files.length}</strong>
            </div>
            <div className="diff-stat-item">
              <span>Deleted Files:</span>
              <strong className="text-warning">{comparison.deleted_files.length}</strong>
            </div>
            <div className="diff-stat-item">
              <span>Modified Files:</span>
              <strong>{comparison.modified_files.length}</strong>
            </div>
          </div>

          {/* Growing Directories */}
          {comparison.growing_directories.length > 0 && (
            <div style={{ marginTop: '16px' }}>
              <h4>Top Growing Directories</h4>
              <table className="dsm-table">
                <thead>
                  <tr>
                    <th>Directory Path</th>
                    <th style={{ width: '120px' }}>Previous Size</th>
                    <th style={{ width: '120px' }}>Current Size</th>
                    <th style={{ width: '120px' }}>Expansion</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.growing_directories.slice(0, 5).map((d) => (
                    <tr key={d.path}>
                      <td className="mono">{d.path}</td>
                      <td>{formatBytes(d.old_size)}</td>
                      <td>{formatBytes(d.new_size)}</td>
                      <td className="text-danger"><strong>+{formatBytes(d.size_diff)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Newly Created Files */}
          {comparison.created_files.length > 0 && (
            <div style={{ marginTop: '16px' }}>
              <h4>Newly Created Files</h4>
              <table className="dsm-table">
                <thead>
                  <tr>
                    <th>File Name</th>
                    <th>Path</th>
                    <th style={{ width: '100px' }}>Type</th>
                    <th style={{ width: '110px' }}>Size</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.created_files.slice(0, 10).map((f) => (
                    <tr key={f.path}>
                      <td><strong>{f.name}</strong></td>
                      <td className="mono text-muted">{f.path}</td>
                      <td>{f.ext}</td>
                      <td className="text-success"><strong>+{formatBytes(f.new_size)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Snapshots Saved in SQLite */}
      <div className="panel-box">
        <h3>Persisted Historical Snapshots</h3>
        <div tabIndex={0} role="region" aria-label="Historical Snapshots" className="table-scroll-wrapper">
          <table className="dsm-table">
            <thead>
              <tr>
                <th>Scan Date & Time</th>
                <th>Volume & Path</th>
                <th style={{ width: '100px' }}>Logical Size</th>
                <th style={{ width: '100px' }}>Allocated</th>
                <th style={{ width: '80px' }}>Files</th>
                <th style={{ width: '80px' }}>Duration</th>
                <th style={{ width: '160px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {snapshots.map((s) => (
                <tr key={s.id}>
                  <td><strong>{new Date(s.created_at).toLocaleString()}</strong></td>
                  <td className="mono">{s.root_path}</td>
                  <td><strong>{formatBytes(s.total_bytes)}</strong></td>
                  <td className="text-muted">{formatBytes(s.total_allocated)}</td>
                  <td>{s.total_files.toLocaleString()}</td>
                  <td>{s.duration_secs.toFixed(1)}s</td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        className="dsm-btn dsm-btn-sm"
                        onClick={() => onLoadSnapshot(s.id)}
                        title="Load into Treemap view"
                      >
                        Load
                      </button>
                      <button
                        className="dsm-btn dsm-btn-sm dsm-btn-danger"
                        onClick={() => handleDelete(s.id)}
                        title="Delete snapshot"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
