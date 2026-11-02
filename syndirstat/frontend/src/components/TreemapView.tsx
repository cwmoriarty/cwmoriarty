import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import { FileNode } from '../types';
import { formatBytes } from '../api/client';

interface TreemapViewProps {
  rootNode: FileNode | null;
  shadingMode: 'cushion' | 'flat';
  colorBy: 'extension' | 'folder' | 'depth';
  minRectSize: number;
}

interface RenderRect {
  node: FileNode;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  w: number;
  h: number;
  depth: number;
  color: string;
}

export const TreemapView: React.FC<TreemapViewProps> = ({
  rootNode,
  shadingMode,
  colorBy,
  minRectSize,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [currentZoomNode, setCurrentZoomNode] = useState<FileNode | null>(rootNode);
  const [hoveredRect, setHoveredRect] = useState<RenderRect | null>(null);
  const [selectedRect, setSelectedRect] = useState<RenderRect | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  // Update zoom when root changes
  useEffect(() => {
    setCurrentZoomNode(rootNode);
    setHoveredRect(null);
    setSelectedRect(null);
  }, [rootNode]);

  // Extension Color Palette (WizTree / WinDirStat Classic)
  const getExtensionColor = useCallback((ext: string): string => {
    const normalized = (ext || '').toLowerCase();
    const map: Record<string, string> = {
      // Video (Magenta / Pink)
      '.mp4': '#e84393', '.mkv': '#fd79a8', '.avi': '#e84393', '.mov': '#fd79a8',
      '.wmv': '#d63031', '.flv': '#e84393', '.m2ts': '#fd79a8',
      // Audio (Purple)
      '.mp3': '#a29bfe', '.flac': '#6c5ce7', '.wav': '#8c7ae6', '.m4a': '#9c88ff',
      // Archives (Emerald Green)
      '.zip': '#00b894', '.rar': '#55efc4', '.7z': '#00cec9', '.tar': '#00b894',
      '.gz': '#55efc4', '.iso': '#10ac84',
      // VM / Disk images (Coral)
      '.vmdk': '#e17055', '.qcow2': '#d63031', '.img': '#ff7675',
      // Images (Teal / Cyan)
      '.jpg': '#00cec9', '.jpeg': '#00cec9', '.png': '#81ecec', '.webp': '#48dbfb',
      // Docs (Amber / Gold)
      '.pdf': '#fdcb6e', '.docx': '#ffeaa7', '.xlsx': '#f9ca24', '.txt': '#fed330',
      // Code (Synology Blue)
      '.go': '#0082fa', '.js': '#0984e3', '.ts': '#0082fa', '.py': '#74b9ff',
      '.html': '#0984e3', '.json': '#54a0ff',
      // System / DB (Steel Gray)
      '.db': '#636e72', '.sqlite': '#b2bec3', '.log': '#718093',
      '[folder]': '#2d3436', '[no extension]': '#7f8c8d',
    };
    if (map[normalized]) return map[normalized];

    // HSL deterministic hash
    let h = 0;
    for (let i = 0; i < normalized.length; i++) {
      h = (h << 5) - h + normalized.charCodeAt(i);
      h |= 0;
    }
    return `hsl(${Math.abs(h) % 360}, 70%, 50%)`;
  }, []);

  // Compute D3 Treemap Layout
  const rects = useMemo<RenderRect[]>(() => {
    if (!currentZoomNode || !containerRef.current) return [];

    const width = containerRef.current.clientWidth || 800;
    const height = containerRef.current.clientHeight || 500;
    if (width <= 0 || height <= 0) return [];

    // Construct D3 hierarchy
    const hierarchy = d3.hierarchy<FileNode>(currentZoomNode)
      .sum((d) => (d.is_dir ? 0 : d.size))
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    // Squarified Treemap layout
    const treemapLayout = d3.treemap<FileNode>()
      .size([width, height])
      .tile(d3.treemapSquarify.ratio(1))
      .paddingInner(1)
      .round(true);

    treemapLayout(hierarchy);

    const leaves: RenderRect[] = [];
    const minArea = Math.max(1, minRectSize);

    for (const rawLeaf of hierarchy.leaves()) {
      const leaf = rawLeaf as d3.HierarchyRectangularNode<FileNode>;
      const w = leaf.x1 - leaf.x0;
      const h = leaf.y1 - leaf.y0;
      if (w * h < minArea) continue;

      let color = '#7f8c8d';
      if (colorBy === 'extension') {
        color = getExtensionColor(leaf.data.ext || '[no extension]');
      } else if (colorBy === 'folder') {
        const hue = (leaf.depth * 53) % 360;
        color = `hsl(${hue}, 70%, 45%)`;
      } else if (colorBy === 'depth') {
        const lightness = Math.max(25, 70 - leaf.depth * 8);
        color = `hsl(210, 80%, ${lightness}%)`;
      }

      leaves.push({
        node: leaf.data,
        x0: leaf.x0,
        y0: leaf.y0,
        x1: leaf.x1,
        y1: leaf.y1,
        w,
        h,
        depth: leaf.depth,
        color,
      });
    }

    return leaves;
  }, [currentZoomNode, colorBy, minRectSize, getExtensionColor]);

  // Draw Treemap onto Canvas (Squarified + Cushion Shading)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !containerRef.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = containerRef.current.clientWidth || 800;
    const height = containerRef.current.clientHeight || 500;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.resetTransform();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const isCushion = shadingMode === 'cushion';

    // Render individual tiles
    for (const r of rects) {
      if (isCushion) {
        // Parabolic cushion simulation (SequoiaView / WinDirStat style)
        ctx.fillStyle = r.color;
        ctx.fillRect(r.x0, r.y0, r.w, r.h);

        if (r.w > 3 && r.h > 3) {
          // Specular ridge light from top-left
          const grad = ctx.createLinearGradient(r.x0, r.y0, r.x1, r.y1);
          grad.addColorStop(0, 'rgba(255, 255, 255, 0.42)');
          grad.addColorStop(0.2, 'rgba(255, 255, 255, 0.12)');
          grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.0)');
          grad.addColorStop(0.8, 'rgba(0, 0, 0, 0.22)');
          grad.addColorStop(1, 'rgba(0, 0, 0, 0.52)');
          ctx.fillStyle = grad;
          ctx.fillRect(r.x0, r.y0, r.w, r.h);

          // Center pillow bevel
          const radGrad = ctx.createRadialGradient(
            r.x0 + r.w * 0.35, r.y0 + r.h * 0.35, 1,
            r.x0 + r.w * 0.35, r.y0 + r.h * 0.35, Math.max(r.w, r.h) * 0.7
          );
          radGrad.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
          radGrad.addColorStop(1, 'rgba(0, 0, 0, 0.12)');
          ctx.fillStyle = radGrad;
          ctx.fillRect(r.x0, r.y0, r.w, r.h);

          ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
          ctx.lineWidth = 0.5;
          ctx.strokeRect(r.x0, r.y0, r.w, r.h);
        }
      } else {
        // Flat style
        ctx.fillStyle = r.color;
        ctx.fillRect(r.x0, r.y0, r.w, r.h);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(r.x0, r.y0, r.w, r.h);
      }

      // Search match highlight
      if (searchQuery && r.node.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        ctx.strokeStyle = '#ffd32a';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(r.x0 + 1, r.y0 + 1, r.w - 2, r.h - 2);
      }
    }

    // Hover Highlight
    if (hoveredRect) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(hoveredRect.x0 + 0.5, hoveredRect.y0 + 0.5, hoveredRect.w - 1, hoveredRect.h - 1);
    }

    // Selected Highlight
    if (selectedRect) {
      ctx.strokeStyle = '#0082fa';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(selectedRect.x0 + 0.5, selectedRect.y0 + 0.5, selectedRect.w - 1, selectedRect.h - 1);
    }
  }, [rects, shadingMode, hoveredRect, selectedRect, searchQuery]);

  // Mouse Interactivity
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const hit = rects.find(r => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1);
    setHoveredRect(hit || null);
    if (hit) {
      setTooltipPos({ x: e.clientX, y: e.clientY });
    } else {
      setTooltipPos(null);
    }
  };

  const handleMouseLeave = () => {
    setHoveredRect(null);
    setTooltipPos(null);
  };

  const handleClick = () => {
    if (hoveredRect) {
      setSelectedRect(hoveredRect);
    }
  };

  const handleDoubleClick = () => {
    if (hoveredRect && hoveredRect.node.is_dir) {
      setCurrentZoomNode(hoveredRect.node);
      setHoveredRect(null);
      setSelectedRect(null);
    }
  };

  // Breadcrumbs Trail
  const breadcrumbs = useMemo(() => {
    if (!rootNode || !currentZoomNode) return [];
    const chain: FileNode[] = [];
    const findChain = (curr: FileNode, target: FileNode): boolean => {
      chain.push(curr);
      if (curr === target) return true;
      if (curr.children) {
        for (const child of curr.children) {
          if (child.is_dir && findChain(child, target)) return true;
        }
      }
      chain.pop();
      return false;
    };
    findChain(rootNode, currentZoomNode);
    return chain;
  }, [rootNode, currentZoomNode]);

  return (
    <div className="treemap-view-wrapper">
      {/* Treemap Top Breadcrumb Bar */}
      <div className="treemap-bar">
        <div className="breadcrumbs">
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={crumb.path}>
              {idx > 0 && <span className="crumb-sep">&gt;</span>}
              <button
                className={`crumb-btn ${idx === breadcrumbs.length - 1 ? 'active' : ''}`}
                onClick={() => setCurrentZoomNode(crumb)}
                title={crumb.path}
              >
                {crumb.name || crumb.path}
              </button>
            </React.Fragment>
          ))}
        </div>

        <div className="treemap-bar-actions">
          <input
            type="search"
            className="dsm-input dsm-search-sm"
            placeholder="Search in view..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button
            className="dsm-btn dsm-btn-sm"
            disabled={currentZoomNode === rootNode}
            onClick={() => {
              if (breadcrumbs.length >= 2) {
                setCurrentZoomNode(breadcrumbs[breadcrumbs.length - 2]);
              }
            }}
          >
            ⬆ Parent Folder
          </button>
        </div>
      </div>

      {/* Main Canvas Viewport */}
      <div className="treemap-canvas-container" ref={containerRef}>
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
        />

        {/* Floating Hover Tooltip */}
        {hoveredRect && tooltipPos && (
          <div
            className="treemap-tooltip"
            style={{
              left: `${Math.min(window.innerWidth - 320, tooltipPos.x + 12)}px`,
              top: `${Math.min(window.innerHeight - 150, tooltipPos.y + 12)}px`,
            }}
          >
            <div className="tt-name">{hoveredRect.node.name}</div>
            <div className="tt-row">
              <span>Path:</span>
              <strong className="mono">{hoveredRect.node.path}</strong>
            </div>
            <div className="tt-row">
              <span>Logical Size:</span>
              <strong>{formatBytes(hoveredRect.node.size)}</strong>
            </div>
            <div className="tt-row">
              <span>Physical Allocation:</span>
              <strong>{formatBytes(hoveredRect.node.allocated || hoveredRect.node.size)}</strong>
            </div>
            <div className="tt-row">
              <span>Type:</span>
              <strong>{hoveredRect.node.is_dir ? 'Directory' : (hoveredRect.node.ext || '[no extension]')}</strong>
            </div>
            <div className="tt-row">
              <span>Modified:</span>
              <strong>{new Date(hoveredRect.node.mtime * 1000).toLocaleString()}</strong>
            </div>
          </div>
        )}
      </div>

      {/* Selected Item Info Footer */}
      <div className="treemap-footer">
        {selectedRect ? (
          <span>
            Selected: <strong className="mono">{selectedRect.node.path}</strong> — {formatBytes(selectedRect.node.size)}
          </span>
        ) : (
          <span>Click any block to select • Double-click directories to drill down</span>
        )}
      </div>
    </div>
  );
};
