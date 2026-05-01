#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$APP_DIR/../.." && pwd)"
cd "$APP_DIR"

if [[ $# -eq 0 ]]; then
  set -- --url=http://127.0.0.1:9393/ --control
fi

has_app_arg() {
  local name="$1"
  local arg
  for arg in "$@"; do
    if [[ "$arg" == "--${name}" || "$arg" == "--${name}="* ]]; then
      return 0
    fi
  done
  return 1
}

list_wslg_outputs() {
  if ! command -v xrandr >/dev/null 2>&1; then
    return 1
  fi
  xrandr --query 2>/dev/null | sed -nE 's/^([^[:space:]]+) connected( primary)? ([0-9]+x[0-9]+\+[-0-9]+\+[-0-9]+).*/\1 \3/p'
}

selected_wslg_output() {
  local selector="${TG_VIDEOCHAT_WSLG_MONITOR:-0}"
  if [[ "$selector" =~ ^[0-9]+$ ]]; then
    list_wslg_outputs | sed -n "$((selector + 1))p"
  else
    list_wslg_outputs | awk -v selector="$selector" '$1 == selector { print; exit }'
  fi
}

window_origin() {
  if [[ -n "${TG_VIDEOCHAT_WSLG_X:-}" && -n "${TG_VIDEOCHAT_WSLG_Y:-}" ]]; then
    echo "$TG_VIDEOCHAT_WSLG_X $TG_VIDEOCHAT_WSLG_Y"
    return
  fi

  local output_line geom
  output_line="$(selected_wslg_output || true)"
  geom="${output_line#* }"
  if [[ "$geom" =~ ^([0-9]+)x([0-9]+)\+(-?[0-9]+)\+(-?[0-9]+)$ ]]; then
    echo "$((BASH_REMATCH[3] + 80)) $((BASH_REMATCH[4] + 80))"
  else
    echo "80 80"
  fi
}

POSITION_ARGS=()
if [[ "${TG_VIDEOCHAT_WSLG_PLACE_WINDOW:-1}" != "0" ]]; then
  if ! has_app_arg x "$@" && ! has_app_arg y "$@"; then
    read -r window_x window_y < <(window_origin)
    POSITION_ARGS+=(--x="$window_x" --y="$window_y")
    echo "WSLg window position: x=${window_x}, y=${window_y} (monitor ${TG_VIDEOCHAT_WSLG_MONITOR:-0})"
  fi
fi

if [[ "${TG_VIDEOCHAT_WSLG_KEEP_WINDOW:-0}" != "1" ]]; then
  mkdir -p "$REPO_ROOT/data"
  read -r state_x state_y < <(window_origin)
  cat > "$REPO_ROOT/data/videochat_app_window.json" <<JSON
{
  "x": ${state_x},
  "y": ${state_y},
  "width": 1600,
  "height": 900,
  "maximized": false,
  "fullscreen": false,
  "alwaysOnTop": false,
  "controlMode": true,
  "overlayUiHidden": false
}
JSON
fi

CHROMIUM_FLAGS=(--no-sandbox)

if [[ "${TG_VIDEOCHAT_WSLG_RENDERER:-native}" == "x11-swiftshader" ]]; then
  export GDK_BACKEND=x11
  export ELECTRON_OZONE_PLATFORM_HINT=x11
  unset WAYLAND_DISPLAY
  CHROMIUM_FLAGS+=(
    --ozone-platform=x11
    --use-gl=angle
    --use-angle=swiftshader
    --enable-unsafe-swiftshader
    --disable-gpu-compositing
  )
fi

if [[ "${TG_VIDEOCHAT_WSLG_PACKED:-0}" == "1" && -x "$APP_DIR/dist/linux-unpacked/tg-videochat-overlay-app" ]]; then
  exec "$APP_DIR/dist/linux-unpacked/tg-videochat-overlay-app" "${CHROMIUM_FLAGS[@]}" "${POSITION_ARGS[@]}" "$@"
fi

exec "$APP_DIR/node_modules/.bin/electron" "${CHROMIUM_FLAGS[@]}" . -- "${POSITION_ARGS[@]}" "$@"
