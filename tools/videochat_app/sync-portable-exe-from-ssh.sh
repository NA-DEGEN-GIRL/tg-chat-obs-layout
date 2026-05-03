#!/usr/bin/env bash
set -euo pipefail

# Run this on the receiving WSL/Linux machine.
# It pulls the portable Windows Electron exe from the SSH host.

HOST="${TG_SYNC_HOST:-na_stream}"
REMOTE="${TG_SYNC_REMOTE:-/home/na_stream/tg-chat-obs-layout/tools/videochat_app/dist/TG 9393 Overlay App-0.1.0-x64.exe}"
INTERVAL="${TG_SYNC_INTERVAL:-5}"
ONCE="${TG_SYNC_ONCE:-0}"
DRY_RUN="${TG_SYNC_DRY_RUN:-0}"

default_local_dir() {
  if command -v cmd.exe >/dev/null 2>&1 && command -v wslpath >/dev/null 2>&1; then
    local win_profile
    win_profile="$(cmd.exe /c "echo %USERPROFILE%" 2>/dev/null | tr -d '\r' | tail -n 1)"
    if [[ -n "$win_profile" ]]; then
      wslpath "$win_profile/Desktop/tg-videochat-dist" 2>/dev/null && return
    fi
  fi
  printf '%s\n' "$HOME/tg-videochat-dist"
}

LOCAL="${TG_SYNC_LOCAL:-$(default_local_dir)}"

if ! command -v rsync >/dev/null 2>&1; then
  echo "rsync is missing. Install it in this WSL: sudo apt update && sudo apt install -y rsync openssh-client" >&2
  exit 1
fi

if ! command -v ssh >/dev/null 2>&1; then
  echo "ssh is missing. Install it in this WSL: sudo apt update && sudo apt install -y openssh-client" >&2
  exit 1
fi

mkdir -p "$LOCAL"

RSYNC_FLAGS=(-az --partial --human-readable --itemize-changes)
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
