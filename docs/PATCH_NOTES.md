# Patch Notes

## 2026-05-01

- Added `docs/VIDEOCHAT_STREAM_PREVIEW_PLAN.md` to document the staged plan for Telegram videochat camera/screen-share indicators, preview UI, TDLib stream probing, and eventual playback.
- 9393 videochat participant cards now show a compact camera/screen-share badge when TDLib reports active participant video or presentation state.
- Fixed LIVE badge detection to use the participant's active `video` stream instead of the broader `video_joined` flag.
- Documented that future video preview panels must exclude the host/current account's own outgoing stream by default.
- Added the first 9393 videochat preview UI: non-host LIVE/SCREEN participants appear in a draggable/resizable preview rail, and each item can open a larger draggable/resizable viewer shell.
- Removed duplicate name/status metadata from the 9393 preview rail items; the thumbnail card itself now carries the participant name and LIVE/SCREEN state.
- Added an experimental real-stream path for 9393 previews: Telethon probes `phone.getGroupCallStreamChannels`, maps returned channel ids to participant video/screen source groups when possible, and exposes local no-cache MP4 chunk URLs for the preview video element.
- The experimental stream probe now skips non-RTMP/livestream calls before calling `phone.getGroupCallStreamChannels`, avoiding repeated `GROUPCALL_INVALID` noise for normal participant-camera videochats.
- Added `tdlib_videochat_probe.py`, a local TDLib/tdjson probe for checking whether normal participant camera/screen video exposes `video_info`, stream channels, or downloadable stream segments.
- Added `tgcalls_videochat_probe.py`, a PyTgCalls/NTgCalls probe that joins the active normal group call and confirms whether incoming camera/screen raw frames can be received.
- Added an experimental 9393 PyTgCalls preview path behind `VIDEOCHAT_TGCALLS_PREVIEW_ENABLED=1`; matched `ssrc` frames are exposed through `/api/videochat/tgcalls/frame/{ssrc}.json` and rendered to the preview canvas.
- `TD_CHAT_ID` can now be a comma-separated candidate list for TDLib/PyTgCalls probes; candidates are tried in order until an active call is found.
- Documented the recommended sub-account receiver design for future video preview work: the host remains in the official Telegram client, while a separate user session joins the call only to receive camera/screen frames.
- Added owner commands `/stream_watch` and `/stream_unwatch` to start/stop the experimental PyTgCalls receiver on demand. If the receiver sub-account session is not authorized, `/stream_watch` replies with the exact `--login-only` command to run.
- TgCalls receiver login no longer falls back to `TD_PHONE`; `TGCALLS_PHONE` or an interactive prompt must be used so the receiver session can stay on a sub-account.
- 9393 stream previews no longer hide the host/broadcaster; with the sub-account receiver model, the host's camera/screen is a valid preview target.
- 9393 can now auto-start the TgCalls receiver when the Telethon watcher finds an active camera/screen participant, controlled by `VIDEOCHAT_TGCALLS_AUTO_JOIN=1`.
- RTMP/livestream chunk probing is now off by default so normal participant-camera calls do not print repeated "not RTMP/livestream" fallback logs.
- Added OpenCV-backed MJPEG output for TgCalls frames at `/api/videochat/tgcalls/mjpeg/{ssrc}` and made 9393 stream previews prefer it over JSON/base64 polling. Defaults target 1280x720 at 30fps.
- Added bounded shutdown for the 9393 Telethon/PyTgCalls tasks. If the native receiver does not stop after Ctrl+C, `VIDEOCHAT_FORCE_EXIT_ON_SHUTDOWN=1` forces the local overlay process to exit.
- Tightened the root shutdown path for the embedded PyTgCalls receiver: cleanup now leaves active NTgCalls calls, stops leftover native binding calls, removes frame handlers, shuts down the PyTgCalls executor, and disconnects the receiver Telethon session.
- Fixed the stream preview drag hang: moving/resizing the preview no longer re-renders the MJPEG `<img>` on every pointer event, which had created many long-lived MJPEG HTTP streams.
- MJPEG encoding is now cached per source/frame sequence so Chrome, OBS, and large-preview viewers share one JPEG encode per incoming frame instead of each connection encoding 720p frames independently.
- Made the large live preview resize handle more visible and easier to grab.
- Large live preview playback now uses `object-fit: contain`, and backend MJPEG resizing preserves source aspect ratio with letterboxing so vertical/screen-share streams are not cropped.
- The large live preview can now be moved by dragging the video surface itself; the `M` button remains as an alternate handle.
- Added `data/videochat_overlay_diag.log` diagnostics for 9393 hangs, including event-loop lag, MJPEG active connection count, JPEG encode timing, frame source count, and TgCalls receiver state.
- Stream preview labels were consolidated into a single translucent top-left overlay containing LIVE/SCREEN, mic state, and participant name.
- Mock participants now include sample camera/screen-share states so the broadcast badge can be tested without a live Telegram videochat.
- Updated the Electron 9393 wrapper to keep rendering when the window is backgrounded or covered by another fullscreen app. It now disables Chromium background throttling/occlusion behavior and starts a `prevent-app-suspension` power-save blocker by default.
- Added `--allow-throttle` to the Electron wrapper for reverting to normal Chromium background throttling when desired.
- Rebuilt the portable Electron app after the keep-rendering changes.

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
