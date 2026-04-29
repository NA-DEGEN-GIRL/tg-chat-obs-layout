# Patch Plan

이 문서는 앞으로 패치할 항목을 공개 repo 기준으로 추적하기 위한 메모다. 실제 토큰, 채팅 ID, 초대 링크, username은 적지 않는다.

## 보안/배포

- 공개 전 `git ls-files`에 `.env`, `data/`, `logs/`, `chrome-debug-profile/`, `debug_videochat*.png`, `vendor/tdlib/*.dll`이 없는지 확인한다.
- `.env.example`은 placeholder 또는 빈 값만 유지한다.
- Telethon 세션 파일은 `data/` 아래에만 저장한다.
- 프로필 사진과 채팅 사진 캐시는 개인정보로 취급하고 repo에 올리지 않는다.
- STT debug 로그 공유 전 인식 텍스트와 provider 이벤트를 확인한다.

## 비디오챗 오버레이

- 방장 판정은 `VIDEOCHAT_HOST_USER_ID` 우선, 그 다음 `VIDEOCHAT_HOST_USERNAME`, 마지막으로 `VIDEOCHAT_HOST_NAME` fallback을 사용한다.
- 참가자 입장/퇴장 효과는 실전 테스트 후 사용하지 않는 옵션을 정리한다.
- mock/preview 모드는 OBS 배치 확인용으로 유지하되 기본 비활성 상태를 유지한다.
- 제목, 채팅창, 이벤트 메시지 위치/크기 설정은 localStorage에 저장한다.
- 카메라 회전/피치/줌/화면 오프셋 설정은 OBS 장면별로 재현 가능해야 한다.

## 레벨/미니게임

- 신규 유저는 `Lv. 1`로 시작한다.
- 호스트는 `Lv. 99`와 crown 표시를 고정한다.
- 레벨 데이터는 우선 JSON 파일로 유지하고, 수천 명 규모에서 성능 문제가 생길 때 DB를 검토한다.
- 닉네임/username 변경은 같은 user id 레코드에 업데이트한다.

## 문서

- README는 사용자 설치/실행 중심으로 유지한다.
- `codex.md`는 개발자 작업 맥락, 보안 주의, 검증 명령을 기록한다.
- 기능 추가 시 이 파일에 후속 패치 후보와 삭제 예정 옵션을 남긴다.
