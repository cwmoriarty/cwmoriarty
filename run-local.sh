#!/usr/bin/env bash
# Quickstart launcher for SynDirStat local preview on macOS / Linux

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN="${DIR}/syndirstat/build/bin/syndirstat-local"
PORT=8742

if [ ! -f "${BIN}" ]; then
    echo "Compiling syndirstat-local binary..."
    "${DIR}/syndirstat/scripts/build.sh"
fi

echo "======================================================"
echo " Starting SynDirStat Local Server on port ${PORT}..."
echo " Opening http://localhost:${PORT}/ in your browser..."
echo "======================================================"

if [[ "$OSTYPE" == "darwin"* ]]; then
  (sleep 1 && open "http://localhost:${PORT}/") &
fi

"${BIN}" --host 127.0.0.1 --port ${PORT}
