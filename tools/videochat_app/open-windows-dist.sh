#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST_DIR="$APP_DIR/dist"

unc_path() {
  local linux_path="$1"
  local distro="${WSL_DISTRO_NAME:-na_stream}"
  local relative="${linux_path#/}"
  printf '\\\\wsl.localhost\\%s\\%s' "$distro" "${relative//\//\\}"
}

if [[ ! -d "$DIST_DIR" ]]; then
  echo "dist directory does not exist yet. Build first with: npm run build:win" >&2
  exit 1
fi

if [[ ! -r /proc/sys/fs/binfmt_misc/WSLInterop ]]; then
  echo "WSL Windows interop is not active in this session." >&2
  echo "Open this path from Windows Explorer instead:" >&2
  echo "  $(unc_path "$DIST_DIR")" >&2
  exit 126
fi

if command -v explorer.exe >/dev/null 2>&1; then
  EXPLORER_EXE="explorer.exe"
elif [[ -x /mnt/c/Windows/explorer.exe ]]; then
  EXPLORER_EXE="/mnt/c/Windows/explorer.exe"
else
  echo "explorer.exe is not available. Enable WSL Windows interop or open this UNC path manually:" >&2
  echo "\\\\wsl.localhost\\na_stream\\home\\na_stream\\tg-chat-obs-layout\\tools\\videochat_app\\dist" >&2
  exit 1
fi

if ! WIN_DIST_DIR="$(wslpath -w "$DIST_DIR")"; then
  WIN_DIST_DIR="$(unc_path "$DIST_DIR")"
fi

exec "$EXPLORER_EXE" "$WIN_DIST_DIR"
