---
name: entropy-scan
description: 코드와 문서 간 정합성을 검사하여 엔트로피를 관리

---

게임 등록, 타입, 스토리지, 소켓 이벤트, 프론트엔드 구조의 정합성을 검사한다. 검사 대상은 코드에서 동적으로 발견하며, 이 문서에 하드코딩하지 않는다.

> 프로젝트 구조는 `.claude/rules/architecture.md`를 참고한다.

## 검사 절차

아래 6개 카테고리를 순서대로 검사하고 결과를 출력한다. 각 카테고리는 발견 → 검증 → 출력 3단계로 수행한다.

---

### 1. 게임 등록 정합성

각 게임이 필수 등록 지점에 모두 존재하는지 확인한다.

**발견:**

`packages/shared-types/src/game-types.ts`의 `GameType` 유니온에서 리터럴 값들을 추출하여 **구현된 게임 목록**을 얻는다.

**검증:**

발견된 각 게임에 대해 아래 9개 체크포인트를 확인한다:

1. `packages/shared-types/src/game-types.ts` — `GAME_CONFIGS` 객체에 키가 있는지
2. `apps/server/src/games/game-manager.ts` — `this.engines.set("{gameType}", ...)` 호출이 있는지
3. `apps/server/src/games/{gameType}-engine.ts` — 파일 존재 여부
4. `apps/web/src/lib/game-registry.tsx` — `GAME_COMPONENTS` 객체에 키가 있는지
5. `apps/web/src/components/games/{gameType}/` — 디렉토리 존재 여부
6. `docs/games/{gameType}.md` — 파일 존재 여부
7. `CLAUDE.md` — 게임 문서 테이블에 해당 게임이 있는지
8. `docs/glossary.md` — 게임 섹션에 항목이 있는지
9. `README.md` — 지원 게임 테이블에 해당 게임이 있는지

추가로 `COMING_SOON_GAMES` 배열에서 게임 이름을 추출한다. 이 게임들은 docs(체크포인트 6~9)에만 존재해야 하고, 구현 코드(체크포인트 1~5 + GameType 유니온)에는 없어야 한다.

**출력:**

```markdown
## 1. 게임 등록 정합성

### 구현된 게임

| 체크포인트 | {game₁} | {game₂} | ... |
|---|---|---|---|
| GAME_CONFIGS | ✅/❌ | ✅/❌ | ... |
| game-manager 등록 | ✅/❌ | ✅/❌ | ... |
| 엔진 파일 | ✅/❌ | ✅/❌ | ... |
| game-registry | ✅/❌ | ✅/❌ | ... |
| 컴포넌트 디렉토리 | ✅/❌ | ✅/❌ | ... |
| docs 규칙 문서 | ✅/❌ | ✅/❌ | ... |
| CLAUDE.md 테이블 | ✅/❌ | ✅/❌ | ... |
| glossary 항목 | ✅/❌ | ✅/❌ | ... |
| README.md 테이블 | ✅/❌ | ✅/❌ | ... |

### Coming Soon 게임

> `COMING_SOON_GAMES` 배열이 비어 있으면 "Coming Soon 게임 없음"으로 출력하고 테이블을 생략한다.

| 체크포인트 | {게임명} | ... |
|---|---|---|
| docs 규칙 문서 | ✅ (있어야 함) | ... |
| CLAUDE.md 테이블 | ✅ (있어야 함) | ... |
| glossary 항목 | ✅ (있어야 함) | ... |
| README.md 테이블 | ✅ (있어야 함) | ... |
| 구현 코드 없음 | ✅ (없어야 함) | ... |
```

---

### 2. 플레이어 수 정합성

3곳의 minPlayers/maxPlayers 값이 일치하는지 확인한다.

**발견:**

섹션 1에서 발견한 구현된 게임 목록을 재사용한다.

**검증:**

각 게임에 대해 아래 3개 소스에서 min-max 값을 추출하여 비교한다:

1. `packages/shared-types/src/game-types.ts` — `GAME_CONFIGS`의 `minPlayers`, `maxPlayers`
2. `apps/server/src/games/{gameType}-engine.ts` — 엔진 클래스의 `minPlayers`, `maxPlayers` 속성
3. `docs/games/{gameType}.md` — 기본 정보 테이블에서 인원 관련 행을 찾아 파싱

**출력:**

```markdown
## 2. 플레이어 수 정합성

| 게임 | GAME_CONFIGS | Engine | Docs | 일치 |
|---|---|---|---|---|
| {game₁} | {min}-{max} | {min}-{max} | {min}-{max} | ✅/❌ |
| {game₂} | {min}-{max} | {min}-{max} | {min}-{max} | ✅/❌ |
```

---

### 3. 타입 완전성

각 게임의 State/Move 타입이 유니온에 포함되는지 확인한다.

**발견:**

`packages/shared-types/src/game-types.ts`에서:
- `GameState` 유니온에 포함된 타입명들을 추출
- `GameMove` 유니온에 포함된 타입명들을 추출

**검증:**

발견된 각 게임에 대해:
- `{Game}State` 또는 `{Game}PublicState` 타입이 정의되어 있고 `GameState` 유니온에 포함되는지 확인
- `{Game}Move` 타입이 정의되어 있고 `GameMove` 유니온에 포함되는지 확인

**출력:**

```markdown
## 3. 타입 완전성

| 게임 | State 타입 | GameState 유니온 포함 | Move 타입 | GameMove 유니온 포함 |
|---|---|---|---|---|
| {game₁} | {타입명} | ✅/❌ | {타입명} | ✅/❌ |
| {game₂} | {타입명} | ✅/❌ | {타입명} | ✅/❌ |
```

---

### 4. 스토리지 레이어 정합성

`Storage` 인터페이스의 각 스토어가 3종 구현을 갖추고 팩토리에 등록되어 있는지 확인한다.

**발견:**

`apps/server/src/storage/index.ts`의 `Storage` 인터페이스에서 프로퍼티명을 추출한다. 각 프로퍼티명에서 `Store` 접미사를 제거하여 스토어 이름을 얻는다 (예: `chatStore` → `chat`).

**검증:**

발견된 각 스토어에 대해:

1. `apps/server/src/storage/interfaces/{name}-store.ts` — 인터페이스 파일 존재
2. `apps/server/src/storage/redis/redis-{name}-store.ts` — Redis 구현 파일 존재
3. `apps/server/src/storage/in-memory/in-memory-{name}-store.ts` — 인메모리 구현 파일 존재
4. `createStorage()` 함수에서 해당 스토어 생성 여부
5. `createInMemoryStorage()` 함수에서 해당 스토어 생성 여부

**출력:**

```markdown
## 4. 스토리지 레이어 정합성

| 스토어 | 인터페이스 | Redis 구현 | 인메모리 구현 | createStorage | createInMemoryStorage |
|---|---|---|---|---|---|
| {store₁} | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ |
| {store₂} | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ |
```

---

### 5. 소켓 이벤트 정합성

소켓 이벤트가 핸들러 파일에 올바르게 매핑되는지 확인한다.

**발견:**

1. `packages/shared-types/src/socket-events.ts`에서 `ClientToServerEvents`와 `ServerToClientEvents`의 모든 이벤트명을 추출한다
2. 이벤트명을 접두사(`:` 앞)로 그룹화하고 C→S / S→C 각각의 이벤트 수를 집계한다

**검증:**

접두사-핸들러 매핑을 코드에서 직접 발견한다:

1. `apps/server/src/socket/` 내 모든 `*.ts` 파일을 글로빙한다 (테스트/헬퍼 파일 제외)
2. 각 파일에서 `socket.on("` 패턴을 grep하여 처리하는 이벤트 접두사를 추출한다
3. 발견 단계의 접두사 그룹과 대조하여, 각 접두사가 어떤 핸들러 파일에 매핑되는지 확인한다
4. 어떤 핸들러에서도 처리하지 않는 접두사가 있으면 이슈로 보고한다

> 참고: 대부분의 핸들러는 `{prefix}-handler.ts` 네이밍 컨벤션을 따르지만, 이 컨벤션에 의존하지 않고 반드시 grep 결과로 매핑을 구축한다.

> 주의: `socket.on()`을 사용하지 않는 핸들러(타이머/인터벌 기반 등)는 grep에 잡히지 않을 수 있다. 이런 파일은 `ServerToClientEvents`의 접두사와 대조하여 보완한다.

부가 검사 — C→S 미등록 이벤트 탐지:
- `ClientToServerEvents`에 정의된 C→S 이벤트 중, 어떤 핸들러 파일에서도 `socket.on()` 으로 등록하지 않는 이벤트가 있으면 참고 정보로 출력한다

**출력:**

```markdown
## 5. 소켓 이벤트 정합성

| 접두사 | C→S 이벤트 수 | S→C 이벤트 수 | 핸들러 파일 | 파일 존재 |
|---|---|---|---|---|
| {prefix₁} | N | N | {handler}.ts | ✅/❌ |
| {prefix₂} | N | N | {handler}.ts | ✅/❌ |

> 참고: 미등록 C→S 이벤트가 있으면 아래에 표시한다:
> N개 C→S 이벤트가 어떤 핸들러에서도 등록되지 않음: {event1}, {event2}, ...
> 없으면 "미등록 C→S 이벤트 없음"으로 출력한다.
```

---

### 6. 프론트엔드 스토어/훅 정합성

Zustand 스토어와 커스텀 훅이 올바르게 존재하는지 확인한다.

**발견:**

1. `apps/web/src/stores/` — `*-store.ts` 파일을 글로빙하여 스토어 목록 수집
2. `apps/web/src/hooks/` — `use-*.ts` 파일을 글로빙하여 훅 목록 수집 (테스트 파일 제외)

**검증:**

두 가지 범위를 검사한다:

공통 기능 영역:
- 스토어 파일명에서 `-store.ts`를 제거하여 영역명 추출 (예: `lobby-store.ts` → `lobby`)
- 훅 파일명에서 `use-`와 `.ts`를 제거하여 영역명 추출 (예: `use-lobby.ts` → `lobby`)
- 양쪽 영역명을 매칭한다. 정확히 일치하지 않으면 단수/복수 차이(s 접미사)만 허용한다 (예: `request` 스토어 ↔ `requests` 훅)
- 스토어 영역명과 매칭되지 않는 훅은 인프라 훅으로 분류하고, 대응 스토어 없이 단독 존재가 정상이다

게임 특화 스토어/훅:
- 파일명에 게임명(`GameType` 값)이 포함된 스토어/훅을 식별한다
- 이들은 1:1 매핑이 아닐 수 있으므로, 해당 게임의 컴포넌트 디렉토리(`apps/web/src/components/games/{gameType}/`)가 존재하는지만 확인한다

**출력:**

```markdown
## 6. 프론트엔드 스토어/훅 정합성

### 공통 기능 영역

| 기능 영역 | 스토어 | 훅 | 일치 |
|---|---|---|---|
| {area₁} | {파일명} ✅/❌ | {파일명} ✅/❌ | ✅/❌ |
| {area₂} | {파일명} ✅/❌ | {파일명} ✅/❌ | ✅/❌ |
| {인프라 훅} | — | {파일명} ✅ | ✅ |

### 게임 특화 스토어/훅

| 게임 | 파일 | 컴포넌트 디렉토리 존재 |
|---|---|---|
| {game₁} | {파일명} | ✅/❌ |
| {game₂} | {파일명} | ✅/❌ |

> 게임 특화 스토어/훅이 없으면 "게임 특화 스토어/훅 없음"으로 출력한다.
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
