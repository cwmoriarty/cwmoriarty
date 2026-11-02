package db

import (
	"bytes"
	"compress/gzip"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"time"

	"github.com/google/uuid"
	_ "modernc.org/sqlite"

	"syndirstat/internal/models"
)

// Database manages SQLite historical scan persistence and differential analysis
type Database struct {
	dbPath string
	db     *sql.DB
	mu     sync.RWMutex
}

// NewDatabase initializes SQLite storage with required schemas
func NewDatabase(dataDir string) (*Database, error) {
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create database directory: %w", err)
	}

	dbPath := filepath.Join(dataDir, "syndirstat.db")
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open sqlite database: %w", err)
	}

	// Performance tuning pragmas
	pragmas := []string{
		"PRAGMA journal_mode = WAL;",
		"PRAGMA synchronous = NORMAL;",
		"PRAGMA temp_store = MEMORY;",
		"PRAGMA foreign_keys = ON;",
	}
	for _, pragma := range pragmas {
		if _, err := db.Exec(pragma); err != nil {
			return nil, fmt.Errorf("failed executing pragma %s: %w", pragma, err)
		}
	}

	d := &Database{
		dbPath: dbPath,
		db:     db,
	}

	if err := d.migrate(); err != nil {
		return nil, err
	}

	return d, nil
}

func (d *Database) Close() error {
	return d.db.Close()
}

func (d *Database) migrate() error {
	schema := `
	CREATE TABLE IF NOT EXISTS snapshots (
		id TEXT PRIMARY KEY,
		created_at DATETIME NOT NULL,
		volume_path TEXT NOT NULL,
		root_path TEXT NOT NULL,
		total_bytes INTEGER NOT NULL,
		total_allocated INTEGER NOT NULL,
		total_files INTEGER NOT NULL,
		total_dirs INTEGER NOT NULL,
		duration_secs REAL NOT NULL,
		extensions_json TEXT,
		tree_gzip BLOB NOT NULL
	);
	CREATE INDEX IF NOT EXISTS idx_snapshots_created ON snapshots(created_at DESC);
	CREATE INDEX IF NOT EXISTS idx_snapshots_root ON snapshots(root_path);

	CREATE TABLE IF NOT EXISTS settings (
		key TEXT PRIMARY KEY,
		value TEXT NOT NULL
	);
	`
	_, err := d.db.Exec(schema)
	return err
}

// SaveSnapshot compresses and saves a full scan snapshot
func (d *Database) SaveSnapshot(s *models.ScanSnapshot) (string, error) {
	d.mu.Lock()
	defer d.mu.Unlock()

	if s.ID == "" {
		s.ID = uuid.New().String()
	}
	if s.CreatedAt.IsZero() {
		s.CreatedAt = time.Now()
	}

	// Compress tree JSON to minimize disk footprint on the NAS
	treeBytes, err := json.Marshal(s.Root)
	if err != nil {
		return "", fmt.Errorf("failed marshaling tree: %w", err)
	}

	var buf bytes.Buffer
	gw := gzip.NewWriter(&buf)
	if _, err := gw.Write(treeBytes); err != nil {
		return "", fmt.Errorf("failed compressing tree: %w", err)
	}
	if err := gw.Close(); err != nil {
		return "", fmt.Errorf("failed closing gzip writer: %w", err)
	}

	extsJSON, _ := json.Marshal(s.Extensions)

	query := `
	INSERT INTO snapshots (
		id, created_at, volume_path, root_path, total_bytes, total_allocated,
		total_files, total_dirs, duration_secs, extensions_json, tree_gzip
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
	`
	_, err = d.db.Exec(
		query,
		s.ID,
		s.CreatedAt.Format(time.RFC3339),
		s.VolumePath,
		s.RootPath,
		s.TotalBytes,
		s.TotalAllocated,
		s.TotalFiles,
		s.TotalDirs,
		s.DurationSecs,
		string(extsJSON),
		buf.Bytes(),
	)
	if err != nil {
		return "", fmt.Errorf("failed inserting snapshot: %w", err)
	}

	return s.ID, nil
}

// ListSnapshots returns summary list of historical scans
func (d *Database) ListSnapshots(limit int) ([]models.SnapshotSummary, error) {
	d.mu.RLock()
	defer d.mu.RUnlock()

	if limit <= 0 {
		limit = 100
	}

	query := `
	SELECT id, created_at, volume_path, root_path, total_bytes, total_allocated, total_files, total_dirs, duration_secs
	FROM snapshots
	ORDER BY created_at DESC
	LIMIT ?;
	`
	rows, err := d.db.Query(query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var summaries []models.SnapshotSummary
	for rows.Next() {
		var s models.SnapshotSummary
		var createdAtStr string
		if err := rows.Scan(
			&s.ID, &createdAtStr, &s.VolumePath, &s.RootPath,
			&s.TotalBytes, &s.TotalAllocated, &s.TotalFiles, &s.TotalDirs, &s.DurationSecs,
		); err != nil {
			return nil, err
		}
		s.CreatedAt, _ = time.Parse(time.RFC3339, createdAtStr)
		summaries = append(summaries, s)
	}

	return summaries, nil
}

// GetSnapshot retrieves and decompresses a full snapshot by ID
func (d *Database) GetSnapshot(id string) (*models.ScanSnapshot, error) {
	d.mu.RLock()
	defer d.mu.RUnlock()

	query := `
	SELECT id, created_at, volume_path, root_path, total_bytes, total_allocated,
	       total_files, total_dirs, duration_secs, extensions_json, tree_gzip
	FROM snapshots
	WHERE id = ?;
	`
	row := d.db.QueryRow(query, id)

	var s models.ScanSnapshot
	var createdAtStr, extsJSON string
	var gzipData []byte

	if err := row.Scan(
		&s.ID, &createdAtStr, &s.VolumePath, &s.RootPath,
		&s.TotalBytes, &s.TotalAllocated, &s.TotalFiles, &s.TotalDirs,
		&s.DurationSecs, &extsJSON, &gzipData,
	); err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("snapshot not found: %s", id)
		}
		return nil, err
	}

	s.CreatedAt, _ = time.Parse(time.RFC3339, createdAtStr)
	_ = json.Unmarshal([]byte(extsJSON), &s.Extensions)

	// Decompress tree
	gr, err := gzip.NewReader(bytes.NewReader(gzipData))
	if err != nil {
		return nil, fmt.Errorf("failed initializing gzip reader: %w", err)
	}
	defer gr.Close()

	rawTree, err := io.ReadAll(gr)
	if err != nil {
		return nil, fmt.Errorf("failed reading decompressed tree: %w", err)
	}

	var rootNode models.FileNode
	if err := json.Unmarshal(rawTree, &rootNode); err != nil {
		return nil, fmt.Errorf("failed unmarshaling tree node: %w", err)
	}
	s.Root = &rootNode

	return &s, nil
}

// DeleteSnapshot removes a historical snapshot
func (d *Database) DeleteSnapshot(id string) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	_, err := d.db.Exec("DELETE FROM snapshots WHERE id = ?", id)
	return err
}

// PruneRetention enforces snapshot retention policies
func (d *Database) PruneRetention(maxDays int, maxCount int) (int64, error) {
	d.mu.Lock()
	defer d.mu.Unlock()

	var deletedCount int64

	// Prune by date
	if maxDays > 0 {
		cutoff := time.Now().AddDate(0, 0, -maxDays).Format(time.RFC3339)
		res, err := d.db.Exec("DELETE FROM snapshots WHERE created_at < ?", cutoff)
		if err == nil {
			n, _ := res.RowsAffected()
			deletedCount += n
		}
	}

	// Prune by count
	if maxCount > 0 {
		query := `
		DELETE FROM snapshots WHERE id NOT IN (
			SELECT id FROM snapshots ORDER BY created_at DESC LIMIT ?
		);
		`
		res, err := d.db.Exec(query, maxCount)
		if err == nil {
			n, _ := res.RowsAffected()
			deletedCount += n
		}
	}

	return deletedCount, nil
}

// CompareSnapshots analyzes structural differences between two historical scans
func (d *Database) CompareSnapshots(baseID, targetID string) (*models.ComparisonResult, error) {
	base, err := d.GetSnapshot(baseID)
	if err != nil {
		return nil, fmt.Errorf("failed loading base snapshot: %w", err)
	}
	target, err := d.GetSnapshot(targetID)
	if err != nil {
		return nil, fmt.Errorf("failed loading target snapshot: %w", err)
	}

	// Index files and directories of base snapshot
	baseFiles := make(map[string]*models.FileNode)
	baseDirs := make(map[string]*models.FileNode)
	indexTree(base.Root, baseFiles, baseDirs)

	// Index files and directories of target snapshot
	targetFiles := make(map[string]*models.FileNode)
	targetDirs := make(map[string]*models.FileNode)
	indexTree(target.Root, targetFiles, targetDirs)

	var createdFiles []models.ChangedFile
	var deletedFiles []models.ChangedFile
	var modifiedFiles []models.ChangedFile

	// Detect created and modified files
	for path, targetFile := range targetFiles {
		baseFile, exists := baseFiles[path]
		if !exists {
			createdFiles = append(createdFiles, models.ChangedFile{
				Path:     path,
				Name:     targetFile.Name,
				Ext:      targetFile.Ext,
				OldSize:  0,
				NewSize:  targetFile.Size,
				SizeDiff: targetFile.Size,
				OldMtime: 0,
				NewMtime: targetFile.Mtime,
				Change:   "created",
			})
		} else if baseFile.Size != targetFile.Size || baseFile.Mtime != targetFile.Mtime {
			modifiedFiles = append(modifiedFiles, models.ChangedFile{
				Path:     path,
				Name:     targetFile.Name,
				Ext:      targetFile.Ext,
				OldSize:  baseFile.Size,
				NewSize:  targetFile.Size,
				SizeDiff: targetFile.Size - baseFile.Size,
				OldMtime: baseFile.Mtime,
				NewMtime: targetFile.Mtime,
				Change:   "modified",
			})
		}
	}

	// Detect deleted files
	for path, baseFile := range baseFiles {
		if _, exists := targetFiles[path]; !exists {
			deletedFiles = append(deletedFiles, models.ChangedFile{
				Path:     path,
				Name:     baseFile.Name,
				Ext:      baseFile.Ext,
				OldSize:  baseFile.Size,
				NewSize:  0,
				SizeDiff: -baseFile.Size,
				OldMtime: baseFile.Mtime,
				NewMtime: 0,
				Change:   "deleted",
			})
		}
	}

	// Detect growing and shrinking directories
	var growingDirs []models.ChangedDirectory
	var shrinkingDirs []models.ChangedDirectory

	for path, targetDir := range targetDirs {
		baseDir, exists := baseDirs[path]
		if exists {
			diff := targetDir.Size - baseDir.Size
			if diff > 0 {
				growingDirs = append(growingDirs, models.ChangedDirectory{
					Path:     path,
					OldSize:  baseDir.Size,
					NewSize:  targetDir.Size,
					SizeDiff: diff,
					OldFiles: baseDir.Files,
					NewFiles: targetDir.Files,
				})
			} else if diff < 0 {
				shrinkingDirs = append(shrinkingDirs, models.ChangedDirectory{
					Path:     path,
					OldSize:  baseDir.Size,
					NewSize:  targetDir.Size,
					SizeDiff: diff,
					OldFiles: baseDir.Files,
					NewFiles: targetDir.Files,
				})
			}
		}
	}

	// Sort largest changes first
	sort.Slice(createdFiles, func(i, j int) bool { return createdFiles[i].SizeDiff > createdFiles[j].SizeDiff })
	sort.Slice(deletedFiles, func(i, j int) bool { return deletedFiles[i].SizeDiff < deletedFiles[j].SizeDiff })
	sort.Slice(modifiedFiles, func(i, j int) bool {
		d1 := abs(modifiedFiles[i].SizeDiff)
		d2 := abs(modifiedFiles[j].SizeDiff)
		return d1 > d2
	})
	sort.Slice(growingDirs, func(i, j int) bool { return growingDirs[i].SizeDiff > growingDirs[j].SizeDiff })
	sort.Slice(shrinkingDirs, func(i, j int) bool { return shrinkingDirs[i].SizeDiff < shrinkingDirs[j].SizeDiff })

	return &models.ComparisonResult{
		BaseSnapshotID:     base.ID,
		BaseCreatedAt:      base.CreatedAt,
		TargetSnapshotID:   target.ID,
		TargetCreatedAt:    target.CreatedAt,
		Path:               target.RootPath,
		NetBytesDiff:       target.TotalBytes - base.TotalBytes,
		NetFilesDiff:       target.TotalFiles - base.TotalFiles,
		CreatedFiles:       createdFiles,
		DeletedFiles:       deletedFiles,
		ModifiedFiles:      modifiedFiles,
		GrowingDirectories: growingDirs,
		ShrinkingDirs:      shrinkingDirs,
	}, nil
}

func indexTree(node *models.FileNode, files map[string]*models.FileNode, dirs map[string]*models.FileNode) {
	if node == nil {
		return
	}
	if node.IsDir {
		dirs[node.Path] = node
		for _, child := range node.Children {
			indexTree(child, files, dirs)
		}
	} else {
		files[node.Path] = node
	}
}

func abs(v int64) int64 {
	if v < 0 {
		return -v
	}
	return v
}
