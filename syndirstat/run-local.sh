#!/usr/bin/env bash
# Quickstart launcher for SynDirStat local preview on macOS / Linux

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT=8742

if [ -f "${DIR}/build/bin/syndirstat-local" ]; then
    BIN="${DIR}/build/bin/syndirstat-local"
elif [ -f "${DIR}/syndirstat/build/bin/syndirstat-local" ]; then
    BIN="${DIR}/syndirstat/build/bin/syndirstat-local"
else
    echo "Compiling syndirstat-local binary..."
    if [ -f "${DIR}/scripts/build.sh" ]; then
        "${DIR}/scripts/build.sh"
        BIN="${DIR}/build/bin/syndirstat-local"
    elif [ -f "${DIR}/syndirstat/scripts/build.sh" ]; then
        "${DIR}/syndirstat/scripts/build.sh"
        BIN="${DIR}/syndirstat/build/bin/syndirstat-local"
    fi
fi

echo "======================================================"
echo " Starting SynDirStat Local Server on port ${PORT}..."
echo " Opening http://localhost:${PORT}/ in your browser..."
echo "======================================================"

if [[ "$OSTYPE" == "darwin"* ]]; then
  (sleep 1 && open "http://localhost:${PORT}/") &
fi

"${BIN}" --host 127.0.0.1 --port ${PORT}
