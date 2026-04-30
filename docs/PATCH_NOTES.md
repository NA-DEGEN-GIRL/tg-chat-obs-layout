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
