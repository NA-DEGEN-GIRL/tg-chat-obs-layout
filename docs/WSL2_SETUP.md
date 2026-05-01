# WSL2 Development Notes

This repo can be developed from WSL2, but runtime credentials and native Telegram libraries must stay local to the OS that uses them.

## Current Safety Checks

Before editing or committing:

```bash
git status --short --branch
git log -1 --oneline
git ls-files -o --exclude-standard
```

Expected state after pulling the Windows work is that the latest commit is `6e0f151 Add videochat stream receiver preview`, and runtime credentials, caches, binaries, raw frames, and logs are not tracked.

## Copied Runtime Data

Keep local JSON files that store overlay state, level records, color mappings, level reasons, emoji cache, and videochat layout settings. These are still local runtime files, so they remain outside git.

Media caches are OS-independent but privacy-sensitive. Profile photos, chat photos, stickers, and animations can be kept for convenience or deleted and redownloaded later.

Recreate copied login/session state in WSL2. That includes Telethon user sessions, the PyTgCalls receiver session, TDLib databases, TDLib file caches, probe debug output, raw frame captures, and local diagnostic logs.

Telethon sessions are SQLite files and can sometimes be read cross-OS, but they contain account auth keys. For WSL2 development, move them aside and log in again from WSL2. This is especially important for the videochat receiver session, which should belong to the receiver/sub-account, not the host account.

TDLib DB/binlog/files are local TDLib runtime state. Recreate them under WSL2 after `libtdjson.so` is installed, instead of sharing the Windows `tdjson.dll` session/cache.

## Python And Login

Install Python dependencies:

```bash
uv venv
uv pip install -r requirements.txt
```

Syntax-check the main Python entry points:

```bash
uv run python -m py_compile main.py videochat_overlay.py tdlib_videochat_probe.py tgcalls_videochat_probe.py
```

Log in the normal Telethon watcher from WSL2:

```bash
uv run python videochat_overlay.py --link "https://t.me/+INVITE_HASH"
```

Log in the PyTgCalls receiver/sub-account separately:

```bash
uv run python tgcalls_videochat_probe.py --session "<local receiver session path>" --login-only
```

Use `TGCALLS_PHONE` only for the receiver/sub-account. Do not let it fall back to the host `TD_PHONE`.

Log in the TDLib probe after Linux `libtdjson.so` is available:

```bash
uv run python tdlib_videochat_probe.py --chat-id "$CHAT_ID"
```

## TDLib On WSL2

Windows uses `tdjson.dll`. WSL2/Linux needs `libtdjson.so`.

The TDLib probe chooses a default per OS:

- Windows: `vendor/tdlib/tdjson.dll`
- Linux/WSL2: `vendor/tdlib/libtdjson.so`
- macOS: `vendor/tdlib/libtdjson.dylib`

Override the path when needed:

```bash
TDLIB_JSON_PATH=/usr/local/lib/libtdjson.so uv run python tdlib_videochat_probe.py --chat-id "$CHAT_ID"
```

`TDLIB_JSON_DLL` and `--dll` still work as compatibility aliases, but `TDLIB_JSON_PATH` and `--tdjson` are the clearer names for cross-platform use.

Install build dependencies on Ubuntu/WSL2:

```bash
sudo apt update
sudo apt install -y git make g++ cmake gperf zlib1g-dev libssl-dev libportaudio2
```

Build a repo-local Linux `libtdjson.so`:

```bash
scripts/build_tdlib_linux.sh
```

The script clones TDLib under `vendor/tdlib/td/`, builds the `tdjson` target, and copies `libtdjson.so` to `vendor/tdlib/libtdjson.so`. Those files are ignored by git.

TDLib's official docs list the same core dependency families: C++17 compiler, OpenSSL, zlib, gperf, and CMake. If you need distro-specific commands, use the official build instruction generator.

## Electron

WSL2 is fine for Python/backend and browser development. The Electron wrapper can run in a Linux GUI environment, but the broadcast-use portable app is Windows-specific and should be packaged from Windows:

```powershell
cd tools/videochat_app
npm install
npm run build:win
```

`tools/videochat_app/dist/` is ignored by git.

## Final Pre-Commit Check

Before committing:

```bash
git status --short
git ls-files -o --exclude-standard
```

There must be no local environment file, runtime data directory, Telegram session, token, phone number, account identifier, TDLib binary, raw frame, or local log in the staged/tracked set.
