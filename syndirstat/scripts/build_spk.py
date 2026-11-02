#!/usr/bin/env python3
"""
SynDirStat SPK Packager for Synology DSM 7
Constructs true POSIX GNU tar SPK archives compatible with Synology DSM Package Center.
"""
import hashlib
import os
import shutil
import sys
import tarfile

def get_md5(filepath):
    h = hashlib.md5()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()

def make_package_tgz(package_content_dir, output_file):
    with tarfile.open(output_file, "w:gz", format=tarfile.GNU_FORMAT) as tar:
        for root, dirs, files in sorted(os.walk(package_content_dir)):
            dirs.sort()
            files.sort()
            for d in dirs:
                dp = os.path.join(root, d)
                rel = os.path.relpath(dp, package_content_dir)
                ti = tar.gettarinfo(dp, arcname=rel)
                ti.uid = 0
                ti.gid = 0
                ti.uname = "root"
                ti.gname = "root"
                ti.mode = 0o755
                tar.addfile(ti)
            for f in files:
                fp = os.path.join(root, f)
                rel = os.path.relpath(fp, package_content_dir)
                ti = tar.gettarinfo(fp, arcname=rel)
                ti.uid = 0
                ti.gid = 0
                ti.uname = "root"
                ti.gname = "root"
                if rel.startswith("bin/"):
                    ti.mode = 0o755
                else:
                    ti.mode = 0o644
                with open(fp, "rb") as content:
                    tar.addfile(ti, content)

def assemble_spk(work_dir, output_spk):
    # Strict order for DSM package parser:
    # 1. package.tgz
    # 2. INFO
    # 3. scripts/
    # 4. conf/
    # 5. PACKAGE_ICON.PNG
    # 6. PACKAGE_ICON_256.PNG
    ordered_items = [
        "package.tgz",
        "INFO",
        "scripts",
        "conf",
        "PACKAGE_ICON.PNG",
        "PACKAGE_ICON_256.PNG"
    ]
    with tarfile.open(output_spk, "w", format=tarfile.GNU_FORMAT) as tar:
        for item in ordered_items:
            item_path = os.path.join(work_dir, item)
            if not os.path.exists(item_path):
                continue
            if os.path.isdir(item_path):
                ti = tar.gettarinfo(item_path, arcname=item)
                ti.uid = 0
                ti.gid = 0
                ti.uname = "root"
                ti.gname = "root"
                ti.mode = 0o755
                tar.addfile(ti)
                for root, dirs, files in sorted(os.walk(item_path)):
                    dirs.sort()
                    files.sort()
                    for f in files:
                        fp = os.path.join(root, f)
                        rel = os.path.relpath(fp, work_dir)
                        sub_ti = tar.gettarinfo(fp, arcname=rel)
                        sub_ti.uid = 0
                        sub_ti.gid = 0
                        sub_ti.uname = "root"
                        sub_ti.gname = "root"
                        if "scripts" in rel:
                            sub_ti.mode = 0o755
                        else:
                            sub_ti.mode = 0o644
                        with open(fp, "rb") as content:
                            tar.addfile(sub_ti, content)
            else:
                ti = tar.gettarinfo(item_path, arcname=item)
                ti.uid = 0
                ti.gid = 0
                ti.uname = "root"
                ti.gname = "root"
                ti.mode = 0o644
                with open(item_path, "rb") as content:
                    tar.addfile(ti, content)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: build_spk.py <work_dir> <output_spk>")
        sys.exit(1)
    work_dir = sys.argv[1]
    output_spk = sys.argv[2]
    assemble_spk(work_dir, output_spk)
