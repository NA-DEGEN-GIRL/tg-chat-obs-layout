# Videochat Stream Preview Plan

This note tracks the planned work for showing Telegram videochat camera/screen-share state and, later, live preview playback inside the 9393 overlay.

## Goal

When a participant starts broadcasting video or screen sharing in Telegram videochat:

- Show a clear camera/live indicator on the 3D character and identity card.
- Show a small draggable/resizable preview panel in the 9393 overlay for active broadcasters.
- Allow clicking a preview to open a larger draggable/resizable viewer.
- Keep OBS-friendly behavior: settings saved, control/browser state synchronized where practical.

## Current State

`videochat_overlay.py` already collects basic broadcast state through Telethon:

```python
"video": media_active(getattr(participant, "video", None)),
"screen": media_active(getattr(participant, "presentation", None)),
```

`normalize_participants()` forwards these fields to the 9393 frontend:

```python
"video": bool(p.get("video")),
"screen": bool(p.get("screen")),
```

So the first UI-only phase can be implemented without TDLib stream decoding.

## Phase 1: Broadcast Indicators

Low-risk frontend work.

- Add camera/live badge near the existing mic status badge.
- Distinguish:
  - `video=true`: camera on / live camera.
  - `screen=true`: screen share / broadcast.
  - both true: prefer screen-share icon plus live dot, or show both compactly.
- Add visual treatment to the character:
  - subtle camera tripod icon above/near card,
  - small red `LIVE` dot,
  - optional faint spotlight/camera beam effect.
- Add CSS classes in `renderParticipants()`:
  - `video-on`
  - `screen-on`
  - `broadcasting`

Expected files:

- `static_videochat/app.js`
- `static_videochat/style.css`

## Phase 2: Preview Panel UI Shell

Still no real stream decoding yet. This phase creates the user-facing layout and settings.

- Add left-corner preview rail for active broadcasters.
- Show participant avatar/name/status cards.
- Exclude the host/current account from the preview rail by default. The host can still show a LIVE/SCREEN badge on their own character card, but their own outgoing stream should not consume preview space.
- Match the current account using the same host identity config used elsewhere:
  - `VIDEOCHAT_HOST_USER_ID`
  - `VIDEOCHAT_HOST_USERNAME`
  - `VIDEOCHAT_HOST_NAME`
- Make the panel draggable/resizable.
- Save settings in `videochat_overlay_settings.json`.
- Clicking a card opens a larger floating viewer shell.
- Viewer shell should be draggable/resizable and closable.

This lets layout and OBS composition be tested before the harder TDLib work.

Implemented baseline:

- The preview rail is created in `static_videochat/app.js`.
- The preview settings are saved as `streamPreview` in overlay settings.
- Host/current account matching uses the configured host id, username, name, plus `is_host`/`king` role.
- The shell currently renders a visual placeholder from avatar/name/status. Real video frames still require Phase 3/4.
- Experimental real chunk rendering is wired: if the backend attaches a `stream.url` to a participant, the preview card tries to play it with a muted `<video>` element and falls back to the placeholder if loading fails.

## Phase 3: TDLib Stream Probe

Telethon is enough for participant state. For livestream/RTMP-style chunks, Telethon exposes the relevant MTProto requests:

- `phone.getGroupCallStreamChannels`
- `upload.getFile` with `inputGroupCallStream`

Implemented experimental path:

- `videochat_overlay.py` calls `phone.getGroupCallStreamChannels` while active video/screen participants exist.
- Participant `video.source_groups` and `presentation.source_groups` are carried as source ids.
- Returned stream channels are matched against those source ids when possible.
- A single-active-broadcaster fallback maps the first returned stream channel to that broadcaster.
- Local endpoint:
  - `/api/videochat/streams`
  - `/api/videochat/streams/{channel}/chunk.mp4?scale=...&time_ms=...`

If this does not produce browser-playable chunks for normal participant cameras, a deeper TDLib or tgcalls/WebRTC path is still needed.

Observed limitation:

- `phone.getGroupCallStreamChannels` is for RTMP/livestream stream channels. Normal participant camera videochats can still expose participant `video` state while rejecting stream-channel probing with `GROUPCALL_INVALID`.
- The watcher now checks the call's `rtmp_stream`/`stream_dc_id` fields before probing. If the current call is not that kind of stream, the preview remains a placeholder and the next path should be TDLib/tgcalls.

TDLib may still be needed for participant-level stream metadata and more stable playback.

Probe script:

```cmd
uv run python tdlib_videochat_probe.py "https://t.me/+INVITE_HASH"
```

Useful variants:

```cmd
uv run python tdlib_videochat_probe.py --chat-id <CHAT_ID>
uv run python tdlib_videochat_probe.py --group-call-id 1
```

The script loads `vendor/tdlib/tdjson.dll` by default, or `TDLIB_JSON_DLL` if set. It stores TDLib session data under `data/tdlib/videochat_probe/` and writes raw probe results to `data/debug_tdlib_videochat/last_probe.json`, both of which must stay uncommitted.

What the probe checks:

- TDLib `chat.video_chat.group_call_id`
- `getGroupCall`
- `loadGroupCallParticipants` updates, including `video_info` and `screen_sharing_video_info`
- `getGroupCallStreams`
- `getGroupCallStreamSegment` / `getVideoChatStreamSegment` if stream channels are exposed

Expected interpretation:

- If `video_info` exists but `getGroupCallStreams` returns no streams, TDLib can see camera state but still doesn't expose browser-playable media segments for normal participant cameras.
- If stream channels and a segment are saved, the overlay can be wired to that route.
- If participant loading fails unless joined, a tgcalls join path may be required.

Current live test result:

- The TDLib probe can authenticate against `vendor/tdlib/tdjson.dll` and find an active `group_call_id` from a comma-separated `TD_CHAT_ID` candidate list.
- For normal participant camera videochat, TDLib reported `getGroupCallStreams` as unavailable because the call is not a streamable RTMP/livestream call.
- `loadGroupCallParticipants` can fail while the TDLib client is not joined, even when another Telegram app session for the same account is already in the call.

PyTgCalls probe:

```cmd
uv run python tgcalls_videochat_probe.py --wait 8 --frame-limit 8 --devices camera
```

Observed result:

- `py-tgcalls[telethon]` + `ntgcalls` can join the active normal group call and receive incoming camera frames.
- A live test received camera frames at `1280x720`; the raw frame length matched a YUV420/NV12-style layout.
- The probe writes raw frame samples and `data/debug_tgcalls_videochat/last_probe.json`. These files must stay uncommitted.

Experimental overlay path:

- Set `VIDEOCHAT_TGCALLS_PREVIEW_ENABLED=1` to enable the 9393 PyTgCalls receiver.
- The receiver tries `TD_CHAT_ID`, `CHAT_ID`, then `VIDEOCHAT_LEVEL_CHAT_ID`; comma-separated values are tried in order.
- Received frame `ssrc` values are matched to Telethon participant `video_sources`/`screen_sources`.
- When matched, participant `stream` metadata points to `/api/videochat/tgcalls/frame/{ssrc}.json`.
- The frontend renders those raw frames onto a canvas. This is intentionally experimental and may need format tuning if colors look wrong.

## Sub-Account Receiver Design

The preferred production direction is to keep the stream receiver separate from the host's real Telegram session.

Roles:

- Host/main account:
  - joins the Telegram group call normally,
  - speaks/listens through the official Telegram client,
  - remains the identity used for STT/host messages in the overlay.
- Receiver sub-account:
  - is a normal Telegram user account, not a Bot API bot,
  - is a member of the chat/channel where the videochat opens,
  - joins the active group call only for media observation,
  - keeps microphone/camera off,
  - receives participant camera/screen raw frames through PyTgCalls/NTgCalls.
- Bot account:
  - keeps existing moderation, command, chat, level, and notification behavior,
  - does not join calls or receive WebRTC media.

Why a sub-account:

- Avoids competing with the host's official Telegram client session.
- A receiver crash does not interrupt the host's live participation.
- Receiver login/session storage can be isolated and revoked separately.
- Makes the video preview feature optional and disableable without affecting normal chat/overlay behavior.

Planned environment variables:

```env
VIDEOCHAT_TGCALLS_PREVIEW_ENABLED=0
VIDEOCHAT_TGCALLS_AUTO_JOIN=1
VIDEOCHAT_FORCE_EXIT_ON_SHUTDOWN=1
VIDEOCHAT_DIAGNOSTICS_ENABLED=1
VIDEOCHAT_DIAG_INTERVAL_SEC=5
TGCALLS_SESSION=data/telethon/videochat_receiver
TGCALLS_PHONE=
TGCALLS_CHAT_IDS=
TGCALLS_AUTO_JOIN=1
TGCALLS_RECEIVE_CAMERA=1
TGCALLS_RECEIVE_SCREEN=1
TGCALLS_FRAME_FPS=8
TGCALLS_MAX_ACTIVE_STREAMS=2
TGCALLS_MJPEG_FPS=30
TGCALLS_MJPEG_QUALITY=82
TGCALLS_MJPEG_WIDTH=1280
TGCALLS_MJPEG_HEIGHT=720
```

Notes:

- `TGCALLS_CHAT_IDS` should accept comma-separated candidates, matching the existing `TD_CHAT_ID` behavior.
- If `TGCALLS_CHAT_IDS` is empty, fallback may use `TD_CHAT_ID`, then `CHAT_ID`, then `VIDEOCHAT_LEVEL_CHAT_ID`.
- `TGCALLS_PHONE` should be the receiver sub-account phone. It intentionally does not fall back to `TD_PHONE`, because `TD_PHONE` normally belongs to the host/main account.
- Receiver session data belongs under `data/telethon/` and must never be committed.

Startup flow:

1. Start the normal 9292 bot/chat server.
2. Start 9393 `videochat_overlay.py`.
3. The normal Telethon watcher resolves active videochat participants and media source ids.
4. Start the receiver automatically when active camera/screen participants are detected and `VIDEOCHAT_TGCALLS_AUTO_JOIN=1`, or manually with the owner-only `/stream_watch` command.
5. Receiver tries chat candidates in order until `PyTgCalls.play(..., auto_start=False)` joins an active call.
6. Receiver enables incoming `RecordStream(audio=False, camera=True, screen=True)`.
7. Frame callbacks store latest frames by `ssrc`.
8. 9393 maps `ssrc` to participant `video_sources`/`screen_sources` and exposes local preview endpoints.

Manual `/stream_watch` flow:

1. Keep `VIDEOCHAT_TGCALLS_PREVIEW_ENABLED=0` if startup-time receiver autostart is not wanted. `VIDEOCHAT_TGCALLS_AUTO_JOIN=1` can still start the receiver once an active broadcaster appears.
2. Configure `TGCALLS_SESSION=data/telethon/videochat_receiver` and optionally `TGCALLS_PHONE` with the receiver sub-account phone.
3. Run `/stream_watch` as the owner.
4. If the receiver session is not authorized, the bot replies with the login command:

```powershell
uv run python tgcalls_videochat_probe.py --session "data/telethon/videochat_receiver" --login-only
```

5. Enter the login code for the receiver sub-account, not the host account.
6. Run `/stream_watch` again. The receiver should join the active call and start exposing camera/screen frames.
7. Use `/stream_unwatch` or `/stream_watch_off` to stop the receiver and clear cached frames.

Frame pipeline MVP:

- Input: PyTgCalls `StreamFrames` callback.
- Key: `(device, ssrc)`.
- Format: live probe confirmed `yuv420p` for camera frames in the tested call.
- Backend cache: keep only the latest frame per `ssrc` with timestamp, width, height, rotation, and format.
- Frontend:
  - prefer `/api/videochat/tgcalls/mjpeg/{ssrc}` for browser/OBS-friendly 720p30 playback,
  - keep the raw JSON frame endpoint as a debug fallback,
  - throttle preview rail lower than large viewer,
  - hide preview if frame timestamp goes stale.

Later optimization:

- Replace JSON/base64 polling with a binary WebSocket channel.
- Send only selected streams, not every active broadcaster.
- Move YUV-to-RGB conversion to WebCodecs/WebGL shader if canvas CPU conversion is too expensive.
- Add per-stream start/stop controls in the preview UI.
- Add watchdog rejoin if the receiver is kicked, disconnected, or the active group call changes.

Operational constraints:

- The receiver sub-account may visibly appear in the group call participant list.
- It must have permission to join the group call.
- If the group/channel restricts videochat participation, receiver permissions need to be configured like a normal user.
- Use a low FPS cap for previews. This is an overlay aid, not a full video conferencing replacement.
- Keep the feature behind `VIDEOCHAT_TGCALLS_PREVIEW_ENABLED=0` by default.

Relevant official TDLib APIs:

- `groupCallParticipant.video_info`
- `groupCallParticipant.screen_sharing_video_info`
- `groupCallParticipantVideoInfo.source_groups`
- `groupCallParticipantVideoInfo.endpoint_id`
- `getGroupCallStreams`
- `getGroupCallStreamSegment`

References:

- https://core.telegram.org/tdlib/docs/classtd_1_1td__api_1_1group_call_participant.html
- https://core.telegram.org/tdlib/docs/classtd_1_1td__api_1_1group_call_participant_video_info.html
- https://core.telegram.org/tdlib/docs/classtd_1_1td__api_1_1get_group_call_streams.html
- https://core.telegram.org/tdlib/docs/classtd_1_1td__api_1_1get_group_call_stream_segment.html

Probe questions:

- Does `getGroupCallStreams` return stream `channel_id` values during normal participant camera video, screen share, or only livestream-style RTMP streams?
- Can returned `channel_id` values be mapped to `video_info.source_groups` or `screen_sharing_video_info.source_groups`?
- Does `getGroupCallStreamSegment` return browser-playable MP4 segments for participant camera video?
- Does the current TDLib account need to explicitly join the call to access segments?
- What segment cadence and latency are practical for preview use?

Suggested probe output:

- Raw TDLib participant video info, redacted of account identifiers before sharing.
- Stream channel list.
- Saved sample segments:
  - `data/debug_stream_segments/<channel_id>_<offset>.mp4`
- Local playback test result with browser/ffmpeg.

## Phase 4: Playback Pipeline

If Phase 3 succeeds:

- Add a small backend streamer in `videochat_overlay.py` or a separate helper.
- Provide local endpoints such as:
  - `/api/videochat/streams`
  - `/api/videochat/streams/{participant_key}/segment`
  - `/api/videochat/streams/{participant_key}/playlist.m3u8` if HLS is easier.
- Frontend options:
  - MediaSource Extensions for MP4 segments.
  - Very short HLS if ffmpeg remuxing is needed.
  - Fallback: periodically refreshed still frame if continuous playback is unstable.

Important constraints:

- Keep preview optional and disabled by default until stable.
- Limit concurrent previews to avoid CPU/network load.
- Provide per-stream start/stop so selecting one broadcaster does not fetch every stream.
- OBS Browser Source may behave differently from Chrome/Electron; test in the Electron wrapper too.

## Open Risks

- Telegram group call video reception may require lower-level tgcalls/WebRTC handling rather than simple TDLib segment polling.
- Segment APIs may target livestream/RTMP style streams more reliably than individual participant webcams.
- Mapping participants to stream channel IDs may not be direct from Telethon alone.
- Latency may be too high for a smooth preview panel.
- Browser playback may need remuxing.

## Recommended Next Step

Implement Phase 1 first because the necessary state is already available.

Then create a separate TDLib probe script for Phase 3 before touching the overlay playback UI. Do not build the full preview player until actual segment retrieval is confirmed in a live videochat.
