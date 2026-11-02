package main

import (
	"context"
	"embed"
	"flag"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"syndirstat/internal/api"
	"syndirstat/internal/db"
	"syndirstat/internal/scanner"
)

//go:embed dist/*
var embeddedFrontend embed.FS

func main() {
	var (
		host    = flag.String("host", "0.0.0.0", "HTTP host binding")
		port    = flag.Int("port", 8742, "HTTP listening port")
		dataDir = flag.String("data-dir", "", "Path to persistent data directory (for SQLite DB)")
		version = flag.Bool("version", false, "Print application version")
	)
	flag.Parse()

	const AppVersion = "1.0.0"

	if *version {
		fmt.Printf("SynDirStat v%s (Synology DSM 7 Storage Analyzer)\n", AppVersion)
		os.Exit(0)
	}

	// Determine data directory
	actualDataDir := *dataDir
	if actualDataDir == "" {
		// Synology Package Center standard var directory
		synoVar := "/var/packages/syn-dirstat/var"
		if fi, err := os.Stat("/var/packages/syn-dirstat"); err == nil && fi.IsDir() {
			actualDataDir = synoVar
		} else {
			// Local development fallback
			home, _ := os.UserHomeDir()
			actualDataDir = filepath.Join(home, ".syndirstat")
		}
	}

	log.Printf("[SynDirStat] Starting daemon v%s...", AppVersion)
	log.Printf("[SynDirStat] Data directory: %s", actualDataDir)

	// Initialize SQLite Database
	database, err := db.NewDatabase(actualDataDir)
	if err != nil {
		log.Fatalf("[SynDirStat] FATAL: Database initialization error: %v", err)
	}
	defer database.Close()

	// Initialize Scanner
	fsScanner := scanner.NewScanner()

	// Extract sub-filesystem for embedded frontend if present
	var webFS fs.FS
	sub, err := fs.Sub(embeddedFrontend, "dist")
	if err == nil {
		webFS = sub
	}

	// Initialize HTTP API Server
	apiServer := api.NewServer(fsScanner, database, webFS)

	serverAddr := fmt.Sprintf("%s:%d", *host, *port)
	httpServer := &http.Server{
		Addr:         serverAddr,
		Handler:      apiServer,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// Graceful shutdown handling
	stopChan := make(chan os.Signal, 1)
	signal.Notify(stopChan, os.Interrupt, syscall.SIGTERM, syscall.SIGQUIT)

	go func() {
		log.Printf("[SynDirStat] HTTP server listening on http://%s/", serverAddr)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[SynDirStat] Server failed: %v", err)
		}
	}()

	sig := <-stopChan
	log.Printf("[SynDirStat] Received termination signal (%v), shutting down gracefully...", sig)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	fsScanner.Cancel()
	if err := httpServer.Shutdown(ctx); err != nil {
		log.Printf("[SynDirStat] Server shutdown warning: %v", err)
	}

	log.Println("[SynDirStat] Cleanly stopped.")
}
