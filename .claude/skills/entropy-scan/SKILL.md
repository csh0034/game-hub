---
name: entropy-scan
description: 코드와 문서 간 정합성을 검사하여 엔트로피를 관리

---

게임 등록과 관련된 코드·문서 8곳의 정합성을 검사한다.

## 검사 절차

아래 3개 카테고리를 순서대로 검사하고 결과를 출력한다.

---

### 1. 게임 등록 정합성

각 게임이 아래 8곳에 모두 등록되어 있는지 확인한다.

**데이터 수집:**

1. `packages/shared-types/src/game-types.ts` — `GameType` 유니온의 리터럴 값들 추출 → **구현된 게임 목록**
2. `packages/shared-types/src/game-types.ts` — `GAME_CONFIGS` 객체의 키 추출
3. `apps/server/src/games/game-manager.ts` — `this.engines.set("...", ...)` 호출에서 게임 타입 추출
4. `apps/server/src/games/` — `*-engine.ts` 파일 존재 여부 확인 (게임 타입명과 파일명의 매핑: `texas-holdem` → `holdem-engine.ts`, 나머지는 `{gameType}-engine.ts`)
5. `apps/web/src/lib/game-registry.tsx` — `GAME_COMPONENTS` 객체의 키 추출
6. `apps/web/src/components/games/` — 게임별 컴포넌트 디렉토리 존재 확인
7. `docs/games/` — `{gameType}.md` 파일 존재 확인
8. `CLAUDE.md` — 게임 문서 테이블에 해당 게임이 있는지 확인

추가로 `docs/glossary.md`의 게임 섹션에 항목이 있는지 확인한다 (9번째 체크포인트).

**COMING_SOON_GAMES 검사:**
- `packages/shared-types/src/game-types.ts`의 `COMING_SOON_GAMES` 배열에서 게임 이름 추출
- 이 게임들은 docs(`docs/games/*.md`, `CLAUDE.md` 테이블, `docs/glossary.md`)에만 존재해야 하고, 구현 코드(GameType 유니온, GAME_CONFIGS, engine, game-manager, game-registry, 컴포넌트)에는 없어야 한다

**결과 출력:**

```markdown
## 1. 게임 등록 정합성

### 구현된 게임

| 체크포인트 | gomoku | texas-holdem | minesweeper | tetris |
|---|---|---|---|---|
| GameType 유니온 | ✅ | ✅ | ✅ | ✅ |
| GAME_CONFIGS | ✅ | ✅ | ✅ | ✅ |
| game-manager 등록 | ✅ | ✅ | ✅ | ✅ |
| 엔진 파일 | ✅ | ✅ | ✅ | ✅ |
| game-registry | ✅ | ✅ | ✅ | ✅ |
| 컴포넌트 디렉토리 | ✅ | ✅ | ✅ | ✅ |
| docs 규칙 문서 | ✅ | ✅ | ✅ | ✅ |
| CLAUDE.md 테이블 | ✅ | ✅ | ✅ | ✅ |
| glossary 항목 | ✅ | ✅ | ✅ | ✅ |

### Coming Soon 게임

| 체크포인트 | 라이어 드로잉 |
|---|---|
| docs 규칙 문서 | ✅ (있어야 함) |
| CLAUDE.md 테이블 | ✅ (있어야 함) |
| glossary 항목 | ✅ (있어야 함) |
| 구현 코드 없음 | ✅ (없어야 함) |
```

---

### 2. 플레이어 수 정합성

3곳의 minPlayers/maxPlayers 값이 일치하는지 확인한다.

**데이터 수집:**

1. `packages/shared-types/src/game-types.ts` — `GAME_CONFIGS`의 각 게임 `minPlayers`, `maxPlayers`
2. `apps/server/src/games/*-engine.ts` — 각 엔진 클래스의 `minPlayers`, `maxPlayers` 속성
3. `docs/games/*.md` — 기본 정보 테이블의 플레이어 수 (예: "2명" → min=2, max=2 / "2~8인" → min=2, max=8 / "1인" → min=1, max=1 / "1~6인" → min=1, max=6)

**결과 출력:**

```markdown
## 2. 플레이어 수 정합성

| 게임 | GAME_CONFIGS | Engine | Docs | 일치 |
|---|---|---|---|---|
| gomoku | 2-2 | 2-2 | 2-2 | ✅ |
| texas-holdem | 2-8 | 2-8 | 2-8 | ✅ |
| minesweeper | 1-1 | 1-1 | 1-1 | ✅ |
| tetris | 1-6 | 1-6 | 1-6 | ✅ |
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
```

---

## 최종 요약

모든 검사 완료 후 아래 형식으로 요약한다:

```markdown
## 요약

- 게임 등록 정합성: N개 게임 검사, M개 이슈
- 플레이어 수 정합성: N개 게임 검사, M개 불일치
- 타입 완전성: N개 게임 검사, M개 누락

총 이슈: X개
```

이슈가 0개이면 "모든 검사를 통과했습니다"로 마무리한다.
이슈가 있으면 각 이슈를 구체적으로 나열하고 수정 방법을 제안한다.
