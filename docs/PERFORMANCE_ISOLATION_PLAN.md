# Performance Isolation Plan

이 문서는 9393 오버레이가 비디오 프리뷰, 채팅, 위젯, 게임을 동시에 처리할 때 한 부분의 부하가 전체 UI를 멈추지 않게 분리하는 단계 기록이다.

## 1. Electron Native Chat View

상태: 구현됨.

Electron 앱에서는 9393 페이지 안의 오른쪽 채팅 DOM을 숨기고, 같은 위치에 9292 채팅 페이지를 별도 투명 `BrowserWindow`로 겹쳐 띄운다. 9393은 말풍선, 캐릭터 효과, 게임 입력용 채팅 이벤트 수신은 계속 유지하지만, 오른쪽 채팅 로그와 전송 UI 렌더링은 9292 전용 Electron 창이 담당한다.

효과:

- 9292 채팅 UI가 9393 Three.js/비디오 프리뷰 렌더링과 DOM 트리를 공유하지 않는다.
- 9292가 별도 renderer/OS 창으로 동작하므로 같은 창 내부 `BrowserView`보다 9393 compositor 부하와 덜 묶인다.
- 9393이 순간적으로 무거워져도 채팅 입력 UI가 덜 같이 막힌다.
- 크롬에서 9393을 단독 테스트할 때는 기존 내장 채팅 UI가 그대로 보인다.

실행 전제:

- 9292 서버와 9393 서버가 모두 떠 있어야 한다.
- Electron은 `--url=http://127.0.0.1:9393/ --control` 기준으로 9292 주소를 자동 추론한다.
- 필요하면 `--chat-url=http://127.0.0.1:9292/` 또는 `--chat-port=9292`로 오버라이드한다.
- OBS가 Electron 메인 창만 정확히 Window Capture하는 방식이면 별도 채팅창이 빠질 수 있다. 디스플레이 캡처/영역 캡처는 보이는 그대로 잡히고, 필요하면 OBS에 채팅창을 별도 Window Capture로 추가한다.

## 2. Web Worker Split

상태: 예정.

브라우저 메인 스레드에서 꼭 처리할 필요가 없는 계산을 Web Worker로 옮긴다.

후보:

- 가격 위젯 데이터 정리와 미니 차트 샘플링
- 게임 집단 입력 투표 집계
- 과도한 debug/client-log batching
- 비디오 프리뷰 상태 diff 계산

주의:

- Three.js DOM/scene 조작은 메인 스레드에 남긴다.
- Worker는 순수 데이터 계산만 맡기고, UI 반영은 작은 patch 메시지로 되돌린다.

## 2.5 Send Path Decoupling

상태: 구현됨.

9292의 `/api/send`는 기본적으로 Telegram 전송 완료까지 기다리지 않고 내부 큐에 넣은 뒤 즉시 응답한다. 실제 Telegram 전송은 `telegram-send-worker`가 순서대로 처리한다.

효과:

- Electron/9393 영상 프리뷰 부하가 있는 상황에서도 send 버튼이 Telegram API 지연에 묶이는 시간을 줄인다.
- 실패 여부는 9292 콘솔의 `[SEND] queued_ok`, `[SEND] queued_failed`, `[SEND] queued_exception` 로그로 확인한다.

설정:

- `TELEGRAM_USER_SEND_ASYNC=1`: 기본값, 큐 방식 사용
- `TELEGRAM_USER_SEND_ASYNC=0`: 이전처럼 `/api/send` 요청에서 Telegram 전송 완료까지 대기
- `TELEGRAM_USER_SEND_QUEUE_MAX=100`: 큐 최대 길이

주의:

- 이 단계는 UX 지연을 줄이는 개선이지, 영상 프리뷰 부하 자체를 제거하는 근본 해결은 아니다.
- Electron 안에서 9393 영상 렌더와 9292 BrowserView가 같은 Chromium/GPU 인프라를 공유하므로, 영상 렌더가 심하게 무거우면 클릭/입력 이벤트 자체가 늦을 수 있다.

## 3. Video Preview Isolation

상태: 예정.

비디오챗 프리뷰와 큰 화면 전환을 채팅/위젯과 더 분리한다.

후보:

- 썸네일 프리뷰는 저해상도 저FPS MJPEG 유지
- 큰 화면은 720p 30fps 유지
- 프리뷰별 연결을 독립적으로 유지하고, 참가자 변경 시 전체 프리뷰 재연결을 피한다.
- 장기적으로는 MJPEG 대신 WebRTC/H.264/NVENC 경로를 검토한다.

목표:

- 누군가 비디오를 켜거나 끌 때 다른 프리뷰가 검게 초기화되지 않게 한다.
- 큰 화면을 열 때 썸네일을 먼저 보여주고 고화질 프레임이 오면 자연스럽게 전환한다.

## 4. Server Split

상태: 예정.

현재 9292 채팅 서버와 9393 오버레이 서버 구조를 더 명확히 나누고, 필요하면 미디어 전용 서버를 추가한다.

가능한 분리:

- 9292: Telegram 채팅, 전송, 삭제, 답장, STT 입력
- 9393: 3D 오버레이, 캐릭터, 위젯 상태
- 94xx: 비디오챗 프리뷰/스트림 인코딩 전용

원칙:

- 비밀 설정 파일, 세션, 토큰, 전화번호, 계정 정보, Electron 프로필, ROM은 읽거나 커밋하지 않는다.
- 외부 공개가 필요한 서버는 별도 인증/읽기 전용 정책 없이는 열지 않는다.
- 로컬 개발 기본값은 `127.0.0.1` 유지.
