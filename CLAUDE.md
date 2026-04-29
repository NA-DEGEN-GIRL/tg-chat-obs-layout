# CLAUDE.md

이 파일은 Claude Code 가 이 저장소에서 작업할 때 참고하는 컨텍스트다.
사용자 가이드는 [README.md](./README.md) 를 볼 것.

---

## 한 줄 요약

텔레그램 그룹 채팅을 **투명 배경 브라우저 오버레이**로 OBS에 띄우는 윈도우 프로그램. 봇 커맨드로 권한 토글 + 마이크 STT → 봇이 대신 포스팅 기능까지 포함.

---

## 아키텍처

```
┌──────────────┐    polling     ┌────────────────────┐
│ Telegram API │◀──────────────▶│ telebot (thread)   │
└──────────────┘                │ - on_text          │
                                │ - on_photo         │
                                │ - cmd_stream_on/off│
                                │ - cmd_tts_on/off   │
                                └─────────┬──────────┘
                                          │ run_coroutine_threadsafe
                                          ▼
 ┌─────────────────┐  WebSocket  ┌────────────────────┐
 │ Browser (OBS)   │◀────────────│ FastAPI (main loop)│
 │ static/app.js   │             │ - /ws push         │
 │                 │             │ - /static /photos  │
 │                 │             │ - /config          │
 └─────────────────┘             └─────────┬──────────┘
                                           │
                                           │ asyncio
                                           ▼
                                ┌────────────────────┐
                                │ stt.STTManager     │
                                │ - OpenAI backend   │
                                │ - Gemini backend   │
                                │ - mic capture(sd)  │
                                └────────────────────┘
```

- **main thread**: uvicorn asyncio 루프 (FastAPI, WebSocket, STT 코디네이션)
- **daemon thread**: telebot `infinity_polling` (동기 HTTP polling)
- **portaudio thread**: sounddevice 콜백 (tts_on 동안만) — `loop.call_soon_threadsafe` 로 asyncio 큐에 PCM 바이트 푸시

---

## 파일 역할

```
main.py                오케스트레이션 (Telegram + FastAPI + STT + state)

stt/manager.py         마이크 캡처 + 백엔드 라이프사이클
stt/openai_backend.py  OpenAI Realtime `?intent=transcription` WS 클라이언트
stt/gemini_backend.py  Gemini Live BidiGenerateContent WS 클라이언트 (실험적)

static/index.html      `{{CB}}` 플레이스홀더 — 서버 시작 시각으로 치환돼 캐시 버스터로 사용
static/style.css       메시지 카드 스타일 (rgba 검정 카드 + blur + 페이드)
static/app.js          WebSocket 클라이언트, payload type 분기 (text/photo)

data/user_colors.json  user_id → hex 색상 영구 매핑
data/state.json        tts_on 지속 상태
data/photos/           받은 사진 캐시 (최신 MAX_PHOTOS=10)
```

---

## 봇 커맨드 (모두 owner + CHAT_ID 게이트)

| 커맨드 | 동작 | 주의 |
|---|---|---|
| `/stream_on` | 텍스트+사진만 허용하도록 `setChatPermissions` 호출 | OWNER+CHAT_ID 게이트. **`use_independent_chat_permissions=True` 필수** |
| `/text_on` | 텍스트만 허용 (사진 포함 모든 미디어 차단) | 동일 |
| `/stream_off` | 전부 음소거 (관리자는 영향 없음) | 동일 |
| `/tts_on` | 친 위치에 따라 `tts_destinations` 에 메인 또는 활성 thread 추가, STTManager 미가동이면 시작 | OWNER 만, 메인 또는 활성 thread 안에서만. 메인 추가 시 `state.json` 에 `tts_on=true` |
| `/tts_off` | `tts_destinations` 전부 비우고 STTManager 종료 | 어디서든 양쪽 다 off (사양) |
| `/here_on` | `active_thread = (chat_id, thread_id)` 등록 | OWNER 만, `message_thread_id` 있는 메시지에서만. 이전 thread 의 TTS 목적지 자동 정리 |
| `/here_off` | `active_thread=None`, thread TTS 목적지 정리. 메인 TTS 도 없으면 STT 도 종료 | OWNER 만 |

권한 체크 함수들:
- `_is_owner_in_target_chat(message)` — OWNER + CHAT_ID 둘 다 매치. `/stream_*`, `/text_on` 에 사용
- `_is_owner(message)` — OWNER 만 체크 (chat 무관). `/tts_*`, `/here_*` 에 사용
- `_is_main_chat`, `_matches_active_thread`, `_is_overlay_source` — 메시지 소스 판정용
- 모든 게이트 실패는 **조용히 무시** (답장 X)

`tts_destinations` 자료형: `list[dict]` — 각 항목 `{"chat_id": int, "thread_id": int | None}`. STT 결과는 모든 목적지에 동시 송출 (`asyncio.gather`). thread 메시지는 `bot.send_message(..., message_thread_id=N)` 로 전송.

---

## Gotcha 모음 (코드에서 잘 안 보이는 것들)

### 1. Telegram `setChatPermissions` 자동 권한 상승
`use_independent_chat_permissions=True` 없이 호출하면:
- `can_add_web_page_previews=True` 하나만으로도 `can_send_messages`, `can_send_audios`, `can_send_documents`, `can_send_photos`, `can_send_videos`, `can_send_video_notes`, `can_send_voice_notes` 전부 자동 True 처리
- `can_send_polls=True` → `can_send_messages` 자동 True

반드시 `True` 로 호출해야 granular 필드가 정확히 적용됨.

### 2. 봇은 자기 메시지 못 받음
`bot.send_message(CHAT_ID, text)` 는 getUpdates 로 돌아오지 않음. 따라서:
- STT 결과를 텔레그램에 포스팅하는 것 + 오버레이에 broadcast 하는 것 → **둘 다 별도로** 해야 함
- `stt_on_text` 에서 `asyncio.gather(broadcast, send_message)` 로 동시 실행

### 3. 409 Conflict — 토큰 중복 사용
같은 `BOT_TOKEN` 으로 두 프로세스가 동시에 `getUpdates` 치면 `409 Conflict`. `main.py` 시작 시 `bot.remove_webhook()` 호출해서 webhook 충돌은 방지했지만, **다른 python 인스턴스가 살아있으면 답 없음**. 사용자가 "에러나서 죽었다"고 할 때 실제론 돌고 있는 경우 많음 → `Get-Process python` 확인.

### 4. Group Privacy Mode
BotFather 기본 설정으론 봇이 그룹에서 **명령어와 mention만** 받음. Privacy Mode 꺼야(`/mybots` → Bot Settings → Group Privacy → Turn off) 일반 메시지 수신. 끈 뒤 **그룹에서 봇 뺐다 다시 초대** 해야 반영.

### 5. python-dotenv 인라인 주석
`KEY=value # comment` 같은 줄 주석을 python-dotenv 는 처리하지 않음. `value # comment` 전체가 값으로 들어감. `main.py` 에서 값 받은 뒤 `#` 이후 잘라내는 방어 코드 있지만, **`.env.example` 은 주석을 별도 줄에** 두기.

### 6. OBS CEF 공격적 캐싱
OBS 브라우저 소스는 JS/CSS 를 공격적으로 캐시함. 속성 창의 "새로 고침" 버튼은 페이지만 리로드, JS 캐시는 그대로 씀. 해결:
- `static/index.html` 의 `{{CB}}` 플레이스홀더를 서버 시작 타임스탬프로 치환 (main.py의 `CACHE_BUSTER`) → `app.js?v=1700000000` 식으로 URL 바뀜 → 자동 갱신
- 처음 배포 시에만 수동으로 "현재 페이지의 캐시 새로 고침" 필요

### 7. `gpt-realtime-1.5` 의 함정
"realtime" 붙었지만 **voice-to-voice 에이전트 모델**. 순수 STT 용도론 과금 낭비.
- 올바른 STT 모델: `gpt-4o-mini-transcribe` (transcription-only)
- 엔드포인트: `wss://api.openai.com/v1/realtime?intent=transcription`
- 기본값을 `gpt-4o-mini-transcribe` 로 둬야 함

### 8. `webp/gif` 업로드 무시
`on_photo` 는 `content_types=["photo"]` 만 처리. 애니메이션 GIF 는 `animation`, 스티커는 `sticker`. `/stream_on` 이 이것들 차단 중이라 그룹에 애초에 안 들어오지만, 나중에 허용하면 별도 핸들러 필요.

### 9. STT 세션 15분 제한 (Gemini)
Gemini Live API 오디오 전용 세션은 15분 제한. 현재 코드는 재연결 로직 없음 — 15분 지나면 말 끊김. 필요 시 `turnComplete` 직후 재연결 루프 추가. (OpenAI 는 60분 + stateless 이라 영향 적음)

---

## 환경변수 (`.env`)

| 이름 | 용도 | 기본값 |
|---|---|---|
| `BOT_TOKEN` | BotFather 토큰 | (필수) |
| `CHAT_ID` | 대상 그룹 ID (-100…) | (필수) |
| `OWNER_ID` | 커맨드 허용 유저 ID | (필수) |
| `WEB_HOST` | 서버 바인드 주소 | `127.0.0.1` |
| `WEB_PORT` | 서버 포트 | `9292` |
| `FADE_AFTER_SEC` | 메시지 페이드아웃 초, `-1`=안 사라짐 | `30` |
| `STT_PROVIDER` | `openai` / `gemini` | `openai` |
| `OPENAI_API_KEY` | STT 용 | — |
| `GEMINI_API_KEY` | STT 용 | — |
| `STT_MODEL_OPENAI` | | `gpt-4o-mini-transcribe` |
| `STT_MODEL_GEMINI` | | `gemini-3.1-flash-live-preview` |
| `STT_LANGUAGE` | ISO 639-1 | `ko` |
| `STT_INPUT_DEVICE` | 마이크 (이름 일부 or 인덱스) | (비어있으면 OS 기본) |

---

## 실행

```bash
uv venv && uv pip install -r requirements.txt
cp .env.example .env && 편집
uv run python main.py
```

**STT 단독 테스트:**
```bash
```

**문법 체크:**
```bash
.venv/Scripts/python.exe -c "import ast; [ast.parse(open(p).read()) for p in ['main.py']]"
```

---

## Git

로컬 전용 — 원격 push 대상 없음. `.gitignore` 가 `.env`, `.venv/`, `data/`, `.claude/`, `__pycache__/` 제외.

커밋 스타일: 짧은 제목 (첫줄) + 빈 줄 + 상세. 예:
```
Add photo support to overlay

- on_photo handler downloads largest Telegram photo variant
- data/photos/ cache with MAX_PHOTOS=10 retention
- StaticFiles mount at /photos
- Frontend renders <img> for payload type=photo
```

---

## 참고 링크

- [pyTelegramBotAPI 4.x docs](https://pytba.readthedocs.io/)
- [Telegram Bot API - setChatPermissions](https://core.telegram.org/bots/api#setchatpermissions)
- [OpenAI Realtime API (transcription intent)](https://developers.openai.com/api/docs/guides/realtime)
- [Gemini Live API](https://ai.google.dev/gemini-api/docs/live-api)
