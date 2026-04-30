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

## Phase 3: TDLib Stream Probe

Telethon is enough for participant state, but real preview playback likely needs TDLib.

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
