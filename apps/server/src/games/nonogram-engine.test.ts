import { describe, it, expect, beforeEach } from "vitest";
import { NonogramEngine, computeHints } from "./nonogram-engine.js";
import { NONOGRAM_PATTERNS } from "./nonogram-patterns.js";
import { NONOGRAM_DIFFICULTY_CONFIGS } from "@game-hub/shared-types";
import type { Player, NonogramDifficulty } from "@game-hub/shared-types";

const mockPlayers: Player[] = [
  { id: "player1", nickname: "노노그래머", isReady: true },
];

describe("computeHints", () => {
  it("연속된 true 그룹의 크기를 반환한다", () => {
    expect(computeHints([true, true, false, true])).toEqual([2, 1]);
  });

  it("모두 true인 경우 전체 길이를 반환한다", () => {
    expect(computeHints([true, true, true])).toEqual([3]);
  });

  it("모두 false인 경우 [0]을 반환한다", () => {
    expect(computeHints([false, false, false])).toEqual([0]);
  });

  it("빈 배열은 [0]을 반환한다", () => {
    expect(computeHints([])).toEqual([0]);
  });

  it("여러 그룹을 올바르게 계산한다", () => {
    expect(computeHints([true, false, true, true, false, true])).toEqual([1, 2, 1]);
  });
});

describe("NonogramEngine", () => {
  let engine: NonogramEngine;

  beforeEach(() => {
    engine = new NonogramEngine("tiny");
  });

  describe("initState", () => {
    it("초기 상태를 올바르게 생성한다", () => {
      const state = engine.initState(mockPlayers);
      expect(state.rows).toBe(5);
      expect(state.cols).toBe(5);
      expect(state.difficulty).toBe("tiny");
      expect(state.startedAt).toBeTypeOf("number");
      expect(state.rowHints).toHaveLength(5);
      expect(state.colHints).toHaveLength(5);
      expect(state.players["player1"]).toBeDefined();
      expect(state.players["player1"].status).toBe("playing");
      expect(state.players["player1"].progress).toBe(0);
      expect(state.puzzleName).toBeNull();
    });

    it("플레이어 보드를 hidden으로 초기화한다", () => {
      const state = engine.initState(mockPlayers);
      const board = state.players["player1"].board;
      for (const row of board) {
        for (const cell of row) {
          expect(cell).toBe("hidden");
        }
      }
    });
  });

  describe("processMove", () => {
    it("fill로 셀을 채운다", () => {
      const state = engine.initState(mockPlayers);
      const newState = engine.processMove(state, "player1", { type: "fill", row: 0, col: 0 });
      expect(newState.players["player1"].board[0][0]).toBe("filled");
    });

    it("fill을 같은 셀에 다시 보내면 변경 없다", () => {
      const state = engine.initState(mockPlayers);
      engine.processMove(state, "player1", { type: "fill", row: 0, col: 0 });
      const newState = engine.processMove(state, "player1", { type: "fill", row: 0, col: 0 });
      expect(newState.players["player1"].board[0][0]).toBe("filled");
    });

    it("mark로 X 마킹한다", () => {
      const state = engine.initState(mockPlayers);
      const newState = engine.processMove(state, "player1", { type: "mark", row: 0, col: 0 });
      expect(newState.players["player1"].board[0][0]).toBe("marked");
    });

    it("mark를 같은 셀에 다시 보내면 변경 없다", () => {
      const state = engine.initState(mockPlayers);
      engine.processMove(state, "player1", { type: "mark", row: 0, col: 0 });
      const newState = engine.processMove(state, "player1", { type: "mark", row: 0, col: 0 });
      expect(newState.players["player1"].board[0][0]).toBe("marked");
    });

    it("marked 셀에 fill을 보내면 filled로 변경된다", () => {
      const state = engine.initState(mockPlayers);
      engine.processMove(state, "player1", { type: "mark", row: 0, col: 0 });
      const newState = engine.processMove(state, "player1", { type: "fill", row: 0, col: 0 });
      expect(newState.players["player1"].board[0][0]).toBe("filled");
    });

    it("filled 셀에 mark를 보내면 marked로 변경된다", () => {
      const state = engine.initState(mockPlayers);
      engine.processMove(state, "player1", { type: "fill", row: 0, col: 0 });
      const newState = engine.processMove(state, "player1", { type: "mark", row: 0, col: 0 });
      expect(newState.players["player1"].board[0][0]).toBe("marked");
    });

    it("clear로 셀을 초기화한다", () => {
      const state = engine.initState(mockPlayers);
      engine.processMove(state, "player1", { type: "fill", row: 0, col: 0 });
      const newState = engine.processMove(state, "player1", { type: "clear", row: 0, col: 0 });
      expect(newState.players["player1"].board[0][0]).toBe("hidden");
    });

    it("범위를 벗어난 이동을 무시한다", () => {
      const state = engine.initState(mockPlayers);
      const newState = engine.processMove(state, "player1", { type: "fill", row: -1, col: 0 });
      expect(newState).toBeDefined();
    });

    it("존재하지 않는 플레이어 이동을 무시한다", () => {
      const state = engine.initState(mockPlayers);
      const newState = engine.processMove(state, "unknown", { type: "fill", row: 0, col: 0 });
      expect(newState).toBeDefined();
    });

    it("완료된 플레이어의 이동을 무시한다", () => {
      const state = engine.initState(mockPlayers);
      engine._setSolution([[true]]);
      engine.processMove(state, "player1", { type: "fill", row: 0, col: 0 });
      const ps = engine._getPlayerState();
      expect(ps?.status).toBe("completed");
    });

    it("진행률을 올바르게 계산한다", () => {
      const state = engine.initState(mockPlayers);
      engine._setSolution([
        [true, false],
        [false, true],
      ]);
      engine.processMove(state, "player1", { type: "fill", row: 0, col: 0 });
      const ps = engine._getPlayerState();
      expect(ps?.progress).toBe(50);
    });
  });

  describe("checkWin", () => {
    it("퍼즐 완성 시 승리를 반환한다", () => {
      const state = engine.initState(mockPlayers);
      engine._setSolution([
        [true, false],
        [false, true],
      ]);
      engine.processMove(state, "player1", { type: "fill", row: 0, col: 0 });
      const state2 = engine.processMove(state, "player1", { type: "fill", row: 1, col: 1 });
      const result = engine.checkWin(state2);
      expect(result).not.toBeNull();
      expect(result?.winnerId).toBe("player1");
      expect(result?.reason).toContain("클리어 시간");
      expect(state2.puzzleName).toBeTypeOf("string");
    });

    it("미완성 시 null을 반환한다", () => {
      const state = engine.initState(mockPlayers);
      engine.processMove(state, "player1", { type: "fill", row: 0, col: 0 });
      const result = engine.checkWin(state);
      expect(result).toBeNull();
    });
  });

  describe("힌트 계산", () => {
    it("_setSolution으로 설정한 퍼즐의 힌트가 올바르다", () => {
      engine.initState(mockPlayers);
      engine._setSolution([
        [true, true, false],
        [false, true, true],
        [true, false, true],
      ]);
      const state = engine.toPublicState();

      expect(state.rowHints[0]).toEqual([2]);
      expect(state.rowHints[1]).toEqual([2]);
      expect(state.rowHints[2]).toEqual([1, 1]);

      expect(state.colHints[0]).toEqual([1, 1]);
      expect(state.colHints[1]).toEqual([2]);
      expect(state.colHints[2]).toEqual([2]);
    });
  });

  describe("난이도", () => {
    it("각 난이도별 보드 크기가 올바르다", () => {
      const difficulties = ["tiny", "beginner", "intermediate", "expert", "extreme"] as const;
      const expectedSizes = [5, 10, 15, 20, 40];

      for (let i = 0; i < difficulties.length; i++) {
        const e = new NonogramEngine(difficulties[i]);
        const state = e.initState(mockPlayers);
        expect(state.rows).toBe(expectedSizes[i]);
        expect(state.cols).toBe(expectedSizes[i]);
      }
    });

    it("getDifficulty가 설정된 난이도를 반환한다", () => {
      expect(engine.getDifficulty()).toBe("tiny");
    });
  });

  describe("패턴 정합성", () => {
    it("모든 난이도의 패턴 크기가 설정과 일치한다", () => {
      const difficulties = Object.keys(NONOGRAM_DIFFICULTY_CONFIGS) as NonogramDifficulty[];
      for (const diff of difficulties) {
        const config = NONOGRAM_DIFFICULTY_CONFIGS[diff];
        const patterns = NONOGRAM_PATTERNS[diff];
        expect(patterns.length).toBeGreaterThan(0);
        for (let i = 0; i < patterns.length; i++) {
          const g = patterns[i].grid;
          expect(g.length, `${diff} 패턴[${i}] 행 수`).toBe(config.rows);
          for (let r = 0; r < g.length; r++) {
            expect(g[r].length, `${diff} 패턴[${i}] ${r}행 열 수`).toBe(config.cols);
          }
        }
      }
    });

    it("각 난이도에 최소 2개 이상의 패턴이 있다", () => {
      const difficulties = Object.keys(NONOGRAM_DIFFICULTY_CONFIGS) as NonogramDifficulty[];
      for (const diff of difficulties) {
        expect(NONOGRAM_PATTERNS[diff].length, `${diff} 패턴 수`).toBeGreaterThanOrEqual(2);
      }
    });

    it("모든 패턴의 채움률이 40~70% 범위이다", () => {
      for (const [diff, patterns] of Object.entries(NONOGRAM_PATTERNS)) {
        patterns.forEach(({ grid }, i) => {
          const total = grid.length * grid[0].length;
          const filled = grid.flat().filter(Boolean).length;
          const ratio = filled / total;
          expect(ratio, `${diff} 패턴[${i}] 채움률 ${(ratio * 100).toFixed(1)}%`).toBeGreaterThanOrEqual(0.4);
          expect(ratio, `${diff} 패턴[${i}] 채움률 ${(ratio * 100).toFixed(1)}%`).toBeLessThanOrEqual(0.7);
        });
      }
    });

    it("모든 패턴에 보드 크기 절반 이상의 큰 힌트가 존재한다", () => {
      for (const [diff, patterns] of Object.entries(NONOGRAM_PATTERNS)) {
        patterns.forEach(({ grid }, i) => {
          const rows = grid.length;
          const cols = grid[0].length;
          const rowHints = grid.map((r) => computeHints(r));
          const colHints = Array.from({ length: cols }, (_, c) => computeHints(grid.map((r) => r[c])));
          const maxHint = Math.max(...rowHints.flat(), ...colHints.flat());
          const halfSize = Math.max(rows, cols) / 2;
          expect(maxHint, `${diff} 패턴[${i}] 최대힌트=${maxHint} < ${halfSize}`).toBeGreaterThanOrEqual(halfSize);
        });
      }
    });
  });

  describe("getCompletionTime", () => {
    it("완료된 플레이어의 시간을 반환한다", () => {
      const state = engine.initState(mockPlayers);
      engine._setSolution([[true]]);
      engine.processMove(state, "player1", { type: "fill", row: 0, col: 0 });
      const time = engine.getCompletionTime();
      expect(time).toBeTypeOf("number");
      expect(time!).toBeGreaterThanOrEqual(0);
    });

    it("미완료 시 null을 반환한다", () => {
      engine.initState(mockPlayers);
      const time = engine.getCompletionTime();
      expect(time).toBeNull();
    });
  });

  describe("verify", () => {
    it("틀린 칸이 없으면 errorCount 0을 반환한다", () => {
      const state = engine.initState(mockPlayers);
      engine._setSolution([
        [true, false],
        [false, true],
      ]);
      engine.processMove(state, "player1", { type: "fill", row: 0, col: 0 });
      expect(engine.verify().errorCount).toBe(0);
      expect(engine.verify().remaining).toBe(1);
    });

    it("틀린 칸 수를 정확히 반환한다", () => {
      const state = engine.initState(mockPlayers);
      engine._setSolution([
        [true, false],
        [false, true],
      ]);
      engine.processMove(state, "player1", { type: "fill", row: 0, col: 1 });
      expect(engine.verify().errorCount).toBe(1);
    });

    it("아무것도 채우지 않으면 남은 칸 수를 반환한다", () => {
      engine.initState(mockPlayers);
      engine._setSolution([
        [true, false],
        [false, true],
      ]);
      const { errorCount, remaining } = engine.verify();
      expect(errorCount).toBe(0);
      expect(remaining).toBe(2);
    });

    it("marked 셀은 오류로 세지 않는다", () => {
      const state = engine.initState(mockPlayers);
      engine._setSolution([
        [true, false],
        [false, true],
      ]);
      engine.processMove(state, "player1", { type: "mark", row: 0, col: 1 });
      expect(engine.verify().errorCount).toBe(0);
    });
  });

  describe("undo/redo", () => {
    it("undo로 마지막 이동을 되돌린다", () => {
      const state = engine.initState(mockPlayers);
      engine.processMove(state, "player1", { type: "fill", row: 0, col: 0 });
      engine.undo();
      expect(engine._getPlayerState()?.board[0][0]).toBe("hidden");
    });

    it("redo로 되돌린 이동을 다시 적용한다", () => {
      const state = engine.initState(mockPlayers);
      engine.processMove(state, "player1", { type: "fill", row: 0, col: 0 });
      engine.undo();
      engine.redo();
      expect(engine._getPlayerState()?.board[0][0]).toBe("filled");
    });

    it("새 이동 시 redo 스택이 초기화된다", () => {
      const state = engine.initState(mockPlayers);
      engine.processMove(state, "player1", { type: "fill", row: 0, col: 0 });
      engine.undo();
      engine.processMove(state, "player1", { type: "mark", row: 0, col: 0 });
      engine.redo(); // redo 스택 비어있으므로 변화 없음
      expect(engine._getPlayerState()?.board[0][0]).toBe("marked");
    });

    it("히스토리가 비었을 때 undo는 변화 없다", () => {
      engine.initState(mockPlayers);
      engine.undo();
      expect(engine._getPlayerState()?.board[0][0]).toBe("hidden");
    });
  });

  describe("restart", () => {
    it("보드를 초기 상태로 되돌린다", () => {
      const state = engine.initState(mockPlayers);
      engine.processMove(state, "player1", { type: "fill", row: 0, col: 0 });
      engine.processMove(state, "player1", { type: "mark", row: 0, col: 1 });
      engine.restart();
      const ps = engine._getPlayerState();
      expect(ps?.board[0][0]).toBe("hidden");
      expect(ps?.board[0][1]).toBe("hidden");
      expect(ps?.progress).toBe(0);
    });

    it("히스토리와 redo 스택을 초기화한다", () => {
      const state = engine.initState(mockPlayers);
      engine.processMove(state, "player1", { type: "fill", row: 0, col: 0 });
      engine.restart();
      engine.undo(); // 히스토리 비어있으므로 변화 없음
      expect(engine._getPlayerState()?.board[0][0]).toBe("hidden");
    });
  });

  describe("toggleHint", () => {
    it("힌트를 체크한다", () => {
      engine.initState(mockPlayers);
      const state = engine.toggleHint("col-0-0");
      expect(state.players["player1"].checkedHints).toContain("col-0-0");
    });

    it("이미 체크된 힌트를 해제한다", () => {
      engine.initState(mockPlayers);
      engine.toggleHint("col-0-0");
      const state = engine.toggleHint("col-0-0");
      expect(state.players["player1"].checkedHints).not.toContain("col-0-0");
    });

    it("여러 힌트를 독립적으로 토글한다", () => {
      engine.initState(mockPlayers);
      engine.toggleHint("col-0-0");
      const state = engine.toggleHint("row-1-0");
      expect(state.players["player1"].checkedHints).toContain("col-0-0");
      expect(state.players["player1"].checkedHints).toContain("row-1-0");
    });
  });

  describe("checkedHints 초기화", () => {
    it("initState에서 빈 배열로 초기화한다", () => {
      const state = engine.initState(mockPlayers);
      expect(state.players["player1"].checkedHints).toEqual([]);
    });

    it("restart에서 checkedHints를 초기화한다", () => {
      const state = engine.initState(mockPlayers);
      engine.toggleHint("col-0-0");
      engine.toggleHint("row-1-0");
      engine.restart();
      expect(engine._getPlayerState()?.checkedHints).toEqual([]);
    });
  });

  describe("processBatchMove", () => {
    it("여러 셀을 한 번에 변경한다", () => {
      engine.initState(mockPlayers);
      engine.processBatchMove("player1", [
        { row: 0, col: 0, target: "filled" },
        { row: 0, col: 1, target: "marked" },
      ]);
      const ps = engine._getPlayerState();
      expect(ps?.board[0][0]).toBe("filled");
      expect(ps?.board[0][1]).toBe("marked");
    });

    it("batch 이동은 1개의 undo 단위이다", () => {
      engine.initState(mockPlayers);
      engine.processBatchMove("player1", [
        { row: 0, col: 0, target: "filled" },
        { row: 0, col: 1, target: "filled" },
      ]);
      engine.undo();
      const ps = engine._getPlayerState();
      expect(ps?.board[0][0]).toBe("hidden");
      expect(ps?.board[0][1]).toBe("hidden");
    });
  });
});
