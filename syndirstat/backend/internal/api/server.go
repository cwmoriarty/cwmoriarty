package api

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io/fs"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"syndirstat/internal/db"
	"syndirstat/internal/dsm"
	"syndirstat/internal/models"
	"syndirstat/internal/scanner"
)

// Server coordinates HTTP endpoints, database access, and scanning engines
type Server struct {
	scanner   *scanner.Scanner
	db        *db.Database
	frontendFS fs.FS
	mux       *http.ServeMux
}

// NewServer configures a new Server instance
func NewServer(scanner *scanner.Scanner, database *db.Database, frontendFS fs.FS) *Server {
	s := &Server{
		scanner:    scanner,
		db:         database,
		frontendFS: frontendFS,
		mux:        http.NewServeMux(),
	}
	s.registerRoutes()
	return s
}

func (s *Server) registerRoutes() {
	// API routes
	s.mux.HandleFunc("/api/volumes", s.handleVolumes)
	s.mux.HandleFunc("/api/scan", s.handleScan)
	s.mux.HandleFunc("/api/scan/cancel", s.handleScanCancel)
	s.mux.HandleFunc("/api/scan/status", s.handleScanStatus)
	s.mux.HandleFunc("/api/scan/events", s.handleScanEvents)
	s.mux.HandleFunc("/api/scan/latest", s.handleScanLatest)
	s.mux.HandleFunc("/api/history", s.handleHistoryList)
	s.mux.HandleFunc("/api/history/", s.handleHistoryItem)
	s.mux.HandleFunc("/api/history/compare", s.handleHistoryCompare)
	s.mux.HandleFunc("/api/export", s.handleExport)
	s.mux.HandleFunc("/api/health", s.handleHealth)

	// Embedded static frontend serving
	if s.frontendFS != nil {
		fileServer := http.FileServer(http.FS(s.frontendFS))
		s.mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
			path := strings.TrimPrefix(r.URL.Path, "/")
			if path == "" {
				path = "index.html"
			}
			// If file exists in embedded assets, serve it; otherwise serve index.html (SPA routing)
			if f, err := s.frontendFS.Open(path); err == nil {
				f.Close()
				fileServer.ServeHTTP(w, r)
			} else {
				r.URL.Path = "/index.html"
				fileServer.ServeHTTP(w, r)
			}
		})
	}
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// Security headers
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("X-Frame-Options", "SAMEORIGIN") // Allow embedding inside DSM desktop window iframe
	w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	s.mux.ServeHTTP(w, r)
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]interface{}{
		"success": false,
		"error":   message,
	})
}

func (s *Server) handleVolumes(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	volumes := dsm.DiscoverVolumes()
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"volumes": volumes,
	})
}

func (s *Server) handleScan(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req struct {
		Path string `json:"path"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Path == "" {
		writeError(w, http.StatusBadRequest, "Invalid request: 'path' is required")
		return
	}

	// Sanitize and validate path (Path traversal defense)
	cleanPath := filepath.Clean(req.Path)
	if !filepath.IsAbs(cleanPath) {
		writeError(w, http.StatusBadRequest, "Path must be absolute")
		return
	}

	if s.scanner.IsActive() {
		writeError(w, http.StatusConflict, "A scan is already in progress")
		return
	}

	// Trigger asynchronous scan
	go func(targetPath string) {
		snapshot, err := s.scanner.ScanPath(targetPath)
		if err == nil && snapshot != nil && s.db != nil {
			// Populate volume capacity
			volInfo := dsm.GetVolumeCapacity(targetPath)
			snapshot.VolumeInfo = &volInfo
			// Persist in historical SQLite database
			snapshotID, saveErr := s.db.SaveSnapshot(snapshot)
			if saveErr == nil {
				snapshot.ID = snapshotID
			}
		}
	}(cleanPath)

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": fmt.Sprintf("Scan initiated for %s", cleanPath),
		"status":  s.scanner.GetStatus(),
	})
}

func (s *Server) handleScanCancel(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	s.scanner.Cancel()
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Scan cancellation requested",
	})
}

func (s *Server) handleScanStatus(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, s.scanner.GetStatus())
}

func (s *Server) handleScanEvents(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	ch := s.scanner.SubscribeProgress()
	defer s.scanner.UnsubscribeProgress(ch)

	// Send initial status immediately
	initial, _ := json.Marshal(s.scanner.GetStatus())
	fmt.Fprintf(w, "data: %s\n\n", initial)
	flusher.Flush()

	notify := r.Context().Done()
	for {
		select {
		case <-notify:
			return
		case prog, open := <-ch:
			if !open {
				return
			}
			data, _ := json.Marshal(prog)
			fmt.Fprintf(w, "data: %s\n\n", data)
			flusher.Flush()
		}
	}
}

func (s *Server) handleScanLatest(w http.ResponseWriter, r *http.Request) {
	res := s.scanner.GetLatestResult()
	if res == nil {
		// Fallback to latest snapshot in SQLite
		summaries, err := s.db.ListSnapshots(1)
		if err == nil && len(summaries) > 0 {
			res, _ = s.db.GetSnapshot(summaries[0].ID)
		}
	}
	if res == nil {
		writeError(w, http.StatusNotFound, "No scan result available yet")
		return
	}
	writeJSON(w, http.StatusOK, res)
}

func (s *Server) handleHistoryList(w http.ResponseWriter, r *http.Request) {
	limit := 100
	if l := r.URL.Query().Get("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
			limit = parsed
		}
	}
	summaries, err := s.db.ListSnapshots(limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success":   true,
		"snapshots": summaries,
	})
}

func (s *Server) handleHistoryItem(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/history/")
	if id == "" || id == "compare" {
		writeError(w, http.StatusBadRequest, "Invalid snapshot ID")
		return
	}

	switch r.Method {
	case http.MethodGet:
		snapshot, err := s.db.GetSnapshot(id)
		if err != nil {
			writeError(w, http.StatusNotFound, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, snapshot)
	case http.MethodDelete:
		if err := s.db.DeleteSnapshot(id); err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"success": true,
			"message": "Snapshot deleted",
		})
	default:
		writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
	}
}

func (s *Server) handleHistoryCompare(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req struct {
		BaseID   string `json:"base_id"`
		TargetID string `json:"target_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.BaseID == "" || req.TargetID == "" {
		writeError(w, http.StatusBadRequest, "Both 'base_id' and 'target_id' are required")
		return
	}

	diff, err := s.db.CompareSnapshots(req.BaseID, req.TargetID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, diff)
}

func (s *Server) handleExport(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Query().Get("id")
	format := strings.ToLower(r.URL.Query().Get("format"))
	if format == "" {
		format = "json"
	}

	var snapshot *models.ScanSnapshot
	var err error
	if id != "" {
		snapshot, err = s.db.GetSnapshot(id)
	} else {
		snapshot = s.scanner.GetLatestResult()
	}
	if err != nil || snapshot == nil {
		writeError(w, http.StatusNotFound, "Snapshot not found for export")
		return
	}

	filename := fmt.Sprintf("syndirstat_%s_%d", filepath.Base(snapshot.RootPath), time.Now().Unix())

	if format == "csv" {
		w.Header().Set("Content-Type", "text/csv")
		w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s.csv\"", filename))
		writer := csv.NewWriter(w)
		_ = writer.Write([]string{"Path", "Name", "Type", "Size_Bytes", "Allocated_Bytes", "Files", "Folders", "Modified"})

		var dumpNode func(n *models.FileNode)
		dumpNode = func(n *models.FileNode) {
			nodeType := "Directory"
			if !n.IsDir {
				nodeType = n.Ext
			}
			_ = writer.Write([]string{
				n.Path,
				n.Name,
				nodeType,
				strconv.FormatInt(n.Size, 10),
				strconv.FormatInt(n.Allocated, 10),
				strconv.FormatInt(n.Files, 10),
				strconv.FormatInt(n.Dirs, 10),
				time.Unix(n.Mtime, 0).Format(time.RFC3339),
			})
			for _, child := range n.Children {
				dumpNode(child)
			}
		}
		dumpNode(snapshot.Root)
		writer.Flush()
		return
	}

	// JSON format
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s.json\"", filename))
	_ = json.NewEncoder(w).Encode(snapshot)
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status":    "healthy",
		"app":       "SynDirStat",
		"version":   "1.0.0",
		"timestamp": time.Now().Unix(),
	})
}
