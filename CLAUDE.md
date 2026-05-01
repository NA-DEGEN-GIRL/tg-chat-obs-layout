# CLAUDE.md

이 저장소에서 작업할 때의 운영 메모입니다. 사용자는 한국어로 소통하며, 요청이 구현 가능한 기능이면 실제 코드 수정과 검증까지 진행하는 것을 기대합니다.

## 최우선 보안 규칙

절대 커밋하면 안 되는 항목:

- `.env`
- `data/`
- Telegram/Telethon/TgCalls 세션 파일
- TDLib 데이터베이스와 캐시
- Electron 프로필과 로그인 정보
- Telegram 토큰, API hash, 전화번호, 계정 정보
- ROM 파일
- TDLib 바이너리
- 빌드 산출물
- 스크린샷, 로그, 디버그 덤프

커밋 전에는 반드시 `git status --short`와 `git diff --cached --name-only`를 확인합니다. `.gitignore`가 있어도 스테이징 목록을 직접 봐야 합니다.

## 프로젝트 개요

`tg-chat-obs-layout`은 Telegram 채팅/비디오챗을 방송용 오버레이로 보여주는 로컬 앱입니다.

- `main.py`: Telegram 봇과 채팅 API 서버. 기본 포트 `9292`.
- `videochat_overlay.py`: 비디오챗 3D 오버레이 서버. 기본 포트 `9393`.
- `static_videochat/`: 9393 화면의 프론트엔드.
- `tools/videochat_app/`: Windows/Electron 앱.
- `level_system.py`: 레벨과 역할 저장/승급 로직.
- `tdlib_videochat_probe.py`: TDLib 기반 probe.
- `tgcalls_videochat_probe.py`: PyTgCalls/Telethon 기반 receiver probe.

## 개발 환경

Python은 uv 가상환경을 사용합니다.

```bash
uv venv --python 3.12 .venv
source .venv/bin/activate
uv pip install -r requirements.txt
```

WSL2/Linux에서 필요한 대표 패키지:

```bash
sudo apt update
sudo apt install -y build-essential cmake gperf zlib1g-dev libssl-dev portaudio19-dev
```

`sounddevice` 오류 중 `PortAudio library not found`는 `portaudio19-dev` 누락입니다.

## 실행

채팅/봇 서버:

```bash
uv run python main.py
```

비디오챗 오버레이:

```bash
uv run python videochat_overlay.py
```

Electron 개발 실행:

```bash
cd tools/videochat_app
npm install
npm run control
```

Windows 빌드:

```bash
cd tools/videochat_app
npm run build:win
```

빌드 결과는 커밋하지 않습니다.

## TDLib와 TgCalls

TDLib 바이너리는 OS마다 다릅니다.

- Windows: `vendor/tdlib/tdjson.dll`
- Linux/WSL2: `vendor/tdlib/libtdjson.so`
- macOS: `vendor/tdlib/libtdjson.dylib`

Linux 빌드는 다음 스크립트를 사용합니다.

```bash
scripts/build_tdlib_linux.sh
```

TgCalls receiver 로그인:

```bash
uv run python tgcalls_videochat_probe.py --session data/telethon/videochat_receiver --login-only
```

생성되는 세션은 절대 커밋하지 않습니다.

## 기능별 주의점

### Electron native web/YouTube

현재 web과 YouTube 위젯은 Electron의 BrowserView 기반입니다. 일반 Chrome으로 9393을 열면 네이티브 뷰가 붙지 않는 것이 정상입니다. Chrome은 3D 오버레이와 일반 UI 테스트용, 실제 web/YouTube 확인은 Electron 앱을 사용합니다.

Electron은 앱 데이터 디렉터리에 로그인 프로필과 창 상태를 저장합니다. packaged 앱에서는 `%APPDATA%/tg-chat-obs-layout/videochat_app/` 아래를 사용하고, 개발 실행에서는 repo의 `data/` 아래를 기본으로 사용합니다.

### 게임 위젯

ROM은 `data/rom/`에서 읽습니다. ROM은 커밋하지 않습니다.

집단 플레이는 비디오챗 참가자의 채팅만 반영합니다. 케이지 안 참가자는 참여할 수 없습니다.

개인 플레이:

- 방향키
- `Z`: A
- `X`: B
- `V`: SELECT
- `Enter`: START

집단 플레이 채팅:

- `up/u`
- `down/d`
- `left/l`
- `right/r`
- `a`
- `b`
- `sel/select`
- `start`

`static_videochat/game_player.html`은 EmulatorJS loader와 iframe postMessage에 의존합니다. EmulatorJS 내부 DOM은 비동기 생성되므로 resize, mutation observer, OSD 제거, save/load 타이밍을 조심해야 합니다.

### 난쟁이와 케이지

난쟁이는 캐릭터와 UI를 비율대로 축소하며 재입장 시 리셋됩니다. 케이지는 persistent 상태로, 나갔다 들어와도 유지됩니다.

케이지 참가자는 케이지 안에서만 이동 가능하고, 게임 집단 플레이 참여가 제한됩니다.

### 캐릭터 이동

place 모드는 고스트 미리보기와 집게 애니메이션을 사용합니다. drive 모드는 WASD, 대각선 이동, QE 회전, Space 점프를 지원합니다. UI focus가 drive 키 입력을 막지 않도록 주의합니다.

### 레벨 시스템

실제 레벨 데이터는 `data/videochat_levels.json`에 저장됩니다. 레벨 문구는 `data/level_reasons.json`에 저장되고, 없으면 `level_reasons.example.json`에서 초기화됩니다.

기본 조건:

- 채팅 기록 생성
- 비디오챗 참여 기록
- `/cheer` 또는 `/fire` 사용 시 레벨 3 조건
- `/cheer`와 `/fire` 모두 사용 시 레벨 4 조건

사용자가 레벨 정책을 바꾸고 싶어 하면 LLM에게 `level_system.py`, `level_reasons.example.json`, `main.py`의 레벨/명령 로직을 보여주고 방송 콘셉트에 맞게 커스텀하도록 지시하는 방식을 권장합니다. 실제 `data/` 파일이나 개인정보는 건드리지 않습니다.

## 검증

기본 검증:

```bash
python -m py_compile main.py videochat_overlay.py level_system.py tgcalls_videochat_probe.py tdlib_videochat_probe.py
node --check static_videochat/app.js
node -e "const fs=require('fs'); const html=fs.readFileSync('static_videochat/game_player.html','utf8'); const m=html.match(/<script>([\\s\\S]*)<\\/script>/); new Function(m[1]); console.log('game_player script ok');"
git diff --check
```

Electron 관련 변경이면 가능하면 `npm run build:win`도 확인합니다. 네트워크/빌드 환경 때문에 불가능하면 그 사실을 최종 응답에 명시합니다.

## 커밋 절차

1. `git status --short`로 작업 트리를 확인합니다.
2. 커밋할 소스/문서만 `git add`합니다.
3. `image*.png`, `data/`, `.env`, ROM, 세션, dist가 스테이징되지 않았는지 확인합니다.
4. `git diff --cached --check`를 실행합니다.
5. 커밋합니다.
6. push합니다.

권장 커밋 메시지 예:

```text
Update overlay widgets and documentation
```

## 사용자 커뮤니케이션

- 짧고 직접적으로 보고합니다.
- 불확실한 부분은 코드 기준으로 확인하고 말합니다.
- Chrome/Electron/WSLg/Windows 빌드의 차이를 분명히 설명합니다.
- 보안상 커밋하지 않은 파일은 명확히 언급합니다.
