# tg-chat-obs-layout

Telegram 그룹 채팅과 비디오챗 참가자를 OBS 방송 화면에 올리는 Windows 중심 오버레이 도구입니다.

두 개의 브라우저 소스를 따로 씁니다.

- `9292`: 일반 Telegram 채팅/STT 오버레이
- `9393`: Telegram 비디오챗 참가자 캐릭터 오버레이

비디오챗 오버레이는 Three.js로 만든 모닥불 장면입니다. 참가자가 비디오챗에 들어오면 캐릭터가 나타나고, 채팅 또는 STT 메시지가 들어오면 해당 캐릭터 위에 말풍선이 뜹니다. 비디오챗에 없는 사람이 채팅하면 오른쪽 채팅 내역에는 보이지만 캐릭터 말풍선에는 붙지 않습니다.

## 주요 기능

- Telegram 그룹 채팅을 OBS에 말풍선 형태로 표시
- Telegram 사진/스티커/GIF 메시지를 오버레이에 표시
- `/stream_on`, `/stream_off`, `/text_on`으로 방송 중 채팅 권한 제어
- `/stt_on`, `/stt_off`로 마이크 음성을 STT 변환 후 Telegram/오버레이에 출력
- 공지 채널 댓글창/thread를 별도 오버레이 소스로 지정하는 `/here_on`, `/here_off`
- Telegram 비디오챗 참가자 목록을 Telethon으로 조회
- 비디오챗 참가자를 Three.js 캐릭터로 표시
- 참가자 프로필 사진, 닉네임, 레벨 배지 표시
- 방장 crown + `Lv. 99` 표시
- 비디오챗 입장/퇴장 애니메이션과 이벤트 메시지
- 오른쪽 채팅 내역 패널, 제목 텍스트, 카메라 각도/줌/위치 조절
- OBS 배치 확인용 mock/preview 모드
- 9393 컨트롤 모드(`?control=1`)에서 조작한 레이아웃을 OBS 브라우저 소스와 실시간 동기화
- 9292/9393 채팅 패널에서 텍스트, 사진, 스티커, GIF/영상, 답장, 인용 답장, 삭제 메뉴 지원
- X/Twitter 링크는 전체 웹앱 iframe 대신 개별 포스트의 텍스트/사진/영상 카드 미리보기로 표시

## 작동 구조

```text
Telegram group chat
        |
        v
main.py  ->  http://127.0.0.1:9292/  ->  OBS Browser Source
        |
        +---- WebSocket text/photo/sticker/GIF/STT events
                         |
                         v
videochat_overlay.py  ->  http://127.0.0.1:9393/  ->  OBS Browser Source
        ^
        |
Telethon user session -> Telegram videochat participants
```

일반 채팅 오버레이만 쓸 때는 `main.py`만 실행하면 됩니다.
비디오챗 캐릭터 오버레이까지 쓰려면 `main.py`와 `videochat_overlay.py`를 함께 실행합니다.

## 준비물

- Windows PC
- Python 3.10 이상
- OBS Studio
- Telegram 계정
- Telegram BotFather로 만든 bot token
- STT를 쓸 경우 OpenAI 또는 Gemini API key
- 비디오챗 오버레이를 쓸 경우 Telegram API ID/API hash

## 설치

Python 버전 확인:

```cmd
python --version
```

`uv` 설치:

```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

프로젝트 받기:

```cmd
git clone <repo-url> tg-chat-obs-layout
cd tg-chat-obs-layout
```

의존성 설치:

```cmd
uv venv
uv pip install -r requirements.txt
```

## Telegram Bot 설정

1. Telegram에서 [@BotFather](https://t.me/BotFather)를 엽니다.
2. `/newbot`으로 bot을 만듭니다.
3. 발급된 bot token을 `.env`의 `BOT_TOKEN`에 넣습니다.
4. BotFather에서 `Group Privacy`를 `Turn off`로 바꿉니다.
5. bot을 방송용 그룹에 초대합니다.
6. `/stream_on`, `/stream_off`를 쓸 경우 bot을 그룹 관리자로 만들고 `Restrict members` 권한을 켭니다.

필요한 값:

- `CHAT_ID`: 방송용 Telegram 그룹 ID
- `OWNER_ID`: 명령어를 실행할 본인 Telegram user ID

## 환경 설정

템플릿 복사:

```cmd
copy .env.example .env
```

`.env`에는 실제 값을 넣습니다. `.env`는 절대 공개하거나 커밋하지 않습니다.

최소 설정:

```bash
BOT_TOKEN=
CHAT_ID=
OWNER_ID=

WEB_HOST=127.0.0.1
WEB_PORT=9292
FADE_AFTER_SEC=30
CHAT_FONT_SIZE=22
```

STT 설정:

```bash
STT_PROVIDER=openai
OPENAI_API_KEY=
GEMINI_API_KEY=
STT_MODEL_OPENAI=gpt-4o-mini-transcribe
STT_MODEL_GEMINI=gemini-3.1-flash-live-preview
STT_LANGUAGE=ko
STT_INPUT_DEVICE=
STT_SEND_AS=bot
STT_AI_LABEL=0
STT_AI_LABEL_TEXT=aiSTT
STT_SEND_AS_USER_FALLBACK_BOT=1

TELEGRAM_USER_SEND_ENABLED=0
TELEGRAM_USER_SEND_PANEL=0
TELEGRAM_USER_SEND_FALLBACK_BOT=0
TELEGRAM_USER_SEND_MAX_CHARS=1000
TELEGRAM_USER_SEND_MAX_PHOTO_MB=8
TELEGRAM_USER_SEND_MAX_MEDIA_MB=50
```

`STT_SEND_AS=user`를 쓰면 bot이 아니라 Telegram 사용자 계정으로 STT 메시지를 보냅니다. 이 경우 아래 Telethon 설정이 필요합니다.

`TELEGRAM_USER_SEND_ENABLED=1`을 켜면 로컬 `/api/send`가 열립니다. `TELEGRAM_USER_SEND_PANEL=1`도 켜면 9292 오버레이에 작은 입력창이 생기고, 거기서 보낸 메시지나 사진을 Telegram 사용자 계정으로 전송할 수 있습니다. 입력창의 `main`/`here` 버튼으로 메인 채팅과 현재 `/here_on` 대상 중 보낼 곳을 고르며, 선택된 대상이 없으면 전송 버튼이 비활성화됩니다.

비디오챗/Telethon 설정:

```bash
TD_API_ID=
TD_API_HASH=
TD_PHONE=
TD_VIDEOCHAT_LINK=

VIDEOCHAT_WEB_HOST=127.0.0.1
VIDEOCHAT_WEB_PORT=9393
VIDEOCHAT_CHAT_WS_URL=ws://127.0.0.1:9292/ws

VIDEOCHAT_HOST_USER_ID=
VIDEOCHAT_HOST_USERNAME=
VIDEOCHAT_HOST_NAME=Host
VIDEOCHAT_HOST_AVATAR_FILE=
VIDEOCHAT_LEVEL_CHAT_ID=0

VIDEOCHAT_WATCH_ENABLED=1
VIDEOCHAT_WATCH_INTERVAL=2
VIDEOCHAT_DOWNLOAD_PHOTOS=1
VIDEOCHAT_DEBUG_SPEECH=0
```

`TD_API_ID`와 `TD_API_HASH`는 <https://my.telegram.org/apps>에서 발급합니다.

방장 crown과 `Lv. 99`가 안 뜨면 `VIDEOCHAT_HOST_USER_ID` 또는 `VIDEOCHAT_HOST_USERNAME`을 실제 계정과 맞춰야 합니다. `VIDEOCHAT_HOST_NAME`도 fallback으로 쓰지만, 이름은 중복될 수 있으므로 ID/username이 더 안전합니다.

`TD_VIDEOCHAT_LINK`는 방송마다 바뀔 수 있으므로 실행할 때 `--link`로 넘겨도 됩니다.

## 실행

일반 채팅/STT 오버레이:

```cmd
uv run python main.py
```

브라우저에서 확인:

```text
http://127.0.0.1:9292/
```

비디오챗 캐릭터 오버레이:

```cmd
uv run python videochat_overlay.py --link "https://t.me/+INVITE_HASH"
```

또는 `.env`에 `TD_VIDEOCHAT_LINK`를 넣고:

```cmd
uv run python videochat_overlay.py
```

브라우저에서 확인:

```text
http://127.0.0.1:9393/
```

Telethon을 처음 실행하면 콘솔에서 로그인 코드 또는 2FA 비밀번호를 물어볼 수 있습니다. 로그인 세션은 `data/telethon/`에 저장되며 공개하면 안 됩니다.

## OBS 구성

OBS에 Browser Source를 두 개 추가하는 구성을 권장합니다.

채팅 오버레이:

- URL: `http://127.0.0.1:9292/`
- Width/Height: 방송 레이아웃에 맞게 설정
- 배경: 투명

비디오챗 캐릭터 오버레이:

- URL: `http://127.0.0.1:9393/`
- Width/Height: 보통 전체 화면 크기
- 채팅창과 캐릭터 씬을 분리하고 싶으면 위치를 따로 조정

OBS Browser Source 옵션에서 “소스가 표시되지 않을 때 종료”는 끄는 편이 안전합니다. 장면 전환 때 WebSocket이 끊기는 것을 줄일 수 있습니다.

## 9393 컨트롤 모드

OBS Browser Source 안의 페이지와 일반 Chrome 창은 서로 다른 브라우저 저장소를 씁니다. 그래서 일반 Chrome에서 맞춘 위치가 OBS에 그대로 적용되지 않을 수 있습니다. 9393 오버레이는 이 문제를 줄이기 위해 서버 저장 설정을 지원합니다.

OBS에는 viewer URL을 넣습니다.

```text
http://127.0.0.1:9393/
```

조작용 Chrome에는 control URL을 엽니다.

```text
http://127.0.0.1:9393/?control=1
```

mock 테스트와 같이 쓰려면:

```text
http://127.0.0.1:9393/?mock_participants=10&debug_speech=1&control=1
```

컨트롤 화면에서 카메라, 제목, 채팅 패널, 입퇴장 메시지, 말풍선/네임카드 크기를 조작하면 서버가 `data/videochat_overlay_settings.json`에 저장하고 OBS 브라우저 소스에 WebSocket으로 전파합니다. 저장할 때 컨트롤 화면의 viewport 크기도 같이 기록하므로 OBS 해상도와 Chrome 창 크기가 달라도 좌표와 크기를 비율로 환산합니다. 그래도 화면 비율은 OBS 캔버스와 비슷하게 맞추는 편이 가장 정확합니다.

## 9393 오버레이 조작

카메라:

- `Q` / `E`: 좌우 회전
- `W` / `S`: 카메라 각도 조절
- 마우스 휠: 확대/축소
- 가운데 휠 드래그: 화면 기준 위치 이동

화면 UI:

- 제목 영역: 방송 주제 표시. 직접 편집, 이동, 크기 조절 가능
- 오른쪽 채팅 패널: 참가자/미참여자 채팅을 함께 표시
- 채팅 패널의 `M`: 패널 이동
- 채팅 패널의 `-` / `+`: 글자 크기 조절
- `fade`: 메시지 사라짐 시간. `-1`이면 사라지지 않음
- `hide`: 채팅 패널 숨김
- `A-` / `A+`: 캐릭터 네임카드 전체 크기
- `B-` / `B+`: 캐릭터 말풍선 전체 크기
- `E-` / `E+`: 입장/퇴장 이벤트 메시지 크기
- `in` / `out`: 입장/퇴장 효과 선택
- `msg`: 입장/퇴장 메시지 스타일 선택

기본값은 브라우저 localStorage에도 저장됩니다. `?control=1` 모드에서 조작한 값은 서버 설정으로도 저장되어 OBS 브라우저 소스와 동기화됩니다.

## Preview 모드

Telegram 없이 OBS 배치를 맞출 때 쓸 수 있습니다.

말풍선 preview:

```text
http://127.0.0.1:9393/?debug_speech=1
```

50명 참가자 preview:

```text
http://127.0.0.1:9393/?mock_participants=50&debug_speech=1
```

입장/퇴장 preview:

```text
http://127.0.0.1:9393/?mock_participants=10&debug_speech=1&debug_lifecycle=1
```

Preview 모드는 방송 전 레이아웃, 말풍선 크기, 카메라 각도, 채팅 패널 위치를 맞추기 위한 기능입니다.

## Telegram 명령어

명령어는 기본적으로 `OWNER_ID`가 실행해야 합니다.

| 명령어 | 설명 |
|---|---|
| `/stream_on` | 텍스트와 사진만 허용하고 sticker, GIF, 영상, 파일 등을 제한 |
| `/text_on` | 텍스트만 허용 |
| `/stream_off` | 호스트/관리자 외 전송 제한 |
| `/stt_on` | 현재 위치를 STT 출력 목적지로 추가하고 마이크 인식 시작 |
| `/stt_off` | 모든 STT 출력 목적지를 비우고 STT 종료 |
| `/here_on` | 현재 thread/comment chat을 오버레이 소스로 활성화 |
| `/here_off` | 활성 thread/comment chat 해제 |

오버레이는 스티커 표시를 지원하지만, 기본 `/stream_on` 권한 설정은 sticker/GIF류 전송을 막습니다. 방송 중 스티커를 허용하려면 권한 정책을 별도로 조정해야 합니다.

## 사용자 계정으로 웹에서 메시지 보내기

`.env`에서 아래 값을 켜면 9292 오버레이에 입력창을 띄울 수 있습니다.

```bash
TELEGRAM_USER_SEND_ENABLED=1
TELEGRAM_USER_SEND_PANEL=1
TELEGRAM_USER_SEND_MAX_PHOTO_MB=8
TD_API_ID=
TD_API_HASH=
TD_PHONE=
```

입력창에서 보낸 텍스트는 Telethon 사용자 세션으로 전송됩니다. 전송 대상은 `main` 버튼의 메인 `CHAT_ID`와 `here` 버튼의 현재 `/here_on` thread/comment chat 중 직접 선택합니다. `/here_on`이 없으면 `here` 버튼은 비활성화되고, 선택된 대상이 없으면 전송할 수 없습니다.

사진은 `+` 버튼으로 고르거나 입력창에 드래그 앤 드롭할 수 있습니다. 전송 전에는 미리보기가 표시되며, 잘못 고른 사진은 `x` 버튼으로 제거할 수 있습니다. 텍스트와 사진을 같이 보내면 텍스트가 사진 캡션으로 전송됩니다. MP4/WEBM 파일도 입력창에 드래그 앤 드롭하거나 붙여넣어 전송할 수 있으며, 영상 파일 크기 제한은 `TELEGRAM_USER_SEND_MAX_MEDIA_MB`로 관리합니다.

입력창에서 `@검색어`를 입력하면 Telethon 사용자 세션으로 main `CHAT_ID`의 참가자를 검색해 자동완성을 표시합니다. username이 있는 사람은 선택 시 `@username`으로 삽입됩니다. username이 없는 사람은 Telegram 일반 텍스트만으로는 확실한 멘션이 되지 않으므로 검색 결과에서 비활성으로 표시됩니다.

9292/9393 채팅 메시지를 우클릭하면 `답장`, `인용`, `삭제` 메뉴를 사용할 수 있습니다. `답장`은 선택한 Telegram 메시지를 reply 대상으로 잡아 다음 전송을 해당 메시지에 답장으로 보냅니다. 메시지 텍스트 일부를 드래그로 선택한 뒤 `인용`을 누르면 Telegram quote metadata로 인용 답장을 보냅니다. `삭제`는 bot 권한으로 먼저 시도하고, 실패하면 Telethon 사용자 세션으로 다시 시도합니다. 둘 다 실패하면 `OWNER_ID`에게 삭제 실패 알림을 보냅니다. Telegram 앱 등 외부에서 삭제된 메시지도 Telethon 삭제 이벤트가 잡히면 오버레이에서 스르륵 사라집니다.

9292 입력창 왼쪽의 `A-` / `A+` 버튼으로 채팅 글자 크기를 바로 조절할 수 있으며, 값은 브라우저 localStorage에 저장됩니다.

9393 비디오챗 오버레이의 오른쪽 채팅 패널에도 같은 전송 입력창이 붙습니다. 9393 서버는 로컬 전용 프록시로 9292의 `/api/send`, `/api/users/search`, `/api/message/delete`를 호출하므로 9292 서버가 같이 실행 중이어야 합니다.

이 기능은 로컬 요청만 받도록 제한되어 있지만, 방송 화면에 입력창이 보일 수 있으므로 OBS 배치 전에 표시 여부를 확인하세요.

## 링크 미리보기

채팅 메시지의 URL을 클릭하면 오버레이 내부에 작은 브라우저 창이 뜹니다. 창은 드래그로 이동하고 오른쪽 아래 핸들로 크기를 조절할 수 있습니다. iframe 차단이 있는 사이트는 `proxy` 버튼으로 로컬 프록시를 시도할 수 있습니다.

X/Twitter는 전체 웹앱이 iframe과 단순 프록시에서 잘 동작하지 않으므로 별도 미리보기 경로를 씁니다. 개별 포스트 URL은 서버가 텍스트, 사진, 영상 썸네일을 가져와 카드로 보여주고, 실패하면 공식 oEmbed로 폴백합니다. `x.com/search?...` 검색 결과 페이지는 X 웹앱 내부 API가 필요하므로 내부에서는 검색어 안내와 외부 열기만 제공합니다.

## 데이터 저장 위치

로컬 실행 중 생성되는 파일:

- `data/user_colors.json`: 사용자별 채팅 색상
- `data/state.json`: `/stt_on` 상태
- `data/photos/`: Telegram 사진 메시지 캐시
- `data/stickers/`: Telegram 스티커 표시용 캐시
- `data/animations/`: Telegram GIF/animation 표시용 캐시
- `data/telethon/`: Telethon 사용자 로그인 세션
- `data/telethon/profile_photos/`: 비디오챗 참가자 프로필 사진 캐시
- `data/videochat_levels.json`: 비디오챗 레벨/프로필 기록
- `data/videochat_overlay_settings.json`: 9393 컨트롤 모드에서 저장한 레이아웃/카메라 설정

`data/`는 개인정보와 세션을 포함할 수 있으므로 커밋하지 않습니다.

## 공개 저장소 보안 체크

공개 전 확인:

- `.env`가 커밋되지 않았는지
- `data/`, `logs/`, `chrome-debug-profile/`, `debug_videochat*.png`가 커밋되지 않았는지
- `data/videochat_overlay_settings.json`, Telethon 세션, 프로필 사진 캐시가 커밋되지 않았는지
- 실제 bot token, API key, phone, invite hash, chat id, username이 문서에 남지 않았는지
- Telethon 세션 파일이 올라가지 않았는지
- 프로필 사진/채팅 사진 캐시가 올라가지 않았는지
- STT debug 로그를 공유하지 않았는지

## 문제 해결

### 채팅이 안 보임

- BotFather에서 Group Privacy가 꺼져 있는지 확인
- bot을 그룹에서 제거 후 다시 초대
- `.env`의 `CHAT_ID`가 맞는지 확인

### `409 Conflict: terminated by other getUpdates`

같은 bot token으로 프로그램이 두 번 실행 중입니다.

```powershell
Get-Process python | Stop-Process -Force
```

그 후 다시 실행합니다.

### `/stream_on` 권한 변경 실패

bot이 그룹 관리자가 아니거나 `Restrict members` 권한이 없습니다. 그룹 관리자 설정에서 권한을 켭니다.

### 포트가 이미 사용 중

`.env`에서 포트를 바꿉니다.

```bash
WEB_PORT=9300
VIDEOCHAT_WEB_PORT=9394
```

OBS URL도 같은 포트로 바꿔야 합니다.

### 비디오챗 참가자가 안 뜸

- `videochat_overlay.py --link ...`에 넘긴 링크가 현재 active videochat/live stream인지 확인
- `TD_API_ID`, `TD_API_HASH`, `TD_PHONE`이 맞는지 확인
- 첫 실행 로그인 절차가 완료됐는지 확인
- 계정 권한이나 초대 링크 접근 권한이 부족하면 참가자 목록이 비어 있을 수 있음

### 방장 왕관/Lv.99가 안 뜸

`.env`에 아래 중 하나를 정확히 넣습니다.

```bash
VIDEOCHAT_HOST_USER_ID=
VIDEOCHAT_HOST_USERNAME=
```

ID가 가장 안정적이고, username이 그 다음입니다.

### STT가 반응하지 않음

- API key와 billing 상태 확인
- `STT_INPUT_DEVICE`가 실제 마이크와 맞는지 확인
- 콘솔 로그 확인

마이크 목록 확인:

```cmd
uv run python -c "import sounddevice as sd; [print(i, d['name']) for i, d in enumerate(sd.query_devices()) if d['max_input_channels']>0]"
```

## 파일 구조

```text
tg-chat-obs-layout/
├── main.py
├── videochat_overlay.py
├── .env.example
├── requirements.txt
├── static/
│   ├── index.html
│   ├── app.js
│   └── style.css
├── static_videochat/
│   ├── index.html
│   ├── app.js
│   └── style.css
├── stt/
│   ├── manager.py
│   ├── openai_backend.py
│   └── gemini_backend.py
├── docs/
│   ├── PATCH_PLAN.md
│   ├── identity_badge_variants.svg
│   ├── level_color_tiers.json
│   ├── level_color_tiers_preview.svg
│   └── videochat_camera_ws.md
└── data/
    └── 자동 생성, 커밋 금지
```

개발자용 작업 맥락은 [codex.md](./codex.md), 앞으로의 패치 메모는 [docs/PATCH_PLAN.md](./docs/PATCH_PLAN.md)를 참고하세요.
