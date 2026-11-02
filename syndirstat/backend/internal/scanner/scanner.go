package scanner

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"

	"syndirstat/internal/models"
)

var (
	ErrScanCancelled = errors.New("scan cancelled by user")
	ErrPathNotFound  = errors.New("target path does not exist")
)

// Scanner coordinates filesystem traversal and real-time telemetry
type Scanner struct {
	mu           sync.RWMutex
	active       bool
	cancelFunc   context.CancelFunc
	currentPath  string
	scannedFiles int64
	scannedDirs  int64
	scannedBytes int64
	startTime    time.Time
	elapsed      float64
	lastError    string
	latestResult *models.ScanSnapshot

	// Broadcast channel for SSE events
	listeners   map[chan models.ScanProgress]struct{}
	listenersMu sync.Mutex
}

// NewScanner constructs a thread-safe Scanner instance
func NewScanner() *Scanner {
	return &Scanner{
		listeners: make(map[chan models.ScanProgress]struct{}),
	}
}

// IsActive returns whether a scan is currently running
func (s *Scanner) IsActive() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.active
}

// Cancel stops an ongoing scan
func (s *Scanner) Cancel() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.active && s.cancelFunc != nil {
		s.cancelFunc()
	}
}

// GetStatus snapshots current scan progress
func (s *Scanner) GetStatus() models.ScanProgress {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var elapsed float64
	if s.active {
		elapsed = time.Since(s.startTime).Seconds()
	} else {
		elapsed = s.elapsed
	}

	var rate int64
	if elapsed > 0 {
		rate = int64(float64(atomic.LoadInt64(&s.scannedFiles)) / elapsed)
	}

	return models.ScanProgress{
		Active:         s.active,
		CurrentPath:    s.currentPath,
		ScannedFiles:   atomic.LoadInt64(&s.scannedFiles),
		ScannedDirs:    atomic.LoadInt64(&s.scannedDirs),
		ScannedBytes:   atomic.LoadInt64(&s.scannedBytes),
		ElapsedSeconds: elapsed,
		ScanRate:       rate,
		Error:          s.lastError,
		HasResult:      s.latestResult != nil,
	}
}

// SubscribeProgress returns a channel receiving live scan events
func (s *Scanner) SubscribeProgress() chan models.ScanProgress {
	ch := make(chan models.ScanProgress, 20)
	s.listenersMu.Lock()
	s.listeners[ch] = struct{}{}
	s.listenersMu.Unlock()
	return ch
}

// UnsubscribeProgress removes an SSE client channel
func (s *Scanner) UnsubscribeProgress(ch chan models.ScanProgress) {
	s.listenersMu.Lock()
	delete(s.listeners, ch)
	close(ch)
	s.listenersMu.Unlock()
}

func (s *Scanner) broadcast(p models.ScanProgress) {
	s.listenersMu.Lock()
	defer s.listenersMu.Unlock()
	for ch := range s.listeners {
		select {
		case ch <- p:
		default:
			// Non-blocking drop if client is saturated
		}
	}
}

// GetLatestResult returns the most recent scan snapshot in memory
func (s *Scanner) GetLatestResult() *models.ScanSnapshot {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.latestResult
}

// ScanPath executes recursive scanning of a directory
func (s *Scanner) ScanPath(rootPath string) (*models.ScanSnapshot, error) {
	s.mu.Lock()
	if s.active {
		s.mu.Unlock()
		return nil, errors.New("a scan is already in progress")
	}

	absPath, err := filepath.Abs(rootPath)
	if err != nil {
		s.mu.Unlock()
		return nil, err
	}

	fi, err := os.Stat(absPath)
	if err != nil {
		s.mu.Unlock()
		return nil, fmt.Errorf("%w: %s", ErrPathNotFound, absPath)
	}
	if !fi.IsDir() {
		s.mu.Unlock()
		return nil, fmt.Errorf("target path is not a directory: %s", absPath)
	}

	ctx, cancel := context.WithCancel(context.Background())
	s.cancelFunc = cancel
	s.active = true
	s.currentPath = absPath
	atomic.StoreInt64(&s.scannedFiles, 0)
	atomic.StoreInt64(&s.scannedDirs, 0)
	atomic.StoreInt64(&s.scannedBytes, 0)
	s.startTime = time.Now()
	s.elapsed = 0
	s.lastError = ""
	s.mu.Unlock()

	defer func() {
		s.mu.Lock()
		s.active = false
		s.elapsed = time.Since(s.startTime).Seconds()
		s.mu.Unlock()
		s.broadcast(s.GetStatus())
	}()

	extStats := make(map[string]*models.ExtensionStat)
	var extMu sync.Mutex

	rootNode := &models.FileNode{
		Name:  fi.Name(),
		Path:  absPath,
		IsDir: true,
		Mtime: fi.ModTime().Unix(),
	}

	lastProgressTime := time.Now()

	var walkDir func(node *models.FileNode, depth int) error
	walkDir = func(node *models.FileNode, depth int) error {
		select {
		case <-ctx.Done():
			return ErrScanCancelled
		default:
		}

		s.mu.Lock()
		s.currentPath = node.Path
		s.mu.Unlock()
		atomic.AddInt64(&s.scannedDirs, 1)

		if time.Since(lastProgressTime) > 100*time.Millisecond {
			lastProgressTime = time.Now()
			s.broadcast(s.GetStatus())
		}

		entries, err := os.ReadDir(node.Path)
		if err != nil {
			node.Error = err.Error()
			return nil // Gracefully record inaccessible directory without aborting scan
		}

		var children []*models.FileNode
		var dirLogical int64
		var dirAllocated int64
		var dirFiles int64
		var dirDirs int64

		for _, entry := range entries {
			select {
			case <-ctx.Done():
				return ErrScanCancelled
			default:
			}

			entryPath := filepath.Join(node.Path, entry.Name())
			info, err := entry.Info()
			if err != nil {
				continue
			}

			// Do not follow symlinks to prevent infinite loops and duplicate storage tallies
			if info.Mode()&os.ModeSymlink != 0 {
				continue
			}

			if entry.IsDir() {
				childDir := &models.FileNode{
					Name:       entry.Name(),
					Path:       entryPath,
					IsDir:      true,
					Mtime:      info.ModTime().Unix(),
					IsRecycle:  entry.Name() == "#recycle",
					IsSynoMeta: entry.Name() == "@eaDir" || entry.Name() == "@syno_ea",
				}

				if err := walkDir(childDir, depth+1); err != nil {
					return err
				}

				dirLogical += childDir.Size
				dirAllocated += childDir.Allocated
				dirFiles += childDir.Files
				dirDirs += 1 + childDir.Dirs
				children = append(children, childDir)
			} else {
				logicalSize := info.Size()
				allocatedSize := getPhysicalBlocks(info)
				if allocatedSize == 0 && logicalSize > 0 {
					allocatedSize = logicalSize
				}

				ext := extractExtension(entry.Name())
				atomic.AddInt64(&s.scannedFiles, 1)
				atomic.AddInt64(&s.scannedBytes, logicalSize)

				dirLogical += logicalSize
				dirAllocated += allocatedSize
				dirFiles += 1

				// Extension tracking
				extMu.Lock()
				stat, exists := extStats[ext]
				if !exists {
					stat = &models.ExtensionStat{Ext: ext}
					extStats[ext] = stat
				}
				stat.Size += logicalSize
				stat.Allocated += allocatedSize
				stat.Count++
				extMu.Unlock()

				childFile := &models.FileNode{
					Name:      entry.Name(),
					Path:      entryPath,
					IsDir:     false,
					Size:      logicalSize,
					Allocated: allocatedSize,
					Mtime:     info.ModTime().Unix(),
					Ext:       ext,
				}
				children = append(children, childFile)
			}
		}

		// Sort children descending by logical size (WizTree standard)
		sort.Slice(children, func(i, j int) bool {
			return children[i].Size > children[j].Size
		})

		node.Children = children
		node.Size = dirLogical
		node.Allocated = dirAllocated
		node.Files = dirFiles
		node.Dirs = dirDirs
		return nil
	}

	if err := walkDir(rootNode, 0); err != nil {
		s.mu.Lock()
		s.lastError = err.Error()
		s.mu.Unlock()
		return nil, err
	}

	// Prepare sorted extension statistics
	var sortedExts []models.ExtensionStat
	for _, st := range extStats {
		if rootNode.Size > 0 {
			st.Percentage = float64(st.Size) / float64(rootNode.Size) * 100.0
		}
		sortedExts = append(sortedExts, *st)
	}
	sort.Slice(sortedExts, func(i, j int) bool {
		return sortedExts[i].Size > sortedExts[j].Size
	})

	duration := time.Since(s.startTime).Seconds()

	snapshot := &models.ScanSnapshot{
		CreatedAt:      time.Now(),
		VolumePath:     extractVolumeRoot(absPath),
		RootPath:       absPath,
		TotalBytes:     rootNode.Size,
		TotalAllocated: rootNode.Allocated,
		TotalFiles:     rootNode.Files,
		TotalDirs:      rootNode.Dirs,
		DurationSecs:   duration,
		Root:           rootNode,
		Extensions:     sortedExts,
	}

	s.mu.Lock()
	s.latestResult = snapshot
	s.mu.Unlock()

	return snapshot, nil
}

func extractExtension(name string) string {
	idx := strings.LastIndex(name, ".")
	if idx > 0 && idx < len(name)-1 {
		ext := strings.ToLower(name[idx:])
		if len(ext) > 12 {
			ext = ext[len(ext)-8:]
		}
		return ext
	}
	return "[no extension]"
}

func extractVolumeRoot(path string) string {
	parts := strings.Split(filepath.Clean(path), string(filepath.Separator))
	if len(parts) >= 2 && strings.HasPrefix(parts[1], "volume") {
		return "/" + parts[1]
	}
	return "/"
}

func getPhysicalBlocks(fi os.FileInfo) int64 {
	if sys := fi.Sys(); sys != nil {
		if stat, ok := sys.(*syscall.Stat_t); ok {
			return int64(stat.Blocks) * 512
		}
	}
	return fi.Size()
}
