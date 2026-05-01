#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE="${1:-help}"
SECONDS_TO_SHOW="${WSLG_PROBE_TIMEOUT:-15}"
CHILD_PIDS=()

cleanup() {
  if [[ ${#CHILD_PIDS[@]} -gt 0 ]]; then
    kill "${CHILD_PIDS[@]}" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM

print_env() {
  echo "WSL_DISTRO_NAME=${WSL_DISTRO_NAME:-}"
  echo "DISPLAY=${DISPLAY:-}"
  echo "WAYLAND_DISPLAY=${WAYLAND_DISPLAY:-}"
  echo "XDG_RUNTIME_DIR=${XDG_RUNTIME_DIR:-}"
  echo
}

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing command: $1" >&2
    echo "Install probes with: sudo apt install -y x11-apps x11-utils zenity wayland-utils python3-tk" >&2
    exit 127
  fi
}

list_outputs() {
  need_cmd xrandr
  xrandr --query | sed -nE 's/^([^[:space:]]+) connected( primary)? ([0-9]+x[0-9]+\+[-0-9]+\+[-0-9]+).*/\1 \3/p'
}

selected_output() {
  local selector="${WSLG_PROBE_MONITOR:-0}"
  if [[ "$selector" =~ ^[0-9]+$ ]]; then
    list_outputs | sed -n "$((selector + 1))p"
  else
    list_outputs | awk -v selector="$selector" '$1 == selector { print; exit }'
  fi
}

origin_from_output() {
  local output_line="$1"
  local geom="${output_line#* }"
  if [[ "$geom" =~ ^([0-9]+)x([0-9]+)\+(-?[0-9]+)\+(-?[0-9]+)$ ]]; then
    echo "$((BASH_REMATCH[3] + 80)) $((BASH_REMATCH[4] + 80))"
  else
    echo "80 80"
  fi
}

probe_origin() {
  if [[ -n "${WSLG_PROBE_X:-}" && -n "${WSLG_PROBE_Y:-}" ]]; then
    echo "$WSLG_PROBE_X $WSLG_PROBE_Y"
    return
  fi
  local output_line
  output_line="$(selected_output || true)"
  if [[ -n "$output_line" ]]; then
    origin_from_output "$output_line"
  else
    echo "80 80"
  fi
}

probe_geometry() {
  local width="$1"
  local height="$2"
  local x y
  read -r x y < <(probe_origin)
  echo "${width}x${height}+${x}+${y}"
}

show_usage() {
  cat <<'USAGE'
Usage:
  tools/wslg_gui_probe.sh env
  tools/wslg_gui_probe.sh monitors
  tools/wslg_gui_probe.sh x11-info
  tools/wslg_gui_probe.sh wayland
  tools/wslg_gui_probe.sh xmessage
  tools/wslg_gui_probe.sh xmessage-all
  tools/wslg_gui_probe.sh xclock
  tools/wslg_gui_probe.sh zenity
  tools/wslg_gui_probe.sh tk
  tools/wslg_gui_probe.sh logs

Optional:
  WSLG_PROBE_MONITOR=1 tools/wslg_gui_probe.sh xclock
  WSLG_PROBE_X=2600 WSLG_PROBE_Y=80 tools/wslg_gui_probe.sh xmessage
  WSLG_PROBE_TIMEOUT=30 tools/wslg_gui_probe.sh xclock
USAGE
}

case "$MODE" in
  env)
    print_env
    ;;

  monitors)
    print_env
    list_outputs | nl -w1 -s': '
    ;;

  x11-info)
    print_env
    need_cmd xdpyinfo
    xdpyinfo | sed -n '1,45p'
    ;;

  wayland)
    print_env
    need_cmd wayland-info
    wayland-info | sed -n '1,80p'
    ;;

  xmessage)
    print_env
    need_cmd xmessage
    geometry="$(probe_geometry 560 150)"
    echo "Opening X11 xmessage at ${geometry} for ${SECONDS_TO_SHOW}s..."
    timeout "${SECONDS_TO_SHOW}s" xmessage -geometry "$geometry" "WSLg xmessage probe: if you can see this, basic X11 windows render."
    ;;

  xmessage-all)
    print_env
    need_cmd xmessage
    echo "Opening one X11 xmessage per monitor for ${SECONDS_TO_SHOW}s..."
    while read -r output_name output_geom; do
      origin="$(origin_from_output "${output_name} ${output_geom}")"
      read -r x y <<<"$origin"
      geometry="460x130+${x}+${y}"
      timeout "${SECONDS_TO_SHOW}s" xmessage -geometry "$geometry" "WSLg probe on ${output_name} ${output_geom}" &
      CHILD_PIDS+=("$!")
      echo "  ${output_name}: ${geometry}"
    done < <(list_outputs)
    wait "${CHILD_PIDS[@]}" || true
    ;;

  xclock)
    print_env
    need_cmd xclock
    geometry="$(probe_geometry 260 260)"
    echo "Opening X11 xclock at ${geometry} for ${SECONDS_TO_SHOW}s..."
    timeout "${SECONDS_TO_SHOW}s" xclock -geometry "$geometry"
    ;;

  zenity)
    print_env
    need_cmd zenity
    echo "Opening GTK zenity dialog for ${SECONDS_TO_SHOW}s..."
    timeout "${SECONDS_TO_SHOW}s" zenity --info \
      --title="WSLg zenity probe" \
      --text="If you can see this, GTK windows render through WSLg."
    ;;

  tk)
    print_env
    need_cmd python3
    geometry="$(probe_geometry 520 280)"
    echo "Opening Tk probe at ${geometry} for ${SECONDS_TO_SHOW}s..."
    WSLG_PROBE_GEOMETRY="$geometry" timeout "${SECONDS_TO_SHOW}s" python3 "$ROOT_DIR/tools/wslg_smoke_test.py"
    ;;

  logs)
    echo "Recent WSLg Weston log lines:"
    if [[ -r /mnt/wslg/weston.log ]]; then
      tail -80 /mnt/wslg/weston.log
    else
      echo "/mnt/wslg/weston.log is not readable."
    fi
    ;;

  help|-h|--help)
    show_usage
    ;;

  *)
    echo "Unknown mode: $MODE" >&2
    show_usage >&2
    exit 2
    ;;
esac
