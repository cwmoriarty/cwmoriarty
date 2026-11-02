import React, { useState, useMemo } from 'react';
import { FileNode } from '../types';
import { formatBytes } from '../api/client';

interface DirectoryTreeProps {
  rootNode: FileNode | null;
}

export const DirectoryTree: React.FC<DirectoryTreeProps> = ({ rootNode }) => {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(rootNode ? [rootNode.path] : []));
  const [sortBy, setSortBy] = useState<'size' | 'name' | 'files' | 'mtime'>('size');
  const [sortAsc, setSortAsc] = useState(false);
  const [filterText, setFilterText] = useState('');

  const toggleExpand = (path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const handleHeaderClick = (col: 'size' | 'name' | 'files' | 'mtime') => {
    if (sortBy === col) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(col);
      setSortAsc(col === 'name');
    }
  };

  const totalRootSize = rootNode?.size || 1;

  // Flatten tree according to expanded nodes
  const flattenedRows = useMemo(() => {
    if (!rootNode) return [];
    const rows: { node: FileNode; depth: number }[] = [];

    const traverse = (node: FileNode, depth: number) => {
      // Filter check
      const matches = !filterText || node.name.toLowerCase().includes(filterText.toLowerCase());
      if (matches) {
        rows.push({ node, depth });
      }

      if (node.is_dir && expandedPaths.has(node.path) && node.children) {
        const sorted = [...node.children].sort((a, b) => {
          let vA = a[sortBy];
          let vB = b[sortBy];
          if (sortBy === 'name') {
            return sortAsc
              ? (a.name || '').localeCompare(b.name || '')
              : (b.name || '').localeCompare(a.name || '');
          }
          return sortAsc ? (vA as number) - (vB as number) : (vB as number) - (vA as number);
        });

        for (const child of sorted) {
          traverse(child, depth + 1);
        }
      }
    };

    traverse(rootNode, 0);
    return rows;
  }, [rootNode, expandedPaths, sortBy, sortAsc, filterText]);

  return (
    <div className="table-view-container">
      <div className="table-filter-bar">
        <input
          type="search"
          className="dsm-input"
          placeholder="Filter directories..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
        />
        <span className="text-muted" style={{ fontSize: '12px' }}>
          Showing {flattenedRows.length.toLocaleString()} items
        </span>
      </div>

      <div tabIndex={0} role="region" aria-label="Directory Breakdown" className="table-scroll-wrapper">
        <table className="dsm-table">
          <thead>
            <tr>
              <th onClick={() => handleHeaderClick('name')}>
                Folder / File Name {sortBy === 'name' ? (sortAsc ? '▲' : '▼') : ''}
              </th>
              <th style={{ width: '130px' }} onClick={() => handleHeaderClick('size')}>
                % of Drive {sortBy === 'size' ? (sortAsc ? '▲' : '▼') : ''}
              </th>
              <th style={{ width: '90px' }} onClick={() => handleHeaderClick('size')}>
                Size
              </th>
              <th style={{ width: '90px' }}>Allocated</th>
              <th style={{ width: '70px' }} onClick={() => handleHeaderClick('files')}>
                Files {sortBy === 'files' ? (sortAsc ? '▲' : '▼') : ''}
              </th>
              <th style={{ width: '70px' }}>Folders</th>
              <th style={{ width: '130px' }} onClick={() => handleHeaderClick('mtime')}>
                Modified {sortBy === 'mtime' ? (sortAsc ? '▲' : '▼') : ''}
              </th>
            </tr>
          </thead>
          <tbody>
            {flattenedRows.map(({ node, depth }) => {
              const isExpanded = expandedPaths.has(node.path);
              const hasKids = node.is_dir && node.children && node.children.length > 0;
              const pct = Math.min(100, (node.size / totalRootSize) * 100);

              return (
                <tr key={node.path} onDoubleClick={() => node.is_dir && toggleExpand(node.path)}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', paddingLeft: `${depth * 18}px` }}>
                      <span
                        className="expander-icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (node.is_dir) toggleExpand(node.path);
                        }}
                      >
                        {hasKids ? (isExpanded ? '▼' : '▶') : ' '}
                      </span>
                      <span className="file-icon">
                        {node.is_dir ? (node.name === '#recycle' ? '🗑️' : isExpanded ? '📂' : '📁') : '📄'}
                      </span>
                      <span className="node-label" title={node.path}>{node.name}</span>
                    </div>
                  </td>
                  <td>
                    <div className="pct-bar-wrap">
                      <div className="pct-bar-track">
                        <div className="pct-bar-fill" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="pct-val">{pct.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td><strong>{formatBytes(node.size)}</strong></td>
                  <td className="text-muted">{formatBytes(node.allocated || node.size)}</td>
                  <td>{node.is_dir ? (node.files || 0).toLocaleString() : '1'}</td>
                  <td>{node.is_dir ? (node.dirs || 0).toLocaleString() : '0'}</td>
                  <td className="text-muted">{node.mtime ? new Date(node.mtime * 1000).toLocaleDateString() : '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
