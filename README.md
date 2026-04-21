# tg-chat-obs-layout

텔레그램 그룹 채팅을 **OBS 방송 화면에 투명 배경 오버레이**로 띄우는 프로그램. 윈도우 환경 기준.

추가로:
- 그룹 권한 토글 (`/stream_on`, `/stream_off`)
- 호스트 음성을 실시간 STT로 전환해서 봇이 대신 채팅치기 (`/tts_on`, `/tts_off`)

---

## 무엇을 하는가

```
  호스트(나)                      방송 시청자
     │                                │
     │ 1. 텔레그램 그룹에서 채팅       │
     │ 2. 마이크로 말하면 봇이 받아    │
     │    텍스트로 그룹에 포스팅      │
     ▼                                ▼
  ┌──────────────────┐        ┌──────────────────┐
  │ 텔레그램 그룹    │───봇───▶│ OBS 방송 화면에  │
  │ (채팅 오고감)     │        │ 말풍선으로 흐름   │
  └──────────────────┘        └──────────────────┘
```

**결과**: 트위치·유튜브 라이브처럼 채팅 오버레이가 OBS 화면에 투명하게 떠서 시청자가 실시간으로 대화 내용을 봄.

---

## 기능

### 채팅 오버레이
- 텔레그램 그룹 메시지를 OBS 화면에 투명 배경 말풍선으로 실시간 표시
- 유저마다 자동 색상 배정, 한 번 배정되면 영구 유지
- 메시지 N초 후 페이드아웃 (설정 가능, `-1` 이면 계속 남음)
- 이모지·한국어 그대로 표시

### 봇 명령어
본인(설정한 `OWNER_ID`) 만 실행 가능. 다른 사람이 치면 조용히 무시.

| 명령 | 효과 |
|---|---|
| `/stream_on` | 그룹에서 **텍스트 + 사진**만 허용. 스티커/GIF/영상/음성/파일은 차단 |
| `/stream_off` | 호스트를 제외한 모든 비관리자 음소거 (방송 중 소란 방지) |
| `/tts_on` | 마이크 입력을 STT로 받아서 봇이 그룹에 대신 채팅. 오버레이에도 동시 표시 |
| `/tts_off` | 마이크 해제 |

---

## 준비물

1. **Windows 10/11 PC**
2. **Python 3.10+** (개발은 3.13에서 확인)
3. **[uv](https://docs.astral.sh/uv/)** (Python 패키지 매니저 — 아래 설치 방법 있음)
4. **OBS Studio**
5. **텔레그램 계정** + 관리할 **그룹(슈퍼그룹)**
6. **BotFather로 만든 봇**
7. **OpenAI API key** (STT 쓸 경우)

---

## 설치 — 처음부터 차근차근

### 1. Python 설치

이미 있으면 건너뛰기. 버전 확인:
```cmd
python --version
```
`3.10` 이상이면 OK. 없으면 [python.org](https://www.python.org/downloads/) 에서 설치 (설치 시 **"Add Python to PATH"** 반드시 체크).

### 2. uv 설치

PowerShell에서:
```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```
설치 후 새 터미널 열어서:
```cmd
uv --version
```
버전 뜨면 성공.

### 3. 이 프로젝트 받기

```cmd
cd D:\원하는\경로
git clone <저장소_주소> tg-chat-obs-layout
cd tg-chat-obs-layout
```
아직 원격 저장소 없으면 폴더 그대로 복사해서 쓰기.

### 4. 가상환경 + 의존성 설치

```cmd
uv venv
uv pip install -r requirements.txt
```
`.venv/` 폴더가 생기면 성공.

---

## 텔레그램 설정

### 1. 봇 만들기

1. 텔레그램에서 **[@BotFather](https://t.me/BotFather)** 검색
2. `/newbot` 입력 → 안내대로 이름 설정
3. **봇 토큰** 받음 (예: `1234567890:AAH...`) — **절대 공개 금지**
4. 같은 대화에서 `/mybots` → 방금 만든 봇 선택 → **Bot Settings** → **Group Privacy** → **Turn off**
   > 이거 안 하면 봇이 그룹 메시지를 못 읽어서 오버레이에 아무것도 안 뜸.

### 2. 그룹 준비

1. 기존 그룹 쓰거나 **새로 그룹 생성 → 슈퍼그룹으로 전환** (일반 그룹은 `-100...` ID 안 됨)
2. 봇을 그룹에 **초대**
3. 봇을 **관리자로 승격**
   - 그룹 설정 → 관리자 → 관리자 추가 → 봇 선택
   - 권한 중 **Restrict members** (멤버 제한) **반드시 켜기** — `/stream_on`·`/stream_off` 에 필요

### 3. 필요한 ID 알아내기

**채팅방 ID 확인 방법**:
1. 그룹에 [@userinfobot](https://t.me/userinfobot) 초대
2. 아무 메시지 치면 그룹 ID 보여줌 (예: `-1003685537332`)
3. 확인 끝나면 봇 제거

**본인 유저 ID 확인 방법**:
1. 본인이 [@userinfobot](https://t.me/userinfobot) 에 1:1 `/start`
2. 본인 ID 알려줌 (예: `84963653`)

---

## OpenAI API key 발급 (STT 쓸 때만)

STT 기능 없이 오버레이만 쓸 거면 건너뛰기.

1. [platform.openai.com](https://platform.openai.com/api-keys) 접속
2. **Create new secret key** → 복사 (한 번만 보임)
3. [Billing](https://platform.openai.com/account/billing/overview) 에서 결제수단 등록 & 크레딧 충전
   - `gpt-4o-mini-transcribe` 는 분당 $0.003 수준이라 $5 충전하면 한참 씀

---

## `.env` 파일 만들기

프로젝트 루트에서:
```cmd
copy .env.example .env
```

`.env` 를 메모장/VSCode 로 열어서 **본인 값으로 채우기**:

```bash
# 필수
BOT_TOKEN=1234567890:AAH...여기에_실제_토큰
CHAT_ID=-1003685537332
OWNER_ID=84963653

# 오버레이 (기본값 유지 OK)
WEB_HOST=127.0.0.1
WEB_PORT=9292
FADE_AFTER_SEC=30

# STT 쓸 때만
STT_PROVIDER=openai
OPENAI_API_KEY=sk-...여기에_실제_키
STT_MODEL_OPENAI=gpt-4o-mini-transcribe
STT_LANGUAGE=ko
STT_INPUT_DEVICE=
```

> ⚠️ **주의**: `.env` 는 `.gitignore` 에 포함돼 있어 git 커밋 안 됨. 공유 시 반드시 `.env.example` 만 공유.
>
> ⚠️ **주석 같은 줄 금지**: `STT_INPUT_DEVICE=  # 주석` 이렇게 쓰면 `# 주석` 이 값으로 들어감. 주석은 **별도 줄**에.

### 마이크 선택 (`STT_INPUT_DEVICE`)

비우면 OS 기본 마이크 사용. 특정 마이크 지정하려면 이름 일부:
```
STT_INPUT_DEVICE=RODE
STT_INPUT_DEVICE=Blue Yeti
STT_INPUT_DEVICE=NVIDIA Broadcast
```

시스템에 설치된 마이크 목록 확인:
```cmd
uv run python -c "import sounddevice as sd; [print(i,d['name']) for i,d in enumerate(sd.query_devices()) if d['max_input_channels']>0]"
```

---

## 실행

```cmd
uv run python main.py
```

정상 기동 시 CMD 출력:
```
[INFO] Overlay: http://127.0.0.1:9292/  (OBS Browser Source)
[INFO] Bot @yourbot listening chat -100... ...
```

그룹에 아무 메시지 보내면 CMD 에 찍힘:
```
홍길동: 테스트메시지
```

안 찍히면 → **Privacy Mode 꺼진 것 맞는지 재확인**.

---

## OBS 에 오버레이 띄우기

1. OBS 에서 **소스** 패널 → `+` 버튼 → **브라우저**
2. "새로 만들기" → 이름 지정 (예: "Telegram Chat")
3. 설정 창에서:
   - **URL**: `http://127.0.0.1:9292/`
   - **너비**: `500` (취향)
   - **높이**: `900` (취향)
   - **"OBS가 소스를 표시하지 않을 때 종료"**: **체크 해제** (중요 — 안 끄면 장면 전환할 때마다 연결 끊김)
4. **확인**
5. 방송 캔버스에 드래그로 위치·크기 조정

**투명 배경은 자동 적용**됨 (OBS 브라우저 소스는 HTML의 alpha channel 네이티브 지원). 테스트로 브라우저에서 `http://127.0.0.1:9292/` 열어보면 흰 배경 위에 메시지만 뜨는 것처럼 보이는데, OBS 에선 배경이 완전 투명.

### 스타일 바꾸기

`static/style.css` 수정 → **OBS 브라우저 소스 우클릭 → "새로 고침"** 누르면 즉시 반영. Python 재시작 안 해도 됨.

주요 조정 포인트:
- **폰트 크기**: `.msg { font-size: 22px; ... }` 값 변경
- **말풍선 투명도**: `background: rgba(15, 18, 24, 0.62);` 의 `0.62` 값 (0 = 완전투명, 1 = 완전불투명)
- **위치**: `#chat { left: 16px; right: 16px; bottom: 16px; }` 값 변경
- **최대 메시지 수**: `static/app.js` 의 `MAX_MESSAGES = 50`

---

## STT (음성 채팅) 사용법

### 단독 테스트 (텔레그램 없이 CMD 확인만)

```cmd
uv run python test_stt.py --provider openai
```
말하면 `>>> 인식된 텍스트` 찍힘. `Ctrl+C` 로 종료.

디버그 모드 (WebSocket raw 이벤트 전부 찍음):
```cmd
uv run python test_stt.py --provider openai --debug
```

### 실제 방송에서 쓰기

`main.py` 돌아가는 상태에서 그룹에 `/tts_on` 입력:
- 봇이 **"TTS 시작: openai 백엔드로 CMD에 출력 중"** 이라고 답장
- 이제 마이크로 말하면:
  1. CMD: `[STT] 봇이름: 인식된 텍스트`
  2. 오버레이: 봇 색상으로 말풍선
  3. 텔레그램 그룹: 봇이 텍스트로 포스팅 → 시청자가 그룹에서 확인 가능
- `/tts_off` 치면 마이크 해제

### 권장 방송 플로우

```
방송 시작 전: /stream_off   ← 일반 유저 채팅 차단
방송 중:      /tts_on       ← 호스트 음성 → 봇이 대신 채팅
방송 끝:      /tts_off
              /stream_on    ← 일반 유저 채팅 복구
```

---

## 문제 해결

### `BOT_TOKEN 이 비어 있습니다`
`.env` 파일이 없거나 토큰 비어있음. `.env.example` 복사해서 채우기.

### 오버레이는 뜨는데 메시지 안 찍힘
BotFather 에서 **Group Privacy** 가 Turn on 상태. `/mybots → 봇 → Bot Settings → Group Privacy → Turn off` 후 **봇을 그룹에서 뺐다가 재초대**.

### `409 Conflict: terminated by other getUpdates`
같은 봇 토큰으로 두 번 돌리고 있다는 뜻. 이전 프로세스가 살아있을 확률 큼:
```powershell
Get-Process python | Stop-Process -Force
```
정리 후 다시 실행.

### `권한 변경 실패` (stream_on/off)
봇이 그룹 관리자가 아니거나, 관리자여도 **Restrict Members** 권한이 꺼져 있음. 그룹 설정에서 봇 관리자 권한 다시 확인.

### 포트 9292 충돌
`.env` 의 `WEB_PORT` 를 다른 숫자(예: `9300`)로 변경. OBS 브라우저 소스 URL 도 같이 변경.

### `/tts_on` 답장은 오는데 말해도 CMD 에 안 뜸
- 마이크가 OS 기본이 아닌 다른 것일 수 있음 → `STT_INPUT_DEVICE` 에 올바른 마이크 이름 지정
- API key 크레딧 바닥났거나 잘못됨 → `test_stt.py --debug` 로 디버그 로그 확인

### 텔레그램에 봇 메시지는 오는데 오버레이에 안 뜸
봇이 보낸 메시지는 `getUpdates` 로 돌아오지 않음. 코드 상 STT 결과를 오버레이 WebSocket 으로 **직접 broadcast** 하는데, 이게 실패했을 수 있음. CMD 로그에 `dispatch error` 가 찍히는지 확인.

### Gemini 로 연결은 되는데 transcript 안 옴
Gemini Live API 는 **유료 결제** 등록된 계정에서만 preview 접근 가능. 무료 티어 키는 setup 은 되지만 실제 transcription 이 안 옴. OpenAI 쓰는 게 안전.

---

## 개발자 정보

아키텍처·알려진 이슈는 [CLAUDE.md](./CLAUDE.md) 참조.

### 주요 의존성
- `pyTelegramBotAPI` — 텔레그램 봇 polling
- `fastapi` + `uvicorn` — 로컬 웹서버 + WebSocket
- `sounddevice` + `numpy` — 마이크 캡처
- `websockets` — STT WebSocket 클라이언트
- `python-dotenv` — `.env` 로드

### 디렉토리 구조
```
main.py                # Telegram + FastAPI + STT 오케스트레이터
test_stt.py            # STT 단독 테스트
stt/                   # STT 백엔드 모듈
  manager.py
  openai_backend.py
  gemini_backend.py
static/                # 오버레이 프론트엔드
  index.html
  style.css
  app.js
data/                  # 런타임 데이터 (.gitignore)
  user_colors.json
```
