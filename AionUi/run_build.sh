#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

export ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
export ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/
export DEBUG=electron-builder

echo "Starting build at $(date)" > build.log
/usr/local/bin/node scripts/build-with-builder.js arm64 --mac --arm64 >> build.log 2>&1
echo "Finished build at $(date)" >> build.log
