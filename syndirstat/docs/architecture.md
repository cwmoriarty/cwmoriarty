# SynDirStat Architecture & Technical Design

## 1. Overview
SynDirStat is an open-source, native Synology DiskStation Manager (DSM 7.x & 6.x) storage visualization tool. It is architected as an independent standalone Go binary embedding a compiled React + TypeScript + D3.js web application, with persistent SQLite historical scan storage.

```
+-------------------------------------------------------------------------------+
|                             Synology DSM Desktop                              |
|   (Iframe Window Launcher: /webman/3rdparty/syn-dirstat/index.cgi)            |
+-------------------------------------------------------------------------------+
                                      │
                                      ▼
+-------------------------------------------------------------------------------+
|                      SynDirStat Embedded HTTP Daemon (Go)                     |
|                                                                               |
|  [REST API & SSE Engine]  ◄──►  [Fast Directory Crawler] ──► [POSIX Filesystem|
|            │                                                  (/volume1...)]  |
|            ▼                                                                  |
|  [SQLite WAL Database]                                                        |
|  (/var/packages/syn-dirstat/var/syndirstat.db)                                |
|                                                                               |
|  [Embedded React / D3.js Assets]                                              |
|  (//go:embed dist/*)                                                          |
+-------------------------------------------------------------------------------+
```

---

## 2. Component Architecture

### Backend: Go (`syndirstat`)
- **Runtime Independence**: The compiled Go binary is 100% statically linked (`CGO_ENABLED=0`). It does not require Docker, Python, Node.js, or external shared libraries on the NAS.
- **Embedded Web Assets**: Uses Go's standard `embed.FS` to bundle all compiled React HTML, CSS, JavaScript, and SVG icons directly into the binary.
- **Filesystem Traversal (`internal/scanner`)**:
  - Employs low-level `os.ReadDir` to interface with Linux kernel directory entries (`getdents64`).
  - Separates logical file size (`fi.Size()`) from physical allocation (`Sys().(*syscall.Stat_t).Blocks * 512`).
  - Ignores symlinks to prevent circular references and artificial volume over-counting.
  - Detects Synology-specific metadata directories (`@eaDir`, `@syno_ea`, `#recycle`).
- **Persistence & Historical Comparisons (`internal/db`)**:
  - Pure-Go SQLite engine (`modernc.org/sqlite`) running in Write-Ahead Logging (WAL) mode.
  - Gzip-compressed snapshot tree serialization to minimize database footprint on low-spec NAS devices.
  - Differential comparison engine identifies newly added files, deleted files, modified files, and growing or shrinking directory trees.

### Frontend: React + TypeScript + Vite + D3.js
- **Squarified Treemap Layout**: Uses D3's squarified treemap tiling algorithm (`d3.treemapSquarify.ratio(1)`).
- **Cushion Shading Engine**: Simulates parabolic ridge lighting with specular gradients and radial bevels to recreate SequoiaView / WinDirStat cushion treemaps on HTML5 Canvas.
- **Responsive Tables**: Complies with modern web standards with sticky headers and container queries (`responsive-table` pattern).
- **Real-Time Telemetry**: Uses Server-Sent Events (SSE) to display files scanned per second and live path updates without polling.

---

## 3. Storage Accounting: Logical Size vs. Physical Btrfs Allocation
SynDirStat explicitly accounts for modern copy-on-write filesystems used on Synology NAS devices:
1. **Btrfs Snapshots**: Shared extents between active files and volume snapshots do not consume additional disk blocks until modified.
2. **Transparent Compression**: Compressed blocks (zstd/zlib) cause physical block allocation to be significantly lower than logical file size.
3. **Inline Extents**: Files smaller than 2KB are stored directly inside metadata B-tree nodes.
4. **Recycle Bins**: Files deleted by SMB/NFS clients persist in `#recycle` folders until purged.
