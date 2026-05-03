#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
SESSION_PATH="${TGCALLS_SESSION:-data/telethon/videochat_receiver}"
SUB_PHONE_ENV="${TG_SUB_PHONE_ENV_NAME:-TG_SUB_PHONE}"
LEGACY_SUB_PHONE_ENV="${TG_LEGACY_SUB_PHONE_ENV:-TGCALLS_PHONE}"

cd "${REPO_ROOT}"

echo "[login] sub account receiver session: ${SESSION_PATH}"
echo "[login] running sub-account login helper"
uv run python scripts/telegram_login_session.py \
  --session "${SESSION_PATH}" \
  --label "sub account receiver" \
  --phone-env "${SUB_PHONE_ENV}" \
  --phone-env "${LEGACY_SUB_PHONE_ENV}"

echo "[login] sub-account session is ready"
