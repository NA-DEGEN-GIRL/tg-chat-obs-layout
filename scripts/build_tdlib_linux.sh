#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TDLIB_VENDOR_DIR="${TDLIB_VENDOR_DIR:-"$ROOT_DIR/vendor/tdlib"}"
TDLIB_SRC_DIR="${TDLIB_SRC_DIR:-"$TDLIB_VENDOR_DIR/td"}"
TDLIB_BUILD_DIR="${TDLIB_BUILD_DIR:-"$TDLIB_SRC_DIR/build"}"
TDLIB_GIT_REF="${TDLIB_GIT_REF:-master}"
TDLIB_JOBS="${TDLIB_JOBS:-$(nproc)}"

mkdir -p "$TDLIB_VENDOR_DIR"

if [[ ! -d "$TDLIB_SRC_DIR/.git" ]]; then
  git clone --depth 1 --branch "$TDLIB_GIT_REF" https://github.com/tdlib/td.git "$TDLIB_SRC_DIR"
else
  git -C "$TDLIB_SRC_DIR" fetch --depth 1 origin "$TDLIB_GIT_REF"
  git -C "$TDLIB_SRC_DIR" checkout --detach FETCH_HEAD
fi

cmake -S "$TDLIB_SRC_DIR" -B "$TDLIB_BUILD_DIR" -DCMAKE_BUILD_TYPE=Release
cmake --build "$TDLIB_BUILD_DIR" --target tdjson -j "$TDLIB_JOBS"

TDJSON_SO="$(find "$TDLIB_BUILD_DIR" -type f -name 'libtdjson.so*' | sort | head -n 1)"
if [[ -z "$TDJSON_SO" ]]; then
  echo "libtdjson.so was not found under $TDLIB_BUILD_DIR" >&2
  exit 1
fi

cp "$TDJSON_SO" "$TDLIB_VENDOR_DIR/libtdjson.so"
echo "Installed $TDLIB_VENDOR_DIR/libtdjson.so"
