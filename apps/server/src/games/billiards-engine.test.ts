import { describe, it, expect, beforeEach } from "vitest";
import { BilliardsEngine } from "./billiards-engine.js";
import type { BilliardsPublicState, Player } from "@game-hub/shared-types";

describe("BilliardsEngine", () => {
  let engine: BilliardsEngine;
  const mockPlayers: Player[] = [
    { id: "player1", nickname: "Player 1", isReady: true },
    { id: "player2", nickname: "Player 2", isReady: true },
  ];

  beforeEach(() => {
    engine = new BilliardsEngine(10, 30);
  });

  describe("initState", () => {
    it("초기 상태를 올바르게 생성한다", () => {
      const state = engine.initState(mockPlayers) as BilliardsPublicState;

      expect(state.balls).toHaveLength(3);
      expect(state.players).toHaveLength(2);
      expect(state.players[0].id).toBe("player1");
      expect(state.players[1].id).toBe("player2");
      expect(state.currentTurnIndex).toBe(0);
      expect(state.phase).toBe("aiming");
      expect(state.targetScore).toBe(10);
      expect(state.turnTimeSeconds).toBe(30);
    });

    it("홀수 플레이어는 흰 공, 짝수 플레이어는 노란 공을 수구로 사용한다", () => {
      const state = engine.initState(mockPlayers) as BilliardsPublicState;

      expect(state.players[0].cueBallId).toBe("cue");
      expect(state.players[1].cueBallId).toBe("yellow");
    });

    it("모든 플레이어 점수가 0이다", () => {
      const state = engine.initState(mockPlayers) as BilliardsPublicState;

      for (const player of state.players) {
        expect(player.score).toBe(0);
      }
    });
  });

  describe("processMove", () => {
    it("현재 턴 플레이어의 샷을 처리한다", () => {
      const state = engine.initState(mockPlayers) as BilliardsPublicState;
      const newState = engine.processMove(state, "player1", { type: "shot", directionDeg: 45, power: 0.5 }) as BilliardsPublicState;

      expect(newState.phase).toBe("simulating");
    });

    it("턴이 아닌 플레이어의 샷은 무시한다", () => {
      const state = engine.initState(mockPlayers) as BilliardsPublicState;
      const newState = engine.processMove(state, "player2", { type: "shot", directionDeg: 45, power: 0.5 }) as BilliardsPublicState;

      expect(newState.phase).toBe("aiming");
    });

    it("시뮬레이션 중에는 샷을 받지 않는다", () => {
      const state = engine.initState(mockPlayers) as BilliardsPublicState;
      const simState = engine.processMove(state, "player1", { type: "shot", directionDeg: 45, power: 0.5 }) as BilliardsPublicState;
      const newState = engine.processMove(simState, "player1", { type: "shot", directionDeg: 90, power: 0.8 }) as BilliardsPublicState;

      expect(newState.phase).toBe("simulating");
    });

    it("샷 후 반환 상태의 수구에 속도가 반영된다", () => {
      const state = engine.initState(mockPlayers) as BilliardsPublicState;
      const newState = engine.processMove(state, "player1", { type: "shot", directionDeg: 0, power: 0.5 }) as BilliardsPublicState;

      const cueBall = newState.balls.find((b) => b.id === "cue")!;
      expect(cueBall.vx).not.toBe(0);
    });
  });

  describe("checkWin", () => {
    it("목표 점수에 도달하지 않으면 null을 반환한다", () => {
      const state = engine.initState(mockPlayers) as BilliardsPublicState;
      const result = engine.checkWin(state);

      expect(result).toBeNull();
    });

    it("목표 점수에 도달하면 승자를 반환한다", () => {
      const state = engine.initState(mockPlayers) as BilliardsPublicState;
      state.players[0].score = 10;

      const result = engine.checkWin(state);
      expect(result).not.toBeNull();
      expect(result!.winnerId).toBe("player1");
    });
  });

  describe("advanceTurn", () => {
    it("미득점 시 상대에게 턴이 넘어간다", () => {
      const state = engine.initState(mockPlayers) as BilliardsPublicState;
      const missState: BilliardsPublicState = {
        ...state,
        lastShotResult: { scored: false, cushionCount: 1, objectBallsHit: [] },
      };

      const nextState = engine.advanceTurn(missState);
      expect(nextState.currentTurnIndex).toBe(1);
      expect(nextState.phase).toBe("aiming");
    });

    it("득점 시 같은 플레이어가 계속 친다", () => {
      const state = engine.initState(mockPlayers) as BilliardsPublicState;
      const scoredState: BilliardsPublicState = {
        ...state,
        lastShotResult: { scored: true, cushionCount: 3, objectBallsHit: ["red", "yellow"] },
      };

      const nextState = engine.advanceTurn(scoredState);
      expect(nextState.currentTurnIndex).toBe(0);
      expect(nextState.players[0].score).toBe(1);
    });
  });

  describe("simulationTick", () => {
    it("시뮬레이션 틱이 프레임 데이터를 반환한다", () => {
      const state = engine.initState(mockPlayers) as BilliardsPublicState;
      engine.processMove(state, "player1", { type: "shot", directionDeg: 0, power: 0.5 });

      const simState: BilliardsPublicState = { ...state, phase: "simulating", shotEvents: [] };
      const { frame, updatedState } = engine.simulationTick(simState);

      expect(frame.balls).toHaveLength(3);
      expect(updatedState).toBeDefined();
    });
  });
});
