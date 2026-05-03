# Patch Notes

이 문서는 공개 repo 기준의 주요 변경 사항과 실전 테스트에서 확인된 문제/해결 상태를 기록한다. 실제 토큰, 전화번호, 채팅 ID, 초대 링크, 세션 파일, Electron 프로필, ROM 파일은 기록하지 않는다.

## 2026-05-04 실전 테스트 안정화 묶음

상태: YouTube/Web native view의 Electron 레이어 한계를 제외하면 실전 운용 가능한 상태로 정리.

### WSL2 / uv / 로그인

- uv 기반 실행 흐름을 문서화하고 WSL2 개발 기준을 정리했다.
- `sounddevice`가 import되기 전에 로컬 환경 파일이 로드되도록 STT 초기화 순서를 보강했다.
- 메인 계정/부계정 Telethon 세션 로그인 helper를 추가했다.
- 세션 DB가 lock 상태일 때 원인과 복구 방법을 안내하고, 로컬 테스트용 locked session 삭제/백업 옵션을 제공한다.
- 원격 WSL 개발 테스트를 위해 repo sync 및 원격 서버 실행 helper를 추가했다.

### 채팅 / STT / Telegram 전송

- Electron 앱에서 9292 채팅 UI를 별도 native chat window로 분리해 9393 렌더링 부하와 채팅 입력 UI를 덜 묶이게 했다.
- Telegram send path를 큐 기반으로 분리해 `/api/send`가 Telegram API 응답을 기다리며 UI를 오래 붙잡지 않게 했다.
- STT 출력은 main/here 상태에 맞춰 중복 표시를 줄이고, 댓글형 메시지는 `(댓)` prefix로 구분한다.
- 댓글형 메시지의 답장/인용, 삭제된 원본 메시지 표시, 우클릭 메뉴 상태 갱신을 보강했다.
- 우클릭 메뉴에 난쟁이/케이지/아가리 기능을 추가하고, 상태가 활성화된 경우 버튼 상태를 갱신한다.

### 비디오챗 프리뷰 / 스트림

- 비디오챗 receiver 상태와 MJPEG 프리뷰 진단 로그를 추가했다.
- 작은 프리뷰와 큰 화면의 화질 프리셋을 분리했다.
- 큰 화면은 720p 30fps 목표를 유지하고, 작은 프리뷰는 저해상도/저FPS로 부하를 줄이도록 정리했다.
- 프리뷰/큰 화면 회전 기능을 추가했다.
- 참가자 변경, 프리뷰 클릭, 큰 화면 close 시 전체 프리뷰가 불필요하게 재연결되는 문제를 줄이기 위한 구조를 정리했다.

### 캐릭터 / 이벤트 / 레벨

- 입장/퇴장뿐 아니라 레벨업/레벨다운 이벤트 메시지를 표시한다.
- 새로고침 시 기존 참가자 등장 이벤트도 이벤트 카드로 보여준다.
- cheer/fire 사용 조건으로 레벨 3/4 도달을 처리하고, 레벨 리셋 후 효과 판정도 다시 계산되게 보강했다.
- 특정 키워드 언급 1회 보너스 같은 이스터에그성 레벨 처리도 추가했다.
- 부계정 캐릭터 표시/자동 소환 설정을 분리했다.
- 케이지 상태는 재입장 후에도 유지하고, 난쟁이 상태는 퇴장/재입장 시 리셋한다.

### 위젯

- 가격, 메모, web, YouTube, 게임, 난쟁이, 케이지, 이동, 프리뷰 위젯을 추가/정리했다.
- 모든 위젯은 드래그, 리사이즈, hide/show, close 동작을 최대한 일관된 방식으로 맞췄다.
- 위젯 클릭 시 z-order를 갱신하고 위치/크기/상태를 localStorage 또는 앱 설정에 저장한다.
- hide 상태의 show 버튼도 드래그 가능하게 정리했다.
- 가격 위젯의 글자 크기/배치, 상승/하락 색상, 미니 차트 표시를 개선했다.
- 난쟁이/케이지 위젯은 선택 목록 스크롤 유지와 실시간 목록 갱신을 보강했다.

### YouTube / Web native view

- YouTube는 Electron native BrowserView 기반으로 재생하고, 웹 테스트용 legacy iframe 브라우저는 메뉴에서 제외했다.
- Electron 프로필/창 상태는 빌드 산출물 안이 아니라 PC별 appData에 저장되도록 정리했다.
- YouTube fullscreen 후 Electron 창 크기 변경 시 native bounds가 stale 상태로 남는 문제를 추적하기 위해 `youtube_escape_event`, `youtube_native_sync`, `electron_window_resize_event` 로그를 추가했다.
- `Esc` 입력은 main window와 BrowserView 양쪽에서 감지하고, 9393 상태가 이미 fullscreen false여도 normal bounds를 강제로 재동기화한다.

남은 한계:

- Electron `BrowserView`는 DOM 안의 div가 아니라 별도 native surface라서 DOM 위젯과 같은 z-index 체계로 부분적으로 섞을 수 없다.
- 따라서 YouTube/Web 내부 렌더링 화면은 DOM 위젯 위로 뜰 수 있다.
- 완전한 해결책은 BrowserView를 포기하고 캡처/스트리밍 기반으로 렌더링하거나, 겹칠 때 native view를 숨기거나, native 위젯을 항상 최상단 UX로 받아들이는 방식 중 하나를 선택해야 한다.

### 게임 위젯

- Game Boy 스타일 내부게임 위젯을 추가했다.
- ROM 선택, 개인 플레이, 집단 플레이, save/load/new, pause/resume, speed/volume 조절을 추가했다.
- 집단 플레이는 비디오챗 참가자 채팅만 반영하고, 케이지 안의 사용자는 참여하지 못하게 했다.
- 조작 버튼은 실제 입력에 맞춰 눌림 상태를 표시한다.
- game widget hide 시 일시정지하고 show 시 재개하도록 정리했다.

### 사운드

- 캠프파이어 배경 루프, crackle, strong crackle 설정을 추가했다.
- 레벨업/레벨다운, 등장/퇴장, firework 소리를 앱 설정에서 조절할 수 있게 했다.
- 말풍선 babble 효과를 추가하고 볼륨/속도를 설정할 수 있게 했다.
- sound lab에서 효과음과 애니메이션 타이밍을 함께 테스트할 수 있게 보강했다.

### Browser Lab 사이드 프로젝트

- 기존 오버레이와 분리된 browser-in-browser 실험 페이지와 별도 proxy를 유지한다.
- Chromium/Playwright 기반 스트리밍 방식의 한계와 React/SPA smoke test 결과를 문서화했다.
- 이 실험은 현재 실사용 web widget의 대체가 아니라, Chrome-only 환경에서 가능한 fidelity를 확인하기 위한 별도 연구용이다.

### 성능 격리 계획

- `docs/PERFORMANCE_ISOLATION_PLAN.md`에 단계별 분리 계획을 기록했다.
- 구현 완료: Electron native chat view, send path decoupling.
- 예정: Web Worker split, video preview isolation, server split.

## 보안 체크

- 로컬 환경 파일, runtime data, Telethon/TDLib 세션, Electron 프로필, 로그, ROM, 빌드 산출물은 커밋하지 않는다.
- 문서에는 env var 이름만 기록하고 실제 값은 기록하지 않는다.
- 실전 로그를 공유할 때는 전화번호, 계정명, 채팅 ID, 초대 링크가 포함되지 않았는지 확인한다.

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
- Added runtime diagnostics for 9393 hangs, including event-loop lag, MJPEG active connection count, JPEG encode timing, frame source count, and TgCalls receiver state.
- Stream preview labels were consolidated into a single translucent top-left overlay containing LIVE/SCREEN, mic state, and participant name.
- Mock participants now include sample camera/screen-share states so the broadcast badge can be tested without a live Telegram videochat.
- Updated the Electron 9393 wrapper to keep rendering when the window is backgrounded or covered by another fullscreen app. It now disables Chromium background throttling/occlusion behavior and starts a `prevent-app-suspension` power-save blocker by default.
- Added `--allow-throttle` to the Electron wrapper for reverting to normal Chromium background throttling when desired.
- Rebuilt the portable Electron app after the keep-rendering changes.

## 2026-04-30 Uncommitted

- User level records now store a `role` field (`host`, `bot`, `viewer`) alongside user id, username, name, and level.
- Bot senders are stored with `role: "bot"` and rendered with a `Bot` badge instead of a level badge.
- Selected-text quote replies now use Telegram quote metadata instead of prepending `> quote` text to the outgoing message.
- Web sender media accepts MP4/WEBM video files with a separate `TELEGRAM_USER_SEND_MAX_MEDIA_MB` limit.
- MP4 video sends use Telegram video upload paths instead of photo/animation fallbacks.
- Repeated speech bubbles are capped without blocking the browser when a fourth bubble arrives.
- Chat media, rich links, and context-menu quote handling are being shared through `static_shared/chat_core.js`.
- Screen-space stars/meteors were added so sky effects remain visible at high camera angles.
- Bot messages now carry `is_bot: true`, `level: null`, and `level_label: "Bot"`.
- The 9393 videochat chat panel renders bot messages with a `Bot` badge instead of `Lv. 1`.
- Host mapping remains unchanged. Messages mapped to the host are still shown as host messages, not bot messages.
- 9393 control mode (`?control=1`) stores overlay layout/camera settings on the server and broadcasts them to OBS Browser Source clients.
- Control-mode settings include the source viewport and are scaled on the viewer side to reduce drift between Chrome and OBS resolutions.
- X/Twitter links use `/api/link/x-preview` to show readable post cards with text and media when possible, with oEmbed and search-page fallbacks.
- Link previews share draggable/resizable UI and local proxy support across 9292 and 9393 via `static_shared/chat_core.js`.
- Added optional level system controls: `VIDEOCHAT_LEVEL_SYSTEM_ENABLED`, `LEVEL_REASONS_FILE`, level-up/down templates, `/check_level`, `/level_scan`, and `/level_up`.
- Automatic levels are staged: Lv. 1 is granted by identifiable chat activity, and Lv. 2 requires both chat activity and videochat presence. If videochat presence was seen first, the later chat event emits Lv. 1 and Lv. 2 notices in order.
- Automatic level-up notices use per-level reasons from local JSON or `LEVEL_REASONS_FILE`; forced level changes use separate admin wording.
- Level-up notifications store `last_notified_level` to avoid repeating the same notice after watcher/server restarts.
- Force-level changes now ask the 9393 overlay to reload level data through both the 9393 local API and a 9292 WebSocket hint.
- Web sender can send cached stickers and cached Telegram custom emoji from the recent emoji picker.
- `/fire` emits a videochat fireworks effect with configurable user/global cooldowns exposed in the 9393 control panel.
- Media lightbox and internal link-preview window open/close/position state are synchronized from control browsers to OBS/browser-source viewers.
