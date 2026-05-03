#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
SESSION_DIR="${TG_MAIN_SESSION_DIR:-data/telethon}"
MAIN_PHONE_ENV="${TG_MAIN_PHONE_ENV_NAME:-TG_MAIN_PHONE}"
LEGACY_WATCHER_PHONE_ENV="${TG_WATCHER_PHONE_ENV:-TD_WATCHER_PHONE}"
LEGACY_SENDER_PHONE_ENV="${TG_SENDER_PHONE_ENV:-TD_SENDER_PHONE}"
LEGACY_MAIN_PHONE_ENV="${TG_LEGACY_MAIN_PHONE_ENV:-TD_PHONE}"

cd "${REPO_ROOT}"

echo "[login] main account sessions"
echo "[login] main account watcher session: ${SESSION_DIR}/videochat_overlay"
echo "[login] running main account watcher login helper"
uv run python scripts/telegram_login_session.py \
  --session "${SESSION_DIR}/videochat_overlay" \
  --label "main account watcher" \
  --phone-env "${MAIN_PHONE_ENV}" \
  --phone-env "${LEGACY_WATCHER_PHONE_ENV}" \
  --phone-env "${LEGACY_MAIN_PHONE_ENV}"

echo "[login] main account sender session: ${SESSION_DIR}/stt_sender"
echo "[login] running main account sender login helper"
uv run python scripts/telegram_login_session.py \
  --session "${SESSION_DIR}/stt_sender" \
  --label "main account sender" \
  --phone-env "${MAIN_PHONE_ENV}" \
  --phone-env "${LEGACY_SENDER_PHONE_ENV}" \
  --phone-env "${LEGACY_MAIN_PHONE_ENV}"

echo "[login] main account sessions are ready"
