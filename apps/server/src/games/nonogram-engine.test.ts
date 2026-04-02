import { describe, it, expect, beforeEach } from "vitest";
import { NonogramEngine, computeHints } from "./nonogram-engine.js";
import type { Player } from "@game-hub/shared-types";

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

    it("fill 토글로 채운 셀을 비운다", () => {
      const state = engine.initState(mockPlayers);
      engine.processMove(state, "player1", { type: "fill", row: 0, col: 0 });
      const newState = engine.processMove(state, "player1", { type: "fill", row: 0, col: 0 });
      expect(newState.players["player1"].board[0][0]).toBe("hidden");
    });

    it("mark로 X 마킹한다", () => {
      const state = engine.initState(mockPlayers);
      const newState = engine.processMove(state, "player1", { type: "mark", row: 0, col: 0 });
      expect(newState.players["player1"].board[0][0]).toBe("marked");
    });

    it("mark 토글로 X 마킹을 해제한다", () => {
      const state = engine.initState(mockPlayers);
      engine.processMove(state, "player1", { type: "mark", row: 0, col: 0 });
      const newState = engine.processMove(state, "player1", { type: "mark", row: 0, col: 0 });
      expect(newState.players["player1"].board[0][0]).toBe("hidden");
    });

    it("marked 셀은 fill할 수 없다", () => {
      const state = engine.initState(mockPlayers);
      engine.processMove(state, "player1", { type: "mark", row: 0, col: 0 });
      const newState = engine.processMove(state, "player1", { type: "fill", row: 0, col: 0 });
      expect(newState.players["player1"].board[0][0]).toBe("marked");
    });

    it("filled 셀은 mark할 수 없다", () => {
      const state = engine.initState(mockPlayers);
      engine.processMove(state, "player1", { type: "fill", row: 0, col: 0 });
      const newState = engine.processMove(state, "player1", { type: "mark", row: 0, col: 0 });
      expect(newState.players["player1"].board[0][0]).toBe("filled");
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
});
