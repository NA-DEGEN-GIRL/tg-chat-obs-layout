#!/usr/bin/env bash
set -euo pipefail

# Run this on the receiving WSL/Linux machine.
# It pulls only changed files from the SSH host's Electron win-unpacked folder.

HOST="${TG_SYNC_HOST:-na_stream}"
REMOTE="${TG_SYNC_REMOTE:-/home/na_stream/tg-chat-obs-layout/tools/videochat_app/dist/win-unpacked/}"
LOCAL="${TG_SYNC_LOCAL:-$HOME/tg-videochat-app}"
INTERVAL="${TG_SYNC_INTERVAL:-5}"
ONCE="${TG_SYNC_ONCE:-0}"
DRY_RUN="${TG_SYNC_DRY_RUN:-0}"
DELETE="${TG_SYNC_DELETE:-1}"

if ! command -v rsync >/dev/null 2>&1; then
  echo "rsync is missing. Install it in this WSL: sudo apt update && sudo apt install -y rsync openssh-client" >&2
  exit 1
fi

if ! command -v ssh >/dev/null 2>&1; then
  echo "ssh is missing. Install it in this WSL: sudo apt update && sudo apt install -y openssh-client" >&2
  exit 1
fi

REMOTE="${REMOTE%/}/"
LOCAL="${LOCAL%/}"
mkdir -p "$LOCAL"

RSYNC_FLAGS=(-az --partial --human-readable --itemize-changes)
if [[ "$DELETE" != "0" ]]; then
  RSYNC_FLAGS+=(--delete)
fi
if [[ "$DRY_RUN" == "1" ]]; then
  RSYNC_FLAGS+=(--dry-run)
fi

sync_once() {
  local started
  started="$(date '+%Y-%m-%d %H:%M:%S')"
  echo "[$started] syncing $HOST:$REMOTE -> $LOCAL/"
  rsync "${RSYNC_FLAGS[@]}" -e ssh "$HOST:$REMOTE" "$LOCAL/"
}

if [[ "$ONCE" == "1" ]]; then
  sync_once
  exit 0
fi

echo "Watching by polling every ${INTERVAL}s. Stop with Ctrl+C."
while true; do
  sync_once
  sleep "$INTERVAL"
done
