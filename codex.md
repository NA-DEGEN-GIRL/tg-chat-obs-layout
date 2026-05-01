# Codex Handoff

이 문서는 Codex 또는 다른 코드 에이전트가 이 저장소를 수정할 때 지켜야 할 작업 기준입니다. 사용자는 한국어로 직접적인 구현을 선호하며, 기능 요청은 보통 "제안"이 아니라 실제 수정까지 기대합니다.

## 절대 규칙

- `.env`를 읽거나 출력하거나 커밋하지 않는다.
- `data/`를 커밋하지 않는다.
- Telegram 세션, TDLib DB, Telethon/TgCalls 세션, Electron 프로필, ROM, 토큰, 전화번호, 계정 정보는 절대 커밋하지 않는다.
- `vendor/tdlib/*.dll`, `*.so`, `*.dylib` 같은 바이너리는 커밋하지 않는다.
- `tools/videochat_app/dist/` 빌드 산출물은 커밋하지 않는다.
- 스크린샷, raw frame, debug dump, 로그 파일은 커밋하지 않는다.
- 커밋 전 `git status --short`와 `git diff --cached --name-only`로 스테이징 목록을 확인한다.
- 이미 존재하는 사용자 변경을 되돌리지 않는다.

## 현재 아키텍처

| 구성 | 파일 | 포트/역할 |
| --- | --- | --- |
| 채팅/봇 서버 | `main.py` | 기본 `9292`. Telegram 봇, 채팅 API, 레벨/명령 처리 |
| 비디오챗 오버레이 | `videochat_overlay.py` | 기본 `9393`. 3D 오버레이, 위젯, TgCalls receiver |
| 9393 프론트엔드 | `static_videochat/` | Three.js 화면, 위젯 UI, 게임 위젯 |
| Electron 앱 | `tools/videochat_app/` | 9393을 감싸고 native web/YouTube BrowserView 제공 |
| 레벨 저장 로직 | `level_system.py` | 레벨/역할/효과 사용 기록 |
| TDLib probe | `tdlib_videochat_probe.py` | OS별 tdjson 로딩, 비디오챗 participant probe |
| TgCalls probe | `tgcalls_videochat_probe.py` | 부계정 세션 로그인 및 프레임 수신 probe |

## 개발 환경

Python은 uv 가상환경을 기준으로 한다.

```bash
uv venv --python 3.12 .venv
source .venv/bin/activate
uv pip install -r requirements.txt
```

WSL2/Linux에서 필요한 대표 시스템 패키지:

```bash
sudo apt update
sudo apt install -y build-essential cmake gperf zlib1g-dev libssl-dev portaudio19-dev
```

`sounddevice`의 `PortAudio library not found`는 `portaudio19-dev` 누락이다.

## 실행 명령

채팅/봇 서버:

```bash
uv run python main.py
```

비디오챗 오버레이 서버:

```bash
uv run python videochat_overlay.py
```

Electron:

```bash
cd tools/videochat_app
npm install
npm run control
```

Windows portable 빌드:

```bash
cd tools/videochat_app
npm run build:win
```

WSLg 테스트:

```bash
cd tools/videochat_app
npm run start:wslg
```

WSLg는 멀티 모니터/Remote Desktop 상태에 따라 taskbar-only 창 문제가 생길 수 있다. 실사용은 Windows 빌드를 Windows 탐색기에서 실행하는 것을 권장한다.

## TDLib/TgCalls

TDLib는 OS별 파일명이 다르다.

- Windows: `vendor/tdlib/tdjson.dll`
- Linux/WSL2: `vendor/tdlib/libtdjson.so`
- macOS: `vendor/tdlib/libtdjson.dylib`

Linux 빌드:

```bash
scripts/build_tdlib_linux.sh
```

TgCalls receiver 로그인:

```bash
uv run python tgcalls_videochat_probe.py --session data/telethon/videochat_receiver --login-only
```

이 명령으로 생성되는 세션은 계정 접근 권한을 포함한다. 절대 커밋하지 않는다.

## 주요 기능 상태

### 3D 오버레이

- 비디오챗 참가자를 캐릭터로 렌더링한다.
- 입장/퇴장/레벨업/레벨다운 이벤트 카드가 있다.
- 말풍선, 닉네임 카드, 레벨, 역할, 왕관, LIVE 배지가 있다.
- UI hide 시에도 입력창 근처 hover로 채팅 입력 UI가 나타난다.
- 카메라 상하 각도와 확대/축소 범위를 UI에서 조정한다.

### 부계정/스트림 수신

- `VIDEOCHAT_TGCALLS_AUTO_JOIN`은 초기 기본값이다.
- 런타임에서는 UI 설정과 부계정 현재 참가 상태가 receiver 동작에 영향을 준다.
- 부계정이 이미 들어와 있으면 auto off여도 프레임 수신은 계속 의미가 있다.
- subaccount character show/hide와 auto join은 분리해서 다룬다.

### 위젯

- 가격: BTC/ETH/Nasdaq 100, 등락 색상, 미니 차트, 글자 크기 조절.
- 메모: 여러 개 추가/수정/삭제, 위치/크기 저장.
- YouTube: Electron native BrowserView 기반. Chrome 테스트에서는 완전 동작하지 않는다.
- web: legacy iframe/proxy가 아니라 Electron native web을 의미한다.
- 내부 게임: EmulatorJS iframe, ROM 목록, save/load/new, 개인/집단 플레이, speed/volume.
- 난쟁이: 캐릭터/카드/말풍선/효과 스케일 축소, 재입장 시 리셋.
- 케이지: persistent cage, 명판 텍스트/색상, 케이지 내부 이동, 게임 참여 제한.
- 캐릭터 이동: place ghost, claw-machine animation, drive WASD/QE/Space.

### 게임 위젯

- ROM은 `data/rom/`에서 읽는다.
- `data/rom/pk_gold.gb` 같은 실제 ROM은 커밋 금지.
- `static_videochat/game_player.html`은 EmulatorJS loader와 postMessage API를 사용한다.
- group play 입력은 비디오챗 참가자 채팅만 반영한다.
- 케이지 참가자는 group play에 참여할 수 없다.
- 개인 플레이 키: 방향키, `Z` A, `X` B, `V` SELECT, `Enter` START.
- group play 채팅: `up/u`, `down/d`, `left/l`, `right/r`, `a`, `b`, `sel/select`, `start`.
- Fast-Forward OSD는 suppression/DOM scrub로 숨긴다.

### 레벨 시스템

저장 파일:

- `data/videochat_levels.json`: 실제 레벨/역할/효과 기록. 커밋 금지.
- `data/level_reasons.json`: 로컬 레벨 문구. 없으면 example 기반 생성.
- `level_reasons.example.json`: 커밋되는 예시.

기본 조건:

- 채팅 참여로 레벨 기록 생성.
- 비디오챗 참여가 별도 기록으로 반영.
- `/cheer` 또는 `/fire` 사용 시 레벨 3 조건.
- `/cheer`와 `/fire` 모두 사용 시 레벨 4 조건.
- 수동 레벨다운 시 effect-progress 기준도 다시 잡아야 한다.

레벨업 시스템은 방송 콘셉트 의존성이 크다. 사용자가 레벨 정책을 바꾸고 싶어 하면 LLM에게 `level_system.py`, `level_reasons.example.json`, `main.py`의 레벨/명령 주변 로직을 보여주고 원하는 조건을 자연어로 지시하는 방식을 안내한다. 실제 개인정보가 들어 있는 `data/` 파일은 건드리지 않는다.

### 채팅 명령

일반:

- `/commands`, `/help`
- `/fire`
- `/cheer [seconds]`
- `/cheer off`

운영:

- `/check_level`
- `/level_scan`
- `/level_up`
- `/check_role`
- `/add_role`
- `/remove_role`
- `/reset_role`
- `/stt_on`, `/stt_off`
- `/here_on`, `/here_off`

`stream_watch`, `unwatch` 계열은 자동 수신 구조로 대체되어 legacy 처리 대상이다.

## 검증 명령

가능하면 변경 후 아래를 실행한다.

```bash
python -m py_compile main.py videochat_overlay.py level_system.py tgcalls_videochat_probe.py tdlib_videochat_probe.py
node --check static_videochat/app.js
node -e "const fs=require('fs'); const html=fs.readFileSync('static_videochat/game_player.html','utf8'); const m=html.match(/<script>([\\s\\S]*)<\\/script>/); new Function(m[1]); console.log('game_player script ok');"
git diff --check
```

Electron 변경은 가능하면:

```bash
cd tools/videochat_app
npm run build:win
```

단, 빌드 산출물은 커밋하지 않는다.

## 커밋 전 보안 점검

스테이징 후:

```bash
git diff --cached --name-only
```

아래 패턴이 있으면 커밋 금지:

- `.env`
- `data/`
- `vendor/tdlib/`
- `*.session`
- `*.gb`, `*.gbc`, `*.gba`
- `tools/videochat_app/dist/`
- `image*.png` 같은 임시 스크린샷

문서에는 실제 토큰/전화번호/계정명/세션 경로의 민감 값 대신 placeholder만 사용한다.

## 작업 스타일 메모

- 사용자는 빠르게 직접 확인하며 피드백을 준다.
- UI 문제는 캐시 영향이 잦다. 정적 파일 cache-bust 버전, hard refresh, Electron reload를 고려한다.
- Chrome과 Electron의 기능 차이를 명확히 구분한다.
- Electron native BrowserView 기능은 Chrome에서 안 되는 것이 정상일 수 있다.
- 위젯 위치/크기 저장은 사용자 체감상 중요하다. 리렌더링이나 서버 업데이트가 로컬 override를 덮지 않게 주의한다.
- 드래그/resize는 pointer capture, iframe shield, local override window가 중요하다.
- 게임 위젯은 iframe/EmulatorJS 내부 DOM이 비동기 생성되므로 mutation/resize 타이밍을 방어해야 한다.
