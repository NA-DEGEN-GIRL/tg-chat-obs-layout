import argparse
import asyncio
import getpass
import os
import re
import sqlite3
from pathlib import Path

from dotenv import load_dotenv
from telethon import TelegramClient


BASE_DIR = Path(__file__).resolve().parents[1]
DEFAULT_TIMEOUT_SEC = 45.0
DEFAULT_CONNECT_TIMEOUT_SEC = 10.0
DEFAULT_CONNECTION_RETRIES = 2


def clean_env(value: str | None) -> str:
    value = value or ""
    if "#" in value:
        value = value.split("#", 1)[0]
    return value.strip().strip('"').strip("'")


def env_int(name: str) -> int:
    value = clean_env(os.getenv(name))
    match = re.search(r"-?\d+", value)
    return int(match.group(0)) if match else 0


def first_env_value(names: list[str]) -> str:
    for name in names:
        value = clean_env(os.getenv(name))
        if value:
            return value
    return ""


def session_path(raw: str) -> Path:
    path = Path(raw)
    if not path.is_absolute():
        path = BASE_DIR / path
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def session_files(path: Path) -> list[Path]:
    base = path if path.name.endswith(".session") else Path(f"{path}.session")
    return [
        path,
        Path(f"{path}-journal"),
        Path(f"{path}-wal"),
        Path(f"{path}-shm"),
        base,
        Path(f"{base}-journal"),
        Path(f"{base}-wal"),
        Path(f"{base}-shm"),
    ]


def replace_locked_enabled(args: argparse.Namespace) -> bool:
    if args.replace_locked_session:
        return True
    return clean_env(os.getenv("TG_LOGIN_REPLACE_LOCKED")).lower() in {"1", "true", "yes", "on"}


def drop_locked_enabled(args: argparse.Namespace) -> bool:
    if args.drop_locked_session:
        return True
    return clean_env(os.getenv("TG_LOGIN_DROP_LOCKED")).lower() in {"1", "true", "yes", "on"}


def backup_session_files(path: Path) -> list[tuple[Path, Path]]:
    backup_dir = path.parent / "locked_backup"
    backup_dir.mkdir(parents=True, exist_ok=True)
    stamp = os.environ.get("TG_LOGIN_BACKUP_STAMP") or str(os.getpid())
    moved: list[tuple[Path, Path]] = []
    seen: set[Path] = set()
    for item in session_files(path):
        if item in seen or not item.exists():
            continue
        seen.add(item)
        target = backup_dir / f"{item.name}.{stamp}.bak"
        item.replace(target)
        moved.append((item, target))
    return moved


def delete_session_files(path: Path) -> list[Path]:
    deleted: list[Path] = []
    seen: set[Path] = set()
    for item in session_files(path):
        if item in seen or not item.exists():
            continue
        seen.add(item)
        item.unlink()
        deleted.append(item)
    return deleted


def timeout_sec() -> float:
    value = clean_env(os.getenv("TG_LOGIN_TIMEOUT"))
    if not value:
        return DEFAULT_TIMEOUT_SEC
    try:
        return max(5.0, float(value))
    except ValueError:
        return DEFAULT_TIMEOUT_SEC


def env_float(name: str, default: float, minimum: float = 1.0) -> float:
    value = clean_env(os.getenv(name))
    if not value:
        return default
    try:
        return max(minimum, float(value))
    except ValueError:
        return default


def env_int_value(name: str, default: int, minimum: int = 0) -> int:
    value = clean_env(os.getenv(name))
    if not value:
        return default
    try:
        return max(minimum, int(value))
    except ValueError:
        return default


async def wait_step(label: str, awaitable, timeout: float):
    print(f"[login] {label}...", flush=True)
    try:
        return await asyncio.wait_for(awaitable, timeout=timeout)
    except asyncio.TimeoutError as exc:
        raise SystemExit(f"[login] timeout while {label} ({timeout:.0f}s)") from exc


async def login(args: argparse.Namespace) -> int:
    load_dotenv(BASE_DIR / ("." + "env"))
    api_id = env_int(args.api_id_env)
    api_hash = clean_env(os.getenv(args.api_hash_env))
    if not api_id or not api_hash:
        raise SystemExit(f"{args.api_id_env} and {args.api_hash_env} are required.")

    path = session_path(args.session)
    timeout = timeout_sec()
    connect_timeout = env_float("TG_LOGIN_CONNECT_TIMEOUT", DEFAULT_CONNECT_TIMEOUT_SEC, minimum=3.0)
    connection_retries = env_int_value("TG_LOGIN_CONNECTION_RETRIES", DEFAULT_CONNECTION_RETRIES, minimum=0)
    print(f"[login] {args.label}: session={path}", flush=True)
    print(f"[login] {args.label}: api env loaded, timeout={timeout:.0f}s", flush=True)
    print(
        f"[login] {args.label}: connect_timeout={connect_timeout:.0f}s retries={connection_retries}",
        flush=True,
    )
    def make_client() -> TelegramClient:
        return TelegramClient(
            str(path),
            api_id,
            api_hash,
            timeout=connect_timeout,
            connection_retries=connection_retries,
            retry_delay=1,
            auto_reconnect=False,
        )

    try:
        client = make_client()
    except sqlite3.OperationalError as exc:
        if "database is locked" in str(exc).lower():
            if drop_locked_enabled(args):
                deleted = delete_session_files(path)
                if not deleted:
                    raise SystemExit(f"[login] session database is locked, but no session files were found: {path}") from exc
                print("[login] locked session files were deleted:", flush=True)
                for source in deleted:
                    print(f"[login]   {source}", flush=True)
                client = make_client()
            elif replace_locked_enabled(args):
                moved = backup_session_files(path)
                if not moved:
                    raise SystemExit(f"[login] session database is locked, but no session files were found: {path}") from exc
                print("[login] locked session files were backed up:", flush=True)
                for source, target in moved:
                    print(f"[login]   {source} -> {target}", flush=True)
                client = make_client()
            else:
                session_file_list = ", ".join(str(item) for item in session_files(path))
                raise SystemExit(
                    "[login] session database is locked. Stop any running 9292/9393 server, "
                    "probe, or other login command using this same session, then retry. "
                    f"session={path}\n"
                    f"[login] checked files: {session_file_list}\n"
                    "[login] if no process is using it and this is a local test machine, rerun with "
                    "TG_LOGIN_DROP_LOCKED=1 to delete the locked session and login again, or "
                    "TG_LOGIN_REPLACE_LOCKED=1 to back it up first."
                ) from exc
        raise
    await wait_step(f"{args.label}: connecting to Telegram", client.connect(), timeout)
    try:
        if await wait_step(f"{args.label}: checking existing authorization", client.is_user_authorized(), timeout):
            print(f"[login] {args.label}: already authorized ({path})", flush=True)
            return 0

        phone = first_env_value(args.phone_env)
        if not phone:
            phone = input(f"Telegram phone number for {args.label}: ").strip()
        else:
            print(f"[login] {args.label}: phone loaded from env", flush=True)
        await wait_step(f"{args.label}: requesting login code", client.send_code_request(phone), timeout)
        code = getpass.getpass(f"Telegram login code for {args.label}: ").strip()
        try:
            await wait_step(f"{args.label}: signing in", client.sign_in(phone=phone, code=code), timeout)
        except Exception as exc:
            if exc.__class__.__name__ != "SessionPasswordNeededError":
                raise
            password = getpass.getpass(f"Telegram 2FA password for {args.label}: ")
            await wait_step(f"{args.label}: signing in with 2FA", client.sign_in(password=password), timeout)
        print(f"[login] {args.label}: login ready ({path})", flush=True)
        return 0
    finally:
        if client.is_connected():
            try:
                await asyncio.wait_for(client.disconnect(), timeout=5.0)
            except asyncio.TimeoutError:
                print(f"[login] {args.label}: disconnect timeout", flush=True)


def main() -> int:
    parser = argparse.ArgumentParser(description="Create or verify a local Telethon login session.")
    parser.add_argument("--session", required=True, help="Telethon session path without or with .session suffix.")
    parser.add_argument("--label", default="Telegram account")
    parser.add_argument("--api-id-env", default="TD_API_ID")
    parser.add_argument("--api-hash-env", default="TD_API_HASH")
    parser.add_argument(
        "--phone-env",
        action="append",
        default=[],
        help="Environment variable to read the phone number from. Can be passed more than once.",
    )
    parser.add_argument(
        "--replace-locked-session",
        action="store_true",
        help="Back up a locked local session file and create a fresh login session.",
    )
    parser.add_argument(
        "--drop-locked-session",
        action="store_true",
        help="Delete a locked local session file and create a fresh login session.",
    )
    args = parser.parse_args()
    if not args.phone_env:
        args.phone_env = ["TD_PHONE"]
    return asyncio.run(login(args))


if __name__ == "__main__":
    raise SystemExit(main())
