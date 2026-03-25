# Game Hub

웹 기반 멀티플레이 게임 허브. 로비에서 방을 만들고 게임을 플레이한다.

## 기술 스택

- **모노레포**: Turborepo + pnpm
- **프론트엔드**: Next.js 15 (App Router) + React 19 + Tailwind CSS 4
- **백엔드**: Node.js + Express + Socket.IO
- **데이터 저장**: Redis (ioredis)
- **상태관리**: Zustand
- **테스트**: Vitest + React Testing Library
- **린터**: ESLint 9 (flat config)
- **공유 타입**: `@game-hub/shared-types`

## 주요 명령어

```bash
pnpm install                           # 의존성 설치
docker compose up redis -d             # Redis 시작 (포트 6389)
pnpm dev                               # 프론트(3000) + 백엔드(3001) 동시 실행
pnpm build                             # 전체 빌드
pnpm lint                              # 전체 린트
pnpm --filter @game-hub/server test    # 서버 테스트
pnpm --filter @game-hub/server lint    # 서버 린트
pnpm --filter web lint                 # 웹 린트
```

## 프로젝트 구조

- `apps/web` — Next.js 프론트엔드
- `apps/server` — Express + Socket.IO 서버
- `packages/shared-types` — 공유 TypeScript 타입

상세 구조와 패턴은 `.claude/rules/architecture.md` 참고.

## 게임 규칙 문서

| 게임 | 문서 | 요약 |
|------|------|------|
| 라이어 드로잉 (Liar Drawing) | `docs/games/liar-drawing.md` | 3~8인, 소셜 디덕션 그림 게임. 제시어를 모르는 라이어를 투표로 찾아내기 |
| 캐치마인드 (Catch Mind) | `docs/games/catch-mind.md` | 3~8인, 출제자가 그린 그림을 보고 채팅으로 정답을 맞추는 드로잉 퀴즈 게임 |
| 테트리스 (Tetris) | `docs/games/tetris.md` | 1~8인, 10×20 보드, 7-bag 랜덤, SRS 벽차기, T-Spin/콤보/B2B/Lock Delay, 클래식(대전 쓰레기줄)/스피드레이스(40줄 Sprint) 모드 |
| 오목 (Gomoku) | `docs/games/gomoku.md` | 2인, 15×15 보드, 5목 먼저 완성 시 승리. 금수 없음, 장목 허용, 흑/백 선택 가능 |
| 지뢰찾기 (Minesweeper) | `docs/games/minesweeper.md` | 1인, 초급(9×9)/중급(16×16)/고급(16×30) 난이도. 모든 안전한 칸을 열면 승리. 첫 클릭 안전 보장 |
| 텍사스 홀덤 (Texas Hold'em) | `docs/games/texas-holdem.md` | 2~8인, 홀카드 2장 + 커뮤니티 5장으로 최고 5장 조합 승부. 시작칩 1000, SB/BB 10/20 |

## 게임 공통 규칙

- **중도 이탈 처리**: 게임 진행 중 플레이어가 나가면(disconnect/leave) 해당 게임은 즉시 종료되고, 남은 모든 플레이어는 5초 후 로비로 이동한다. 인원 수나 게임 종류에 관계없이 동일하게 적용된다.
- **다시하기**: 게임 종료 후 방장만 "다시하기" 버튼이 노출된다. 방장이 누르면 방의 모든 플레이어와 관전자가 대기실로 복귀한다.
- **관전 모드** (`docs/spectator.md`): 모든 게임에서 최대 4명까지 관전 가능. 호스트가 "관전 허용" ON/OFF 설정 (기본값 OFF). 관전자는 waiting 상태에서 입장 가능하며, "게임 중 관전" 옵션 ON 시 playing 상태에서도 입장 가능하다. 게임 종료 후 대기실에 잔류한다. 관전자 이탈 시 게임이 종료되지 않는다. 비공개 정보(홀덤 홀카드, 라이어 역할/제시어, 캐치마인드 제시어)는 관전자에게 모두 공개된다. 관전자 채팅은 별도 ON/OFF 설정 (기본값 ON).
- **강퇴** (`docs/kick.md`): 방장이 waiting 상태에서 플레이어 또는 관전자를 개별 강퇴할 수 있다. 강퇴된 사용자는 로비로 자동 이동되며, 확인 다이얼로그를 거쳐 실행된다. 관전 허용 OFF 전환 시 관전자가 있으면 전원 일괄 강퇴된다.
- **방 이름 수정**: 방장이 대기실(waiting)에서 방 이름을 변경할 수 있다. 1~20자(trim 적용), `lobby:update-room-name` 이벤트로 대기실과 로비 방 목록에 실시간 반영된다.

## 랭킹 시스템

1인 플레이 게임(지뢰찾기, 테트리스 솔로)의 난이도별 Top 10 랭킹.

- **대상 게임**: 지뢰찾기 (완료 시간, 낮을수록 좋음), 테트리스 스피드 레이스 솔로 (클리어 시간, 낮을수록 좋음)
- **난이도별 분리**: 지뢰찾기 3종 + 테트리스 3종 (beginner/intermediate/expert) = 총 6개 랭킹
- **Top 10**: 난이도당 최대 10개 엔트리 저장
- **식별자**: 닉네임 (계정 시스템 없음)
- **서버 자동 등록**: 게임 종료 시 서버가 `game-handler.ts`에서 자동으로 랭킹 등록 (치팅 방지)
- **치팅 방지**: 지뢰찾기 최소 클리어 시간 (초급 3초/중급 15초/고급 35초) 미만은 랭킹 등록 거부, reveal 간 최소 50ms 간격 강제 (자동화 클릭 방지)
- **관리자 삭제**: 관리자가 로비 랭킹 카드에서 의심 기록을 삭제 가능 (`ranking:delete` 이벤트)
- **UI 위치**: 로비 (채팅 패널 하단 랭킹 카드) + 대기실 (게임 옵션 아래 랭킹 카드) + 게임 결과 (순위 표시, 1위 시 신기록 표시)
- **실시간 갱신**: `ranking:updated` 이벤트로 로비 및 대기실의 랭킹 카드가 자동 갱신
- **Redis 키**: `ranking:{gameType}:{difficulty}` (STRING, JSON 배열)
- **테트리스 랭킹 조건**: 스피드 레이스 솔로 모드에서 40줄 클리어 시에만 랭킹 등록 (시간 기반, 낮을수록 좋음). 클래식 모드 및 대전 모드는 제외

## 요청사항 게시판

로비 내 탭으로 접근하는 기능 요청 게시판. 모든 접속자가 요청을 등록하고, 관리자가 상태를 관리한다.

- **라벨**: `feature`(기능 요청, 기본값), `bug`(버그), `improvement`(개선), `new-game`(게임 추가) — 등록 시 필수 선택, 관리자가 모든 상태에서 변경 가능
- **상태**: `open`(요청) → `in-progress`(진행중) → `resolved`(완료) 또는 `rejected`(거부) 또는 `stopped`(중단)
  - open → in-progress: 관리자 수락 (선택적 답변)
  - open/in-progress → resolved: 관리자 완료 처리 (선택적 커밋 해시, 선택적 답변)
  - open/in-progress → rejected: 관리자 거부 (사유 필수)
  - open/in-progress → stopped: 관리자 중단 (사유 필수, 중복 요청 등)
  - rejected, resolved, stopped는 최종 상태 (되돌리기 불가, 삭제만 가능)
- **관리자 답변**: `adminResponse` 필드 — 거부/중단 시 필수, 수락/완료 시 선택
- **관리자 설정**: 환경변수 `ADMIN_NICKNAMES` (서버) — 쉼표 구분, 기본값 `"admin"`. 닉네임 인증 시 서버가 `isAdmin` 응답
- **GitHub 링크**: 환경변수 `GITHUB_REPO_URL` — 기본값 `https://github.com/csh0034/game-hub`
- **완료 처리**: 관리자가 커밋 해시 입력 (선택) → 입력 시 GitHub 커밋 페이지 링크 자동 생성, 미입력 시 링크 미표시
- **삭제**: 관리자가 요청사항 삭제 가능 (확인 다이얼로그 후 삭제)

## 관리자 공지

관리자가 접속 중인 모든 사용자에게 실시간 공지를 전송하는 기능.

- **접근**: 로비 탭 네비게이션에 "공지하기" 탭 (관리자에게만 노출)
- **UI**: 탭 클릭 시 모달 (텍스트 입력, 200자 제한)
- **전송**: `system:announce` → 서버에서 관리자 검증 후 `system:announcement`로 전체 브로드캐스트
- **수신**: 모든 접속자에게 화면 중앙 오버레이 모달 표시 (확인 버튼/ESC/배경 클릭으로 닫기)
- **저장**: 없음 (fire-and-forget, Redis 미사용)

## 규칙 파일 안내

| 파일 | 내용 |
|------|------|
| `.claude/rules/architecture.md` | 모노레포 구조, GameEngine 인터페이스, 프론트엔드 패턴, 게임 추가 흐름 |
| `.claude/rules/test-code.md` | 테스트 프레임워크, 네이밍, 모킹 패턴, 커버리지 우선순위 |
| `.claude/rules/commit.md` | Angular 커밋 컨벤션, scope 규칙 |
| `.claude/rules/workflow.md` | 코드 작성 후 린트 → 테스트 워크플로우 |
