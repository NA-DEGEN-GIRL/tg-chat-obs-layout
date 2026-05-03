import json
import threading
import time
from pathlib import Path
from typing import Any


def env_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def normalize_roles(value) -> list[str]:
    if value is None:
        raw = []
    elif isinstance(value, str):
        raw = value.replace(";", ",").split(",")
    elif isinstance(value, (list, tuple, set)):
        raw = value
    else:
        raw = [str(value)]
    roles: list[str] = []
    for item in raw:
        for part in str(item or "").replace(";", ",").split(","):
            role = part.strip().lower()
            if role and role not in roles:
                roles.append(role)
    return roles


def primary_role(roles: list[str]) -> str:
    return roles[0] if roles else ""


def merge_roles(*role_sets) -> list[str]:
    roles: list[str] = []
    for role_set in role_sets:
        for role in normalize_roles(role_set):
            if role not in roles:
                roles.append(role)
    return roles


def level_key(user_id: str, username: str, name: str) -> str:
    if user_id:
        return f"id:{user_id}"
    if username:
        return f"username:{username.lower()}"
    return f"name:{name}"


def clamp_level(value, *, minimum: int = 0, maximum: int = 99) -> int:
    try:
        return max(minimum, min(maximum, int(value)))
    except (TypeError, ValueError):
        return minimum


class LevelStore:
    def __init__(self, path: Path, *, enabled: bool = True, minimum: int = 0, maximum: int = 99):
        self.path = path
        self.enabled = enabled
        self.minimum = minimum
        self.maximum = maximum
        self.users: dict[str, dict[str, Any]] = {}
        self.mtime = 0.0
        self.lock = threading.Lock()

    def normalize_record(self, key: str, value) -> dict[str, Any]:
        record = dict(value) if isinstance(value, dict) else {"level": value}
        roles = normalize_roles(record.get("roles"))
        legacy = str(record.get("role") or "").strip().lower()
        if legacy and legacy not in roles:
            roles.append(legacy)
        record["roles"] = roles
        record["role"] = primary_role(roles)
        record["level"] = clamp_level(record.get("level", self.minimum), minimum=self.minimum, maximum=self.maximum)
        record.setdefault("key", str(key))
        return record

    def load(self) -> dict[str, dict[str, Any]]:
        try:
            raw = json.loads(self.path.read_text(encoding="utf-8"))
        except FileNotFoundError:
            with self.lock:
                self.users = {}
                self.mtime = 0.0
            return self.users
        except Exception as exc:
            print(f"[WARN] level store load failed: {exc}", flush=True)
            with self.lock:
                self.users = {}
            return self.users
        source = raw.get("users") if isinstance(raw, dict) and isinstance(raw.get("users"), dict) else raw
        if not isinstance(source, dict):
            source = {}
        next_users = {str(key): self.normalize_record(str(key), value) for key, value in source.items()}
        with self.lock:
            self.users = next_users
            try:
                self.mtime = self.path.stat().st_mtime
            except FileNotFoundError:
                self.mtime = 0.0
        return self.users

    def reload_if_changed(self) -> bool:
        try:
            mtime = self.path.stat().st_mtime
        except FileNotFoundError:
            return False
        if mtime <= self.mtime:
            return False
        loaded = self.load()
        if not loaded:
            self.mtime = mtime
        return True

    def save(self) -> None:
        with self.lock:
            users = self.users
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(
            json.dumps({"version": 1, "users": users}, ensure_ascii=False, indent=2, sort_keys=True),
            encoding="utf-8",
        )
        tmp.replace(self.path)
        try:
            self.mtime = self.path.stat().st_mtime
        except FileNotFoundError:
            self.mtime = 0.0

    def key_for_profile(self, profile: dict) -> str:
        user_id = str(profile.get("speaker_id") or profile.get("id") or "")
        username = str(profile.get("username") or "").lstrip("@")
        name = str(profile.get("name") or username or user_id or "Unknown")
        return level_key(user_id, username, name)

    def profile_record(self, profile: dict, roles: list[str]) -> dict[str, Any]:
        user_id = str(profile.get("speaker_id") or profile.get("id") or "")
        username = str(profile.get("username") or "").lstrip("@")
        name = str(profile.get("name") or username or user_id or "Unknown")
        return {
            "id": user_id,
            "username": username,
            "name": name,
            "role": primary_role(roles),
            "roles": roles,
        }

    def _initial_level(self, profile: dict, source: str, explicit_level=None) -> int:
        roles = normalize_roles(profile.get("roles"))
        if "king" in roles or profile.get("is_host"):
            return self.maximum
        if explicit_level is not None:
            return clamp_level(explicit_level, minimum=self.minimum, maximum=self.maximum)
        return 1 if source == "chat" else self.minimum

    def _promoted_level(self, record: dict, source: str) -> int:
        roles = normalize_roles(record.get("roles"))
        if "king" in roles:
            return self.maximum
        current = clamp_level(record.get("level", self.minimum), minimum=self.minimum, maximum=self.maximum)
        if not self.enabled:
            return current
        if source == "chat":
            try:
                videochat_seen_at = float(record.get("videochat_seen_at", 0) or 0)
            except (TypeError, ValueError):
                videochat_seen_at = 0
            try:
                manual_level_at = float(record.get("manual_level_at", 0) or 0)
            except (TypeError, ValueError):
                manual_level_at = 0
            if videochat_seen_at and (current >= 2 or videochat_seen_at > manual_level_at):
                return max(current, 2)
            return max(current, 1)
        if source == "videochat":
            if current >= 1:
                return max(current, 2)
            return current
        try:
            manual_level_at = float(record.get("manual_level_at", 0) or 0)
        except (TypeError, ValueError):
            manual_level_at = 0
        try:
            cheer_seen_at = float(record.get("videochat_cheer_seen_at", 0) or 0)
        except (TypeError, ValueError):
            cheer_seen_at = 0
        try:
            fire_seen_at = float(record.get("videochat_fire_seen_at", 0) or 0)
        except (TypeError, ValueError):
            fire_seen_at = 0
        cheer_seen = bool(cheer_seen_at and cheer_seen_at > manual_level_at)
        fire_seen = bool(fire_seen_at and fire_seen_at > manual_level_at)
        if cheer_seen and fire_seen:
            return max(current, 4)
        if cheer_seen or fire_seen:
            return max(current, 3)
        return current

    def observe_videochat_effect(self, profile: dict, effect: str) -> tuple[dict[str, Any], int, int]:
        effect_key = str(effect or "").strip().lower()
        field = {
            "cheer": "videochat_cheer_seen_at",
            "fire": "videochat_fire_seen_at",
            "firework": "videochat_fire_seen_at",
            "fireworks": "videochat_fire_seen_at",
        }.get(effect_key)
        record, _changed = self.observe_profile(profile, source="chat")
        if not field:
            level = clamp_level(record.get("level", self.minimum), minimum=self.minimum, maximum=self.maximum)
            return record, level, level
        key = self.key_for_profile(profile)
        now = time.time()
        with self.lock:
            target = self.users.get(key)
            if not isinstance(target, dict):
                target = dict(record)
                self.users[key] = target
            old = clamp_level(target.get("level", self.minimum), minimum=self.minimum, maximum=self.maximum)
            target[field] = now
            next_level = self._promoted_level(target, "videochat_effect")
            if target.get("level") != next_level:
                target["level"] = next_level
            target["updated_at"] = now
            record = dict(target)
        self.save()
        return record, old, int(record.get("level", old) or old)

    def observe_profile(
        self,
        profile: dict,
        *,
        source: str = "chat",
        explicit_level=None,
        roles: list[str] | None = None,
    ) -> tuple[dict[str, Any], bool]:
        profile = dict(profile)
        role_list = merge_roles(profile.get("roles"), roles)
        if profile.get("is_host") or "king" in role_list:
            role_list = ["king"] + [role for role in role_list if role != "king"]
        if profile.get("is_bot") and "bot" not in role_list:
            role_list.append("bot")
        profile["roles"] = role_list
        key = self.key_for_profile(profile)
        now = time.time()
        changed = False
        with self.lock:
            if key not in self.users and profile.get("speaker_id") and profile.get("username"):
                old_key = level_key("", str(profile.get("username") or "").lstrip("@"), str(profile.get("name") or ""))
                if old_key in self.users:
                    self.users[key] = self.users.pop(old_key)
                    changed = True
            record = self.users.get(key)
            if not isinstance(record, dict):
                record = {
                    **self.profile_record(profile, role_list),
                    "level": self._initial_level(profile, source, explicit_level),
                    "first_seen_at": now,
                }
                self.users[key] = record
                changed = True
            updates = self.profile_record(profile, role_list)
            for field, value in updates.items():
                if record.get(field) != value:
                    record[field] = value
                    changed = True
            if "first_seen_at" not in record:
                record["first_seen_at"] = now
                changed = True
            if source == "chat" and not record.get("chat_seen_at"):
                record["chat_seen_at"] = now
                changed = True
            if source == "videochat" and not record.get("videochat_seen_at"):
                record["videochat_seen_at"] = now
                changed = True
            next_level = self._promoted_level(record, source)
            if record.get("level") != next_level:
                record["level"] = next_level
                changed = True
            if changed:
                record["updated_at"] = now
        if changed:
            self.save()
        return dict(record), changed

    def find_by_username(self, username: str) -> dict[str, Any] | None:
        wanted = username.strip().lstrip("@").lower()
        if not wanted:
            return None
        with self.lock:
            for record in self.users.values():
                if not isinstance(record, dict):
                    continue
                if str(record.get("username") or "").lstrip("@").lower() == wanted:
                    return dict(record)
        return None

    def set_roles(self, profile: dict, mode: str, requested=None, auto_roles=None) -> tuple[dict[str, Any], list[str]]:
        record, _changed = self.observe_profile(profile, source="chat", roles=merge_roles(auto_roles, profile.get("roles")))
        requested_roles = normalize_roles(requested)
        auto = normalize_roles(auto_roles)
        key = self.key_for_profile(profile)
        with self.lock:
            current = normalize_roles(self.users.get(key, {}).get("roles"))
            if mode == "add":
                roles = merge_roles(auto, current, requested_roles)
            elif mode == "remove":
                remove = set(requested_roles)
                roles = [role for role in merge_roles(auto, current) if role not in remove or role in auto]
            elif mode == "reset":
                roles = auto
            else:
                roles = merge_roles(auto, current)
            target = self.users[key]
            target["roles"] = roles
            target["role"] = primary_role(roles)
            if "king" in roles:
                target["level"] = self.maximum
            target["updated_at"] = time.time()
            record = dict(target)
        self.save()
        return record, roles

    def adjust_level(self, profile: dict, delta: int) -> tuple[dict[str, Any], int, int]:
        profile = dict(profile)
        role_list = merge_roles(profile.get("roles"))
        if profile.get("is_host") or "king" in role_list:
            role_list = ["king"] + [role for role in role_list if role != "king"]
        if profile.get("is_bot") and "bot" not in role_list:
            role_list.append("bot")
        profile["roles"] = role_list
        key = self.key_for_profile(profile)
        now = time.time()
        with self.lock:
            if key not in self.users and profile.get("speaker_id") and profile.get("username"):
                old_key = level_key("", str(profile.get("username") or "").lstrip("@"), str(profile.get("name") or ""))
                if old_key in self.users:
                    self.users[key] = self.users.pop(old_key)
            if key not in self.users or not isinstance(self.users.get(key), dict):
                self.users[key] = {
                    **self.profile_record(profile, role_list),
                    "level": self.minimum,
                    "first_seen_at": now,
                }
            target = self.users[key]
            stored_roles = normalize_roles(target.get("roles"))
            final_roles = merge_roles(stored_roles, role_list)
            if profile.get("is_host") or "king" in final_roles:
                final_roles = ["king"] + [role for role in final_roles if role != "king"]
            if profile.get("is_bot") and "bot" not in final_roles:
                final_roles.append("bot")
            for field, value in self.profile_record(profile, final_roles).items():
                target[field] = value
            roles = normalize_roles(target.get("roles"))
            old = clamp_level(target.get("level", self.minimum), minimum=self.minimum, maximum=self.maximum)
            new = self.maximum if "king" in roles else clamp_level(old + int(delta), minimum=self.minimum, maximum=self.maximum)
            target["level"] = new
            target["last_notified_level"] = new
            if "king" not in roles:
                target["manual_level_at"] = now
                if new < old:
                    for field in (
                        "videochat_cheer_seen_at",
                        "videochat_fire_seen_at",
                    ):
                        target.pop(field, None)
                if new < 2:
                    for field in (
                        "videochat_seen_at",
                        "videochat_active",
                        "videochat_active_at",
                        "videochat_active_until",
                        "videochat_left_at",
                    ):
                        target.pop(field, None)
            target["updated_at"] = now
            record = dict(target)
        self.save()
        return record, old, new

    def apply_once_bonus(
        self,
        profile: dict,
        marker: str,
        *,
        delta: int = 1,
        minimum_level: int = 0,
    ) -> tuple[dict[str, Any], int, int, bool]:
        profile = dict(profile)
        role_list = merge_roles(profile.get("roles"))
        if profile.get("is_host") or "king" in role_list:
            role_list = ["king"] + [role for role in role_list if role != "king"]
        if profile.get("is_bot") and "bot" not in role_list:
            role_list.append("bot")
        profile["roles"] = role_list
        key = self.key_for_profile(profile)
        now = time.time()
        field = str(marker or "").strip()
        if not field:
            field = "once_bonus_at"
        with self.lock:
            if key not in self.users and profile.get("speaker_id") and profile.get("username"):
                old_key = level_key("", str(profile.get("username") or "").lstrip("@"), str(profile.get("name") or ""))
                if old_key in self.users:
                    self.users[key] = self.users.pop(old_key)
            if key not in self.users or not isinstance(self.users.get(key), dict):
                self.users[key] = {
                    **self.profile_record(profile, role_list),
                    "level": self._initial_level(profile, "chat"),
                    "first_seen_at": now,
                }
            target = self.users[key]
            for update_field, value in self.profile_record(profile, merge_roles(target.get("roles"), role_list)).items():
                target[update_field] = value
            old = clamp_level(target.get("level", self.minimum), minimum=self.minimum, maximum=self.maximum)
            if target.get(field):
                return dict(target), old, old, False
            if old < int(minimum_level):
                return dict(target), old, old, False
            roles = normalize_roles(target.get("roles"))
            if "king" in roles:
                return dict(target), old, old, False
            new = clamp_level(old + int(delta), minimum=self.minimum, maximum=self.maximum)
            target[field] = now
            target["level"] = new
            target["updated_at"] = now
            record = dict(target)
        self.save()
        return record, old, new, new != old

    def mark_notified_level(self, key: str, level: int) -> None:
        with self.lock:
            record = self.users.get(key)
            if not isinstance(record, dict):
                return
            notified = clamp_level(level, minimum=self.minimum, maximum=self.maximum)
            if record.get("last_notified_level") == notified:
                return
            record["last_notified_level"] = notified
            record["updated_at"] = time.time()
        self.save()
