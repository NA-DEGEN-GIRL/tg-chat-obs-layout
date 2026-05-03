# tg-chat-obs-layout

Telegram 채팅과 비디오챗 참여자를 방송용 오버레이로 OBS에 띄우는 로컬 프로젝트입니다. Python/FastAPI 서버 두 개가 텔레그램 메시지와 비디오챗 상태를 받아오고, 브라우저 또는 Electron 앱이 OBS에 캡처할 화면을 그립니다.

이 저장소에는 **소스 코드와 예시 설정만** 들어갑니다. 실제 `.env`, Telegram 세션, TDLib 데이터, Electron 로그인 프로필, ROM, 토큰, 전화번호, 계정 정보는 절대 커밋하지 않습니다.

---

## 목차

- [이게 뭐예요](#이게-뭐예요)
- [준비물 체크리스트](#준비물-체크리스트)
- [5분 Quick Start — 채팅 오버레이만](#5분-quick-start--채팅-오버레이만)
- [비디오챗 오버레이 추가하기](#비디오챗-오버레이-추가하기)
- [Electron 앱 추가하기](#electron-앱-추가하기)
- [OBS에 띄우기](#obs에-띄우기)
- [위젯 사용하기](#위젯-사용하기)
- [채팅 명령어](#채팅-명령어)
- [레벨 시스템](#레벨-시스템)
- [자주 겪는 문제](#자주-겪는-문제)
- [참고 자료](#참고-자료)
  - [폴더 구조](#폴더-구조)
  - [설정 파일](#설정-파일)
  - [Electron 데이터 유지](#electron-데이터-유지)
  - [디버깅과 문법 체크](#디버깅과-문법-체크)
  - [보안 규칙과 커밋 체크리스트](#보안-규칙과-커밋-체크리스트)

---

## 이게 뭐예요

채팅창과 비디오챗 참가자를 방송 화면에 예쁘게 보여주기 위한 도구입니다. 텔레그램에서 일어나는 일을 두 개의 로컬 서버가 받아서, 브라우저(또는 Electron 앱)가 그것을 그려주고, OBS는 그 화면을 캡처합니다.

```
 ┌──────────────┐
 │ Telegram     │  채팅 / 비디오챗
 └──────┬───────┘
        │
        ▼
 ┌─────────────────────┐         ┌───────────────────────────┐
 │ main.py (9292)      │         │ videochat_overlay.py(9393)│
 │ - 봇/채팅 API       │         │ - 비디오챗 3D 오버레이    │
 │ - 레벨/명령어       │         │ - 위젯, TgCalls 수신      │
 └──────┬──────────────┘         └────────────┬──────────────┘
        │ WebSocket / HTTP                    │
        ▼                                     ▼
 ┌─────────────────────┐         ┌───────────────────────────┐
 │ 채팅 오버레이 페이지│         │ 비디오챗 오버레이 페이지  │
 │ (Chrome / OBS)      │         │ (Chrome 또는 Electron 앱) │
 └─────────────────────┘         └────────────┬──────────────┘
                                              │
                                              ▼
                                          ┌───────┐
                                          │  OBS  │
                                          └───────┘
```

쓸 수 있는 시나리오:

- 채팅만 OBS에 띄우고 싶다 → `main.py` 1개로 충분합니다.
- 비디오챗 참가자를 3D 캐릭터로 띄우고 싶다 → `videochat_overlay.py`를 추가합니다.
- 방송에서 YouTube/web/게임 위젯을 쓰고 싶다 → Windows용 Electron 앱까지 추가합니다.

처음에는 채팅 오버레이만 띄워보고, 익숙해지면 비디오챗과 Electron 단계를 단계적으로 붙여 나가면 됩니다.

---

## 준비물 체크리스트

시작 전에 아래가 준비되어 있는지 확인하세요.

| 항목 | 어디서 얻나 | 어디에 쓰이나 |
| --- | --- | --- |
| Telegram 봇 토큰 | [@BotFather](https://t.me/BotFather) | 채팅 오버레이, 명령어 |
| 봇이 들어간 그룹의 채팅 ID | 봇을 그룹에 초대 후 메시지 ID 확인 | 명령어 권한 게이트 |
| Telegram API ID / API Hash | <https://my.telegram.org> | 비디오챗 수신 (TgCalls/TDLib) |
| 메인/부계정 전화번호 | 본인이 보유한 Telegram 계정 | 메인계정은 채팅/STT/상태 확인, 부계정은 비디오챗 receiver |
| OBS Studio | <https://obsproject.com/> | 방송 화면 캡처 |
| 운영체제 | WSL2(Ubuntu) **또는** Windows 10/11 | 개발은 WSL2, 실사용은 Windows 권장 |
| Python 3.12, [uv](https://docs.astral.sh/uv/) | 패키지 매니저 | 서버 실행 |
| Node.js + npm | <https://nodejs.org/> | Electron 앱 (옵션) |

> 비디오챗과 Electron이 처음에는 필요 없으면 봇 토큰과 그룹 ID, OBS만 있어도 채팅 오버레이는 띄울 수 있습니다.

---

## 5분 Quick Start — 채팅 오버레이만

OBS에 채팅창만 먼저 띄워보는 가장 짧은 흐름입니다. 비디오챗/Electron은 다음 섹션에서 다룹니다.

### 1) 시스템 패키지 설치 (WSL2 Ubuntu 기준)

```bash
sudo apt update
sudo apt install -y build-essential cmake gperf zlib1g-dev libssl-dev portaudio19-dev
```

`sounddevice`가 `OSError: PortAudio library not found`를 내면 `portaudio19-dev`가 빠진 것입니다.

### 1-1) WSL2에서 마이크/STT 입력 확인 (STT를 쓸 때만)

`/stt_on`으로 내 마이크 음성을 텔레그램에 보내려면 WSL2 안에서 입력 장치가 보여야 합니다. 새 PC나 새 WSL에서 먼저 아래 순서로 확인하세요.

Windows 쪽에서 확인할 것:

- Windows 설정 → 개인정보 및 보안 → 마이크에서 마이크 접근 권한이 켜져 있어야 합니다.
- WSLg/오디오 연결이 꼬였으면 PowerShell에서 `wsl --update` 후 WSL을 다시 열어 봅니다.
- 원격 SSH로 다른 컴퓨터의 WSL에 붙은 경우, 내 PC 마이크가 자동으로 그 WSL에 넘어가지는 않습니다. 그 컴퓨터 로컬 WSL에서 실행하거나, 별도 원격 STT 입력 경로를 써야 합니다.

WSL2 Ubuntu에서 확인:

```bash
sudo apt update
sudo apt install -y portaudio19-dev pulseaudio-utils alsa-utils

echo "$PULSE_SERVER"
pactl info
pactl list short sources
```

`pactl list short sources`에 `NVIDIA Broadcast`, `Microphone`, `input` 같은 입력 장치가 보여야 합니다.

Python/sounddevice에서 보이는 이름 확인:

```bash
uv run python - <<'PY'
import sounddevice as sd
print(sd.query_devices())
print("default:", sd.default.device)
PY
```

로컬 환경 설정에는 실제로 위 목록에 보이는 장치 이름 일부를 넣습니다.

```text
STT_INPUT_DEVICE=NVIDIA
```

잘 모르겠으면 비워두면 OS 기본 입력 장치를 씁니다.

```text
STT_INPUT_DEVICE=
```

설정 후 `uv run python main.py`를 다시 켜고 `/stt_on`으로 테스트합니다.

### 2) 가상환경과 의존성

프로젝트 루트에서:

```bash
uv venv --python 3.12 .venv
source .venv/bin/activate
uv pip install -r requirements.txt
```

이후로는 가상환경을 켜고 `python ...`을 쓰거나, 안 켜고 `uv run python ...`을 써도 됩니다.

### 3) `.env` 만들기

```bash
cp .env.example .env
```

`.env`를 열어 최소한 다음 항목을 채웁니다:

- `BOT_TOKEN` — BotFather 봇 토큰
- `CHAT_ID` — 봇이 들어가 있는 그룹의 ID
- `OWNER_ID` — 명령어를 쓸 본인 사용자 ID

> `.env`는 절대 커밋하지 않습니다. `.env.example`에는 빈 값과 설명만 둡니다.

### 4) 채팅 서버 실행

```bash
uv run python main.py
```

정상이면 `http://127.0.0.1:9292/`에 채팅 오버레이가 뜹니다.

### 5) OBS에 추가

OBS에서 `브라우저 소스` 추가 → URL에 `http://127.0.0.1:9292/`. 배경은 투명, 그룹에서 메시지를 보내면 카드가 떠야 정상입니다.

여기까지 되면 채팅 오버레이는 끝입니다. 비디오챗 캐릭터가 필요 없으면 다음 섹션은 건너뛰어도 됩니다.

---

## 비디오챗 오버레이 추가하기

비디오챗 참가자를 3D 캐릭터로 띄우려면 `videochat_overlay.py`(9393 포트), 메인계정 세션, 부계정 receiver 세션이 필요합니다.

이 문서에서는 계정을 단순하게 이렇게 부릅니다.

| 이름 | 실제 역할 | 세션 |
| --- | --- | --- |
| 메인계정 | 채팅/STT 전송, 비디오챗 상태/참가자/call 정보 확인 | `data/telethon/videochat_overlay`, `data/telethon/stt_sender` |
| 부계정 | 오토 소환되어 비디오챗에 입장하고 영상 프레임 수신 | `data/telethon/videochat_receiver` |

### 1) `.env` 항목 추가

```text
TD_API_ID=...
TD_API_HASH=...
TD_VIDEOCHAT_LINK=...
VIDEOCHAT_WEB_HOST=127.0.0.1
VIDEOCHAT_WEB_PORT=9393
TG_MAIN_PHONE=+82...     # 메인계정: 채팅/STT/비디오챗 상태 확인
TG_SUB_PHONE=+82...      # 부계정: 오토 소환/영상 프레임 수신
TGCALLS_SESSION=data/telethon/videochat_receiver
```

전화번호 항목은 비워도 로그인할 때 터미널에서 입력할 수 있습니다. 다만 원격 테스트 WSL에서는 `TG_MAIN_PHONE`, `TG_SUB_PHONE`을 채워두면 덜 헷갈립니다.

### 2) TDLib 바이너리 준비

OS에 따라 자동 선택됩니다.

- Windows: `vendor/tdlib/tdjson.dll`
- Linux/WSL2: `vendor/tdlib/libtdjson.so`
- macOS: `vendor/tdlib/libtdjson.dylib`

WSL2/Linux에서 직접 빌드:

```bash
scripts/build_tdlib_linux.sh
```

빌드 결과 `vendor/tdlib/libtdjson.so`는 로컬 바이너리이므로 커밋하지 않습니다. 특정 경로를 강제로 쓰려면 `.env`의 `TDLIB_JSON_PATH` 또는 `TDLIB_JSON_DLL`을 지정합니다.

### 3) Telegram 세션 로그인

세션 파일은 계정 접근 권한이므로 복사/커밋하지 말고, 각 PC/WSL에서 직접 로그인합니다.

메인계정 세션:

```bash
scripts/login_main_account.sh
```

이 스크립트는 메인계정으로 두 세션을 만듭니다.

- `data/telethon/videochat_overlay`: 9393이 비디오챗 상태와 참가자를 확인
- `data/telethon/stt_sender`: 9292가 메인계정으로 채팅/STT 메시지를 보낼 때 사용

둘 다 같은 `TG_MAIN_PHONE`을 쓰더라도 세션 파일이 분리되어 있어서 최초 1회는 인증 코드/2FA를 두 번 입력할 수 있습니다.

부계정 세션:

```bash
scripts/login_sub_account.sh
```

이 스크립트는 `TG_SUB_PHONE`으로 `data/telethon/videochat_receiver` 세션을 만듭니다. 이 계정이 오토 소환되어 비디오챗 프레임을 받는 receiver입니다.

로그인 중 `database is locked`가 나오면 같은 세션을 쓰는 서버나 이전 로그인 helper가 남아 있는 상태입니다.

```bash
pkill -f 'telegram_login_session.py --session data/telethon/videochat_overlay' || true
pkill -f 'telegram_login_session.py --session data/telethon/stt_sender' || true
pkill -f 'telegram_login_session.py --session data/telethon/videochat_receiver' || true
```

원격 테스트 WSL에서만 잠긴 로컬 세션을 버리고 새로 로그인하려면:

```bash
TG_LOGIN_DROP_LOCKED=1 scripts/login_main_account.sh
TG_LOGIN_DROP_LOCKED=1 scripts/login_sub_account.sh
```

이 명령은 해당 WSL의 로컬 세션 파일을 삭제합니다. 메인 개발 WSL에서 실수로 쓰지 마세요.

### 4) 두 서버 같이 띄우기

터미널 2개:

```bash
# 터미널 1
source .venv/bin/activate
python main.py

# 터미널 2
source .venv/bin/activate
python videochat_overlay.py
```

| 서버 | 주소 | 용도 |
| --- | --- | --- |
| 채팅 | `http://127.0.0.1:9292/` | 채팅 오버레이 |
| 비디오챗 | `http://127.0.0.1:9393/` | 3D 비디오챗 오버레이 |
| 비디오챗 제어 UI | `http://127.0.0.1:9393/?control=1` | 위젯/카메라 조정 |

OBS에서 `http://127.0.0.1:9393/`을 브라우저 소스로 추가하면 비디오챗 화면이 나옵니다.

---

## Electron 앱 추가하기

YouTube/web 같은 네이티브 위젯은 일반 Chrome에서는 동작하지 않고, **Electron 네이티브 BrowserView**가 필요합니다. 내부 게임은 Chrome에서도 테스트할 수 있지만, Windows 방송 실사용 환경은 Electron 앱 화면을 캡처하는 쪽이 가장 안정적입니다.

```bash
cd tools/videochat_app
npm install
npm run control
```

WSL2의 WSLg에서 테스트:

```bash
npm run start:wslg
```

> WSLg에서는 창이 작업표시줄에만 보이거나 빈 화면이 뜨는 경우가 있습니다. 코드 문제보다 WSLg/디스플레이 환경 문제일 가능성이 높습니다. 실사용은 Windows 빌드를 Windows에서 직접 실행하는 쪽이 안정적입니다.

Windows portable 빌드:

```bash
cd tools/videochat_app
npm run build:win
```

결과는 `tools/videochat_app/dist/`에 생기며 **커밋하지 않습니다**.

---

## OBS에 띄우기

가장 단순한 방식은 OBS에 브라우저 소스로 다음 URL을 추가하는 것입니다.

- 채팅만: `http://127.0.0.1:9292/`
- 비디오챗: `http://127.0.0.1:9393/`

YouTube/web 같은 Electron 네이티브 위젯까지 포함된 실제 화면이 필요하면, **Windows Electron 앱 화면을 OBS에서 캡처**하는 방식을 씁니다(브라우저 소스로는 네이티브 위젯이 표시되지 않습니다).

---

## 위젯 사용하기

오버레이의 `widget` 메뉴에서 추가/표시합니다. 대부분 위젯은 드래그 이동, 크기 조절, hide/show, x 종료를 지원하고 위치/크기는 로컬 설정에 저장됩니다.

### 가격 위젯
- BTC, ETH, Nasdaq 100 카드
- 등락 색상, 15분 미니 차트, 글자 크기 조절

### 메모 위젯
- 방송 중 임시 메모 표시. 여러 개 가능. 드래그/크기조절/삭제

### YouTube 위젯
- Electron 네이티브 Chromium 뷰. 일반 Chrome에서는 안 붙음
- Electron 프로필을 유지하면 로그인도 유지됨
- hide → show 시 직전 상태 최대한 복원

### web 위젯
- Electron 네이티브 web. 일반 브라우저 테스트에서는 동작 안 함
- legacy iframe/proxy 실험은 메뉴에서 제거됨

### 내부 게임 위젯
- 로컬 ROM을 EmulatorJS로 실행. 개인 플레이/집단 플레이 지원
- 집단 플레이는 비디오챗 참가자 채팅 명령만 반영
- 케이지 안 참가자는 집단 플레이에 참여 불가
- hide / x 종료 시 상태 저장 시도

ROM은 직접 준비해서 `data/rom/`에 둡니다.

```bash
mkdir -p data/rom
# 합법적으로 보유한 ROM을 data/rom/pk_gold.gb 같은 이름으로 배치
```

ROM 파일은 저작권/개인 파일이므로 커밋 금지입니다.

**개인 플레이 키:**

| 게임 입력 | 키보드 |
| --- | --- |
| 방향 | 화살표 |
| A | `Z` |
| B | `X` |
| SELECT | `V` |
| START | `Enter` |

**집단 플레이 채팅:**

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
- 참가자를 선택해 캐릭터/카드/말풍선/효과를 비율만큼 작게 표시
- 나갔다 다시 들어오면 리셋

### 케이지 위젯
- 참가자를 케이지 안에 가둠. 나갔다 들어와도 유지(persistent)
- 케이지 안 참가자는 효과/게임 참여 제한
- 위치, 회전, 명판 문구/색상 UI 조정 가능
- 비어 있을 땐 반투명, 들어가면 선명해짐

### 캐릭터 이동 위젯
- place 모드: 고스트 미리보기 + 집게 이동 애니메이션
- drive 모드: WASD 이동, 대각선, QE 회전, Space 점프
- 케이지 참가자는 케이지 안에서만 이동 가능

---

## 채팅 명령어

실제 표시 문구는 그룹에서 `/commands` 또는 `/help`로 확인할 수 있습니다.

**일반 명령:**

| 명령어 | 설명 |
| --- | --- |
| `/commands`, `/help` | 명령어 도움말 |
| `/fire` | 비디오챗 캐릭터 위치에서 폭죽 효과 |
| `/cheer` | 기본 5초 응원봉 효과 |
| `/cheer 30` | 30초 응원봉. 최대 600초 |
| `/cheer off` | 응원봉 중지 |

**관리/운영 명령:**

| 명령어 | 설명 |
| --- | --- |
| `/check_level` | 대상 레벨/역할 확인 |
| `/level_scan` | 레벨 목록 확인 |
| `/level_up` | 레벨 수동 조정 |
| `/add_role`, `/remove_role`, `/reset_role`, `/check_role` | 역할 관리 |
| `/stt_on`, `/stt_off` | STT 토글 |
| `/here_on`, `/here_off` | 현장/참여 상태 토글 |

예전 수동 스트림 감시 명령(`stream_watch`, `unwatch`)은 자동 수신 방식으로 대체되어 legacy 처리되어 있습니다.

---

## 레벨 시스템

기본 흐름:

- 채팅을 하면 레벨 기록 생성
- 비디오챗에 들어오면 비디오챗 참여 기록 반영
- `/cheer` 또는 `/fire` 사용 시 레벨 3 조건 만족
- `/cheer`와 `/fire` 모두 사용 시 레벨 4 조건 만족
- 관리자가 `/level_up`으로 수동 조정 가능
- 수동으로 레벨을 내리면 cheer/fire 기록도 기준 시점 이후로 다시 판단

레벨 메시지는 입장/퇴장 이벤트와 함께 오버레이 이벤트 카드에 표시됩니다.

레벨 정책은 방송마다 성격이 달라서, LLM에게 다음 파일과 원하는 운영 규칙을 보여주고 커스텀 지시하는 방식을 권장합니다.

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

---

## 자주 겪는 문제

### `PortAudio library not found`

```bash
sudo apt install -y portaudio19-dev
```

설치 후 가상환경에서 다시 실행합니다.

### WSL2에서 STT 마이크가 안 잡힘

먼저 WSL2 안에서 입력 장치가 보이는지 확인합니다.

```bash
pactl info
pactl list short sources
uv run python - <<'PY'
import sounddevice as sd
print(sd.query_devices())
print("default:", sd.default.device)
PY
```

- `pactl info`가 실패하면 WSLg/오디오 연결 문제입니다. Windows 마이크 권한과 `wsl --update`를 확인합니다.
- `pactl`에는 보이는데 Python에 안 보이면 `portaudio19-dev`와 `sounddevice` 설치 상태를 확인합니다.
- `STT_INPUT_DEVICE`는 임의 이름이 아니라 `sounddevice` 목록에 실제로 뜨는 이름 일부를 넣어야 합니다.
- 장치 선택이 헷갈리면 `STT_INPUT_DEVICE=`로 비워두고 OS 기본 입력으로 먼저 테스트합니다.

### WSL2에서 `tdjson.dll`을 찾으려고 함

WSL2/Linux에서는 `.dll`이 아니라 `libtdjson.so`가 필요합니다.

```bash
scripts/build_tdlib_linux.sh
```

또는 `.env`의 `TDLIB_JSON_PATH`를 Linux용 `.so` 파일로 지정합니다.

### 부계정이 비디오챗 화면을 못 받음

- `TGCALLS_SESSION` 경로에 로그인 세션이 있는지
- `TD_API_ID`, `TD_API_HASH`가 설정되어 있는지
- 부계정이 대상 그룹/비디오챗에 접근 가능한지
- UI의 자동 참가 설정과 실제 부계정 참가 상태

### 로그인 스크립트에서 `database is locked`

같은 Telethon 세션 파일을 여는 프로세스가 남아 있을 때 생깁니다. 먼저 서버와 중복 로그인 helper를 끕니다.

```bash
pkill -f 'telegram_login_session.py --session data/telethon/videochat_overlay' || true
pkill -f 'telegram_login_session.py --session data/telethon/stt_sender' || true
pkill -f 'telegram_login_session.py --session data/telethon/videochat_receiver' || true
```

원격 테스트 WSL처럼 세션을 새로 만들어도 되는 환경에서는 잠긴 로컬 세션을 삭제하고 다시 로그인할 수 있습니다.

```bash
TG_LOGIN_DROP_LOCKED=1 scripts/login_main_account.sh
TG_LOGIN_DROP_LOCKED=1 scripts/login_sub_account.sh
```

### Chrome에서는 web/YouTube 위젯이 안 됨

정상입니다. web/YouTube는 Electron 네이티브 BrowserView를 사용합니다. Chrome에서는 3D 오버레이와 일반 위젯 테스트만 보고, web/YouTube는 Electron 앱에서 확인합니다.

### 게임 위젯이 ROM을 못 찾음

ROM은 `data/rom/` 아래에 둡니다.

```bash
ls data/rom
```

`/api/game/roms`가 ROM 목록을 반환해야 합니다.

### 봇이 자기 메시지를 못 받음 / 그룹 메시지를 못 받음

- BotFather에서 Group Privacy를 끄고, 그룹에서 봇을 뺐다 다시 초대해야 일반 메시지가 들어옵니다.
- 봇은 자기가 보낸 메시지를 `getUpdates`로 받지 못합니다 (정상 동작).

### `409 Conflict`로 봇이 죽음

같은 `BOT_TOKEN`으로 두 프로세스가 동시에 polling 중일 때입니다. 다른 Python 프로세스가 살아 있는지 확인하세요.

```bash
ps aux | grep main.py    # WSL2/Linux
# Get-Process python     # Windows PowerShell
```

---

## 참고 자료

### 폴더 구조

| 경로 | 설명 |
| --- | --- |
| `main.py` | Telegram 봇, 채팅 서버, 레벨 시스템, 명령어 |
| `videochat_overlay.py` | 비디오챗 3D 오버레이 서버, TgCalls 수신, 위젯 API |
| `static_videochat/` | 9393 오버레이의 HTML/CSS/JS |
| `tools/videochat_app/` | Electron 래퍼 앱 |
| `level_system.py` | 레벨 저장/승급/역할 로직 |
| `level_reasons.example.json` | 레벨별 메시지 예시 |
| `scripts/build_tdlib_linux.sh` | WSL2/Linux용 `libtdjson.so` 빌드 스크립트 |
| `scripts/login_main_account.sh` | 메인계정 Telethon 세션 로그인 스크립트 |
| `scripts/login_sub_account.sh` | 부계정 TgCalls receiver 세션 로그인 스크립트 |
| `scripts/telegram_login_session.py` | 공통 Telethon 로그인 helper |
| `data/` | 로컬 실행 데이터(세션/설정/프로필/ROM). **커밋 금지** |
| `vendor/tdlib/` | TDLib 바이너리 위치. **커밋 금지** |

### 설정 파일

#### `.env`

실제 실행 설정. 로컬 전용.

| 항목 | 설명 |
| --- | --- |
| `BOT_TOKEN` | BotFather 봇 토큰 |
| `CHAT_ID` | 대상 그룹 ID |
| `OWNER_ID` | 명령어 허용 사용자 ID |
| `WEB_HOST`, `WEB_PORT` | 채팅 서버 주소. 기본 `127.0.0.1:9292` |
| `TD_API_ID`, `TD_API_HASH` | Telegram user API 값 |
| `TD_VIDEOCHAT_LINK` | 대상 비디오챗 링크 |
| `VIDEOCHAT_WEB_HOST`, `VIDEOCHAT_WEB_PORT` | 비디오챗 서버. 기본 `127.0.0.1:9393` |
| `STT_INPUT_DEVICE` | STT 마이크 입력 장치 이름 일부. 비워두면 OS 기본 입력 사용 |
| `TG_MAIN_PHONE` | 메인계정 로그인 번호. 채팅/STT 전송과 비디오챗 상태 확인에 사용. **커밋 금지** |
| `TG_SUB_PHONE` | 부계정 로그인 번호. TgCalls receiver가 비디오챗 프레임을 받을 때 사용. **커밋 금지** |
| `TGCALLS_SESSION` | TgCalls receiver 부계정 세션 경로 |
| `TGCALLS_PHONE` | 예전 부계정 전화번호 env. 새 설정은 `TG_SUB_PHONE` 권장. **커밋 금지** |
| `TG_LOGIN_TIMEOUT`, `TG_LOGIN_CONNECT_TIMEOUT` | 로그인 스크립트 타임아웃 조정 |
| `TG_LOGIN_DROP_LOCKED` | 원격 테스트 WSL에서 잠긴 세션을 삭제하고 새로 로그인할 때만 `1`로 사용 |
| `VIDEOCHAT_TGCALLS_AUTO_JOIN` | 초기 자동 참가 기본값 (런타임 UI 설정도 반영) |
| `TDLIB_JSON_PATH`, `TDLIB_JSON_DLL` | TDLib 바이너리 강제 경로 (옵션) |

#### `data/videochat_overlay_settings.json`
오버레이 UI에서 조정한 위젯 위치/크기/UI 설정. 로컬 상태 파일이므로 커밋하지 않습니다.

#### `data/videochat_levels.json`
사용자 레벨/역할/효과 사용 기록. 운영 데이터이므로 커밋하지 않습니다.

#### `data/level_reasons.json`
레벨별 안내 문구. 파일이 없으면 `level_reasons.example.json`을 기반으로 자동 생성됩니다. 방송 콘셉트에 맞게 로컬에서 자유롭게 수정합니다.

### Electron 데이터 유지

Electron 앱은 로그인 정보와 창 위치를 로컬 데이터 디렉터리에 저장합니다.

- 개발 실행: 기본 repo의 `data/` 아래
- packaged Windows 앱: `%APPDATA%/tg-chat-obs-layout/videochat_app/` 아래

빌드할 때마다 로그인이 날아가지 않게 하려면 `TG_VIDEOCHAT_APP_DATA_DIR` 또는 `--data-dir=...`로 고정 경로를 지정합니다.

```bash
TG_VIDEOCHAT_APP_DATA_DIR=/home/na_stream/tg-chat-obs-layout/data/videochat_app npm run control
```

Windows에서도 같은 원리로 고정 데이터 폴더를 지정할 수 있습니다.

### 디버깅과 문법 체크

**Python 문법:**

```bash
uv run python -m py_compile main.py videochat_overlay.py level_system.py tgcalls_videochat_probe.py tdlib_videochat_probe.py
```

**JavaScript 문법:**

```bash
node --check static_videochat/app.js
node -e "const fs=require('fs'); const html=fs.readFileSync('static_videochat/game_player.html','utf8'); const m=html.match(/<script>([\\s\\S]*)<\\/script>/); new Function(m[1]); console.log('game_player script ok');"
```

**정적 파일 캐시:** 9393 서버는 개발 중 `/static/`, `/shared/`에 no-store 처리를 합니다. 그래도 이상하면 강력 새로고침 또는 Electron 재시작을 먼저 시도합니다.

**Electron 디버그:** Electron 앱은 네이티브 web/YouTube의 브라우저 이벤트와 콘솔 로그를 오버레이 쪽으로 전달합니다. 문제가 생기면 디버그 패널 또는 개발자 도구에서 확인합니다.

### 보안 규칙과 커밋 체크리스트

**절대 커밋 금지:**

- `.env`
- `data/`, `data/telethon/*.session`, `data/tdlib/`
- `vendor/tdlib/*.dll`, `*.so`, `*.dylib`
- `tools/videochat_app/dist/`
- Electron 프로필/로그인 정보
- `data/rom/` ROM 파일
- 스크린샷, 디버그 덤프, raw frame, 로그 파일

`.gitignore`가 위 항목을 기본 제외하지만, **커밋 전에는 반드시 스테이징 목록을 직접 확인**합니다.

```bash
git status --short
git diff --check
git diff --cached --name-only
```

스테이징 목록에 다음이 보이면 커밋을 멈춥니다.

- `.env`
- `data/`
- `vendor/tdlib/`
- `*.session`, `*.db`, `*.sqlite`
- `*.gb`, `*.gbc`, `*.gba`
- `tools/videochat_app/dist/`
- 스크린샷/로그/디버그 덤프
