export interface SharedFolder {
  name: string;
  path: string;
  is_recycle: boolean;
}

export interface VolumeInfo {
  id: string;
  name: string;
  mount_path: string;
  total_bytes: number;
  used_bytes: number;
  free_bytes: number;
  percent_used: number;
  filesystem_type: string;
  is_synology: boolean;
  shares?: SharedFolder[];
}

export interface FileNode {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  allocated?: number;
  mtime: number;
  ext?: string;
  files?: number;
  dirs?: number;
  children?: FileNode[];
  is_recycle?: boolean;
  is_syno_meta?: boolean;
  error?: string;
}

export interface ExtensionStat {
  ext: string;
  size: number;
  allocated: number;
  count: number;
  percentage: number;
}

export interface ScanSnapshot {
  id: string;
  created_at: string;
  volume_path: string;
  root_path: string;
  total_bytes: number;
  total_allocated: number;
  total_files: number;
  total_dirs: number;
  duration_secs: number;
  root?: FileNode;
  extensions?: ExtensionStat[];
  volume_info?: VolumeInfo;
}

export interface SnapshotSummary {
  id: string;
  created_at: string;
  volume_path: string;
  root_path: string;
  total_bytes: number;
  total_allocated: number;
  total_files: number;
  total_dirs: number;
  duration_secs: number;
}

export interface ScanProgress {
  active: boolean;
  current_path: string;
  scanned_files: number;
  scanned_dirs: number;
  scanned_bytes: number;
  elapsed_seconds: number;
  scan_rate: number;
  error?: string;
  has_result: boolean;
  snapshot_id?: string;
}

export interface ChangedFile {
  path: string;
  name: string;
  ext: string;
  old_size: number;
  new_size: number;
  size_diff: number;
  old_mtime: number;
  new_mtime: number;
  change: 'created' | 'deleted' | 'modified';
}

export interface ChangedDirectory {
  path: string;
  old_size: number;
  new_size: number;
  size_diff: number;
  old_files: number;
  new_files: number;
}

export interface ComparisonResult {
  base_snapshot_id: string;
  base_created_at: string;
  target_snapshot_id: string;
  target_created_at: string;
  path: string;
  net_bytes_diff: number;
  net_files_diff: number;
  created_files: ChangedFile[];
  deleted_files: ChangedFile[];
  modified_files: ChangedFile[];
  growing_directories: ChangedDirectory[];
  shrinking_directories: ChangedDirectory[];
}

export type ViewTab = 'overview' | 'treemap' | 'files' | 'directories' | 'filetypes' | 'history' | 'settings';
