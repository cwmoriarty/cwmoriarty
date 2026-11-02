import React, { useState, useMemo } from 'react';
import { FileNode } from '../types';
import { formatBytes } from '../api/client';

interface FileListProps {
  rootNode: FileNode | null;
}

export const FileList: React.FC<FileListProps> = ({ rootNode }) => {
  const [filterText, setFilterText] = useState('');
  const [extFilter, setExtFilter] = useState('');
  const [minSizeMB, setMinSizeMB] = useState<number>(0);
  const [limit, setLimit] = useState(200);

  // Collect all files from tree
  const allFiles = useMemo(() => {
    if (!rootNode) return [];
    const list: FileNode[] = [];
    const collect = (n: FileNode) => {
      if (!n.is_dir) {
        list.push(n);
      } else if (n.children) {
        for (const c of n.children) collect(c);
      }
    };
    collect(rootNode);
    return list;
  }, [rootNode]);

  // Filter & Sort
  const filteredFiles = useMemo(() => {
    const minBytes = minSizeMB * 1024 * 1024;
    return allFiles
      .filter((f) => {
        if (f.size < minBytes) return false;
        if (extFilter && f.ext !== extFilter) return false;
        if (filterText && !f.name.toLowerCase().includes(filterText.toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => b.size - a.size)
      .slice(0, limit);
  }, [allFiles, filterText, extFilter, minSizeMB, limit]);

  return (
    <div className="table-view-container">
      <div className="table-filter-bar">
        <input
          type="search"
          className="dsm-input"
          placeholder="Search by filename..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
        />
        <input
          type="text"
          className="dsm-input"
          style={{ width: '110px' }}
          placeholder="Ext (e.g. .mkv)"
          value={extFilter}
          onChange={(e) => setExtFilter(e.target.value)}
        />
        <select
          className="dsm-select"
          value={minSizeMB}
          onChange={(e) => setMinSizeMB(Number(e.target.value))}
        >
          <option value={0}>Any Size</option>
          <option value={10}>&gt; 10 MB</option>
          <option value={100}>&gt; 100 MB</option>
          <option value={1024}>&gt; 1 GB</option>
          <option value={10240}>&gt; 10 GB</option>
        </select>
        <span className="text-muted" style={{ fontSize: '12px' }}>
          Top {filteredFiles.length} largest files
        </span>
      </div>

      <div tabIndex={0} role="region" aria-label="Top Files" className="table-scroll-wrapper">
        <table className="dsm-table">
          <thead>
            <tr>
              <th>File Name</th>
              <th>Path</th>
              <th style={{ width: '80px' }}>Type</th>
              <th style={{ width: '100px' }}>Size</th>
              <th style={{ width: '100px' }}>Allocated</th>
              <th style={{ width: '130px' }}>Modified</th>
            </tr>
          </thead>
          <tbody>
            {filteredFiles.map((file) => (
              <tr key={file.path}>
                <td><strong>{file.name}</strong></td>
                <td className="mono text-muted" title={file.path}>{file.path}</td>
                <td><span className="tag-ext">{file.ext || '-'}</span></td>
                <td><strong>{formatBytes(file.size)}</strong></td>
                <td className="text-muted">{formatBytes(file.allocated || file.size)}</td>
                <td className="text-muted">{new Date(file.mtime * 1000).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
