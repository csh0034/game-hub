import { describe, it, expect, beforeEach } from "vitest";
import { CatchMindEngine } from "./catch-mind-engine.js";
import type { Player, CatchMindPublicState } from "@game-hub/shared-types";

const mockPlayers: Player[] = [
  { id: "p1", nickname: "Alice", isReady: true },
  { id: "p2", nickname: "Bob", isReady: true },
  { id: "p3", nickname: "Charlie", isReady: true },
];

describe("CatchMindEngine", () => {
  let engine: CatchMindEngine;

  beforeEach(() => {
    engine = new CatchMindEngine(60, 3, false);
  });

  describe("initState", () => {
    it("초기 상태를 올바르게 생성한다", () => {
      const state = engine.initState(mockPlayers) as CatchMindPublicState;

      expect(state.phase).toBe("role-reveal");
      expect(state.roundNumber).toBe(1);
      expect(state.totalRounds).toBe(3);
      expect(state.players).toHaveLength(3);
      expect(state.drawTimeSeconds).toBe(60);
      expect(state.canvas).toEqual([]);
      expect(state.guessOrder).toEqual([]);
      expect(state.roundEnded).toBe(false);
    });

    it("첫 번째 플레이어가 출제자로 선정된다", () => {
      const state = engine.initState(mockPlayers) as CatchMindPublicState;
      expect(state.drawerId).toBe("p1");
    });

    it("제시어가 선택된다", () => {
      engine.initState(mockPlayers);
      expect(engine.getKeyword()).toBeTruthy();
    });

    it("글자 수 힌트 OFF일 때 keywordLength가 null이다", () => {
      const state = engine.initState(mockPlayers) as CatchMindPublicState;
      expect(state.keywordLength).toBeNull();
      expect(state.showCharHint).toBe(false);
    });

    it("글자 수 힌트 ON일 때 keywordLength가 설정된다", () => {
      const hintEngine = new CatchMindEngine(60, 3, true);
      const state = hintEngine.initState(mockPlayers) as CatchMindPublicState;
      expect(state.keywordLength).toBeGreaterThan(0);
      expect(state.showCharHint).toBe(true);
    });
  });

  describe("startNewRound", () => {
    it("출제자가 순차적으로 교체된다", () => {
      const state1 = engine.initState(mockPlayers) as CatchMindPublicState;
      expect(state1.drawerId).toBe("p1");

      const state2 = engine.startNewRound({ ...state1, roundNumber: 2 });
      expect(state2.drawerId).toBe("p2");

      const state3 = engine.startNewRound({ ...state2, roundNumber: 3 });
      expect(state3.drawerId).toBe("p3");
    });

    it("라운드 초기화 시 캔버스가 비워진다", () => {
      const state = engine.initState(mockPlayers) as CatchMindPublicState;
      const newState = engine.startNewRound({ ...state, roundNumber: 2 });
      expect(newState.canvas).toEqual([]);
    });

    it("라운드 초기화 시 플레이어 상태가 초기화된다", () => {
      const state = engine.initState(mockPlayers) as CatchMindPublicState;
      const modifiedState: CatchMindPublicState = {
        ...state,
        roundNumber: 2,
        players: state.players.map((p) => ({ ...p, hasGuessedCorrectly: true })),
      };
      const newState = engine.startNewRound(modifiedState);
      expect(newState.players.every((p) => !p.hasGuessedCorrectly)).toBe(true);
    });
  });

  describe("startDrawingPhase", () => {
    it("drawing 페이즈로 전환한다", () => {
      const state = engine.initState(mockPlayers) as CatchMindPublicState;
      const drawingState = engine.startDrawingPhase(state);
      expect(drawingState.phase).toBe("drawing");
      expect(drawingState.turnStartedAt).not.toBeNull();
    });
  });

  describe("processMove", () => {
    it("출제자만 그림을 그릴 수 있다", () => {
      const state = engine.initState(mockPlayers) as CatchMindPublicState;
      const drawingState = engine.startDrawingPhase(state);

      const points = [{ x: 10, y: 10, tool: "pen" as const, color: "black" as const, thickness: 5 as const, isStart: true }];

      // 출제자가 그리면 성공
      const newState = engine.processMove(drawingState, "p1", { type: "draw", points }) as CatchMindPublicState;
      expect(newState.canvas).toHaveLength(1);

      // 다른 플레이어가 그리면 변화 없음
      const unchanged = engine.processMove(drawingState, "p2", { type: "draw", points }) as CatchMindPublicState;
      expect(unchanged.canvas).toHaveLength(0);
    });

    it("출제자만 캔버스를 초기화할 수 있다", () => {
      const state = engine.initState(mockPlayers) as CatchMindPublicState;
      const drawingState = engine.startDrawingPhase(state);

      const points = [{ x: 10, y: 10, tool: "pen" as const, color: "black" as const, thickness: 5 as const, isStart: true }];
      const withDrawing = engine.processMove(drawingState, "p1", { type: "draw", points }) as CatchMindPublicState;
      expect(withDrawing.canvas).toHaveLength(1);

      const cleared = engine.processMove(withDrawing, "p1", { type: "clear-canvas" }) as CatchMindPublicState;
      expect(cleared.canvas).toHaveLength(0);

      // 다른 플레이어의 clear-canvas는 무시
      const withDrawing2 = engine.processMove(cleared, "p1", { type: "draw", points }) as CatchMindPublicState;
      const notCleared = engine.processMove(withDrawing2, "p2", { type: "clear-canvas" }) as CatchMindPublicState;
      expect(notCleared.canvas).toHaveLength(1);
    });

    it("drawing 페이즈가 아닌 경우 draw를 무시한다", () => {
      const state = engine.initState(mockPlayers) as CatchMindPublicState;
      const points = [{ x: 10, y: 10, tool: "pen" as const, color: "black" as const, thickness: 5 as const, isStart: true }];

      const unchanged = engine.processMove(state, "p1", { type: "draw", points }) as CatchMindPublicState;
      expect(unchanged.canvas).toHaveLength(0);
    });
  });

  describe("checkGuess", () => {
    let drawingState: CatchMindPublicState;
    let keyword: string;

    beforeEach(() => {
      const state = engine.initState(mockPlayers) as CatchMindPublicState;
      drawingState = engine.startDrawingPhase(state);
      keyword = engine.getKeyword()!;
    });

    it("정답을 맞추면 correct: true를 반환한다", () => {
      const result = engine.checkGuess(drawingState, "p2", keyword);
      expect(result.correct).toBe(true);
      expect(result.newState.guessOrder).toEqual(["p2"]);

      const player = result.newState.players.find((p) => p.id === "p2")!;
      expect(player.hasGuessedCorrectly).toBe(true);
    });

    it("오답이면 correct: false를 반환한다", () => {
      const result = engine.checkGuess(drawingState, "p2", "존재하지않는단어");
      expect(result.correct).toBe(false);
    });

    it("정답에 공백이 있어도 맞출 수 있다", () => {
      const result = engine.checkGuess(drawingState, "p2", ` ${keyword} `);
      expect(result.correct).toBe(true);
    });

    it("출제자는 추측할 수 없다", () => {
      const result = engine.checkGuess(drawingState, "p1", keyword);
      expect(result.correct).toBe(false);
    });

    it("이미 맞춘 플레이어는 다시 추측할 수 없다", () => {
      const result1 = engine.checkGuess(drawingState, "p2", keyword);
      expect(result1.correct).toBe(true);

      const result2 = engine.checkGuess(result1.newState, "p2", keyword);
      expect(result2.correct).toBe(false);
    });

    it("drawing 페이즈가 아니면 추측할 수 없다", () => {
      const state = engine.initState(mockPlayers) as CatchMindPublicState;
      const result = engine.checkGuess(state, "p2", keyword);
      expect(result.correct).toBe(false);
    });

    it("맞춘 순서가 guessOrder에 기록된다", () => {
      const result1 = engine.checkGuess(drawingState, "p2", keyword);
      expect(result1.newState.guessOrder).toEqual(["p2"]);

      const result2 = engine.checkGuess(result1.newState, "p3", keyword);
      expect(result2.newState.guessOrder).toEqual(["p2", "p3"]);
    });

    it("모든 비출제자가 맞추면 roundEnded가 true가 된다", () => {
      const result1 = engine.checkGuess(drawingState, "p2", keyword);
      expect(result1.newState.roundEnded).toBe(false);

      const result2 = engine.checkGuess(result1.newState, "p3", keyword);
      expect(result2.newState.roundEnded).toBe(true);
    });

    it("roundEnded가 true이면 추가 정답을 맞출 수 없다", () => {
      const stateWithRoundEnded: CatchMindPublicState = {
        ...drawingState,
        roundEnded: true,
      };
      const result = engine.checkGuess(stateWithRoundEnded, "p2", keyword);
      expect(result.correct).toBe(false);
    });
  });

  describe("3등 후 라운드 종료 (5인)", () => {
    const fivePlayers: Player[] = [
      { id: "p1", nickname: "Alice", isReady: true },
      { id: "p2", nickname: "Bob", isReady: true },
      { id: "p3", nickname: "Charlie", isReady: true },
      { id: "p4", nickname: "Dave", isReady: true },
      { id: "p5", nickname: "Eve", isReady: true },
    ];

    it("3명이 맞추면 roundEnded가 true가 된다", () => {
      const eng = new CatchMindEngine(60, 3, false);
      const state = eng.initState(fivePlayers) as CatchMindPublicState;
      const drawingState = eng.startDrawingPhase(state);
      const kw = eng.getKeyword()!;

      const r1 = eng.checkGuess(drawingState, "p2", kw);
      expect(r1.newState.roundEnded).toBe(false);

      const r2 = eng.checkGuess(r1.newState, "p3", kw);
      expect(r2.newState.roundEnded).toBe(false);

      const r3 = eng.checkGuess(r2.newState, "p4", kw);
      expect(r3.newState.roundEnded).toBe(true);
      expect(r3.newState.guessOrder).toEqual(["p2", "p3", "p4"]);
    });

    it("3등 후 4등은 맞출 수 없다", () => {
      const eng = new CatchMindEngine(60, 3, false);
      const state = eng.initState(fivePlayers) as CatchMindPublicState;
      const drawingState = eng.startDrawingPhase(state);
      const kw = eng.getKeyword()!;

      const r1 = eng.checkGuess(drawingState, "p2", kw);
      const r2 = eng.checkGuess(r1.newState, "p3", kw);
      const r3 = eng.checkGuess(r2.newState, "p4", kw);

      const r4 = eng.checkGuess(r3.newState, "p5", kw);
      expect(r4.correct).toBe(false);
    });

    it("1등 3점, 2등 2점, 3등 1점 차등 부여 (5인)", () => {
      const eng = new CatchMindEngine(60, 3, false);
      const state = eng.initState(fivePlayers) as CatchMindPublicState;
      const drawingState = eng.startDrawingPhase(state);
      const kw = eng.getKeyword()!;

      const r1 = eng.checkGuess(drawingState, "p2", kw);
      const r2 = eng.checkGuess(r1.newState, "p3", kw);
      const r3 = eng.checkGuess(r2.newState, "p4", kw);
      const endedState = eng.endRound(r3.newState);

      expect(endedState.roundScores["p2"]).toBe(3); // 1등
      expect(endedState.roundScores["p3"]).toBe(2); // 2등
      expect(endedState.roundScores["p4"]).toBe(1); // 3등
      expect(endedState.roundScores["p1"]).toBe(1); // 출제자
      expect(endedState.roundScores["p5"]).toBe(0); // 못 맞춤
    });
  });

  describe("endRound", () => {
    it("1등 +3점, 출제자 +1점, 못 맞춘 플레이어 0점", () => {
      const state = engine.initState(mockPlayers) as CatchMindPublicState;
      const drawingState = engine.startDrawingPhase(state);
      const keyword = engine.getKeyword()!;

      const guessResult = engine.checkGuess(drawingState, "p2", keyword);
      const endedState = engine.endRound(guessResult.newState);

      expect(endedState.phase).toBe("round-result");
      expect(endedState.roundScores["p2"]).toBe(3); // 1등
      expect(endedState.roundScores["p1"]).toBe(1); // 출제자
      expect(endedState.roundScores["p3"]).toBe(0); // 못 맞춤
      expect(endedState.keyword).toBe(keyword); // 정답 공개
    });

    it("1등 +3점, 2등 +2점 차등 부여", () => {
      const state = engine.initState(mockPlayers) as CatchMindPublicState;
      const drawingState = engine.startDrawingPhase(state);
      const keyword = engine.getKeyword()!;

      const result1 = engine.checkGuess(drawingState, "p2", keyword);
      const result2 = engine.checkGuess(result1.newState, "p3", keyword);
      const endedState = engine.endRound(result2.newState);

      expect(endedState.roundScores["p2"]).toBe(3); // 1등
      expect(endedState.roundScores["p3"]).toBe(2); // 2등
      expect(endedState.roundScores["p1"]).toBe(1); // 출제자
    });

    it("아무도 못 맞추면 모두 0점", () => {
      const state = engine.initState(mockPlayers) as CatchMindPublicState;
      const drawingState = engine.startDrawingPhase(state);

      const endedState = engine.endRound(drawingState);

      expect(endedState.roundScores["p1"]).toBe(0); // 출제자
      expect(endedState.roundScores["p2"]).toBe(0);
      expect(endedState.roundScores["p3"]).toBe(0);
    });

    it("플레이어 점수가 누적된다", () => {
      const state = engine.initState(mockPlayers) as CatchMindPublicState;
      const drawingState = engine.startDrawingPhase(state);
      const keyword = engine.getKeyword()!;

      const guessResult = engine.checkGuess(drawingState, "p2", keyword);
      const endedState = engine.endRound(guessResult.newState);

      const p1 = endedState.players.find((p) => p.id === "p1")!;
      const p2 = endedState.players.find((p) => p.id === "p2")!;
      expect(p1.score).toBe(1); // 출제자
      expect(p2.score).toBe(3); // 1등
    });
  });

  describe("checkWin", () => {
    it("진행 중이면 null을 반환한다", () => {
      const state = engine.initState(mockPlayers) as CatchMindPublicState;
      expect(engine.checkWin(state)).toBeNull();

      const drawingState = engine.startDrawingPhase(state);
      expect(engine.checkWin(drawingState)).toBeNull();
    });

    it("final-result 시 최고 점수자를 반환한다", () => {
      const state: CatchMindPublicState = {
        phase: "final-result",
        roundNumber: 3,
        totalRounds: 3,
        drawerId: "p1",
        drawTimeSeconds: 60,
        turnStartedAt: null,
        players: [
          { id: "p1", nickname: "Alice", score: 2, hasGuessedCorrectly: false },
          { id: "p2", nickname: "Bob", score: 3, hasGuessedCorrectly: false },
          { id: "p3", nickname: "Charlie", score: 1, hasGuessedCorrectly: false },
        ],
        canvas: [],
        keyword: null,
        keywordLength: null,
        guessOrder: [],
        roundEnded: false,
        roundScores: {},
        showCharHint: false,
      };

      const result = engine.checkWin(state);
      expect(result).not.toBeNull();
      expect(result!.winnerId).toBe("p2");
    });

    it("동점이면 무승부를 반환한다", () => {
      const state: CatchMindPublicState = {
        phase: "final-result",
        roundNumber: 3,
        totalRounds: 3,
        drawerId: "p1",
        drawTimeSeconds: 60,
        turnStartedAt: null,
        players: [
          { id: "p1", nickname: "Alice", score: 2, hasGuessedCorrectly: false },
          { id: "p2", nickname: "Bob", score: 2, hasGuessedCorrectly: false },
          { id: "p3", nickname: "Charlie", score: 1, hasGuessedCorrectly: false },
        ],
        canvas: [],
        keyword: null,
        keywordLength: null,
        guessOrder: [],
        roundEnded: false,
        roundScores: {},
        showCharHint: false,
      };

      const result = engine.checkWin(state);
      expect(result).not.toBeNull();
      expect(result!.winnerId).toBeNull();
      expect(result!.reason).toContain("무승부");
    });
  });

  describe("phase-ready", () => {
    it("round-result에서 다음 라운드로 진행한다", () => {
      const state: CatchMindPublicState = {
        phase: "round-result",
        roundNumber: 1,
        totalRounds: 3,
        drawerId: "p1",
        drawTimeSeconds: 60,
        turnStartedAt: null,
        players: [
          { id: "p1", nickname: "Alice", score: 1, hasGuessedCorrectly: false },
          { id: "p2", nickname: "Bob", score: 1, hasGuessedCorrectly: false },
          { id: "p3", nickname: "Charlie", score: 0, hasGuessedCorrectly: false },
        ],
        canvas: [],
        keyword: "고양이",
        keywordLength: null,
        guessOrder: ["p2"],
        roundEnded: false,
        roundScores: { p1: 1, p2: 1, p3: 0 },
        showCharHint: false,
      };

      const newState = engine.processMove(state, "p1", { type: "phase-ready" }) as CatchMindPublicState;
      expect(newState.phase).toBe("role-reveal");
      expect(newState.roundNumber).toBe(2);
      expect(newState.drawerId).toBe("p2");
    });

    it("마지막 라운드에서 final-result로 전환한다", () => {
      const state: CatchMindPublicState = {
        phase: "round-result",
        roundNumber: 3,
        totalRounds: 3,
        drawerId: "p3",
        drawTimeSeconds: 60,
        turnStartedAt: null,
        players: [
          { id: "p1", nickname: "Alice", score: 2, hasGuessedCorrectly: false },
          { id: "p2", nickname: "Bob", score: 1, hasGuessedCorrectly: false },
          { id: "p3", nickname: "Charlie", score: 1, hasGuessedCorrectly: false },
        ],
        canvas: [],
        keyword: "강아지",
        keywordLength: null,
        guessOrder: [],
        roundEnded: false,
        roundScores: {},
        showCharHint: false,
      };

      const newState = engine.processMove(state, "p1", { type: "phase-ready" }) as CatchMindPublicState;
      expect(newState.phase).toBe("final-result");
    });
  });

  describe("constructor 제한", () => {
    it("그리기 시간이 1~120 범위로 제한된다", () => {
      const engine1 = new CatchMindEngine(0, 3, false);
      const state1 = engine1.initState(mockPlayers) as CatchMindPublicState;
      expect(state1.drawTimeSeconds).toBe(1);

      const engine2 = new CatchMindEngine(200, 3, false);
      const state2 = engine2.initState(mockPlayers) as CatchMindPublicState;
      expect(state2.drawTimeSeconds).toBe(120);
    });

    it("라운드 수가 1~10 범위로 제한된다", () => {
      const engine1 = new CatchMindEngine(60, 0, false);
      const state1 = engine1.initState(mockPlayers) as CatchMindPublicState;
      expect(state1.totalRounds).toBe(1);

      const engine2 = new CatchMindEngine(60, 20, false);
      const state2 = engine2.initState(mockPlayers) as CatchMindPublicState;
      expect(state2.totalRounds).toBe(10);
    });
  });
});
