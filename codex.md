# codex.md

이 문서는 Codex가 이 저장소에서 작업할 때 참고할 프로젝트 맥락과 작업 규칙이다.
사용자용 설치/운영 설명은 `README.md`, 기존 Claude용 메모는 `CLAUDE.md`를 함께 참고한다.

## 프로젝트 개요

`tg-chat-obs-layout`는 Telegram 그룹 채팅을 OBS 브라우저 소스용 투명 오버레이로 보여주는 Windows 중심 Python 앱이다.

주요 기능:
- Telegram 그룹의 텍스트 메시지를 WebSocket으로 브라우저 오버레이에 실시간 표시
- Telegram 사진 메시지를 `data/photos/`에 캐시하고 오버레이에 표시
- 소유자 명령으로 그룹 전송 권한을 방송 모드에 맞게 제어
- 마이크 입력을 STT로 변환해 Telegram 그룹과 오버레이에 동시 출력
- 공지 채널의 연결 댓글창/토론 그룹도 하나의 활성 thread로 오버레이 표시 가능

## 런타임 구조

한 프로세스에서 다음 구성요소가 함께 실행된다.

- `main.py`
  - FastAPI/uvicorn 서버
  - `/` 오버레이 HTML 제공
  - `/config` 프론트엔드 설정 제공
  - `/ws` WebSocket broadcast
  - `/static`, `/photos` 정적 파일 mount
  - Telegram bot polling thread 시작
  - STTManager lifecycle 관리
- Telegram bot thread
  - `telebot.infinity_polling(...)`
  - 메시지/사진/명령 핸들러 실행
  - FastAPI asyncio loop에는 `asyncio.run_coroutine_threadsafe(...)`로 broadcast 전달
- `stt/manager.py`
  - `sounddevice.RawInputStream`으로 마이크 PCM 캡처
  - OpenAI/Gemini 백엔드로 오디오 전송
  - 최종 텍스트 콜백을 `main.py`로 전달
- `static/app.js`
  - `/config`를 읽고 `/ws`에 연결
  - payload type에 따라 text/photo DOM 렌더링
  - WebSocket 끊김 시 자동 재연결

## 주요 파일

- `main.py`: 앱 진입점, Telegram/FastAPI/STT 통합 로직
- `stt/manager.py`: STT provider 선택, 마이크 장치 해석, 오디오 큐/스트림 관리
- `stt/openai_backend.py`: OpenAI Realtime transcription WebSocket 백엔드
- `stt/gemini_backend.py`: Gemini Live WebSocket 백엔드
- `static/index.html`: OBS 브라우저 소스용 단일 페이지
- `static/app.js`: WebSocket 클라이언트와 메시지 렌더링
- `static/style.css`: 오버레이 시각 스타일
- `videochat_overlay.py`: 별도 포트에서 Three.js 비디오챗 캐릭터 오버레이를 제공하고 Telethon watcher를 내장 실행하는 서버
- `static_videochat/`: 비디오챗 캐릭터 오버레이 프론트엔드
- `.env.example`: 환경변수 템플릿
- `requirements.txt`: Python 의존성 목록

런타임 생성 파일:
- `data/user_colors.json`: Telegram 사용자 ID별 오버레이 색상 매핑
- `data/state.json`: `tts_on` 상태 저장
- `data/photos/`: Telegram 사진 캐시. 현재 최신 10개 유지
- `data/telethon/`: Telethon 로그인 세션
- `data/telethon/profile_photos/`: Telethon watcher가 내려받은 참가자 프로필 사진 캐시
- `data/emoji_cache.json`: 최근 수신한 스티커/커스텀 이모지 전송 선택지 캐시
- `data/level_reasons.json`: 레벨별 자동 안내 사유. 예시는 `level_reasons.example.json`
- `data/videochat_levels.json`: 사용자 레벨, role 목록, 마지막 알림 레벨, 채팅/비디오챗 관찰 시각

`data/`, `.env`, `.venv/`, 로그, 캐시는 커밋 대상이 아니다.

## 환경변수

실제 값은 `.env`에 둔다. `.env`는 민감정보 파일이므로 내용을 출력하거나 커밋하지 않는다.

필수:
- `BOT_TOKEN`: BotFather에서 발급한 Telegram bot token
- `CHAT_ID`: 대상 Telegram 그룹 ID
- `OWNER_ID`: bot 명령을 실행할 소유자 Telegram user ID

서버/오버레이:
- `WEB_HOST`: 기본 `127.0.0.1`
- `WEB_PORT`: 기본 `9292`
- `FADE_AFTER_SEC`: 메시지 fade-out 초. `-1`이면 자동 제거 없음
- `CHAT_FONT_SIZE`: 오버레이 글자 크기 px

STT:
- `STT_PROVIDER`: `openai` 또는 `gemini`
- `OPENAI_API_KEY`: OpenAI STT 사용 시 필요
- `GEMINI_API_KEY`: Gemini STT 사용 시 필요
- `STT_MODEL_OPENAI`: 기본 `gpt-4o-mini-transcribe`
- `STT_MODEL_GEMINI`: 기본 `gemini-3.1-flash-live-preview`
- `STT_LANGUAGE`: 기본 `ko`
- `STT_INPUT_DEVICE`: 비우면 OS 기본 마이크. 이름 일부 또는 장치 인덱스 지정 가능
- `STT_SEND_AS`: STT 결과의 Telegram 전송 주체. `bot` 또는 `user`
- `STT_AI_LABEL`: `1`이면 STT 메시지 뒤에 이탤릭 `aiSTT` 표식을 붙임
- `STT_AI_LABEL_TEXT`: STT 표식 텍스트. 기본 `aiSTT`
- `STT_SEND_AS_USER_FALLBACK_BOT`: `user` 전송 실패 시 봇 전송으로 fallback할지 여부

Telethon video chat watcher:
- `TD_API_ID`: https://my.telegram.org/apps 에서 발급한 API ID
- `TD_API_HASH`: 같은 곳에서 발급한 API hash
- `TD_PHONE`: 로그인 전화번호. 비우면 일부 스크립트가 콘솔에서 입력받음
- `TD_VIDEOCHAT_LINK`: `https://t.me/...` 비디오챗/초대 링크
- `VIDEOCHAT_WEB_HOST`: 캐릭터 오버레이 서버 host. 기본 `127.0.0.1`
- `VIDEOCHAT_WEB_PORT`: 캐릭터 오버레이 서버 port. 기본 `9393`
- `VIDEOCHAT_CHAT_WS_URL`: 기존 채팅 오버레이 WebSocket URL. 기본 `ws://127.0.0.1:9292/ws`
- `VIDEOCHAT_HOST_USER_ID`: 호스트 Telegram user id
- `VIDEOCHAT_HOST_USERNAME`: 호스트 username. 공개 repo에는 실제 username을 기록하지 않는다.
- `VIDEOCHAT_HOST_NAME`: 호스트 표시 이름. 기본 예시는 `Host`
- `VIDEOCHAT_HOST_AVATAR_FILE`: mock 테스트에서 호스트에게 우선 배정할 프로필 사진 파일명. 없으면 비워둔다.
- `VIDEOCHAT_LEVEL_CHAT_ID`: 레벨/프로필 정보를 수집할 채팅방 ID. 기본 `0`이면 별도 수집 없음.
- `VIDEOCHAT_LEVEL_SYSTEM_ENABLED`: `1`이면 레벨 시스템 사용.
- `LEVEL_REASONS_FILE`: 레벨별 자동 안내 사유 JSON 경로. 비우면 `data/level_reasons.json`.
- `LEVEL_UP_TEMPLATE`, `LEVEL_DOWN_TEMPLATE`: 자동 레벨 변동 안내 문구.
- `FORCE_LEVEL_UP_TEMPLATE`, `FORCE_LEVEL_DOWN_TEMPLATE`: `/level_up` 안내 문구.
- `VIDEOCHAT_FIRE_USER_COOLDOWN_SEC`, `VIDEOCHAT_FIRE_GLOBAL_COOLDOWN_SEC`: `/fire` 폭죽 이펙트 쿨다운.
- `VIDEOCHAT_WATCH_ENABLED`: `1`이면 `videochat_overlay.py`가 Telethon watcher를 내장 실행
- `VIDEOCHAT_WATCH_INTERVAL`: 참가자 목록 polling 간격 초. 기본 `2`, 코드에서 최소 `1.5`초로 제한
- `VIDEOCHAT_DOWNLOAD_PHOTOS`: `1`이면 참가자 프로필 사진을 `data/telethon/profile_photos/`에 캐시
- `VIDEOCHAT_DEBUG_SPEECH`: `1`이면 참가자들이 번갈아 “안녕하세요?”를 말하는 디버그 말풍선 모드

주의: `python-dotenv`는 unquoted 값의 인라인 `#` 주석을 안전하게 제거하지 못할 수 있다. `.env`에서는 `KEY=value # comment` 형태를 피하고 주석은 별도 줄에 둔다.

공개 repo 기준:
- `.env.example`에는 실제 chat id, invite hash, username, phone, token, API key를 넣지 않는다.
- `TD_VIDEOCHAT_LINK`는 기본 빈 값으로 둔다. 문서 예시는 `https://t.me/example?livestream` 또는 `https://t.me/+INVITE_HASH`만 사용한다.
- `VIDEOCHAT_HOST_USERNAME`, `VIDEOCHAT_HOST_USER_ID`, `VIDEOCHAT_HOST_AVATAR_FILE`은 기본 빈 값으로 둔다.
- `VIDEOCHAT_HOST_NAME`은 예시용 `Host` 정도만 허용한다.
- `VIDEOCHAT_LEVEL_CHAT_ID` 기본값은 `0`으로 둔다.

레벨 규칙:
- Lv. 0은 기본값.
- Lv. 1은 커뮤니티 채팅에서 식별 가능한 메시지를 말했을 때만 자동 부여.
- Lv. 2는 채팅 조건과 비디오챗 접속 조건을 모두 만족할 때 자동 부여. 비디오챗을 먼저 관찰한 Lv. 0 사용자가 이후 채팅하면 Lv. 1/Lv. 2 안내를 순서대로 보낸다.
- Host/king은 Lv. 99 고정, bot은 레벨 배지 대신 Bot 배지를 쓴다.
- 자동 레벨업 안내는 `last_notified_level`을 저장해서 서버 재시작/재조회 때 같은 레벨 안내를 반복하지 않는다.

## 실행 명령

의존성 설치:

```powershell
uv venv
uv pip install -r requirements.txt
```

앱 실행:

```powershell
uv run python main.py
```

OBS 브라우저 소스 URL:

```text
http://127.0.0.1:9292/
```

비디오챗 캐릭터 오버레이 실행:

```powershell
uv run python videochat_overlay.py
uv run python videochat_overlay.py --link "https://t.me/+INVITE_HASH"
```

OBS에 별도 Browser Source로 추가:

```text
http://127.0.0.1:9393/
```

말풍선 디버그:

```text
http://127.0.0.1:9393/?debug_speech=1
```

50명 mock 디버그:

```text
http://127.0.0.1:9393/?mock_participants=50&debug_speech=1
```

평상시 운영은 `videochat_overlay.py`가 `--link` 인자 또는 `TD_VIDEOCHAT_LINK`를 읽고 내장 Telethon watcher로 참가자 snapshot을 갱신한다. 방송마다 링크가 달라질 수 있으므로 CLI `--link`를 우선 사용한다.

방장 표시:
- 왕관과 `Lv. 99`는 participant snapshot의 `is_host=true`일 때만 표시된다.
- `videochat_overlay.py`는 `VIDEOCHAT_HOST_USER_ID`, `VIDEOCHAT_HOST_USERNAME`, `VIDEOCHAT_HOST_NAME` 순서로 host를 판정한다.
- 실전에서는 이름 중복 가능성이 있으므로 `VIDEOCHAT_HOST_USER_ID` 또는 `VIDEOCHAT_HOST_USERNAME` 설정을 우선한다.

문법 확인:

```powershell
.venv\Scripts\python.exe -c "import ast; [ast.parse(open(p, encoding='utf-8').read()) for p in ['main.py','stt/manager.py','stt/openai_backend.py','stt/gemini_backend.py']]"
```

## Telegram 명령

대부분의 명령은 `OWNER_ID`와 대상 채팅 조건을 만족해야 실행된다. 조건이 맞지 않으면 조용히 무시하는 패턴이 많다.

- `/stream_on`: 그룹에서 텍스트와 사진만 허용
- `/text_on`: 텍스트만 허용하고 사진/미디어 차단
- `/stream_off`: 호스트/관리자 외 전송 제한
- `/tts_on`: 현재 위치를 STT 출력 목적지로 추가하고 STT 시작
- `/tts_off`: 모든 STT 출력 목적지를 비우고 STT 종료
- `/here_on`: 현재 댓글창/thread를 오버레이 소스로 활성화
- `/here_off`: 활성 댓글창/thread 해제

권한 변경은 `bot.set_chat_permissions(..., use_independent_chat_permissions=True)`를 사용해야 granular permission이 의도대로 적용된다.

## 데이터 흐름

텍스트 메시지:
1. Telegram polling handler가 대상 메시지인지 검사한다.
2. 사용자 표시 이름과 색상을 결정한다.
3. FastAPI loop로 `broadcast({"type": "text", ...})`를 전달한다.
4. `static/app.js`가 WebSocket payload를 받아 `.msg` 요소를 추가한다.

사진 메시지:
1. Telegram photo sizes 중 가장 큰 항목을 선택한다.
2. `data/photos/{file_unique_id}.jpg`에 저장한다.
3. 오래된 사진 캐시를 최신 10개 이후부터 제거한다.
4. WebSocket으로 `{"type": "photo", "url": "/photos/..."}`를 전송한다.

STT:
1. `/tts_on`이 `STTManager.start()`를 호출한다.
2. `sounddevice`가 40ms 단위 PCM 프레임을 asyncio queue에 넣는다.
3. provider backend가 WebSocket으로 오디오를 전송한다.
4. 최종 transcript가 `stt_on_text()`로 돌아온다.
5. 오버레이 broadcast와 Telegram `send_message`가 수행된다.

비디오챗 참가자:
1. `videochat_overlay.py`가 내장 Telethon watcher로 video chat link를 조회한다.
2. `ChannelFull.call`에서 `InputGroupCall(id, access_hash)`를 얻고 `phone.GetGroupParticipantsRequest`로 참가자 목록을 조회한다.
3. Telethon user 객체에 profile photo가 있으면 `download_profile_photo`로 `data/telethon/profile_photos/`에 캐시한다.
4. watcher snapshot을 자체 WebSocket으로 브라우저에 전송한다.
5. 캐릭터 오버레이는 별도 포트에서 뜨고, 기존 `main.py`의 `/ws`를 구독해 텍스트/STT 메시지를 말풍선으로 라우팅한다.

## 개발 주의점

- `.env`, `data/`, 로그, 실제 token/API key 값을 읽거나 출력하지 않는다.
- 사용자에게 보여줄 경로는 로컬 홈 디렉터리 사용자명을 마스킹한다.
- 기존 작업 트리에 수정된 파일이 있을 수 있다. 요청과 무관한 변경은 되돌리지 않는다.
- `README.md`, `CLAUDE.md`는 현재 터미널에서 깨져 보일 수 있다. 인코딩을 확인하고 불필요한 재저장을 피한다.
- OBS는 JS/CSS 캐시가 강하다. `main.py`의 `CACHE_BUSTER`와 `index.html`의 `{{CB}}` 치환이 캐시 갱신 역할을 한다.
- bot 자신의 Telegram 메시지는 polling으로 다시 들어오지 않는다고 가정한다. STT 결과는 Telegram 전송과 오버레이 broadcast를 별도로 수행한다.
- `on_photo`는 Telegram `photo` 타입만 처리한다. sticker, animation, document, video 처리는 현재 범위 밖이다.
- Gemini Live 세션은 장시간 사용 시 세션 제한/재연결 이슈가 있을 수 있다. OpenAI 백엔드는 supervisor 루프로 자동 재연결을 시도한다.
- `STT_DEBUG=1`은 백엔드 raw 이벤트를 출력할 수 있으므로 공유 전 민감정보가 없는지 확인한다.
- 비디오챗 참가자 이름 목록은 `videochat_overlay.py`의 내장 Telethon watcher 경로를 사용한다.
- private invite link는 계정 권한/가입 여부에 따라 결과가 달라질 수 있으므로 공개 문서에는 실제 invite hash를 남기지 않는다.
- 공개 문서에는 실제 Telegram username, chat id, invite hash를 남기지 않는다.
- 프로필 사진 캐시(`data/telethon/profile_photos/`)와 채팅 사진 캐시(`data/photos/`)는 개인정보가 될 수 있으므로 커밋하지 않는다.

## 변경 시 검증 기준

좁은 코드 변경이라도 최소한 다음을 확인한다.

- Python 문법 확인
- 변경한 Telegram command의 권한 조건
- WebSocket payload shape이 `static/app.js`와 호환되는지
- 사진 관련 변경 시 `/photos/...` 정적 mount와 cache cleanup 영향
- STT 관련 변경 시 `main.py`의 `/tts_on` 경로와 백엔드 AST/import 경로
- `.env.example`을 바꾸는 경우 실제 `.env` 값이나 비밀값이 섞이지 않았는지

## 비디오챗/캐릭터 오버레이 로드맵

현재 목표:
- Telegram 비디오챗 참가자 목록을 가져온다.
- 참가자별 상태를 오버레이 payload로 만든다.
- 추후 Three.js 캐릭터로 참가자를 화면에 표시한다.

확인된 기술 결론:
- Bot API는 비디오챗 시작/종료/초대 서비스 메시지만 가능하고 실제 참가자 목록은 부족하다.
- Telethon raw MTProto의 `phone.GetGroupParticipantsRequest` 경로를 사용해 참가자 목록을 조회한다.

현재 실행 단위:
- `main.py`: 기존 채팅/STT 오버레이 서버. 기본 `9292`.
- `videochat_overlay.py`: 캐릭터 오버레이 서버 + Telethon 비디오챗 watcher. 기본 `9393`.

다음 패치 순서:
- `videochat_overlay.py`가 여러 `TD_VIDEOCHAT_LINK(S)`를 감시할 수 있게 확장한다.
- 참가자 snapshot을 주기적으로 가져와 이전 snapshot과 diff한다.
- join/leave/update 이벤트 payload를 정의한다.
- 캐릭터 오버레이 내부 상태에 join/leave/update 애니메이션을 붙인다.
- WebSocket payload type 예시:
  - `videochat_snapshot`: 전체 참가자 목록
  - `videochat_join`: 새 참가자
  - `videochat_leave`: 나간 참가자
  - `videochat_update`: muted/video/screen 상태 변화
- `static/app.js`에 임시 2D 참가자 리스트 렌더링을 먼저 붙인다.
- Three.js 씬은 별도 모드로 추가하고, 참가자별 stable id 기반 캐릭터 슬롯을 만든다.
- 캐릭터 데이터 모델은 최소 `id`, `name`, `username`, `muted`, `video`, `screen`, `color`, `joined_at`로 시작한다.
- 프로필 사진이 있으면 `avatar_url` 또는 로컬 캐시 경로를 추가하고, 없으면 색상/이니셜 기반 기본 캐릭터를 사용한다.
- OBS에서 투명 배경 유지, 기존 채팅 overlay와 겹치지 않는 레이아웃을 설계한다.
- 캐릭터 오버레이는 기존 채팅 오버레이와 섞지 않고 별도 OBS Browser Source/포트로 유지한다.

주의할 미해결점:
- Telethon 세션은 일반 계정 세션이므로 `data/telethon/`을 절대 커밋하지 않는다.
- private invite link는 계정 권한/가입 여부에 따라 결과가 다르다.
- 라이브 링크에서 `ChannelFull.call`이 비어 있으면 해당 시점에 active live/video chat이 없는 것이다.
- 장기 watcher는 Telegram flood/rate limit을 피하도록 polling 간격과 backoff가 필요하다.
- Three.js 패치 전에는 먼저 콘솔 watcher와 WebSocket payload 안정화가 우선이다.
