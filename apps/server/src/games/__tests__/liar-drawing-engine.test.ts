import { describe, it, expect, beforeEach } from "vitest";
import { LiarDrawingEngine } from "../liar-drawing-engine.js";
import type { Player, LiarDrawingPublicState, LiarDrawingMove } from "@game-hub/shared-types";

const mockPlayers: Player[] = [
  { id: "p1", nickname: "Alice", isReady: true },
  { id: "p2", nickname: "Bob", isReady: true },
  { id: "p3", nickname: "Charlie", isReady: true },
];

describe("LiarDrawingEngine", () => {
  let engine: LiarDrawingEngine;

  beforeEach(() => {
    engine = new LiarDrawingEngine(60, 2);
  });

  describe("initState", () => {
    it("초기 상태를 올바르게 생성한다", () => {
      const state = engine.initState(mockPlayers) as LiarDrawingPublicState;

      expect(state.phase).toBe("role-reveal");
      expect(state.roundNumber).toBe(1);
      expect(state.totalRounds).toBe(2);
      expect(state.players).toHaveLength(3);
      expect(state.drawOrder).toHaveLength(3);
      expect(state.category).toBeTruthy();
      expect(state.drawTimeSeconds).toBe(60);
    });

    it("라이어가 1명 배정된다", () => {
      engine.initState(mockPlayers);
      const liarId = engine.getLiarId();

      expect(liarId).toBeTruthy();
      expect(mockPlayers.some((p) => p.id === liarId)).toBe(true);
    });

    it("제시어가 선택된다", () => {
      engine.initState(mockPlayers);
      expect(engine.getKeyword()).toBeTruthy();
      expect(engine.getCategory()).toBeTruthy();
    });

    it("모든 플레이어의 캔버스가 초기화된다", () => {
      const state = engine.initState(mockPlayers) as LiarDrawingPublicState;
      for (const p of mockPlayers) {
        expect(state.canvases[p.id]).toEqual([]);
      }
    });
  });

  describe("processMove - draw", () => {
    it("현재 그리는 사람만 그릴 수 있다", () => {
      const state = engine.initState(mockPlayers) as LiarDrawingPublicState;
      const drawingState = engine.startDrawingPhase(state);
      const currentDrawer = drawingState.drawOrder[0];
      const otherPlayer = mockPlayers.find((p) => p.id !== currentDrawer)!;

      const points = [{ x: 10, y: 10, tool: "pen" as const, color: "black" as const, thickness: 5 as const, isStart: true }];

      // Current drawer can draw
      const result1 = engine.processMove(drawingState, currentDrawer, { type: "draw", points }) as LiarDrawingPublicState;
      expect(result1.canvases[currentDrawer]).toHaveLength(1);

      // Other player cannot draw
      const result2 = engine.processMove(drawingState, otherPlayer.id, { type: "draw", points }) as LiarDrawingPublicState;
      expect(result2.canvases[otherPlayer.id]).toHaveLength(0);
    });

    it("drawing 페이즈가 아니면 그릴 수 없다", () => {
      const state = engine.initState(mockPlayers) as LiarDrawingPublicState;
      // state is in role-reveal phase
      const points = [{ x: 10, y: 10, tool: "pen" as const, color: "black" as const, thickness: 5 as const, isStart: true }];

      const result = engine.processMove(state, state.drawOrder[0], { type: "draw", points }) as LiarDrawingPublicState;
      expect(result.canvases[state.drawOrder[0]]).toHaveLength(0);
    });
  });

  describe("processMove - clear-canvas", () => {
    it("현재 그리는 사람의 캔버스를 초기화한다", () => {
      const state = engine.initState(mockPlayers) as LiarDrawingPublicState;
      const drawingState = engine.startDrawingPhase(state);
      const currentDrawer = drawingState.drawOrder[0];

      const points = [{ x: 10, y: 10, tool: "pen" as const, color: "black" as const, thickness: 5 as const, isStart: true }];
      const drawnState = engine.processMove(drawingState, currentDrawer, { type: "draw", points }) as LiarDrawingPublicState;
      expect(drawnState.canvases[currentDrawer]).toHaveLength(1);

      const clearedState = engine.processMove(drawnState, currentDrawer, { type: "clear-canvas" }) as LiarDrawingPublicState;
      expect(clearedState.canvases[currentDrawer]).toHaveLength(0);
    });
  });

  describe("processMove - vote", () => {
    function getVotingState(): LiarDrawingPublicState {
      const state = engine.initState(mockPlayers) as LiarDrawingPublicState;
      const drawingState = engine.startDrawingPhase(state);
      // Advance all drawing turns to reach voting
      let current = drawingState;
      for (let i = 0; i < mockPlayers.length; i++) {
        current = engine.advanceDrawingTurn(current);
      }
      return current;
    }

    it("유효한 투표를 처리한다", () => {
      const votingState = getVotingState();
      expect(votingState.phase).toBe("voting");

      const result = engine.processMove(votingState, "p1", { type: "vote", targetPlayerId: "p2" }) as LiarDrawingPublicState;
      expect(result.votedPlayerIds).toContain("p1");
      expect(result.votes["p1"]).toBe("p2");
    });

    it("자기 자신에게 투표할 수 없다", () => {
      const votingState = getVotingState();
      const result = engine.processMove(votingState, "p1", { type: "vote", targetPlayerId: "p1" }) as LiarDrawingPublicState;
      expect(result.votedPlayerIds).not.toContain("p1");
    });

    it("이미 투표한 사람은 다시 투표할 수 없다", () => {
      const votingState = getVotingState();
      const afterFirst = engine.processMove(votingState, "p1", { type: "vote", targetPlayerId: "p2" }) as LiarDrawingPublicState;
      const afterSecond = engine.processMove(afterFirst, "p1", { type: "vote", targetPlayerId: "p3" }) as LiarDrawingPublicState;
      expect(afterSecond.votes["p1"]).toBe("p2");
    });

    it("전원 투표 후 결과가 계산된다", () => {
      const votingState = getVotingState();
      let current = votingState;

      // All vote for p2
      current = engine.processMove(current, "p1", { type: "vote", targetPlayerId: "p2" }) as LiarDrawingPublicState;
      current = engine.processMove(current, "p2", { type: "vote", targetPlayerId: "p1" }) as LiarDrawingPublicState;
      current = engine.processMove(current, "p3", { type: "vote", targetPlayerId: "p2" }) as LiarDrawingPublicState;

      // Phase should have advanced
      expect(["liar-guess", "round-result"]).toContain(current.phase);
      expect(current.liarId).toBeTruthy();
    });

    it("동률이면 라이어 지목 실패로 처리된다", () => {
      const votingState = getVotingState();
      let current = votingState;

      // p1->p2, p2->p3, p3->p1 (all get 1 vote each)
      current = engine.processMove(current, "p1", { type: "vote", targetPlayerId: "p2" }) as LiarDrawingPublicState;
      current = engine.processMove(current, "p2", { type: "vote", targetPlayerId: "p3" }) as LiarDrawingPublicState;
      current = engine.processMove(current, "p3", { type: "vote", targetPlayerId: "p1" }) as LiarDrawingPublicState;

      expect(current.phase).toBe("round-result");
      expect(current.accusedPlayerId).toBeNull();
    });
  });

  describe("processMove - liar-guess", () => {
    it("라이어만 추측할 수 있다", () => {
      const state = engine.initState(mockPlayers) as LiarDrawingPublicState;
      // Manually set to liar-guess phase
      const liarGuessState: LiarDrawingPublicState = {
        ...state,
        phase: "liar-guess",
        liarId: engine.getLiarId(),
        accusedPlayerId: engine.getLiarId(),
        turnStartedAt: Date.now(),
      };

      const liarId = engine.getLiarId()!;
      const nonLiar = mockPlayers.find((p) => p.id !== liarId)!;

      // Non-liar cannot guess
      const result1 = engine.processMove(liarGuessState, nonLiar.id, { type: "liar-guess", guess: "test" }) as LiarDrawingPublicState;
      expect(result1.phase).toBe("liar-guess");

      // Liar can guess
      const result2 = engine.processMove(liarGuessState, liarId, { type: "liar-guess", guess: "wrong" }) as LiarDrawingPublicState;
      expect(result2.phase).toBe("round-result");
      expect(result2.liarGuessCorrect).toBe(false);
    });

    it("정답을 맞추면 liarGuessCorrect가 true이다", () => {
      const state = engine.initState(mockPlayers) as LiarDrawingPublicState;
      const keyword = engine.getKeyword()!;
      const liarId = engine.getLiarId()!;

      const liarGuessState: LiarDrawingPublicState = {
        ...state,
        phase: "liar-guess",
        liarId,
        accusedPlayerId: liarId,
        turnStartedAt: Date.now(),
      };

      const result = engine.processMove(liarGuessState, liarId, { type: "liar-guess", guess: keyword }) as LiarDrawingPublicState;
      expect(result.liarGuessCorrect).toBe(true);
    });
  });

  describe("scoring", () => {
    it("라이어 지목 실패 시 라이어가 2점을 받는다", () => {
      const state = engine.initState(mockPlayers) as LiarDrawingPublicState;
      const scores = engine.calculateRoundScores(state, false, false);
      const liarId = engine.getLiarId()!;
      expect(scores[liarId]).toBe(2);
      for (const p of mockPlayers) {
        if (p.id !== liarId) expect(scores[p.id]).toBe(0);
      }
    });

    it("라이어 지목 성공 + 제시어 오답 시 시민이 각 1점을 받는다", () => {
      const state = engine.initState(mockPlayers) as LiarDrawingPublicState;
      const scores = engine.calculateRoundScores(state, true, false);
      const liarId = engine.getLiarId()!;
      expect(scores[liarId]).toBe(0);
      for (const p of mockPlayers) {
        if (p.id !== liarId) expect(scores[p.id]).toBe(1);
      }
    });

    it("라이어 지목 성공 + 제시어 정답 시 라이어가 3점을 받는다", () => {
      const state = engine.initState(mockPlayers) as LiarDrawingPublicState;
      const scores = engine.calculateRoundScores(state, true, true);
      const liarId = engine.getLiarId()!;
      expect(scores[liarId]).toBe(3);
      for (const p of mockPlayers) {
        if (p.id !== liarId) expect(scores[p.id]).toBe(0);
      }
    });
  });

  describe("advanceDrawingTurn", () => {
    it("다음 플레이어로 턴을 넘긴다", () => {
      const state = engine.initState(mockPlayers) as LiarDrawingPublicState;
      const drawingState = engine.startDrawingPhase(state);

      const nextState = engine.advanceDrawingTurn(drawingState);
      expect(nextState.currentDrawerIndex).toBe(1);
      expect(nextState.phase).toBe("drawing");
    });

    it("마지막 플레이어 후 투표 페이즈로 전환된다", () => {
      const state = engine.initState(mockPlayers) as LiarDrawingPublicState;
      const drawingState = engine.startDrawingPhase(state);

      let current = drawingState;
      for (let i = 0; i < mockPlayers.length; i++) {
        current = engine.advanceDrawingTurn(current);
      }
      expect(current.phase).toBe("voting");
    });
  });

  describe("checkWin", () => {
    it("final-result 페이즈가 아니면 null을 반환한다", () => {
      const state = engine.initState(mockPlayers) as LiarDrawingPublicState;
      expect(engine.checkWin(state)).toBeNull();
    });

    it("final-result 페이즈이면 GameResult를 반환한다", () => {
      const state = engine.initState(mockPlayers) as LiarDrawingPublicState;
      const finalState: LiarDrawingPublicState = {
        ...state,
        phase: "final-result",
        players: state.players.map((p, i) => ({
          ...p,
          score: i === 0 ? 5 : i === 1 ? 3 : 1,
        })),
      };

      const result = engine.checkWin(finalState);
      expect(result).not.toBeNull();
      expect(result!.winnerId).toBe("p1");
    });

    it("동점이면 무승부를 반환한다", () => {
      const state = engine.initState(mockPlayers) as LiarDrawingPublicState;
      const finalState: LiarDrawingPublicState = {
        ...state,
        phase: "final-result",
        players: state.players.map((p) => ({
          ...p,
          score: 3,
        })),
      };

      const result = engine.checkWin(finalState);
      expect(result).not.toBeNull();
      expect(result!.winnerId).toBeNull();
    });
  });

  describe("startNewRound", () => {
    it("라이어가 재배정된다", () => {
      const state = engine.initState(mockPlayers) as LiarDrawingPublicState;
      const firstLiar = engine.getLiarId();

      // Run multiple rounds to verify liar can change (probabilistic)
      let differentLiarFound = false;
      for (let i = 0; i < 20; i++) {
        engine.startNewRound(state);
        if (engine.getLiarId() !== firstLiar) {
          differentLiarFound = true;
          break;
        }
      }
      // With 3 players, the probability of getting the same liar 20 times is (1/3)^19 ≈ 0
      expect(differentLiarFound).toBe(true);
    });

    it("캔버스와 투표가 초기화된다", () => {
      const state = engine.initState(mockPlayers) as LiarDrawingPublicState;
      const newState = engine.startNewRound({ ...state, roundNumber: 2 });

      expect(newState.phase).toBe("role-reveal");
      expect(newState.votedPlayerIds).toHaveLength(0);
      expect(Object.keys(newState.votes)).toHaveLength(0);
      for (const p of mockPlayers) {
        expect(newState.canvases[p.id]).toHaveLength(0);
      }
    });
  });

  describe("processMove - complete-turn", () => {
    it("현재 그리는 사람이 턴을 완료하면 다음 턴으로 넘어간다", () => {
      const state = engine.initState(mockPlayers) as LiarDrawingPublicState;
      const drawingState = engine.startDrawingPhase(state);
      const currentDrawer = drawingState.drawOrder[0];

      const result = engine.processMove(drawingState, currentDrawer, { type: "complete-turn" }) as LiarDrawingPublicState;
      expect(result.currentDrawerIndex).toBe(1);
      expect(result.phase).toBe("drawing");
    });

    it("현재 그리는 사람이 아닌 플레이어는 턴을 완료할 수 없다", () => {
      const state = engine.initState(mockPlayers) as LiarDrawingPublicState;
      const drawingState = engine.startDrawingPhase(state);
      const currentDrawer = drawingState.drawOrder[0];
      const otherPlayer = mockPlayers.find((p) => p.id !== currentDrawer)!;

      const result = engine.processMove(drawingState, otherPlayer.id, { type: "complete-turn" }) as LiarDrawingPublicState;
      expect(result.currentDrawerIndex).toBe(0);
    });

    it("skip=true이면 캔버스를 지우고 턴을 넘긴다", () => {
      const state = engine.initState(mockPlayers) as LiarDrawingPublicState;
      const drawingState = engine.startDrawingPhase(state);
      const currentDrawer = drawingState.drawOrder[0];

      const points = [{ x: 10, y: 10, tool: "pen" as const, color: "black" as const, thickness: 5 as const, isStart: true }];
      const drawnState = engine.processMove(drawingState, currentDrawer, { type: "draw", points }) as LiarDrawingPublicState;
      expect(drawnState.canvases[currentDrawer]).toHaveLength(1);

      const result = engine.processMove(drawnState, currentDrawer, { type: "complete-turn", skip: true }) as LiarDrawingPublicState;
      expect(result.canvases[currentDrawer]).toHaveLength(0);
      expect(result.currentDrawerIndex).toBe(1);
    });

    it("skip=false이면 캔버스를 유지하고 턴을 넘긴다", () => {
      const state = engine.initState(mockPlayers) as LiarDrawingPublicState;
      const drawingState = engine.startDrawingPhase(state);
      const currentDrawer = drawingState.drawOrder[0];

      const points = [{ x: 10, y: 10, tool: "pen" as const, color: "black" as const, thickness: 5 as const, isStart: true }];
      const drawnState = engine.processMove(drawingState, currentDrawer, { type: "draw", points }) as LiarDrawingPublicState;

      const result = engine.processMove(drawnState, currentDrawer, { type: "complete-turn", skip: false }) as LiarDrawingPublicState;
      expect(result.canvases[currentDrawer]).toHaveLength(1);
      expect(result.currentDrawerIndex).toBe(1);
    });

    it("마지막 플레이어가 완료하면 투표 페이즈로 전환된다", () => {
      const state = engine.initState(mockPlayers) as LiarDrawingPublicState;
      const drawingState = engine.startDrawingPhase(state);

      let current = drawingState;
      for (let i = 0; i < mockPlayers.length; i++) {
        const drawer = current.drawOrder[current.currentDrawerIndex];
        current = engine.processMove(current, drawer, { type: "complete-turn" }) as LiarDrawingPublicState;
      }
      expect(current.phase).toBe("voting");
    });

    it("drawing 페이즈가 아니면 상태가 변경되지 않는다", () => {
      const state = engine.initState(mockPlayers) as LiarDrawingPublicState;
      const result = engine.processMove(state, state.drawOrder[0], { type: "complete-turn" }) as LiarDrawingPublicState;
      expect(result.phase).toBe("role-reveal");
    });
  });

  describe("phase-ready", () => {
    it("round-result에서 마지막 라운드면 final-result로 전환한다", () => {
      const state = engine.initState(mockPlayers) as LiarDrawingPublicState;
      const roundResultState: LiarDrawingPublicState = {
        ...state,
        phase: "round-result",
        roundNumber: 2, // totalRounds is 2
      };

      const result = engine.processMove(roundResultState, "p1", { type: "phase-ready" }) as LiarDrawingPublicState;
      expect(result.phase).toBe("final-result");
    });

    it("round-result에서 아직 라운드가 남으면 새 라운드를 시작한다", () => {
      const state = engine.initState(mockPlayers) as LiarDrawingPublicState;
      const roundResultState: LiarDrawingPublicState = {
        ...state,
        phase: "round-result",
        roundNumber: 1, // totalRounds is 2
      };

      const result = engine.processMove(roundResultState, "p1", { type: "phase-ready" }) as LiarDrawingPublicState;
      expect(result.phase).toBe("role-reveal");
      expect(result.roundNumber).toBe(2);
    });
  });
});
