# CLAUDE.md

이 파일은 Claude Code가 이 저장소에서 작업할 때 참고하는 프로젝트 컨텍스트이다.

## 프로젝트 개요

텔레그램 그룹 채팅을 OBS 방송 화면에 **투명 배경 오버레이**로 띄우는 Python 프로그램.
호스트 음성을 STT로 텍스트화해서 봇이 그룹에 대신 포스팅하는 기능도 포함.

윈도우 환경 전제. 주요 설정은 `.env` 로 한다.

## 아키텍처

```
┌─────────────────┐   polling    ┌──────────────┐
│ Telegram Group  │─────────────▶│   main.py    │
│  (chat_id)      │              │  FastAPI +   │
└─────────────────┘              │   telebot    │
         ▲                       └──────┬───────┘
         │ bot.send_message             │
         │                              │ WebSocket push
  ┌──────┴───────┐              ┌──────▼───────┐
  │  STT (mic)   │──transcript─▶│  Browser src │
  │  OpenAI RT   │              │  (OBS)       │
  └──────────────┘              └──────────────┘
```

- **텔레그램 입력**: `pyTelegramBotAPI` long-polling (별도 데몬 스레드)
- **웹서버**: FastAPI + uvicorn, `127.0.0.1:9292` 로컬 바인드
- **오버레이 렌더링**: `static/` 내 정적 HTML/CSS/JS, WebSocket으로 실시간 푸시
- **STT**: `stt/` 모듈. OpenAI Realtime (transcription intent) 또는 Gemini Live. WebSocket 클라이언트 + `sounddevice` 마이크 캡처
- **색상 영속화**: 유저별 색상은 `data/user_colors.json` 에 영구 저장 (user_id → hex color)

## 파일 구조

```
main.py                # 오케스트레이션: Telegram + FastAPI + WebSocket + STT
test_stt.py            # STT 단독 테스트 (텔레그램/오버레이 없이 CMD 출력만)
requirements.txt       # 의존성
.env.example           # 설정 템플릿 (실제 .env 는 커밋 금지)
.gitignore
CLAUDE.md              # 이 파일
README.md              # 사용자 가이드

stt/
  __init__.py
  manager.py           # 마이크 캡처 + 백엔드 라이프사이클 관리
  openai_backend.py    # OpenAI Realtime transcription WebSocket 클라이언트
  gemini_backend.py    # Gemini Live API WebSocket 클라이언트 (실험적)

static/
  index.html           # 오버레이 HTML (투명 body)
  style.css            # 말풍선 스타일, 페이드 애니메이션
  app.js               # WebSocket 클라이언트 + 메시지 렌더링

data/
  user_colors.json     # 유저별 배정된 색상 (.gitignore)
```

## 봇 명령어

모두 **OWNER_ID 본인**이 **대상 CHAT_ID** 에서 보낼 때만 동작. 그 외엔 조용히 무시.

| 명령 | 설명 |
|---|---|
| `/stream_on` | 그룹에 **텍스트 + 사진**만 허용. 스티커·GIF·영상·음성·파일·폴 차단. `use_independent_chat_permissions=True` 로 granular 권한 적용 |
| `/stream_off` | 모든 비관리자 음소거. 호스트(관리자) 본인은 영향 없음 |
| `/tts_on` | STT 활성화. 마이크 → OpenAI Realtime → 봇이 그룹에 대신 포스팅 + 오버레이에 broadcast |
| `/tts_off` | STT 비활성화, 마이크 해제 |

## 설정 (`.env`)

| 변수 | 용도 | 기본값 |
|---|---|---|
| `BOT_TOKEN` | BotFather 발급 봇 토큰 | (필수) |
| `CHAT_ID` | 대상 그룹 ID (슈퍼그룹은 `-100...`) | (필수) |
| `OWNER_ID` | 봇 명령 실행 허용할 유저 ID | (필수) |
| `WEB_HOST` | 오버레이 서버 바인드 주소 | `127.0.0.1` |
| `WEB_PORT` | 오버레이 서버 포트 | `9292` |
| `FADE_AFTER_SEC` | 메시지 N초 후 페이드아웃. `-1` = 안 사라짐 | `30` |
| `STT_PROVIDER` | `openai` or `gemini` | `openai` |
| `OPENAI_API_KEY` | STT용 | — |
| `GEMINI_API_KEY` | STT용 | — |
| `STT_MODEL_OPENAI` | OpenAI 트랜스크립션 모델 | `gpt-4o-mini-transcribe` |
| `STT_MODEL_GEMINI` | Gemini Live 모델 | `gemini-3.1-flash-live-preview` |
| `STT_LANGUAGE` | ISO 639-1 언어 코드 | `ko` |
| `STT_INPUT_DEVICE` | 마이크 지정 (이름 일부 or 인덱스). 비우면 OS 기본 | 빈값 |

## 실행

```bash
# 가상환경 + 의존성 (uv 사용)
uv venv
uv pip install -r requirements.txt

# 설정
cp .env.example .env
# .env 편집

# 실행
uv run python main.py
```

## 알려진 이슈 / 주의사항

- **봇 프라이버시 모드**: 그룹 메시지를 읽으려면 BotFather에서 `/mybots → 봇 → Bot Settings → Group Privacy → Turn off`. 봇 관리자 승격도 가능
- **관리자 권한 "Restrict Members"** 켜야 `/stream_on`·`/stream_off` 가 권한 변경 가능
- **텔레그램 `setChatPermissions` implicit elevation**: `use_independent_chat_permissions=True` 없으면 `can_add_web_page_previews=True` 하나만으로도 모든 media 권한이 자동 상승됨. 반드시 이 플래그 켜서 호출
- **봇은 자기 메시지 수신 못 함**: `bot.send_message(CHAT_ID, text)` 한 건 `getUpdates` 로 돌아오지 않으므로, STT 결과는 오버레이 WebSocket으로 **직접 broadcast** 해야 함 (텔레그램 왕복 기대 X)
- **포트 충돌**: 같은 토큰으로 두 번 띄우면 텔레그램이 `409 Conflict: terminated by other getUpdates`. 죽은 줄 알고 또 띄우지 말고 `tasklist`/`Get-Process python` 으로 확인. `main.py` 는 시작 시 `remove_webhook()` 호출해서 webhook 충돌은 방지함
- **`.env` 인라인 주석**: python-dotenv 는 unquoted 값 뒤의 `#` 을 주석으로 처리하지 않음. 값만 넣고 주석은 별도 줄에. 코드 쪽 `_clean()` 에서 방어는 함
- **Gemini Live**: 무료 티어에선 Live API 접근 제한 있음 (유료 결제 필요). OpenAI 먼저 검증 권장
- **가벼운 `gpt-realtime-1.5`**: voice-to-voice 에이전트 모델이라 STT만 쓰려면 과금 낭비. Realtime API의 `?intent=transcription` 엔드포인트 + `gpt-4o-mini-transcribe` 조합이 성능·비용 균형 최적

## 테스트

- **STT 단독 검증**:
  ```bash
  uv run python test_stt.py --provider openai --debug
  ```
  `--debug` 는 `STT_DEBUG=1` 설정 → 모든 WebSocket 수신 이벤트 raw 로깅

- **syntax 확인**:
  ```bash
  .venv/Scripts/python.exe -c "import ast; [ast.parse(open(p).read()) for p in ['main.py','test_stt.py']]"
  ```

## Git

저장소는 **로컬만** — 현재 원격 push 대상 없음. `.gitignore` 는 `.env`, `.venv/`, `data/`, `.claude/` 를 제외함.
