#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXE="$APP_DIR/dist/TG 9393 Overlay App-0.1.0-x64.exe"

unc_path() {
  local linux_path="$1"
  local distro="${WSL_DISTRO_NAME:-na_stream}"
  local relative="${linux_path#/}"
  printf '\\\\wsl.localhost\\%s\\%s' "$distro" "${relative//\//\\}"
}

print_windows_fallback() {
  local win_exe="$1"
  shift
  echo "WSL Windows interop is not active in this session." >&2
  echo "Run this from Windows PowerShell instead:" >&2
  printf '  Start-Process "%s"' "$win_exe" >&2
  if [[ $# -gt 0 ]]; then
    printf ' -ArgumentList ' >&2
    local first=1
    local arg
    for arg in "$@"; do
      if [[ $first -eq 0 ]]; then
        printf ',' >&2
      fi
      first=0
      printf '"%s"' "$arg" >&2
    done
  fi
  printf '\n' >&2
}

if [[ ! -f "$EXE" ]]; then
  echo "Windows portable app is not built yet:" >&2
  echo "  $EXE" >&2
  echo "Build it with: npm run build:win" >&2
  exit 1
fi

APP_ARGS=("$@")
if [[ ${#APP_ARGS[@]} -eq 0 ]]; then
  APP_ARGS=(--url=http://127.0.0.1:9393/ --control)
fi

if [[ ! -r /proc/sys/fs/binfmt_misc/WSLInterop ]]; then
  print_windows_fallback "$(unc_path "$EXE")" "${APP_ARGS[@]}"
  exit 126
fi

if command -v cmd.exe >/dev/null 2>&1; then
  CMD_EXE="cmd.exe"
elif [[ -x /mnt/c/Windows/System32/cmd.exe ]]; then
  CMD_EXE="/mnt/c/Windows/System32/cmd.exe"
else
  echo "cmd.exe is not available. Enable WSL Windows interop or run the exe from Windows Explorer." >&2
  exit 1
fi

if ! WIN_EXE="$(wslpath -w "$EXE")"; then
  WIN_EXE="$(unc_path "$EXE")"
fi

exec "$CMD_EXE" /C start "" "$WIN_EXE" "${APP_ARGS[@]}"
