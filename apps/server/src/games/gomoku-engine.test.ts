import { describe, it, expect, beforeEach } from "vitest";
import { GomokuEngine } from "./gomoku-engine.js";
import type { Player, GomokuState } from "@game-hub/shared-types";

const mockPlayers: Player[] = [
  { id: "player1", nickname: "흑돌", isReady: true },
  { id: "player2", nickname: "백돌", isReady: true },
];

describe("GomokuEngine", () => {
  let engine: GomokuEngine;

  beforeEach(() => {
    engine = new GomokuEngine();
  });

  it("gameType이 gomoku이다", () => {
    expect(engine.gameType).toBe("gomoku");
  });

  it("2인 게임이다", () => {
    expect(engine.minPlayers).toBe(2);
    expect(engine.maxPlayers).toBe(2);
  });

  describe("initState", () => {
    it("15x15 빈 보드를 생성한다", () => {
      const state = engine.initState(mockPlayers);
      expect(state.board).toHaveLength(15);
      expect(state.board[0]).toHaveLength(15);
      expect(state.board.every((row) => row.every((cell) => cell === null))).toBe(true);
    });

    it("첫 번째 플레이어를 흑으로 설정한다", () => {
      const state = engine.initState(mockPlayers);
      expect(state.currentTurn).toBe("black");
      expect(state.players.black).toBe("player1");
      expect(state.players.white).toBe("player2");
    });

    it("초기 상태에 lastMove가 null이다", () => {
      const state = engine.initState(mockPlayers);
      expect(state.lastMove).toBeNull();
      expect(state.moveCount).toBe(0);
    });

    it("turnStartedAt과 gameStartedAt을 설정한다", () => {
      const before = Date.now();
      const state = engine.initState(mockPlayers);
      const after = Date.now();
      expect(state.turnStartedAt).toBeGreaterThanOrEqual(before);
      expect(state.turnStartedAt).toBeLessThanOrEqual(after);
      expect(state.gameStartedAt).toBeGreaterThanOrEqual(before);
      expect(state.gameStartedAt).toBeLessThanOrEqual(after);
    });

    it("기본 턴 제한시간은 30초이다", () => {
      const state = engine.initState(mockPlayers);
      expect(state.turnTimeSeconds).toBe(30);
    });

    it("생성자로 턴 제한시간을 설정할 수 있다", () => {
      const customEngine = new GomokuEngine(45);
      const state = customEngine.initState(mockPlayers);
      expect(state.turnTimeSeconds).toBe(45);
    });

    it("firstColor가 host이면 방장(players[0])이 흑이다", () => {
      const hostEngine = new GomokuEngine(30, "host");
      const state = hostEngine.initState(mockPlayers);
      expect(state.players.black).toBe("player1");
      expect(state.players.white).toBe("player2");
    });

    it("firstColor가 guest이면 상대(players[1])가 흑이다", () => {
      const guestEngine = new GomokuEngine(30, "guest");
      const state = guestEngine.initState(mockPlayers);
      expect(state.players.black).toBe("player2");
      expect(state.players.white).toBe("player1");
    });
  });

  describe("processMove", () => {
    let state: GomokuState;

    beforeEach(() => {
      state = engine.initState(mockPlayers);
    });

    it("유효한 위치에 돌을 놓는다", () => {
      const newState = engine.processMove(state, "player1", { row: 7, col: 7 });
      expect(newState.board[7][7]).toBe("black");
      expect(newState.lastMove).toEqual({ row: 7, col: 7 });
      expect(newState.moveCount).toBe(1);
    });

    it("돌을 놓으면 턴이 교대된다", () => {
      const newState = engine.processMove(state, "player1", { row: 7, col: 7 });
      expect(newState.currentTurn).toBe("white");
    });

    it("이미 돌이 있는 위치에 놓으면 상태가 변경되지 않는다", () => {
      const s1 = engine.processMove(state, "player1", { row: 7, col: 7 });
      const s2 = engine.processMove(s1, "player2", { row: 7, col: 7 });
      expect(s2).toBe(s1);
    });

    it("자기 차례가 아니면 상태가 변경되지 않는다", () => {
      const result = engine.processMove(state, "player2", { row: 7, col: 7 });
      expect(result).toBe(state);
    });

    it("보드 범위를 벗어나면 상태가 변경되지 않는다", () => {
      expect(engine.processMove(state, "player1", { row: -1, col: 0 })).toBe(state);
      expect(engine.processMove(state, "player1", { row: 0, col: 15 })).toBe(state);
      expect(engine.processMove(state, "player1", { row: 15, col: 0 })).toBe(state);
    });

    it("원래 보드를 변경하지 않는다 (불변성)", () => {
      const newState = engine.processMove(state, "player1", { row: 7, col: 7 });
      expect(state.board[7][7]).toBeNull();
      expect(newState.board[7][7]).toBe("black");
      expect(newState).not.toBe(state);
    });

    it("돌을 놓으면 turnStartedAt이 갱신된다", () => {
      const newState = engine.processMove(state, "player1", { row: 7, col: 7 });
      expect(newState.turnStartedAt).toBeGreaterThanOrEqual(state.turnStartedAt);
    });

    it("돌을 놓아도 gameStartedAt은 유지된다", () => {
      const newState = engine.processMove(state, "player1", { row: 7, col: 7 });
      expect(newState.gameStartedAt).toBe(state.gameStartedAt);
    });
  });

  describe("checkWin", () => {
    let state: GomokuState;

    beforeEach(() => {
      state = engine.initState(mockPlayers);
    });

    it("lastMove가 없으면 null을 반환한다", () => {
      expect(engine.checkWin(state)).toBeNull();
    });

    it("게임 진행 중이면 null을 반환한다", () => {
      const s = engine.processMove(state, "player1", { row: 7, col: 7 });
      expect(engine.checkWin(s)).toBeNull();
    });

    it("가로 5목을 판정한다", () => {
      let s = state;
      // 흑: (7,3), (7,4), (7,5), (7,6), (7,7)
      // 백: (8,3), (8,4), (8,5), (8,6)
      const blackMoves = [
        { row: 7, col: 3 },
        { row: 7, col: 4 },
        { row: 7, col: 5 },
        { row: 7, col: 6 },
        { row: 7, col: 7 },
      ];
      const whiteMoves = [
        { row: 8, col: 3 },
        { row: 8, col: 4 },
        { row: 8, col: 5 },
        { row: 8, col: 6 },
      ];

      for (let i = 0; i < 5; i++) {
        s = engine.processMove(s, "player1", blackMoves[i]);
        if (i < 4) {
          s = engine.processMove(s, "player2", whiteMoves[i]);
        }
      }

      const result = engine.checkWin(s);
      expect(result).not.toBeNull();
      expect(result!.winnerId).toBe("player1");
    });

    it("세로 5목을 판정한다", () => {
      let s = state;
      const blackMoves = [
        { row: 3, col: 7 },
        { row: 4, col: 7 },
        { row: 5, col: 7 },
        { row: 6, col: 7 },
        { row: 7, col: 7 },
      ];
      const whiteMoves = [
        { row: 3, col: 8 },
        { row: 4, col: 8 },
        { row: 5, col: 8 },
        { row: 6, col: 8 },
      ];

      for (let i = 0; i < 5; i++) {
        s = engine.processMove(s, "player1", blackMoves[i]);
        if (i < 4) {
          s = engine.processMove(s, "player2", whiteMoves[i]);
        }
      }

      const result = engine.checkWin(s);
      expect(result).not.toBeNull();
      expect(result!.winnerId).toBe("player1");
    });

    it("대각선 5목을 판정한다", () => {
      let s = state;
      const blackMoves = [
        { row: 3, col: 3 },
        { row: 4, col: 4 },
        { row: 5, col: 5 },
        { row: 6, col: 6 },
        { row: 7, col: 7 },
      ];
      const whiteMoves = [
        { row: 0, col: 1 },
        { row: 0, col: 2 },
        { row: 0, col: 3 },
        { row: 0, col: 4 },
      ];

      for (let i = 0; i < 5; i++) {
        s = engine.processMove(s, "player1", blackMoves[i]);
        if (i < 4) {
          s = engine.processMove(s, "player2", whiteMoves[i]);
        }
      }

      const result = engine.checkWin(s);
      expect(result).not.toBeNull();
      expect(result!.winnerId).toBe("player1");
    });

    it("역대각선 5목을 판정한다", () => {
      let s = state;
      const blackMoves = [
        { row: 7, col: 3 },
        { row: 6, col: 4 },
        { row: 5, col: 5 },
        { row: 4, col: 6 },
        { row: 3, col: 7 },
      ];
      const whiteMoves = [
        { row: 0, col: 1 },
        { row: 0, col: 2 },
        { row: 0, col: 3 },
        { row: 0, col: 4 },
      ];

      for (let i = 0; i < 5; i++) {
        s = engine.processMove(s, "player1", blackMoves[i]);
        if (i < 4) {
          s = engine.processMove(s, "player2", whiteMoves[i]);
        }
      }

      const result = engine.checkWin(s);
      expect(result).not.toBeNull();
      expect(result!.winnerId).toBe("player1");
    });

    it("장목(6목 이상)도 승리로 인정한다", () => {
      let s = state;
      const blackMoves = [
        { row: 7, col: 2 },
        { row: 7, col: 3 },
        { row: 7, col: 4 },
        { row: 7, col: 5 },
        { row: 7, col: 6 },
        { row: 7, col: 7 },
      ];
      const whiteMoves = [
        { row: 8, col: 2 },
        { row: 8, col: 3 },
        { row: 8, col: 4 },
        { row: 8, col: 5 },
        { row: 8, col: 6 },
      ];

      for (let i = 0; i < 6; i++) {
        s = engine.processMove(s, "player1", blackMoves[i]);
        if (i < 5) {
          s = engine.processMove(s, "player2", whiteMoves[i]);
        }
      }

      const result = engine.checkWin(s);
      expect(result).not.toBeNull();
      expect(result!.winnerId).toBe("player1");
    });

    it("225칸이 모두 차면 무승부를 반환한다", () => {
      // 보드를 무승부가 되도록 채운다
      const board: ("black" | "white" | null)[][] = Array.from({ length: 15 }, (_, row) =>
        Array.from({ length: 15 }, (_, col) => {
          // 5목이 만들어지지 않도록 3줄씩 교대 패턴
          const band = Math.floor(row / 3);
          return band % 2 === 0
            ? col % 2 === 0 ? "black" : "white"
            : col % 2 === 0 ? "white" : "black";
        })
      );

      const drawState: GomokuState = {
        board,
        currentTurn: "black",
        players: { black: "player1", white: "player2" },
        lastMove: { row: 14, col: 14 },
        moveCount: 225,
        turnStartedAt: Date.now(),
        gameStartedAt: Date.now(),
        turnTimeSeconds: 30,
        winLine: null,
        forbiddenMoves: null,
      };

      const result = engine.checkWin(drawState);
      // lastMove 위치에서 5목이 안 되면 moveCount >= 225로 무승부
      expect(result).not.toBeNull();
      expect(result!.winnerId).toBeNull();
      expect(result!.reason).toContain("무승부");
    });
  });

  describe("free rule에서 forbiddenMoves", () => {
    it("free rule에서 forbiddenMoves는 null이다", () => {
      const state = engine.initState(mockPlayers);
      expect(state.forbiddenMoves).toBeNull();
    });
  });
});

describe("GomokuEngine (renju rule)", () => {
  let engine: GomokuEngine;

  beforeEach(() => {
    engine = new GomokuEngine(30, "host", "renju");
  });

  describe("initState", () => {
    it("렌주룰에서 forbiddenMoves는 빈 배열이다", () => {
      const state = engine.initState(mockPlayers);
      expect(state.forbiddenMoves).toEqual([]);
    });
  });

  describe("processMove", () => {
    it("흑의 삼삼 금수를 차단한다", () => {
      let s = engine.initState(mockPlayers);
      // 삼삼 구성: 가로 (7,5)(7,6), 세로 (5,7)(6,7), (7,7)에 놓으면 삼삼
      s = engine.processMove(s, "player1", { row: 7, col: 5 }); // 흑
      s = engine.processMove(s, "player2", { row: 0, col: 0 }); // 백
      s = engine.processMove(s, "player1", { row: 7, col: 6 }); // 흑
      s = engine.processMove(s, "player2", { row: 0, col: 1 }); // 백
      s = engine.processMove(s, "player1", { row: 5, col: 7 }); // 흑
      s = engine.processMove(s, "player2", { row: 0, col: 2 }); // 백
      s = engine.processMove(s, "player1", { row: 6, col: 7 }); // 흑
      s = engine.processMove(s, "player2", { row: 0, col: 3 }); // 백

      // 이제 흑 차례, (7,7)은 삼삼 금수
      const before = s;
      const after = engine.processMove(s, "player1", { row: 7, col: 7 });
      expect(after).toBe(before); // 착수 거부
    });

    it("흑의 사사 금수를 차단한다", () => {
      let s = engine.initState(mockPlayers);
      // 사사 구성: 가로 (7,4)(7,5)(7,6), 세로 (4,7)(5,7)(6,7)
      s = engine.processMove(s, "player1", { row: 7, col: 4 }); // 흑
      s = engine.processMove(s, "player2", { row: 0, col: 0 }); // 백
      s = engine.processMove(s, "player1", { row: 7, col: 5 }); // 흑
      s = engine.processMove(s, "player2", { row: 0, col: 1 }); // 백
      s = engine.processMove(s, "player1", { row: 7, col: 6 }); // 흑
      s = engine.processMove(s, "player2", { row: 0, col: 2 }); // 백
      s = engine.processMove(s, "player1", { row: 4, col: 7 }); // 흑
      s = engine.processMove(s, "player2", { row: 0, col: 3 }); // 백
      s = engine.processMove(s, "player1", { row: 5, col: 7 }); // 흑
      s = engine.processMove(s, "player2", { row: 0, col: 4 }); // 백
      s = engine.processMove(s, "player1", { row: 6, col: 7 }); // 흑
      s = engine.processMove(s, "player2", { row: 0, col: 5 }); // 백

      const before = s;
      const after = engine.processMove(s, "player1", { row: 7, col: 7 });
      expect(after).toBe(before); // 착수 거부
    });

    it("흑의 장목을 차단한다", () => {
      let s = engine.initState(mockPlayers);
      // 흑: (7,2)(7,3)(7,4)(7,5)(7,6) → (7,7)에 놓으면 6목
      s = engine.processMove(s, "player1", { row: 7, col: 2 }); // 흑
      s = engine.processMove(s, "player2", { row: 0, col: 0 }); // 백
      s = engine.processMove(s, "player1", { row: 7, col: 3 }); // 흑
      s = engine.processMove(s, "player2", { row: 0, col: 1 }); // 백
      s = engine.processMove(s, "player1", { row: 7, col: 4 }); // 흑
      s = engine.processMove(s, "player2", { row: 0, col: 2 }); // 백
      s = engine.processMove(s, "player1", { row: 7, col: 5 }); // 흑
      s = engine.processMove(s, "player2", { row: 0, col: 3 }); // 백
      s = engine.processMove(s, "player1", { row: 7, col: 6 }); // 흑
      s = engine.processMove(s, "player2", { row: 0, col: 4 }); // 백

      const before = s;
      const after = engine.processMove(s, "player1", { row: 7, col: 7 });
      expect(after).toBe(before); // 장목 금수
    });

    it("5목 완성은 금수 예외로 허용한다", () => {
      let s = engine.initState(mockPlayers);
      // 흑 5목: (7,3)(7,4)(7,5)(7,6) + (7,7)
      s = engine.processMove(s, "player1", { row: 7, col: 3 }); // 흑
      s = engine.processMove(s, "player2", { row: 0, col: 0 }); // 백
      s = engine.processMove(s, "player1", { row: 7, col: 4 }); // 흑
      s = engine.processMove(s, "player2", { row: 0, col: 1 }); // 백
      s = engine.processMove(s, "player1", { row: 7, col: 5 }); // 흑
      s = engine.processMove(s, "player2", { row: 0, col: 2 }); // 백
      s = engine.processMove(s, "player1", { row: 7, col: 6 }); // 흑
      s = engine.processMove(s, "player2", { row: 0, col: 3 }); // 백

      const after = engine.processMove(s, "player1", { row: 7, col: 7 });
      expect(after).not.toBe(s); // 착수 성공
      expect(after.board[7][7]).toBe("black");
    });

    it("백에게는 금수 규칙이 적용되지 않는다", () => {
      let s = engine.initState(mockPlayers);
      // 백으로 사사 구성
      s = engine.processMove(s, "player1", { row: 14, col: 14 }); // 흑 (아무데나)
      s = engine.processMove(s, "player2", { row: 7, col: 4 }); // 백
      s = engine.processMove(s, "player1", { row: 14, col: 13 }); // 흑
      s = engine.processMove(s, "player2", { row: 7, col: 5 }); // 백
      s = engine.processMove(s, "player1", { row: 14, col: 12 }); // 흑
      s = engine.processMove(s, "player2", { row: 7, col: 6 }); // 백
      s = engine.processMove(s, "player1", { row: 14, col: 11 }); // 흑
      s = engine.processMove(s, "player2", { row: 4, col: 7 }); // 백
      s = engine.processMove(s, "player1", { row: 14, col: 10 }); // 흑
      s = engine.processMove(s, "player2", { row: 5, col: 7 }); // 백
      s = engine.processMove(s, "player1", { row: 14, col: 9 }); // 흑
      s = engine.processMove(s, "player2", { row: 6, col: 7 }); // 백
      s = engine.processMove(s, "player1", { row: 14, col: 8 }); // 흑

      // 백 차례, (7,7)에 놓으면 사사이지만 백이라 허용
      const after = engine.processMove(s, "player2", { row: 7, col: 7 });
      expect(after).not.toBe(s);
      expect(after.board[7][7]).toBe("white");
    });

    it("흑 차례 전에 forbiddenMoves를 갱신한다", () => {
      let s = engine.initState(mockPlayers);
      // 삼삼 구성의 일부 배치
      s = engine.processMove(s, "player1", { row: 7, col: 5 }); // 흑
      s = engine.processMove(s, "player2", { row: 0, col: 0 }); // 백
      s = engine.processMove(s, "player1", { row: 7, col: 6 }); // 흑
      s = engine.processMove(s, "player2", { row: 0, col: 1 }); // 백
      s = engine.processMove(s, "player1", { row: 5, col: 7 }); // 흑
      s = engine.processMove(s, "player2", { row: 0, col: 2 }); // 백
      s = engine.processMove(s, "player1", { row: 6, col: 7 }); // 흑
      // 백 차례 후 흑 차례가 되면 forbiddenMoves 갱신
      s = engine.processMove(s, "player2", { row: 0, col: 3 });

      expect(s.forbiddenMoves).not.toBeNull();
      expect(s.forbiddenMoves).toContainEqual({ row: 7, col: 7 });
    });
  });

  describe("checkWin", () => {
    it("렌주룰에서 흑 5목은 승리한다", () => {
      let s = engine.initState(mockPlayers);
      const blackMoves = [
        { row: 7, col: 3 },
        { row: 7, col: 4 },
        { row: 7, col: 5 },
        { row: 7, col: 6 },
        { row: 7, col: 7 },
      ];
      const whiteMoves = [
        { row: 8, col: 3 },
        { row: 8, col: 4 },
        { row: 8, col: 5 },
        { row: 8, col: 6 },
      ];

      for (let i = 0; i < 5; i++) {
        s = engine.processMove(s, "player1", blackMoves[i]);
        if (i < 4) {
          s = engine.processMove(s, "player2", whiteMoves[i]);
        }
      }

      const result = engine.checkWin(s);
      expect(result).not.toBeNull();
      expect(result!.winnerId).toBe("player1");
    });

    it("렌주룰에서 백 6목 이상도 승리한다", () => {
      let s = engine.initState(mockPlayers);
      // 백 6목 구성
      s = engine.processMove(s, "player1", { row: 14, col: 14 }); // 흑
      s = engine.processMove(s, "player2", { row: 7, col: 2 }); // 백
      s = engine.processMove(s, "player1", { row: 14, col: 13 }); // 흑
      s = engine.processMove(s, "player2", { row: 7, col: 3 }); // 백
      s = engine.processMove(s, "player1", { row: 14, col: 12 }); // 흑
      s = engine.processMove(s, "player2", { row: 7, col: 4 }); // 백
      s = engine.processMove(s, "player1", { row: 14, col: 11 }); // 흑
      s = engine.processMove(s, "player2", { row: 7, col: 5 }); // 백
      s = engine.processMove(s, "player1", { row: 14, col: 10 }); // 흑
      s = engine.processMove(s, "player2", { row: 7, col: 6 }); // 백
      s = engine.processMove(s, "player1", { row: 14, col: 9 }); // 흑
      s = engine.processMove(s, "player2", { row: 7, col: 7 }); // 백 6목

      const result = engine.checkWin(s);
      expect(result).not.toBeNull();
      expect(result!.winnerId).toBe("player2");
    });
  });
});
