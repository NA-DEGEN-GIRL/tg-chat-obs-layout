# YouTube/Web Native View Issues

이 문서는 Electron 앱의 YouTube/Web 위젯에서 남아 있는 native view 레이어 문제를 다른 LLM이나 개발자가 빠르게 검토할 수 있도록 정리한 것이다.

## 현재 구조

- 9393 오버레이는 일반 Chrome에서도 동작하는 DOM/Canvas/Three.js 기반 페이지다.
- Windows Electron 앱은 9393 페이지를 메인 `BrowserWindow`로 띄운다.
- YouTube 위젯과 Web 위젯은 iframe이 아니라 Electron `BrowserView`를 사용한다.
- 9393 renderer는 `window.tgElectronBrowser.upsert(...)`로 native view의 URL, bounds, fullscreen 상태, z 값을 main process로 보낸다.
- Electron main process는 `BrowserView`를 만들고 `mainWindow.addBrowserView(...)`, `view.setBounds(...)`, `mainWindow.setTopBrowserView(...)`로 배치한다.

## 왜 BrowserView를 쓰는가

- YouTube iframe/player는 로그인, 프리미엄 계정, 일부 영상 재생, 팝업/권한/브라우저 기능에서 한계가 있었다.
- 일반 web widget도 iframe/proxy 방식은 CSP, X-Frame-Options, 쿠키, 로그인, SPA, WebRTC 문제를 완전히 피하기 어렵다.
- 그래서 Electron 안에서는 native browser surface를 붙이는 방향으로 구현했다.

## 현재 남은 주요 증상

### 1. DOM 위젯과 native BrowserView z-index가 섞이지 않는다

증상:

- YouTube/Web 위젯 프레임 자체는 DOM 위젯이므로 일반 위젯과 z-index 정렬이 가능하다.
- 그러나 위젯 내부의 실제 YouTube/Web 화면은 `BrowserView`라서 DOM 위젯과 같은 z-index 레이어에 있지 않다.
- 결과적으로 다른 DOM 위젯이 YouTube/Web 위젯 위에 있어야 하는 상황에서도 native 화면이 그 위젯을 덮을 수 있다.
- YouTube/Web 두 native view끼리는 `setTopBrowserView`로 어느 정도 순서를 맞출 수 있지만, DOM 위젯과의 부분 겹침은 해결되지 않는다.

현재 판단:

- Electron `BrowserView`는 DOM 안의 div가 아니라 별도 native surface다.
- CSS z-index로 DOM 요소와 같은 레이어에 섞는 것은 불가능에 가깝다.

### 2. YouTube fullscreen / window resize / Esc 상태 불일치

증상:

- YouTube 위젯에서 full 모드로 전환한 뒤 Electron 창 크기를 조절하면 native view bounds가 stale 상태로 남을 때가 있었다.
- `Esc`를 누르면 BrowserView에서는 escape input이 들어오지만, 9393 상태는 이미 `fullscreen:false`로 기록되어 있어 `exitYoutubeWidgetFullscreen()`이 no-op으로 끝나는 경우가 있었다.

최근 보강:

- BrowserView와 main window 양쪽에서 Escape 입력을 감지한다.
- `youtube_escape_event`, `youtube_fullscreen_event`, `youtube_native_sync`, `electron_window_resize_event` client log를 추가했다.
- 9393 상태가 이미 fullscreen false여도 normal widget bounds를 강제로 다시 render/sync하도록 보강했다.

확인할 로그:

- 9393 콘솔:
  - `youtube_escape_event`
  - `youtube_fullscreen_event`
  - `youtube_native_sync`
  - `electron_window_resize_event`
- Electron app log:
  - `%APPDATA%/tg-chat-obs-layout/videochat_app/videochat_app.log`

## 이미 시도한 것

### A. BrowserView끼리 z-order 정렬

- 각 native view에 widget z 값을 보내고 `mainWindow.setTopBrowserView(...)` 순서를 조정했다.
- YouTube/Web끼리의 순서에는 도움이 된다.
- DOM 위젯과 native surface의 섞임 문제는 해결하지 못한다.

### B. native view가 있는 위젯 프레임을 항상 최상단으로 올리기

- BrowserView 내부 화면이 어차피 DOM 위를 덮으니, 프레임도 같이 최상단으로 올려 “프레임과 내용이 따로 노는” 느낌을 줄이는 시도를 했다.
- 단점: YouTube/Web 프레임까지 항상 다른 위젯보다 위에 떠서 사용자가 기대한 위젯 z-order와 어긋났다.
- 현재는 이 보정은 제거했고, 프레임은 일반 위젯 z-order를 따른다.

### C. 설정 패널이 열릴 때 native view 숨기기

- 설정 패널이 YouTube/Web native view 아래에 묻히지 않도록, 설정 패널 open 동안 YouTube/Web native view를 `visible:false`로 내렸다.
- 이 방식은 특정 UI에는 효과가 있지만 일반 위젯 겹침 문제 전체를 해결하는 것은 아니다.

## 가능한 해결책 후보

### 1. BrowserView 유지 + 겹침 시 native view 숨김

아이디어:

- DOM 위젯이 YouTube/Web viewport 위로 올라오면 해당 native view를 일시적으로 `visible:false` 처리한다.
- 겹침이 사라지면 다시 `visible:true`로 붙인다.

장점:

- 구현 난이도가 상대적으로 낮다.
- DOM 위젯이 native 화면에 가려지는 문제를 피할 수 있다.

단점:

- 겹치는 순간 YouTube/Web 화면 전체가 사라지거나 fallback 텍스트가 보인다.
- “부분적으로 가림”은 안 되고 “전체 숨김”에 가깝다.
- 영상은 계속 재생되게 할 수 있지만 시각적으로 깜빡일 수 있다.

### 2. BrowserView를 여러 조각으로 쪼개서 마스킹 흉내

아이디어:

- 겹치는 DOM 위젯 영역을 계산해서 BrowserView를 여러 사각형으로 나누거나 crop된 여러 view로 표현한다.

장점:

- 이론상 DOM 위젯 주변만 native 화면을 비우는 느낌을 만들 수 있다.

단점:

- Electron `BrowserView`를 한 페이지에 대해 여러 crop surface로 안정적으로 나누는 것은 복잡하고 현실성이 낮다.
- 입력 좌표, 스크롤, 영상 동기화, 성능, z-order 관리가 크게 복잡해진다.

### 3. BrowserView 포기 + 캡처/스트리밍 방식

아이디어:

- Electron main process 또는 별도 Chromium/Playwright가 실제 YouTube/Web 페이지를 렌더링한다.
- 그 결과를 screenshot/WebRTC/canvas/video stream으로 9393 DOM 안에 그린다.
- 입력은 9393에서 캡처해 원격 browser engine으로 전달한다.

장점:

- 결과 화면이 DOM/canvas/video 요소가 되므로 일반 위젯 z-index와 자연스럽게 섞인다.
- BrowserView 레이어 문제를 근본적으로 피한다.

단점:

- 지연이 생긴다.
- 오디오 전달, DRM/YouTube 정책, 로그인, 권한, WebRTC, 입력 정확도 문제가 새로 생긴다.
- BrowserView보다 구현/운영 복잡도가 훨씬 크다.

### 4. Electron `WebContentsView` / 최신 View API 검토

아이디어:

- Electron 버전에 따라 `BrowserView` 대신 `WebContentsView`/`BaseWindow` 계열 API를 사용할 수 있다.

검토 포인트:

- 이 API도 native surface라면 DOM z-index 문제는 그대로일 가능성이 높다.
- 그래도 BrowserView deprecation 또는 bounds/focus/fullscreen 동작 개선 여지가 있는지 확인할 가치가 있다.

### 5. UX 정책으로 native 위젯은 항상 최상단 취급

아이디어:

- YouTube/Web은 “실제 브라우저 surface”라서 항상 다른 DOM 위젯보다 위에 온다고 명시한다.
- 다른 위젯을 가리지 않도록 배치하는 UX로 정리한다.

장점:

- 안정적이고 구현이 단순하다.
- 로그인/YouTube 재생 fidelity를 유지한다.

단점:

- 자유 배치 위젯이라는 목표와 일부 충돌한다.
- 사용자가 겹쳐 놓았을 때 직관적이지 않다.

## 현재 선호 방향

현 시점에서 실사용 안정성을 우선하면:

1. BrowserView는 유지한다.
2. YouTube/Web 프레임은 일반 위젯 z-order를 유지한다.
3. 설정 패널처럼 꼭 위에 떠야 하는 UI는 native view를 임시로 숨긴다.
4. 일반 위젯 겹침은 UX 한계로 문서화하거나, 필요 시 “겹침 감지 시 전체 숨김” 옵션을 실험한다.

다른 LLM에게 물어볼 핵심 질문:

- Electron `BrowserView`/`WebContentsView`의 native surface를 DOM z-index와 같은 레이어로 섞는 공식/비공식 방법이 있는가?
- BrowserView를 유지하면서 특정 DOM rectangle만 위에 보이게 할 수 있는 실용적인 마스킹 방법이 있는가?
- YouTube 로그인/프리미엄/재생 fidelity를 유지하면서 DOM 레이어에 그릴 수 있는 더 나은 구조가 있는가?
- fullscreen/resize/Esc 상태 불일치를 더 robust하게 처리하는 Electron main-process 패턴이 있는가?
