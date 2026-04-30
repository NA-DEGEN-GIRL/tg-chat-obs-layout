# Patch Notes

## 2026-04-30 Uncommitted

- `data/videochat_levels.json` now stores a `role` field (`host`, `bot`, `viewer`) alongside user id, username, name, and level.
- Bot senders are stored with `role: "bot"` and rendered with a `Bot` badge instead of a level badge.
- Selected-text quote replies now use Telegram quote metadata instead of prepending `> quote` text to the outgoing message.
- Web sender media accepts MP4/WEBM video files with a separate `TELEGRAM_USER_SEND_MAX_MEDIA_MB` limit.
- MP4 video sends use Telegram video upload paths instead of photo/animation fallbacks.
- Repeated speech bubbles are capped without blocking the browser when a fourth bubble arrives.
- Chat media, rich links, and context-menu quote handling are being shared through `static_shared/chat_core.js`.
- Screen-space stars/meteors were added so sky effects remain visible at high camera angles.
- Bot messages now carry `is_bot: true`, `level: null`, and `level_label: "Bot"`.
- The 9393 videochat chat panel renders bot messages with a `Bot` badge instead of `Lv. 1`.
- Host/NA mapping remains unchanged. Messages mapped to the host are still shown as host messages, not bot messages.
- 9393 control mode (`?control=1`) stores overlay layout/camera settings on the server and broadcasts them to OBS Browser Source clients.
- Control-mode settings include the source viewport and are scaled on the viewer side to reduce drift between Chrome and OBS resolutions.
- X/Twitter links use `/api/link/x-preview` to show readable post cards with text and media when possible, with oEmbed and search-page fallbacks.
- Link previews share draggable/resizable UI and local proxy support across 9292 and 9393 via `static_shared/chat_core.js`.
- Added optional level system controls: `VIDEOCHAT_LEVEL_SYSTEM_ENABLED`, `LEVEL_REASONS_FILE`, level-up/down templates, `/check_level`, `/level_scan`, and `/level_up`.
- Automatic levels are staged: Lv. 1 is granted by identifiable chat activity, and Lv. 2 requires both chat activity and videochat presence. If videochat presence was seen first, the later chat event emits Lv. 1 and Lv. 2 notices in order.
- Automatic level-up notices use per-level reasons from `data/level_reasons.json` or `LEVEL_REASONS_FILE`; forced level changes use separate admin wording.
- Level-up notifications store `last_notified_level` to avoid repeating the same notice after watcher/server restarts.
- Force-level changes now ask the 9393 overlay to reload level data through both the 9393 local API and a 9292 WebSocket hint.
- Web sender can send cached stickers and cached Telegram custom emoji from the recent emoji picker.
- `/fire` emits a videochat fireworks effect with configurable user/global cooldowns exposed in the 9393 control panel.
- Media lightbox and internal link-preview window open/close/position state are synchronized from control browsers to OBS/browser-source viewers.
