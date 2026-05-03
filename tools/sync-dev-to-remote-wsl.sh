#!/usr/bin/env bash
set -euo pipefail

die() {
  echo "error: $*" >&2
  exit 1
}

resolve_script_dir() {
  local source="${BASH_SOURCE[0]}"
  if [[ "${source}" != */* ]]; then
    source="$(command -v -- "${source}")" || die "cannot resolve script path"
  fi
  cd -- "$(dirname -- "${source}")" && pwd
}

is_repo_root() {
  [[ -f "$1/main.py" && -f "$1/videochat_overlay.py" && -d "$1/static_videochat" && -d "$1/tools" ]]
}

resolve_local_dir() {
  local candidate
  if [[ -n "${TG_DEV_SYNC_LOCAL_DIR:-}" ]]; then
    candidate="${TG_DEV_SYNC_LOCAL_DIR}"
  else
    candidate="$(cd -- "$(resolve_script_dir)/.." && pwd)"
    if ! is_repo_root "${candidate}"; then
      candidate="$(git -C "${PWD}" rev-parse --show-toplevel 2>/dev/null || true)"
    fi
  fi
  [[ -n "${candidate}" ]] || die "cannot find repo root; set TG_DEV_SYNC_LOCAL_DIR"
  candidate="$(cd -- "${candidate}" && pwd)" || die "cannot open local dir: ${candidate}"
  is_repo_root "${candidate}" || die "not a tg-chat-obs-layout repo root: ${candidate}"
  printf '%s\n' "${candidate}"
}

LOCAL_DIR="$(resolve_local_dir)"
REMOTE_HOST="${TG_DEV_SYNC_HOST:-na_stream}"
REMOTE_DIR="${TG_DEV_SYNC_REMOTE_DIR:-/home/na_stream/tg-chat-obs-layout}"
INTERVAL="${TG_DEV_SYNC_INTERVAL:-2}"
SSH_PORT="${TG_DEV_SYNC_SSH_PORT:-}"
REMOTE_RUN_DIR="${REMOTE_DIR}/.remote-dev"

ENV_FILE_PATTERN=".en""v"

SSH_OPTS=()
RSYNC_SSH=(ssh)
if [[ -n "${SSH_PORT}" ]]; then
  SSH_OPTS=(-p "${SSH_PORT}")
  RSYNC_SSH=(ssh -p "${SSH_PORT}")
fi

usage() {
  cat <<'EOF'
Usage:
  tools/sync-dev-to-remote-wsl.sh setup
  tools/sync-dev-to-remote-wsl.sh dry-run
  tools/sync-dev-to-remote-wsl.sh sync
  tools/sync-dev-to-remote-wsl.sh watch [seconds]
  tools/sync-dev-to-remote-wsl.sh start-9292
  tools/sync-dev-to-remote-wsl.sh start-9393
  tools/sync-dev-to-remote-wsl.sh start-both
  tools/sync-dev-to-remote-wsl.sh stop
  tools/sync-dev-to-remote-wsl.sh status
  tools/sync-dev-to-remote-wsl.sh logs-9292
  tools/sync-dev-to-remote-wsl.sh logs-9393
  tools/sync-dev-to-remote-wsl.sh shell

Environment:
  TG_DEV_SYNC_HOST        SSH host alias. Default: na_stream
  TG_DEV_SYNC_REMOTE_DIR  Remote WSL repo path.
  TG_DEV_SYNC_LOCAL_DIR   Local repo path. Default: current repo root
  TG_DEV_SYNC_INTERVAL    Watch interval seconds. Default: 2
  TG_DEV_SYNC_SSH_PORT    Optional SSH port when not using ssh config

Notes:
  This sync is source-first, but it also copies the safe JSON state needed
  for same-looking local tests: user colors, level records, level reasons,
  chat state, overlay settings, Electron window state, local media caches,
  ROM files, and the Windows Electron dist output.
  It intentionally skips private sessions, browser profiles, dependencies,
  logs, and local secret settings.
  The remote WSL should have its own private runtime files and uv setup.
EOF
}

ssh_remote() {
  ssh "${SSH_OPTS[@]}" "${REMOTE_HOST}" "$@"
}

ssh_remote_tty() {
  ssh "${SSH_OPTS[@]}" -t "${REMOTE_HOST}" "$@"
}

remote_sh() {
  ssh_remote "bash -lc $(printf '%q' "$1")"
}

rsync_common_args() {
  printf '%s\n' \
    "-az" \
    "--delete" \
    "--human-readable" \
    "--info=name1,stats2" \
    "--filter=protect ${ENV_FILE_PATTERN}" \
    "--filter=protect ${ENV_FILE_PATTERN}.*" \
    "--filter=protect data/***" \
    "--filter=protect tools/videochat_app/profile/***" \
    "--include=data/" \
    "--include=data/user_colors.json" \
    "--include=data/state.json" \
    "--include=data/videochat_levels.json" \
    "--include=data/level_reasons.json" \
    "--include=data/videochat_overlay_settings.json" \
    "--include=data/videochat_app_window.json" \
    "--include=data/photos/***" \
    "--include=data/stickers/***" \
    "--include=data/animations/***" \
    "--include=data/emoji_cache.json" \
    "--include=data/rom/***" \
    "--include=tools/videochat_app/dist/***" \
    "--exclude=data/***" \
    "--exclude=.git/" \
    "--exclude=.venv/" \
    "--exclude=venv/" \
    "--exclude=__pycache__/" \
    "--exclude=**/__pycache__/" \
    "--exclude=.pytest_cache/" \
    "--exclude=.mypy_cache/" \
    "--exclude=.ruff_cache/" \
    "--exclude=node_modules/" \
    "--exclude=**/node_modules/" \
    "--exclude=dist/" \
    "--exclude=build/" \
    "--exclude=tools/videochat_app/release/" \
    "--exclude=tools/videochat_app/profile/" \
    "--exclude=logs/" \
    "--exclude=.remote-dev/" \
    "--exclude=${ENV_FILE_PATTERN}" \
    "--exclude=${ENV_FILE_PATTERN}.*" \
    "--exclude=*.session" \
    "--exclude=*.session-*" \
    "--exclude=*.sqlite" \
    "--exclude=*.sqlite3" \
    "--exclude=*.db" \
    "--exclude=*.db-*" \
    "--exclude=*.log" \
    "--exclude=*.pyc" \
    "--exclude=image*.png" \
    "--exclude=*.gb" \
    "--exclude=*.gbc" \
    "--exclude=*.gba"
}

run_rsync() {
  local dry="${1:-0}"
  local args=()
  while IFS= read -r arg; do
    args+=("${arg}")
  done < <(rsync_common_args)
  if [[ "${dry}" == "1" ]]; then
    args+=("--dry-run")
  fi
  args+=("-e" "${RSYNC_SSH[*]}")
  args+=("${LOCAL_DIR%/}/" "${REMOTE_HOST}:${REMOTE_DIR%/}/")
  rsync "${args[@]}"
}

setup_remote() {
  remote_sh "mkdir -p $(printf '%q' "${REMOTE_DIR}") $(printf '%q' "${REMOTE_RUN_DIR}")"
}

start_remote_server() {
  local name="$1"
  local command="$2"
  setup_remote
  local quoted_dir quoted_run_dir quoted_name quoted_cmd
  quoted_dir="$(printf '%q' "${REMOTE_DIR}")"
  quoted_run_dir="$(printf '%q' "${REMOTE_RUN_DIR}")"
  quoted_name="$(printf '%q' "${name}")"
  quoted_cmd="$(printf '%q' "${command}")"
  remote_sh "
    set -euo pipefail
    cd ${quoted_dir}
    mkdir -p ${quoted_run_dir}
    if command -v tmux >/dev/null 2>&1; then
      tmux has-session -t ${quoted_name} 2>/dev/null && tmux kill-session -t ${quoted_name}
      tmux new-session -d -s ${quoted_name} \"cd ${quoted_dir} && ${command} 2>&1 | tee ${quoted_run_dir}/${name}.log\"
      echo \"started ${name} in tmux\"
    else
      if [[ -f ${quoted_run_dir}/${name}.pid ]]; then
        old_pid=\$(cat ${quoted_run_dir}/${name}.pid 2>/dev/null || true)
        if [[ -n \"\${old_pid:-}\" ]] && kill -0 \"\${old_pid}\" 2>/dev/null; then
          kill \"\${old_pid}\" 2>/dev/null || true
          sleep 1
        fi
      fi
      nohup bash -lc ${quoted_cmd} > ${quoted_run_dir}/${name}.log 2>&1 &
      echo \$! > ${quoted_run_dir}/${name}.pid
      echo \"started ${name} pid=\$(cat ${quoted_run_dir}/${name}.pid)\"
    fi
  "
}

stop_remote_servers() {
  local quoted_run_dir
  quoted_run_dir="$(printf '%q' "${REMOTE_RUN_DIR}")"
  remote_sh "
    set +e
    for s in tg-9292 tg-9393; do
      if command -v tmux >/dev/null 2>&1; then
        tmux has-session -t \"\$s\" 2>/dev/null && tmux kill-session -t \"\$s\"
      fi
      if [[ -f ${quoted_run_dir}/\$s.pid ]]; then
        pid=\$(cat ${quoted_run_dir}/\$s.pid 2>/dev/null)
        [[ -n \"\$pid\" ]] && kill \"\$pid\" 2>/dev/null
        rm -f ${quoted_run_dir}/\$s.pid
      fi
    done
    echo stopped
  "
}

status_remote_servers() {
  local quoted_run_dir
  quoted_run_dir="$(printf '%q' "${REMOTE_RUN_DIR}")"
  remote_sh "
    set +e
    for s in tg-9292 tg-9393; do
      state=stopped
      if command -v tmux >/dev/null 2>&1 && tmux has-session -t \"\$s\" 2>/dev/null; then
        state=tmux-running
      elif [[ -f ${quoted_run_dir}/\$s.pid ]]; then
        pid=\$(cat ${quoted_run_dir}/\$s.pid 2>/dev/null)
        if [[ -n \"\$pid\" ]] && kill -0 \"\$pid\" 2>/dev/null; then
          state=\"pid-running:\$pid\"
        fi
      fi
      echo \"\$s \$state\"
    done
  "
}

tail_remote_log() {
  local name="$1"
  local quoted_run_dir
  quoted_run_dir="$(printf '%q' "${REMOTE_RUN_DIR}")"
  remote_sh "mkdir -p ${quoted_run_dir}; touch ${quoted_run_dir}/${name}.log; tail -n 120 -f ${quoted_run_dir}/${name}.log"
}

command_name="${1:-}"
case "${command_name}" in
  setup)
    setup_remote
    ;;
  dry-run)
    setup_remote
    run_rsync 1
    ;;
  sync)
    setup_remote
    run_rsync 0
    ;;
  watch)
    setup_remote
    if [[ "${2:-}" != "" ]]; then
      INTERVAL="$2"
    fi
    while true; do
      date '+[%Y-%m-%d %H:%M:%S] sync'
      run_rsync 0
      sleep "${INTERVAL}"
    done
    ;;
  start-9292)
    start_remote_server "tg-9292" "uv run python main.py"
    ;;
  start-9393)
    start_remote_server "tg-9393" "uv run python videochat_overlay.py"
    ;;
  start-both)
    start_remote_server "tg-9292" "uv run python main.py"
    start_remote_server "tg-9393" "uv run python videochat_overlay.py"
    ;;
  stop)
    stop_remote_servers
    ;;
  status)
    status_remote_servers
    ;;
  logs-9292)
    tail_remote_log "tg-9292"
    ;;
  logs-9393)
    tail_remote_log "tg-9393"
    ;;
  shell)
    ssh_remote_tty "cd $(printf '%q' "${REMOTE_DIR}") && exec bash -l"
    ;;
  ""|-h|--help|help)
    usage
    ;;
  *)
    echo "unknown command: ${command_name}" >&2
    usage >&2
    exit 2
    ;;
esac
