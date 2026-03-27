---
name: entropy-scan
description: 코드와 문서 간 정합성을 검사하여 엔트로피를 관리

---

게임 등록, 타입, 스토리지, 소켓 이벤트, 프론트엔드 구조의 정합성을 검사한다.

## 검사 절차

아래 6개 카테고리를 순서대로 검사하고 결과를 출력한다.

> 각 카테고리의 예시 테이블은 **출력 형식**을 보여주기 위한 것이며, 실제 출력은 스캔 결과에 따라 달라진다.

---

### 1. 게임 등록 정합성

각 게임이 아래 10곳에 모두 등록되어 있는지 확인한다.

**데이터 수집:**

1. `packages/shared-types/src/game-types.ts` — `GameType` 유니온의 리터럴 값들 추출 → **구현된 게임 목록**
2. `packages/shared-types/src/game-types.ts` — `GAME_CONFIGS` 객체의 키 추출
3. `apps/server/src/games/game-manager.ts` — `this.engines.set("...", ...)` 호출에서 게임 타입 추출
4. `apps/server/src/games/` — `*-engine.ts` 파일 존재 여부 확인 (게임 타입명과 파일명의 매핑: `texas-holdem` → `holdem-engine.ts`, 나머지는 `{gameType}-engine.ts`)
5. `apps/web/src/lib/game-registry.tsx` — `GAME_COMPONENTS` 객체의 키 추출
6. `apps/web/src/components/games/` — 게임별 컴포넌트 디렉토리 존재 확인
7. `docs/games/` — `{gameType}.md` 파일 존재 확인
8. `CLAUDE.md` — 게임 문서 테이블에 해당 게임이 있는지 확인
9. `docs/glossary.md` — 게임 섹션에 항목이 있는지 확인
10. `README.md` — 지원 게임 테이블에 해당 게임이 있는지 확인

**COMING_SOON_GAMES 검사:**
- `packages/shared-types/src/game-types.ts`의 `COMING_SOON_GAMES` 배열에서 게임 이름 추출
- 이 게임들은 docs(`docs/games/*.md`, `CLAUDE.md` 테이블, `docs/glossary.md`, `README.md` 테이블)에만 존재해야 하고, 구현 코드(GameType 유니온, GAME_CONFIGS, engine, game-manager, game-registry, 컴포넌트)에는 없어야 한다

**결과 출력:**

```markdown
## 1. 게임 등록 정합성

### 구현된 게임

| 체크포인트 | gomoku | texas-holdem | minesweeper | tetris | liar-drawing | catch-mind |
|---|---|---|---|---|---|---|
| GameType 유니온 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| GAME_CONFIGS | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| game-manager 등록 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 엔진 파일 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| game-registry | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 컴포넌트 디렉토리 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| docs 규칙 문서 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| CLAUDE.md 테이블 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| glossary 항목 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| README.md 테이블 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### Coming Soon 게임

> `COMING_SOON_GAMES` 배열이 비어 있으면 이 섹션은 "Coming Soon 게임 없음"으로 출력하고 테이블을 생략한다.

| 체크포인트 | {게임명} |
|---|---|
| docs 규칙 문서 | ✅ (있어야 함) |
| CLAUDE.md 테이블 | ✅ (있어야 함) |
| glossary 항목 | ✅ (있어야 함) |
| README.md 테이블 | ✅ (있어야 함) |
| 구현 코드 없음 | ✅ (없어야 함) |
```

---

### 2. 플레이어 수 정합성

3곳의 minPlayers/maxPlayers 값이 일치하는지 확인한다.

**데이터 수집:**

1. `packages/shared-types/src/game-types.ts` — `GAME_CONFIGS`의 각 게임 `minPlayers`, `maxPlayers`
2. `apps/server/src/games/*-engine.ts` — 각 엔진 클래스의 `minPlayers`, `maxPlayers` 속성
3. `docs/games/*.md` — 기본 정보 테이블의 플레이어 수 (예: "2명" → min=2, max=2 / "2~8인" → min=2, max=8 / "1인" → min=1, max=1 / "3~8인" → min=3, max=8)

**결과 출력:**

```markdown
## 2. 플레이어 수 정합성

| 게임 | GAME_CONFIGS | Engine | Docs | 일치 |
|---|---|---|---|---|
| gomoku | 2-2 | 2-2 | 2-2 | ✅ |
| texas-holdem | 2-8 | 2-8 | 2-8 | ✅ |
| minesweeper | 1-1 | 1-1 | 1-1 | ✅ |
| tetris | 1-8 | 1-8 | 1-8 | ✅ |
| liar-drawing | 3-8 | 3-8 | 3-8 | ✅ |
| catch-mind | 3-8 | 3-8 | 3-8 | ✅ |
```

---

### 3. 타입 완전성

각 게임의 State/Move 타입이 유니온에 포함되는지 확인한다.

**데이터 수집:**

1. `packages/shared-types/src/game-types.ts` — `GameState` 유니온에 포함된 타입들
2. `packages/shared-types/src/game-types.ts` — `GameMove` 유니온에 포함된 타입들
3. 각 게임별로 `{Game}State`/`{Game}PublicState`와 `{Game}Move` 타입이 정의되어 있고 유니온에 포함되는지 확인

**결과 출력:**

```markdown
## 3. 타입 완전성

| 게임 | State 타입 | GameState 유니온 포함 | Move 타입 | GameMove 유니온 포함 |
|---|---|---|---|---|
| gomoku | GomokuState | ✅ | GomokuMove | ✅ |
| texas-holdem | HoldemPublicState | ✅ | HoldemMove | ✅ |
| minesweeper | MinesweeperPublicState | ✅ | MinesweeperMove | ✅ |
| tetris | TetrisPublicState | ✅ | TetrisMove | ✅ |
| liar-drawing | LiarDrawingPublicState | ✅ | LiarDrawingMove | ✅ |
| catch-mind | CatchMindPublicState | ✅ | CatchMindMove | ✅ |
```

---

### 4. 스토리지 레이어 정합성

`Storage` 인터페이스의 각 스토어가 인터페이스/Redis/인메모리 3종 구현을 갖추고 팩토리에 등록되어 있는지 확인한다.

**데이터 수집:**

1. `apps/server/src/storage/index.ts` — `Storage` 인터페이스의 프로퍼티에서 스토어 이름 추출 (chatStore, roomStore, sessionStore, requestStore, rankingStore, placardStore)
2. 각 스토어에 대해 아래 파일 존재 확인:
   - `apps/server/src/storage/interfaces/{name}-store.ts` (인터페이스)
   - `apps/server/src/storage/redis/redis-{name}-store.ts` (Redis 구현)
   - `apps/server/src/storage/in-memory/in-memory-{name}-store.ts` (인메모리 구현)
3. `apps/server/src/storage/index.ts`의 `createStorage()` 함수에서 해당 스토어가 생성되는지 확인
4. `apps/server/src/storage/index.ts`의 `createInMemoryStorage()` 함수에서 해당 스토어가 생성되는지 확인

**결과 출력:**

```markdown
## 4. 스토리지 레이어 정합성

| 스토어 | 인터페이스 | Redis 구현 | 인메모리 구현 | createStorage | createInMemoryStorage |
|---|---|---|---|---|---|
| chat | ✅ | ✅ | ✅ | ✅ | ✅ |
| room | ✅ | ✅ | ✅ | ✅ | ✅ |
| session | ✅ | ✅ | ✅ | ✅ | ✅ |
| request | ✅ | ✅ | ✅ | ✅ | ✅ |
| ranking | ✅ | ✅ | ✅ | ✅ | ✅ |
| placard | ✅ | ✅ | ✅ | ✅ | ✅ |
```

---

### 5. 소켓 이벤트 정합성

소켓 이벤트 접두사가 해당 핸들러 파일에 매핑되는지 확인한다.

**데이터 수집:**

1. `packages/shared-types/src/socket-events.ts` — `ClientToServerEvents`와 `ServerToClientEvents`에서 모든 이벤트명 추출
2. 이벤트명을 접두사(`:` 앞)로 그룹화하고 각 그룹의 이벤트 수 집계
3. 각 접두사 그룹에 대응하는 핸들러 파일이 `apps/server/src/socket/`에 존재하는지 확인

**접두사 → 핸들러 매핑 규칙:**
- `lobby:*` → `lobby-handler.ts`
- `game:*` → `game-handler.ts`
- `player:*` → `nickname-handler.ts`
- `chat:*` → `chat-handler.ts`
- `request:*` → `request-handler.ts`
- `ranking:*` → `game-handler.ts` (game-handler가 ranking 이벤트도 처리)
- `placard:*` → `placard-handler.ts`
- `system:*` → `broadcast-player-count.ts` + `announce-handler.ts` (system:player-count는 broadcast-player-count, system:announce/announcement/version은 announce-handler)

**결과 출력:**

```markdown
## 5. 소켓 이벤트 정합성

| 접두사 | C→S 이벤트 수 | S→C 이벤트 수 | 핸들러 파일 | 파일 존재 |
|---|---|---|---|---|
| lobby | 10 | 11 | lobby-handler.ts | ✅ |
| game | 4 | 13 | game-handler.ts | ✅ |
| player | 2 | 1 | nickname-handler.ts | ✅ |
| chat | 5 | 4 | chat-handler.ts | ✅ |
| request | 8 | 7 | request-handler.ts | ✅ |
| ranking | 2 | 1 | game-handler.ts | ✅ |
| placard | 2 | 1 | placard-handler.ts | ✅ |
| system | 1 | 3 | broadcast-player-count.ts, announce-handler.ts | ✅ |
```

---

### 6. 프론트엔드 스토어/훅 정합성

각 기능 영역에 Zustand 스토어와 커스텀 훅이 쌍으로 존재하는지 확인한다.

**데이터 수집:**

1. `apps/web/src/stores/` — `*-store.ts` 파일 목록에서 기능 영역 추출 (lobby, game, chat, request, ranking)
2. `apps/web/src/hooks/` — `use-*.ts` 파일 목록에서 기능 영역 추출
3. 각 영역에 대해 스토어와 훅이 모두 존재하는지 교차 확인
4. `use-socket.ts`는 인프라 훅으로 별도 존재 확인 (대응 스토어 불필요)

**매핑 규칙:**
- `stores/lobby-store.ts` ↔ `hooks/use-lobby.ts`
- `stores/game-store.ts` ↔ `hooks/use-game.ts`
- `stores/chat-store.ts` ↔ `hooks/use-chat.ts`
- `stores/request-store.ts` ↔ `hooks/use-requests.ts`
- `stores/ranking-store.ts` ↔ `hooks/use-ranking.ts`

**결과 출력:**

```markdown
## 6. 프론트엔드 스토어/훅 정합성

| 기능 영역 | 스토어 | 훅 | 일치 |
|---|---|---|---|
| lobby | lobby-store.ts ✅ | use-lobby.ts ✅ | ✅ |
| game | game-store.ts ✅ | use-game.ts ✅ | ✅ |
| chat | chat-store.ts ✅ | use-chat.ts ✅ | ✅ |
| request | request-store.ts ✅ | use-requests.ts ✅ | ✅ |
| ranking | ranking-store.ts ✅ | use-ranking.ts ✅ | ✅ |
| socket (인프라) | — | use-socket.ts ✅ | ✅ |
```

---

## 최종 요약

모든 검사 완료 후 아래 형식으로 요약한다:

```markdown
## 요약

- 게임 등록 정합성: N개 게임 검사, M개 이슈
- 플레이어 수 정합성: N개 게임 검사, M개 불일치
- 타입 완전성: N개 게임 검사, M개 누락
- 스토리지 레이어 정합성: N개 스토어 검사, M개 이슈
- 소켓 이벤트 정합성: N개 접두사 검사, M개 이슈
- 프론트엔드 스토어/훅 정합성: N개 영역 검사, M개 이슈

총 이슈: X개
```

이슈가 0개이면 "모든 검사를 통과했습니다"로 마무리한다.
이슈가 있으면 각 이슈를 구체적으로 나열하고 수정 방법을 제안한다.
