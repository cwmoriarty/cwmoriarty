package models

import "time"

// VolumeInfo describes a filesystem volume (e.g., /volume1)
type VolumeInfo struct {
	ID             string       `json:"id"`
	Name           string       `json:"name"`
	MountPath      string       `json:"mount_path"`
	TotalBytes     uint64       `json:"total_bytes"`
	UsedBytes      uint64       `json:"used_bytes"`
	FreeBytes      uint64       `json:"free_bytes"`
	PercentUsed    float64      `json:"percent_used"`
	FilesystemType string       `json:"filesystem_type"` // btrfs, ext4, etc.
	IsSynology     bool         `json:"is_synology"`
	Shares         []SharedFolder `json:"shares"`
}

// SharedFolder represents a top-level share on a volume
type SharedFolder struct {
	Name      string `json:"name"`
	Path      string `json:"path"`
	IsRecycle bool   `json:"is_recycle"`
}

// FileNode represents a single directory or file node in the treemap hierarchy
type FileNode struct {
	Name         string      `json:"name"`
	Path         string      `json:"path"`
	IsDir        bool        `json:"is_dir"`
	Size         int64       `json:"size"`          // Logical size in bytes
	Allocated    int64       `json:"allocated"`     // Physical block allocation (blocks * 512)
	Mtime        int64       `json:"mtime"`         // Unix timestamp seconds
	Ext          string      `json:"ext,omitempty"` // Extension (.mkv, .zip, etc.)
	Files        int64       `json:"files,omitempty"`
	Dirs         int64       `json:"dirs,omitempty"`
	Children     []*FileNode `json:"children,omitempty"`
	IsRecycle    bool        `json:"is_recycle,omitempty"`
	IsSynoMeta   bool        `json:"is_syno_meta,omitempty"`
	Error        string      `json:"error,omitempty"`
}

// ExtensionStat aggregates storage consumed by a file extension
type ExtensionStat struct {
	Ext        string  `json:"ext"`
	Size       int64   `json:"size"`
	Allocated  int64   `json:"allocated"`
	Count      int64   `json:"count"`
	Percentage float64 `json:"percentage"`
}

// ScanSnapshot is a persisted historical snapshot of a filesystem scan
type ScanSnapshot struct {
	ID             string          `json:"id"`
	CreatedAt      time.Time       `json:"created_at"`
	VolumePath     string          `json:"volume_path"`
	RootPath       string          `json:"root_path"`
	TotalBytes     int64           `json:"total_bytes"`
	TotalAllocated int64           `json:"total_allocated"`
	TotalFiles     int64           `json:"total_files"`
	TotalDirs      int64           `json:"total_dirs"`
	DurationSecs   float64         `json:"duration_secs"`
	Root           *FileNode       `json:"root,omitempty"`
	Extensions     []ExtensionStat `json:"extensions,omitempty"`
	VolumeInfo     *VolumeInfo     `json:"volume_info,omitempty"`
}

// SnapshotSummary is a lightweight representation for history listings
type SnapshotSummary struct {
	ID             string    `json:"id"`
	CreatedAt      time.Time `json:"created_at"`
	VolumePath     string    `json:"volume_path"`
	RootPath       string    `json:"root_path"`
	TotalBytes     int64     `json:"total_bytes"`
	TotalAllocated int64     `json:"total_allocated"`
	TotalFiles     int64     `json:"total_files"`
	TotalDirs      int64     `json:"total_dirs"`
	DurationSecs   float64   `json:"duration_secs"`
}

// ScanProgress communicates real-time progress over SSE or polling
type ScanProgress struct {
	Active         bool    `json:"active"`
	CurrentPath    string  `json:"current_path"`
	ScannedFiles   int64   `json:"scanned_files"`
	ScannedDirs    int64   `json:"scanned_dirs"`
	ScannedBytes   int64   `json:"scanned_bytes"`
	ElapsedSeconds float64 `json:"elapsed_seconds"`
	ScanRate       int64   `json:"scan_rate"` // files per second
	Error          string  `json:"error,omitempty"`
	HasResult      bool    `json:"has_result"`
	SnapshotID     string  `json:"snapshot_id,omitempty"`
}

// ChangedFile tracks additions, deletions, or modifications between scans
type ChangedFile struct {
	Path     string `json:"path"`
	Name     string `json:"name"`
	Ext      string `json:"ext"`
	OldSize  int64  `json:"old_size"`
	NewSize  int64  `json:"new_size"`
	SizeDiff int64  `json:"size_diff"`
	OldMtime int64  `json:"old_mtime"`
	NewMtime int64  `json:"new_mtime"`
	Change   string `json:"change"` // "created", "deleted", "modified"
}

// ChangedDirectory tracks growing or shrinking directory branches
type ChangedDirectory struct {
	Path     string `json:"path"`
	OldSize  int64  `json:"old_size"`
	NewSize  int64  `json:"new_size"`
	SizeDiff int64  `json:"size_diff"`
	OldFiles int64  `json:"old_files"`
	NewFiles int64  `json:"new_files"`
}

// ComparisonResult represents a full diff between two historical scans
type ComparisonResult struct {
	BaseSnapshotID     string             `json:"base_snapshot_id"`
	BaseCreatedAt      time.Time          `json:"base_created_at"`
	TargetSnapshotID   string             `json:"target_snapshot_id"`
	TargetCreatedAt    time.Time          `json:"target_created_at"`
	Path               string             `json:"path"`
	NetBytesDiff       int64              `json:"net_bytes_diff"`
	NetFilesDiff       int64              `json:"net_files_diff"`
	CreatedFiles       []ChangedFile      `json:"created_files"`
	DeletedFiles       []ChangedFile      `json:"deleted_files"`
	ModifiedFiles      []ChangedFile      `json:"modified_files"`
	GrowingDirectories []ChangedDirectory `json:"growing_directories"`
	ShrinkingDirs      []ChangedDirectory `json:"shrinking_directories"`
}

// AppSettings stores user preferences and retention policy
type AppSettings struct {
	RetentionDays   int    `json:"retention_days"`
	MaxSnapshots    int    `json:"max_snapshots"`
	Theme           string `json:"theme"`            // "dark" or "light"
	TreemapShading  string `json:"treemap_shading"`  // "cushion" or "flat"
	TreemapColorBy  string `json:"treemap_color_by"` // "extension", "folder", "depth"
	MinRectSize     int    `json:"min_rect_size"`    // minimum pixel area
}
