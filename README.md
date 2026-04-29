# tg-chat-obs-layout

**텔레그램 그룹 채팅을 OBS 방송 화면에 띄우는 프로그램** (윈도우용)

```
  텔레그램 그룹 채팅        →         OBS 방송 화면
  "안녕하세요~"                        [투명 배경에 말풍선으로 뜸]
```

## 할 수 있는 것

1. **채팅 오버레이** — 텔레그램 그룹의 채팅이 OBS에 말풍선으로 실시간 표시 (트위치·유튜브 채팅창처럼)
2. **사진 표시** — 그룹에 올린 사진도 오버레이에 보임
3. **방송 모드 전환** — 명령어 한 번으로 시청자 채팅 허용/차단
4. **음성 → 채팅** — 마이크에 말하면 AI가 자동으로 받아써서 봇이 대신 그룹에 채팅 (오버레이에도 같이 표시)

---

# 🛠 처음부터 설치 — 따라만 하세요

## 0단계. 이게 뭘 할지 먼저 이해하기

```
[호스트 PC]                              [시청자]
  ┌─────────────────┐
  │ 이 프로그램(Py) │ ←── 텔레그램 그룹 채팅 받아옴
  │  + OBS 브라우저 │
  │    소스         │
  └────────┬────────┘
           │ 방송
           ▼
        [YouTube / Twitch / ...]
```

호스트는 자기 PC에 이 프로그램을 돌리고, OBS에 "브라우저 소스" 라는 걸로 이 프로그램이 만드는 화면을 띄웁니다.
시청자는 그냥 방송만 봄 — 오버레이가 방송 화면 위에 합성돼서 나옴.

---

## 1단계. 필요한 것들

이 5개 전부 준비돼야 합니다:

| 항목 | 필요한 이유 |
|---|---|
| Windows PC | 이 프로그램이 윈도우 전용 |
| Python 3.10+ | 프로그램이 파이썬으로 돌아감 |
| OBS Studio | 방송용 프로그램 (무료) |
| 텔레그램 계정 | 채팅을 가져올 곳 |
| OpenAI API 키 | 음성→텍스트 변환 (STT 안 쓰면 생략 가능) |

### Python 설치 확인

CMD(명령 프롬프트) 열고:
```
python --version
```

`Python 3.10` 이상 숫자가 뜨면 OK. 아니면:
1. [python.org/downloads](https://www.python.org/downloads/) 에서 다운
2. **설치할 때 "Add Python to PATH" 체크박스 반드시 체크**

### uv 설치 (파이썬 패키지 관리 도구)

PowerShell 열고 (우클릭 → "관리자 권한으로 실행" 추천):
```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

설치 후 **새 터미널 다시 열고** 확인:
```
uv --version
```
버전 숫자 뜨면 성공.

---

## 2단계. 프로젝트 받기 + 설치

CMD 에서:
```cmd
cd D:\어디든\설치할곳
```

프로젝트 폴더 복사해서 넣거나, git 쓰면:
```
git clone <저장소_주소> tg-chat-obs-layout
cd tg-chat-obs-layout
```

설치:
```cmd
uv venv
uv pip install -r requirements.txt
```

`.venv` 폴더가 생기면 완료.

---

## 3단계. 텔레그램 봇 만들기 (한 번만 하면 됨)

### 3-1. 봇 만들기

1. 텔레그램에서 **[@BotFather](https://t.me/BotFather)** 검색 → 대화 시작
2. `/newbot` 입력
3. 봇 이름 대답 (예: `내방송채팅봇`)
4. 봇 사용자명 대답 (예: `my_stream_chat_bot`) — 반드시 `_bot` 으로 끝나야 함
5. **봇 토큰**이 나옴 (길고 이상한 문자열: `1234567890:AAH...`). 메모장에 복사해둘 것
6. 매우 중요한 설정 한 가지 — BotFather 한테:
   - `/mybots` → 방금 만든 봇 선택
   - `Bot Settings` → `Group Privacy` → `Turn off` 누르기
   - 이거 **안 하면 봇이 그룹 메시지를 못 읽어서 오버레이에 아무것도 안 뜸**

### 3-2. 그룹 만들기 + 봇 초대

1. 텔레그램에서 **새 그룹 만들기** (또는 기존 그룹 사용)
2. 그룹이 일반 그룹이면 **슈퍼그룹으로 전환** (그룹 설정 → 유형 → 채널/슈퍼그룹)
3. 그룹에 방금 만든 봇 추가
4. 그룹 설정 → **관리자** → 관리자 추가 → 봇 선택 → **"멤버 제한(Restrict members)" 권한 반드시 켜기**

### 3-3. 필요한 숫자 알아내기

이 프로그램은 두 가지 숫자가 필요합니다:
- **CHAT_ID**: 우리 방송할 그룹의 ID
- **OWNER_ID**: 내 텔레그램 계정 ID

알아내는 방법:
1. 텔레그램에서 **[@userinfobot](https://t.me/userinfobot)** 검색
2. 이 봇을 그룹에 잠깐 초대 → 그룹에 아무 글 쓰기 → 봇이 그룹 ID 답해줌 (예: `-1001234567890`) = **CHAT_ID**
3. 이 봇하고 1:1로 `/start` → 봇이 내 ID 알려줌 (예: `123456789`) = **OWNER_ID**
4. 확인 끝나면 그룹에서 userinfobot 빼도 됨

---

## 4단계. OpenAI API 키 (STT 쓸 때만)

음성으로 채팅 치는 기능(`/tts_on`) 안 쓸 거면 **건너뛰어도 됨**.

1. [platform.openai.com](https://platform.openai.com/api-keys) 로그인
2. **Create new secret key** 버튼 → 생성된 키 복사 (한 번만 보임!)
3. [Billing 페이지](https://platform.openai.com/account/billing/overview) 에서 **결제수단 등록 + 크레딧 $5 정도 충전**
   - 음성 인식 요금: 1분당 약 $0.003 (1시간 방송 = $0.18)
   - $5 넣으면 수십 시간 씀

---

## 5단계. 설정 파일 (.env) 만들기

프로젝트 폴더에서:
```cmd
copy .env.example .env
```

`.env` 파일을 메모장으로 열고 아래 값들 **전부 채우기**:

```bash
# 필수
BOT_TOKEN=여기에_3단계에서_받은_봇_토큰_붙여넣기
CHAT_ID=여기에_3-3에서_알아낸_그룹ID
OWNER_ID=여기에_3-3에서_알아낸_내ID

# 오버레이 (바꿀 필요 없음)
WEB_HOST=127.0.0.1
WEB_PORT=9292
FADE_AFTER_SEC=30

# STT (음성→채팅, 안 쓰면 비워둬도 됨)
STT_PROVIDER=openai
OPENAI_API_KEY=여기에_4단계에서_받은_키
STT_MODEL_OPENAI=gpt-4o-mini-transcribe
STT_LANGUAGE=ko
STT_INPUT_DEVICE=
```

**절대 하지 말 것:**
- 값 뒤에 같은 줄에 `#주석` 붙이지 말기. (`CHAT_ID=-1003... # 내 그룹` 처럼 쓰면 `# 내 그룹`이 값에 섞여 들어감)
- `.env` 파일 아무한테도 공유하지 말기 (토큰·API 키 = 비밀번호와 같음)

### 비디오챗 캐릭터 오버레이 설정

비디오챗 참가자 캐릭터 오버레이를 쓰려면 아래 값도 `.env`에 채웁니다.

```bash
VIDEOCHAT_WEB_HOST=127.0.0.1
VIDEOCHAT_WEB_PORT=9393
VIDEOCHAT_CHAT_WS_URL=ws://127.0.0.1:9292/ws

# 방장 표시. 가능하면 user id를 권장합니다.
VIDEOCHAT_HOST_USER_ID=
VIDEOCHAT_HOST_USERNAME=
VIDEOCHAT_HOST_NAME=Host
VIDEOCHAT_HOST_AVATAR_FILE=

# 레벨을 저장할 채팅방. 비워두거나 0이면 메인 채팅만 사용합니다.
VIDEOCHAT_LEVEL_CHAT_ID=0

# 방송마다 링크가 바뀌면 실행 인자로 넘겨도 됩니다.
TD_VIDEOCHAT_LINK=
```

방장 왕관과 `Lv. 99`가 안 보이면 `VIDEOCHAT_HOST_USER_ID` 또는 `VIDEOCHAT_HOST_USERNAME`이 실제 Telegram 계정과 일치하는지 먼저 확인하세요. `VIDEOCHAT_HOST_NAME`으로도 fallback 판정하지만, 같은 이름 사용자가 있을 수 있어 ID/username이 더 안전합니다.

### 마이크 고르기 (`STT_INPUT_DEVICE`)

비우면 OS 기본 마이크 사용. 특정 마이크 쓰려면 이름 일부만 쓰면 됨:
```bash
STT_INPUT_DEVICE=RODE         # 로데 마이크 쓸 때
STT_INPUT_DEVICE=Blue Yeti    # Yeti 마이크 쓸 때
STT_INPUT_DEVICE=NVIDIA       # NVIDIA Broadcast 거쳐서
```

**내 PC에 어떤 마이크 있는지 확인:**
```cmd
uv run python -c "import sounddevice as sd; [print(i, d['name']) for i, d in enumerate(sd.query_devices()) if d['max_input_channels']>0]"
```

---

## 6단계. 실행

CMD 에서:
```cmd
uv run python main.py
```

정상이면 이런 게 뜸:
```
[INFO] Overlay: http://127.0.0.1:9292/  (OBS Browser Source)
[INFO] Bot @내봇이름 listening chat -100... ...
```

**검증 시간:** 텔레그램 그룹에 아무 채팅 치기. CMD에 찍혀야 정상:
```
내이름: 안녕하세요
```

**찍히지 않으면** → 3-1번 6의 "Group Privacy Turn off" 다시 확인.

---

## 7단계. OBS에 연결

1. OBS 열기
2. "소스" 패널 → 아래 `+` 버튼 → **브라우저** 선택
3. "새로 만들기" → 이름 자유 (예: `Telegram Chat`) → 확인
4. 설정 창에서:
   - **URL**: `http://127.0.0.1:9292/` 붙여넣기
   - **너비**: 500 (취향대로)
   - **높이**: 900 (취향대로)
   - **"OBS가 소스를 표시하지 않을 때 종료"**: **체크 해제** ← 중요! 안 끄면 장면 바꿀 때마다 연결 끊김
5. 확인
6. 방송 캔버스에서 마우스로 위치·크기 조정

**배경은 투명하게 자동 적용**됩니다. OBS 화면에는 말풍선만 보이고 배경은 방송 화면이 비침.

---

# 📖 사용법

## 그룹에 있을 때 쓸 수 있는 봇 명령어

**본인(`.env` 의 `OWNER_ID`)만 실행 가능.** 다른 사람이 쳐봐야 봇이 무시함.

| 명령어 | 효과 |
|---|---|
| `/stream_on` | 시청자들이 텍스트+사진만 보낼 수 있게 함. 스티커/GIF/영상/음성/파일 차단 |
| `/text_on` | 텍스트만 허용 (사진도 차단). 방송 안 할 때 일반 대화용 |
| `/stream_off` | 호스트(나) 빼고 전부 음소거. 방송 중 소란 방지 |
| `/tts_on` | 마이크 켜서 말하는 내용 → 자동으로 봇이 친 곳에 채팅 (메인 그룹 또는 활성 댓글창) |
| `/tts_off` | 마이크 끔 (양쪽 모두 무조건 off) |
| `/here_on` | (공지채널 댓글창 등) 다른 채팅방의 댓글창에서 사용. 그 댓글창의 글도 오버레이에 같이 흘림 |
| `/here_off` | 활성 댓글창 해제 |

> 참고: 시청자가 `/lol`, `/ㅋㅋㅋ`, `/슬픔` 같이 슬래시 붙여서 장난식으로 쳐도 일반 채팅처럼 오버레이에 표시됩니다. 위 실제 관리 명령어만 봇이 먼저 가로채서 처리하고, 그 외 슬래시 메시지는 전부 통과.

### 공지채널 댓글창 모드 (`/here_on`)

방송을 공지채널에서 띄울 때, 시청자들이 메인 그룹 대신 **공지채널 특정 글의 댓글로 소통**하는 경우 사용:

1. 공지채널의 **연결된 토론 그룹(linked discussion group)** 에 봇 초대 + Privacy Mode OFF 확인
2. 시청자가 댓글로 모이는 그 글의 댓글창에 본인이 `/here_on` 입력
3. 봇이 "이 댓글창 오버레이 활성화" 답장 → 그 댓글창의 새 댓글들도 오버레이에 같이 뜸 (메인 그룹은 계속 표시됨)
4. 거기서 `/tts_on` 치면 → STT 결과가 그 댓글창에 댓글로 포스팅됨
5. 메인 그룹에서도 `/tts_on` 했으면 양쪽 모두에 STT 결과 들어감 (각자 토글 가능)
6. `/tts_off` → 양쪽 모두 STT 종료
7. `/here_off` → 댓글창 모드 해제

**제약**:
- 활성 댓글창은 한 번에 **하나만**. 새로 `/here_on` 치면 이전 것 자동 해제
- 댓글창 모드는 **저장 안 됨** (단발성). 봇 재시작하면 메인만 복구되고 댓글창은 다시 `/here_on` 필요

## 방송하는 날 표준 플로우

```
방송 시작 30분 전 ─── 이 프로그램 실행 (uv run python main.py)
                  ─── OBS 켜고 브라우저 소스 표시 확인

방송 시작 ────────── 그룹에 /stream_off → 일반 시청자 채팅 차단
                  ─── 그룹에 /tts_on → 내 목소리가 채팅으로 변환
                  ─── 말하면서 방송

방송 중 ─────────── 시청자들은 텔레그램 그룹에서 타이핑 대신
                     (호스트가 허용한 경우) 가끔 /stream_on 으로 열어주거나
                     그냥 반응만 받는 식

방송 끝 ─────────── /tts_off
                  ─── /stream_on (시청자들도 다시 편하게 채팅)
                  ─── 프로그램 Ctrl+C 로 종료
```

## 오버레이 스타일 바꾸기

폰트 크기, 색깔, 위치 등 바꾸려면 `static/style.css` 파일 수정. 수정 후 OBS에서:
- 소스 우클릭 → **"현재 페이지의 캐시 새로 고침"** (그냥 "새로 고침" 아님!)
- 또는 `main.py` 재시작하면 자동으로 반영됨 (캐시 버스터 자동)

자주 바꿀 만한 값:

```css
/* static/style.css */
.msg {
  font-size: 22px;                          /* 글자 크기 */
  background: rgba(15, 18, 24, 0.62);       /* 말풍선 투명도 (0=투명, 1=꽉 찬 검정) */
}
#chat {
  left: 16px;                               /* 왼쪽 여백 */
  bottom: 16px;                             /* 아래쪽 여백 */
}
```

사진 최대 크기:
```css
.msg-photo img {
  max-width: 360px;                         /* 사진 최대 너비 */
  max-height: 360px;                        /* 사진 최대 높이 */
}
```

메시지 몇 초 뒤 사라지게 할지는 `.env` 의 `FADE_AFTER_SEC`:
- `30` → 30초 후 사라짐
- `-1` → 안 사라짐
- `10` → 10초 후 사라짐

---

# 🔧 문제 해결

## "BOT_TOKEN 이 비어 있습니다" 오류
→ `.env` 파일 없거나 값 안 채움. `.env.example` 복사해서 채우기.

## 오버레이는 뜨는데 채팅이 안 보임
→ BotFather 에서 **Group Privacy 가 아직 Turn on 상태**.
1. `/mybots` → 봇 → Bot Settings → Group Privacy → **Turn off**
2. 그룹에서 봇을 **한 번 빼고 다시 초대** (설정 반영을 위해)

## `409 Conflict: terminated by other getUpdates` 오류
→ 같은 봇 토큰으로 프로그램이 두 번 돌고 있음. 확인:
```powershell
Get-Process python | Stop-Process -Force
```
(PowerShell에서 실행) 전부 종료 후 다시 시작.

## `/stream_on` 했는데 "권한 변경 실패" 답장
→ 봇이 그룹 관리자가 아니거나, 관리자인데 **"멤버 제한" 권한이 꺼져 있음**.
- 그룹 설정 → 관리자 → 봇 선택 → 권한 확인 → **멤버 제한 켜기**

## 포트 9292 이미 사용 중
→ `.env` 의 `WEB_PORT` 를 다른 숫자(예: `9300`)로 변경.
- OBS 브라우저 소스 URL도 `http://127.0.0.1:9300/` 으로 같이 바꾸기.

## `/tts_on` 답장은 오는데 말해도 반응 없음
- 마이크가 OS 기본이 아닌 엉뚱한 거일 수 있음 → `.env` 의 `STT_INPUT_DEVICE` 정확히 지정
- API 키 크레딧 바닥났을 수 있음 → platform.openai.com 빌링 확인
- 상세 디버깅:
  ```cmd
  uv run python main.py
  ```

## 사진이 오버레이에 안 뜸
1. 일반 브라우저로 `http://127.0.0.1:9292/photos/아까그파일이름.jpg` 접속 → 사진 뜨면 백엔드는 OK
2. OBS 소스 **우클릭 → "현재 페이지의 캐시 새로 고침"**
3. 그래도 안 되면: 브라우저 소스 삭제하고 같은 URL로 다시 추가

## 오버레이가 갑자기 텅 빔
→ 서버(Python) 가 죽었거나, WebSocket 연결 끊김.
- CMD 창 확인 (에러 메시지 있는지)
- 필요하면 재시작

---

# 💡 팁

- **방송 중에도 `main.py` 는 그대로 두세요** — 중간에 끄면 오버레이 사라짐
- **스타일은 방송 전에 미리 조정** — 방송 중에 바꾸면 시청자가 레이아웃 바뀌는 게 보임
- **오픈AI 크레딧 모니터링** — platform.openai.com 에서 사용량 주기적으로 확인
- **`/tts_on` 상태는 저장됨** — 프로그램 꺼도 다음 실행 시 자동 복구 (`data/state.json`)
- **유저 색깔도 저장됨** — 같은 사람은 매번 같은 색 (`data/user_colors.json`)

---

# 공개 저장소 보안 체크

이 저장소를 공개하기 전에 아래 항목을 확인하세요.

- `.env`, `data/`, `logs/`, `chrome-debug-profile/`, `debug_videochat*.png`가 커밋되지 않아야 합니다.
- `data/telethon/`에는 사용자 계정 세션이 저장됩니다. 절대 공유하지 마세요.
- `data/telethon/profile_photos/`와 `data/photos/`에는 참가자/채팅 사진이 저장될 수 있습니다. 공개하지 마세요.
- `.env.example`에는 실제 토큰, 실제 채팅 ID, 실제 초대 링크, 실제 username을 넣지 마세요.
- STT debug 로그는 API 응답/인식 텍스트를 많이 출력할 수 있으니 공유 전 확인하세요.

# 🗂 파일 구조 (참고)

```
tg-chat-obs-layout/
├── main.py              ← 메인 프로그램
├── .env                 ← 내 설정 (절대 공유 금지)
├── .env.example         ← 설정 템플릿
├── requirements.txt     ← 파이썬 라이브러리 목록
├── static/              ← 오버레이 웹페이지
│   ├── index.html
│   ├── style.css        ← 스타일 수정 위치
│   └── app.js
├── static_videochat/    ← 비디오챗 캐릭터 오버레이 웹페이지
├── videochat_overlay.py ← 비디오챗 캐릭터 오버레이 서버
├── docs/                ← 디자인 시안과 패치 계획
│   └── PATCH_PLAN.md
├── stt/                 ← 음성 인식 모듈
│   ├── manager.py
│   ├── openai_backend.py
│   └── gemini_backend.py
└── data/                ← 런타임 데이터 (자동 생성)
    ├── user_colors.json ← 유저별 색상
    ├── state.json       ← tts_on 상태
    └── photos/          ← 받은 사진 캐시 (최신 10개만)
```

개발자용 기술 세부정보는 [codex.md](./codex.md), 앞으로의 패치 메모는 [docs/PATCH_PLAN.md](./docs/PATCH_PLAN.md) 참고.
