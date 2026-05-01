# tg-chat-obs-layout

Telegram 채팅과 비디오챗 참여자를 방송용 오버레이로 보여주는 로컬 프로젝트입니다. Python/FastAPI 서버가 텔레그램 메시지와 비디오챗 상태를 수집하고, 브라우저/Electron 화면이 OBS 또는 Windows 앱에서 표시할 오버레이를 렌더링합니다.

이 저장소에는 소스 코드와 예시 설정만 들어갑니다. 실제 `.env`, Telegram 세션, TDLib 데이터베이스, Electron 로그인 프로필, ROM 파일, 토큰, 전화번호, 계정 정보는 절대 커밋하지 않습니다.

## 주요 기능

- Telegram 봇 채팅을 방송용 오버레이로 표시합니다.
- Telegram 비디오챗 참여자를 3D 캐릭터로 표시합니다.
- 참여/퇴장, 레벨업/레벨다운 이벤트 카드를 표시합니다.
- 캐릭터 머리 위 닉네임 카드, 레벨, 왕관, LIVE 배지, 말풍선을 표시합니다.
- `/fire`, `/cheer` 같은 채팅 명령으로 캐릭터 효과를 실행합니다.
- UI에서 카메라 각도, 확대/축소, 카드/말풍선 거리, 위젯 위치와 크기를 조정할 수 있습니다.
- 가격, 메모, YouTube, Electron 네이티브 web, 내부 게임, 난쟁이, 케이지, 캐릭터 이동 위젯을 제공합니다.
- Electron 앱에서는 YouTube/web을 Chromium 네이티브 뷰로 띄워 로그인 상태와 디버그 로그를 유지할 수 있습니다.
- 내부 게임 위젯은 로컬 ROM을 선택하고, 개인 플레이 또는 비디오챗 참가자 채팅 기반 집단 플레이를 지원합니다.
- WSL2 개발과 Windows 실사용 빌드를 분리해서 운용할 수 있습니다.

## 서버 구성

이 프로젝트는 보통 서버 2개를 같이 띄웁니다.

| 서버 | 기본 포트 | 파일 | 역할 |
| --- | ---: | --- | --- |
| 채팅/봇 서버 | `9292` | `main.py` | Telegram 봇, 채팅 오버레이 API, 레벨/명령 처리 |
| 비디오챗 오버레이 서버 | `9393` | `videochat_overlay.py` | 3D 비디오챗 화면, 위젯, Electron 연동 |

방송 화면은 주로 `http://127.0.0.1:9393/`를 봅니다. 일반 Chrome에서도 대부분 테스트할 수 있지만, Electron 네이티브 web/YouTube는 Windows Electron 앱 안에서만 정상 동작합니다.

## 폴더 구조

| 경로 | 설명 |
| --- | --- |
| `main.py` | Telegram 봇, 채팅 서버, 레벨 시스템, 명령어 처리 |
| `videochat_overlay.py` | 비디오챗 3D 오버레이 서버, TgCalls 수신, 위젯 API |
| `static_videochat/` | 9393 오버레이의 HTML/CSS/JS |
| `tools/videochat_app/` | Electron 래퍼 앱 |
| `level_system.py` | 레벨 저장/승급/역할 로직 |
| `level_reasons.example.json` | 레벨별 메시지 예시 |
| `scripts/build_tdlib_linux.sh` | WSL2/Linux용 `libtdjson.so` 빌드 스크립트 |
| `data/` | 로컬 실행 데이터. 세션/설정/프로필/ROM 저장. 커밋 금지 |
| `vendor/tdlib/` | TDLib 바이너리 위치. 커밋 금지 |

## 처음 실행하기

아래 절차는 WSL2에서 개발하고, 필요하면 Windows용 Electron 앱을 빌드하는 흐름입니다.

### 1. 시스템 패키지 설치

WSL2 Ubuntu 기준입니다.

```bash
sudo apt update
sudo apt install -y build-essential cmake gperf zlib1g-dev libssl-dev portaudio19-dev
```

`sounddevice`가 `OSError: PortAudio library not found`를 내면 `portaudio19-dev`가 빠진 것입니다.

### 2. uv 가상환경 만들기

프로젝트 루트에서 실행합니다.

```bash
uv venv --python 3.12 .venv
source .venv/bin/activate
uv pip install -r requirements.txt
```

이후에는 가상환경을 켠 상태에서 `python main.py`처럼 실행하거나, 가상환경을 켜지 않고 `uv run python main.py`로 실행할 수 있습니다.

### 3. 환경변수 만들기

```bash
cp .env.example .env
```

그 다음 `.env`를 직접 열어 Telegram 봇 토큰, API ID/API HASH, 대상 채팅, 비디오챗 링크 등을 채웁니다.

중요:

- `.env`는 커밋 금지입니다.
- Telegram 봇 토큰, `TD_API_HASH`, 전화번호, 세션 파일은 커밋 금지입니다.
- `.env.example`에는 실제 값이 아니라 설명과 빈 값만 둡니다.

### 4. TDLib 준비

Windows에서는 `vendor/tdlib/tdjson.dll`을 사용합니다. WSL2/Linux에서는 `vendor/tdlib/libtdjson.so`가 필요합니다.

Linux/WSL2에서 직접 빌드하려면:

```bash
scripts/build_tdlib_linux.sh
```

빌드가 끝나면 `vendor/tdlib/libtdjson.so`가 생성됩니다. 이 파일은 로컬 바이너리이므로 커밋하지 않습니다.

TDLib 경로는 기본적으로 OS에 맞게 자동 선택됩니다.

- Windows: `vendor/tdlib/tdjson.dll`
- Linux/WSL2: `vendor/tdlib/libtdjson.so`
- macOS: `vendor/tdlib/libtdjson.dylib`

특정 경로를 강제로 쓰고 싶으면 `.env`에 `TDLIB_JSON_PATH` 또는 `TDLIB_JSON_DLL`을 지정합니다.

### 5. Telegram 세션 로그인

TgCalls receiver는 보통 부계정 세션으로 비디오챗 프레임을 받습니다. 세션은 `data/telethon/` 아래에 저장되며 커밋하면 안 됩니다.

처음 로그인:

```bash
uv run python tgcalls_videochat_probe.py --session data/telethon/videochat_receiver --login-only
```

필요하면 전화번호와 로그인 코드를 입력합니다. 이 과정에서 만들어지는 `.session` 파일은 계정 접근 권한을 포함하므로 절대 공유하거나 커밋하지 않습니다.

### 6. 서버 실행

터미널 2개를 엽니다.

터미널 1:

```bash
source .venv/bin/activate
python main.py
```

터미널 2:

```bash
source .venv/bin/activate
python videochat_overlay.py
```

정상 실행되면:

- 채팅 서버: `http://127.0.0.1:9292/`
- 비디오챗 오버레이: `http://127.0.0.1:9393/`

제어 UI까지 보려면:

```text
http://127.0.0.1:9393/?control=1
```

### 7. Electron 앱 실행

Electron은 `tools/videochat_app/`에서 관리합니다.

```bash
cd tools/videochat_app
npm install
npm run control
```

WSL2의 WSLg에서 테스트할 수도 있습니다.

```bash
npm run start:wslg
```

WSLg에서 작업표시줄에는 뜨는데 창이 안 보이는 현상이 생길 수 있습니다. 이 경우 WSLg/Windows 디스플레이 문제일 가능성이 큽니다. 방송 실사용은 Windows용 빌드를 만들어 Windows 탐색기에서 실행하는 쪽이 안정적입니다.

Windows용 portable 빌드:

```bash
cd tools/videochat_app
npm run build:win
```

빌드 결과는 `tools/videochat_app/dist/`에 생깁니다. 이 폴더도 커밋하지 않습니다.

## OBS에서 보기

가장 단순한 방식은 OBS에서 브라우저 소스로 `http://127.0.0.1:9393/`를 추가하는 것입니다.

단, Electron 네이티브 web/YouTube 위젯은 일반 브라우저 소스에서 재현되지 않습니다. 이런 기능까지 포함한 실제 화면을 쓰려면 Windows Electron 앱 화면을 OBS에서 캡처하는 방식을 사용합니다.

## 보안 규칙

커밋 전 반드시 확인합니다.

- `.env` 커밋 금지
- `data/` 커밋 금지
- `data/telethon/*.session` 커밋 금지
- `data/tdlib/` 커밋 금지
- `vendor/tdlib/*.dll`, `*.so`, `*.dylib` 커밋 금지
- `tools/videochat_app/dist/` 커밋 금지
- Electron 프로필/로그인 정보 커밋 금지
- `data/rom/` ROM 파일 커밋 금지
- 스크린샷, 디버그 덤프, raw frame, 로그 파일 커밋 금지

현재 `.gitignore`는 위 항목을 기본적으로 제외합니다. 그래도 커밋 전에는 `git status --short`와 스테이징 파일 목록을 직접 확인해야 합니다.

## 설정 파일

### `.env`

실제 실행 설정입니다. 로컬에만 둡니다.

대표 항목:

| 항목 | 설명 |
| --- | --- |
| `BOT_TOKEN` | BotFather에서 받은 봇 토큰 |
| `WEB_HOST`, `WEB_PORT` | 채팅 서버 주소. 기본 `127.0.0.1:9292` |
| `TD_API_ID`, `TD_API_HASH` | Telegram user API 값 |
| `TD_VIDEOCHAT_LINK` | 대상 비디오챗 링크 |
| `VIDEOCHAT_WEB_HOST`, `VIDEOCHAT_WEB_PORT` | 비디오챗 오버레이 서버. 기본 `127.0.0.1:9393` |
| `TGCALLS_SESSION` | TgCalls receiver 부계정 세션 경로 |
| `TGCALLS_PHONE` | 최초 로그인 편의를 위한 전화번호. 커밋 금지 |
| `VIDEOCHAT_TGCALLS_AUTO_JOIN` | 초기 자동 참가 기본값. 실제 런타임 제어는 UI 설정도 반영 |

### `data/videochat_overlay_settings.json`

오버레이 UI에서 조정한 위젯 위치, 크기, UI 설정 등이 저장됩니다. 로컬 상태 파일이므로 커밋하지 않습니다.

### `data/videochat_levels.json`

사용자 레벨/역할/효과 사용 기록이 저장됩니다. 방송 운영 데이터이므로 커밋하지 않습니다.

### `data/level_reasons.json`

레벨별 안내 문구입니다. 파일이 없으면 `level_reasons.example.json` 기반으로 자동 생성됩니다. 방송 콘셉트에 맞게 로컬에서 수정할 수 있습니다.

레벨업 시스템은 방송마다 성격이 달라서, LLM에게 다음 파일과 원하는 운영 규칙을 보여주고 커스텀 지시를 하는 형태를 권장합니다.

- `level_system.py`
- `level_reasons.example.json`
- `main.py`의 `/check_level`, `/level_scan`, `/level_up`, `/fire`, `/cheer` 주변 로직

예시 지시:

```text
이 방송에서는 레벨 1은 채팅 참여, 레벨 2는 비디오챗 입장,
레벨 3은 cheer 또는 fire 사용, 레벨 4는 둘 다 사용으로 유지하고,
레벨별 문구를 더 장난스럽게 바꿔줘.
실제 data 파일과 개인정보는 건드리지 말고 예시 JSON과 로직만 수정해줘.
```

## 레벨 시스템

기본 흐름:

- 채팅을 하면 레벨 기록이 생성됩니다.
- 비디오챗에 들어오면 비디오챗 참여 기록이 반영됩니다.
- `/cheer` 또는 `/fire` 효과를 쓰면 레벨 3 조건을 만족합니다.
- `/cheer`와 `/fire`를 모두 쓰면 레벨 4 조건을 만족합니다.
- 관리자는 `/level_up`으로 레벨을 수동 조정할 수 있습니다.
- 수동으로 레벨을 내리면 cheer/fire 진행 기록도 기준 시점 이후로 다시 판단됩니다.

레벨 메시지는 입장/퇴장 이벤트와 마찬가지로 오버레이 이벤트 카드에 표시됩니다.

## 채팅 명령어

사용자는 Telegram 채팅에서 명령어를 입력합니다. 실제 표시 문구는 `/commands` 또는 `/help`로 확인할 수 있습니다.

일반 명령:

| 명령어 | 설명 |
| --- | --- |
| `/commands`, `/help` | 명령어 도움말 |
| `/fire` | 비디오챗 캐릭터 위치에서 폭죽 효과 |
| `/cheer` | 기본 5초 동안 응원봉 효과 |
| `/cheer 30` | 30초 동안 응원봉 효과. 최대 600초 |
| `/cheer off` | 응원봉 효과 중지 |

관리/운영 명령:

| 명령어 | 설명 |
| --- | --- |
| `/check_level` | 대상 레벨/역할 확인 |
| `/level_scan` | 레벨 목록 확인 |
| `/level_up` | 대상 레벨 수동 조정 |
| `/add_role`, `/remove_role`, `/reset_role`, `/check_role` | 역할 관리 |
| `/stt_on`, `/stt_off` | STT 토글 |
| `/here_on`, `/here_off` | 현장/참여 상태 관련 토글 |

예전 수동 스트림 감시 명령인 `stream_watch`, `unwatch` 계열은 현재 자동 수신 방식으로 대체되어 legacy 처리되어 있습니다.

## 위젯

오버레이의 `widget` 메뉴에서 추가하거나 표시할 수 있습니다. 대부분의 위젯은 드래그 이동, 크기 조절, hide/show, x 종료를 지원하며 위치와 크기는 로컬 설정에 저장됩니다.

### 가격 위젯

- BTC, ETH, Nasdaq 100 가격 카드
- 등락 색상 표시
- 15분 미니 차트
- 글자 크기 조절

### 메모 위젯

- 방송 중 임시 메모를 표시합니다.
- 여러 개를 추가할 수 있습니다.
- 드래그 이동, 크기 조절, 삭제를 지원합니다.

### YouTube 위젯

- Electron 네이티브 Chromium 뷰로 YouTube를 표시합니다.
- 일반 Chrome 테스트 화면에서는 네이티브 뷰가 붙지 않으므로 Electron 앱에서 확인해야 합니다.
- Electron 프로필을 유지하면 로그인 상태를 유지할 수 있습니다.
- hide 후 show 시 보던 상태를 최대한 유지합니다.

### web 위젯

- 현재 web은 Electron 네이티브 web을 의미합니다.
- 일반 브라우저 테스트에서는 동작하지 않고 Electron 앱 안에서 동작합니다.
- legacy iframe/proxy web 실험은 메뉴에서 제거되어 있습니다.

### 내부 게임 위젯

- 로컬 ROM을 선택해 EmulatorJS 기반으로 실행합니다.
- 개인 플레이와 집단 플레이를 지원합니다.
- 집단 플레이는 비디오챗 참가자의 채팅 명령만 반영합니다.
- 케이지 안에 있는 참가자는 집단 플레이에 참여할 수 없습니다.
- hide 또는 x 종료 시 상태 저장을 시도합니다.

ROM은 직접 준비해서 `data/rom/`에 넣습니다. 예:

```bash
mkdir -p data/rom
# 합법적으로 보유한 ROM을 data/rom/pk_gold.gb 같은 이름으로 배치
```

ROM 파일은 저작권/개인 파일이므로 커밋하지 않습니다.

개인 플레이 기본 키:

| 게임 입력 | 키보드 |
| --- | --- |
| 방향 | 화살표 |
| A | `Z` |
| B | `X` |
| SELECT | `V` |
| START | `Enter` |

집단 플레이 채팅 입력:

| 게임 입력 | 채팅 |
| --- | --- |
| UP | `up`, `u` |
| DOWN | `down`, `d` |
| LEFT | `left`, `l` |
| RIGHT | `right`, `r` |
| A | `a` |
| B | `b` |
| SELECT | `sel`, `select` |
| START | `start` |

### 난쟁이 위젯

- 참가자를 선택해서 캐릭터, 카드, 말풍선, 효과를 설정 비율만큼 작게 표시합니다.
- 나갔다 다시 들어오면 난쟁이 상태는 리셋됩니다.

### 케이지 위젯

- 참가자를 케이지 안에 넣습니다.
- 케이지 상태는 나갔다 들어와도 유지됩니다.
- 케이지 안 참가자는 효과와 게임 참여가 제한됩니다.
- 케이지 위치, 회전, 명판 문구와 색상을 UI에서 조정할 수 있습니다.
- 케이지에 아무도 없어도 반투명하게 표시되고, 참가자가 들어가면 더 선명하게 표시됩니다.

### 캐릭터 이동 위젯

- 참가자를 선택해서 위치를 옮길 수 있습니다.
- place 모드에서는 고스트 미리보기와 집게 이동 애니메이션을 사용합니다.
- drive 모드에서는 WASD 이동, 대각선 이동, QE 회전, Space 점프를 지원합니다.
- 케이지 참가자는 케이지 안에서만 이동할 수 있습니다.

## Electron 앱 데이터 유지

Electron 앱은 로그인 정보와 창 위치를 로컬 데이터 디렉터리에 저장합니다.

- 개발 실행: 기본적으로 repo의 `data/` 아래 사용
- packaged Windows 앱: `%APPDATA%/tg-chat-obs-layout/videochat_app/` 아래 사용

빌드할 때마다 로그인 정보가 날아가지 않게 하려면 `TG_VIDEOCHAT_APP_DATA_DIR` 또는 `--data-dir=...`로 고정 경로를 지정할 수 있습니다.

예:

```bash
TG_VIDEOCHAT_APP_DATA_DIR=/home/na_stream/tg-chat-obs-layout/data/videochat_app npm run control
```

Windows에서 실행할 때도 같은 원리로 고정 데이터 폴더를 지정할 수 있습니다.

## 디버깅

### Python 문법 확인

```bash
python -m py_compile main.py videochat_overlay.py level_system.py tgcalls_videochat_probe.py tdlib_videochat_probe.py
```

### JavaScript 문법 확인

```bash
node --check static_videochat/app.js
node -e "const fs=require('fs'); const html=fs.readFileSync('static_videochat/game_player.html','utf8'); const m=html.match(/<script>([\\s\\S]*)<\\/script>/); new Function(m[1]); console.log('game_player script ok');"
```

### 정적 파일 캐시

9393 서버는 개발 중 `/static/`, `/shared/`에 no-store 처리를 합니다. 그래도 브라우저/Electron 캐시 때문에 이상하면 강력 새로고침 또는 Electron 재시작을 먼저 시도합니다.

### Electron 디버그

Electron 앱은 네이티브 web/YouTube 브라우저 이벤트와 콘솔 로그를 오버레이 쪽으로 전달합니다. 문제가 생기면 Electron 화면의 디버그 패널 또는 개발자 도구에서 콘솔 로그를 확인합니다.

### WSLg 문제

WSLg에서 창이 작업표시줄에만 보이거나 빈 화면으로 뜨는 문제는 코드보다 WSLg/Remote Desktop/멀티 모니터 상태 문제일 수 있습니다. 실사용은 Windows용 Electron 빌드를 Windows 탐색기에서 직접 실행하는 방식이 더 안정적입니다.

## 커밋 전 체크리스트

```bash
git status --short
git diff --check
```

스테이징 후에는 다음을 확인합니다.

```bash
git diff --cached --name-only
```

스테이징 목록에 아래가 있으면 커밋을 멈춥니다.

- `.env`
- `data/`
- `vendor/tdlib/`
- `*.session`
- `*.db`
- `*.sqlite`
- `*.gb`, `*.gbc`, `*.gba`
- `tools/videochat_app/dist/`
- 스크린샷/로그/디버그 덤프

## 자주 겪는 문제

### `PortAudio library not found`

```bash
sudo apt install -y portaudio19-dev
```

설치 후 가상환경에서 다시 실행합니다.

### WSL2에서 `tdjson.dll`을 찾으려고 함

WSL2/Linux에서는 `.dll`이 아니라 `libtdjson.so`가 필요합니다.

```bash
scripts/build_tdlib_linux.sh
```

또는 `.env`의 `TDLIB_JSON_PATH`를 Linux용 `.so` 파일로 지정합니다.

### 부계정이 비디오챗 화면을 못 받음

- `TGCALLS_SESSION` 경로에 로그인 세션이 있는지 확인합니다.
- `TD_API_ID`, `TD_API_HASH`가 설정되어 있는지 확인합니다.
- 부계정이 대상 그룹/비디오챗에 접근 가능한지 확인합니다.
- UI의 자동 참가 설정과 실제 부계정 참가 상태를 확인합니다.

### Chrome에서는 web/YouTube 위젯이 안 됨

정상입니다. 현재 web/YouTube는 Electron 네이티브 BrowserView 기능을 사용합니다. Chrome에서는 3D 오버레이와 일반 위젯 테스트용으로 보고, web/YouTube는 Electron 앱에서 확인합니다.

### 게임 위젯이 ROM을 못 찾음

ROM은 `data/rom/` 아래에 둡니다.

```bash
ls data/rom
```

`/api/game/roms`가 ROM 목록을 반환해야 합니다.
