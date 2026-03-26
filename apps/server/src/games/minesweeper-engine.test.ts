import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { MinesweeperEngine } from "./minesweeper-engine.js";
import type { Player, MinesweeperPublicState, MinesweeperMove } from "@game-hub/shared-types";

const mockPlayers: Player[] = [
  { id: "player1", nickname: "지뢰찾기유저", isReady: true },
];

function createTestBoard(rows: number, cols: number, mines: [number, number][]) {
  const board = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({
      hasMine: false,
      adjacentMines: 0,
      status: "hidden" as const,
    })),
  );

  for (const [r, c] of mines) {
    board[r][c].hasMine = true;
  }

  // Calculate adjacent counts
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (board[r][c].hasMine) continue;
      let count = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && board[nr][nc].hasMine) {
            count++;
          }
        }
      }
      board[r][c].adjacentMines = count;
    }
  }

  return board;
}

// reveal/chord 간격 제한(50ms)을 통과시키기 위해 시간을 전진시키는 헬퍼
function tick(ms = 60) {
  vi.advanceTimersByTime(ms);
}

// 인간적 클릭 패턴 시뮬레이션 (봇 탐지 통과용)
let humanTickIdx = 0;
const HUMAN_INTERVALS = [200, 350, 150, 500, 180, 2500, 300, 120, 400, 280, 3000, 250, 170, 600, 90];
function humanTick() {
  const ms = HUMAN_INTERVALS[humanTickIdx % HUMAN_INTERVALS.length];
  humanTickIdx++;
  vi.advanceTimersByTime(ms);
}

describe("MinesweeperEngine", () => {
  let engine: MinesweeperEngine;

  beforeEach(() => {
    vi.useFakeTimers();
    humanTickIdx = 0;
    engine = new MinesweeperEngine();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("gameType이 minesweeper이다", () => {
    expect(engine.gameType).toBe("minesweeper");
  });

  it("1인 게임이다", () => {
    expect(engine.minPlayers).toBe(1);
    expect(engine.maxPlayers).toBe(1);
  });

  describe("initState", () => {
    it("기본 난이도(초급)로 9x9 빈 보드를 생성한다", () => {
      const state = engine.initState(mockPlayers);
      expect(state.rows).toBe(9);
      expect(state.cols).toBe(9);
      expect(state.board).toHaveLength(9);
      expect(state.board[0]).toHaveLength(9);
      expect(state.difficulty).toBe("beginner");
    });

    it("모든 셀이 hidden 상태이다", () => {
      const state = engine.initState(mockPlayers);
      for (const row of state.board) {
        for (const cell of row) {
          expect(cell.status).toBe("hidden");
        }
      }
    });

    it("초기 상태가 올바르다", () => {
      const state = engine.initState(mockPlayers);
      expect(state.status).toBe("playing");
      expect(state.mineCount).toBe(10);
      expect(state.flagCount).toBe(0);
      expect(state.revealedCount).toBe(0);
      expect(state.startedAt).toBeNull();
      expect(state.playerId).toBe("player1");
    });
  });

  describe("난이도별 초기화", () => {
    it("중급은 16x16 보드에 지뢰 40개이다", () => {
      const intermediateEngine = new MinesweeperEngine("intermediate");
      const state = intermediateEngine.initState(mockPlayers);
      expect(state.rows).toBe(16);
      expect(state.cols).toBe(16);
      expect(state.mineCount).toBe(40);
      expect(state.difficulty).toBe("intermediate");
      expect(state.board).toHaveLength(16);
      expect(state.board[0]).toHaveLength(16);
    });

    it("고급은 16x30 보드에 지뢰 99개이다", () => {
      const expertEngine = new MinesweeperEngine("expert");
      const state = expertEngine.initState(mockPlayers);
      expect(state.rows).toBe(16);
      expect(state.cols).toBe(30);
      expect(state.mineCount).toBe(99);
      expect(state.difficulty).toBe("expert");
      expect(state.board).toHaveLength(16);
      expect(state.board[0]).toHaveLength(30);
    });

    it("중급에서 첫 클릭이 안전하다", () => {
      const intermediateEngine = new MinesweeperEngine("intermediate");
      const state = intermediateEngine.initState(mockPlayers);
      const move: MinesweeperMove = { type: "reveal", row: 8, col: 8 };
      const newState = intermediateEngine.processMove(state, "player1", move);
      expect(newState.status).toBe("playing");
      expect(newState.board[8][8].status).toBe("revealed");
    });

    it("고급에서 첫 클릭이 안전하다", () => {
      const expertEngine = new MinesweeperEngine("expert");
      const state = expertEngine.initState(mockPlayers);
      const move: MinesweeperMove = { type: "reveal", row: 8, col: 15 };
      const newState = expertEngine.processMove(state, "player1", move);
      expect(newState.status).toBe("playing");
      expect(newState.board[8][15].status).toBe("revealed");
    });
  });

  describe("processMove - reveal", () => {
    it("첫 클릭은 안전하다", () => {
      const state = engine.initState(mockPlayers);
      const move: MinesweeperMove = { type: "reveal", row: 4, col: 4 };
      const newState = engine.processMove(state, "player1", move);
      expect(newState.status).toBe("playing");
      expect(newState.startedAt).not.toBeNull();
      // 첫 클릭 위치는 반드시 revealed
      expect(newState.board[4][4].status).toBe("revealed");
    });

    it("지뢰를 밟으면 lost 상태가 된다", () => {
      const state = engine.initState(mockPlayers);
      // 지뢰 위치를 직접 설정
      const board = createTestBoard(9, 9, [[0, 0]]);
      engine._setBoard(board);
      engine._setStartedAt(Date.now());

      const move: MinesweeperMove = { type: "reveal", row: 0, col: 0 };
      const newState = engine.processMove(state, "player1", move);
      expect(newState.status).toBe("lost");
    });

    it("lost 상태에서 모든 지뢰 위치를 공개한다", () => {
      const state = engine.initState(mockPlayers);
      const mines: [number, number][] = [[0, 0], [1, 1], [2, 2]];
      const board = createTestBoard(9, 9, mines);
      engine._setBoard(board);
      engine._setStartedAt(Date.now());

      const move: MinesweeperMove = { type: "reveal", row: 0, col: 0 };
      const newState = engine.processMove(state, "player1", move);
      expect(newState.status).toBe("lost");
      for (const [r, c] of mines) {
        expect(newState.board[r][c].hasMine).toBe(true);
      }
    });

    it("인접 지뢰가 0이면 flood fill로 자동 오픈한다", () => {
      const state = engine.initState(mockPlayers);
      // 지뢰를 구석에만 배치
      const board = createTestBoard(9, 9, [[8, 8]]);
      engine._setBoard(board);
      engine._setStartedAt(Date.now());

      const move: MinesweeperMove = { type: "reveal", row: 0, col: 0 };
      const newState = engine.processMove(state, "player1", move);
      // (0,0)은 지뢰에서 멀리 있어 flood fill이 많이 열려야 함
      expect(newState.revealedCount).toBeGreaterThan(1);
    });

    it("이미 열린 셀은 다시 열 수 없다", () => {
      const state = engine.initState(mockPlayers);
      const board = createTestBoard(9, 9, [[8, 8]]);
      engine._setBoard(board);
      engine._setStartedAt(Date.now());

      const move: MinesweeperMove = { type: "reveal", row: 0, col: 0 };
      const s1 = engine.processMove(state, "player1", move);
      tick();
      const s2 = engine.processMove(s1, "player1", move);
      expect(s2.revealedCount).toBe(s1.revealedCount);
    });

    it("범위 밖 좌표는 무시한다", () => {
      const state = engine.initState(mockPlayers);
      const s1 = engine.processMove(state, "player1", { type: "reveal", row: -1, col: 0 });
      expect(s1.revealedCount).toBe(0);
      const s2 = engine.processMove(state, "player1", { type: "reveal", row: 0, col: 9 });
      expect(s2.revealedCount).toBe(0);
    });

    it("다른 플레이어의 이동은 무시한다", () => {
      const state = engine.initState(mockPlayers);
      const board = createTestBoard(9, 9, [[8, 8]]);
      engine._setBoard(board);
      engine._setStartedAt(Date.now());

      const move: MinesweeperMove = { type: "reveal", row: 0, col: 0 };
      const newState = engine.processMove(state, "other-player", move);
      expect(newState.revealedCount).toBe(0);
    });

    it("모든 비지뢰 셀을 열면 won 상태가 된다", () => {
      const state = engine.initState(mockPlayers);
      // 지뢰 1개만 배치 (8,8)
      const board = createTestBoard(9, 9, [[8, 8]]);
      engine._setBoard(board);
      engine._setStartedAt(Date.now());

      // (0,0)에서 flood fill하면 (8,8) 주변 빼고 대부분 열림
      let s = engine.processMove(state, "player1", { type: "reveal", row: 0, col: 0 });

      // 아직 안 열린 non-mine 셀 찾아서 열기
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (s.board[r][c].status === "hidden" && !(r === 8 && c === 8)) {
            tick();
            s = engine.processMove(s, "player1", { type: "reveal", row: r, col: c });
          }
        }
      }

      expect(s.status).toBe("won");
      expect(s.revealedCount).toBe(9 * 9 - 1);
    });
  });

  describe("processMove - flag", () => {
    it("숨겨진 셀에 깃발을 놓는다", () => {
      const state = engine.initState(mockPlayers);
      const move: MinesweeperMove = { type: "flag", row: 0, col: 0 };
      const newState = engine.processMove(state, "player1", move);
      expect(newState.board[0][0].status).toBe("flagged");
      expect(newState.flagCount).toBe(1);
    });

    it("깃발을 물음표로 변경한다", () => {
      const state = engine.initState(mockPlayers);
      let s = engine.processMove(state, "player1", { type: "flag", row: 0, col: 0 });
      expect(s.flagCount).toBe(1);
      s = engine.processMove(s, "player1", { type: "question", row: 0, col: 0 });
      expect(s.board[0][0].status).toBe("questioned");
      expect(s.flagCount).toBe(0);
    });

    it("물음표를 원래 상태로 되돌린다", () => {
      const state = engine.initState(mockPlayers);
      let s = engine.processMove(state, "player1", { type: "flag", row: 0, col: 0 });
      s = engine.processMove(s, "player1", { type: "question", row: 0, col: 0 });
      s = engine.processMove(s, "player1", { type: "unquestion", row: 0, col: 0 });
      expect(s.board[0][0].status).toBe("hidden");
      expect(s.flagCount).toBe(0);
    });

    it("열린 셀에는 깃발을 놓을 수 없다", () => {
      const state = engine.initState(mockPlayers);
      const board = createTestBoard(9, 9, [[8, 8]]);
      engine._setBoard(board);
      engine._setStartedAt(Date.now());

      const s1 = engine.processMove(state, "player1", { type: "reveal", row: 0, col: 0 });
      const s2 = engine.processMove(s1, "player1", { type: "flag", row: 0, col: 0 });
      expect(s2.board[0][0].status).toBe("revealed");
      expect(s2.flagCount).toBe(0);
    });

    it("flagged 셀에 flag는 무시된다", () => {
      const state = engine.initState(mockPlayers);
      let s = engine.processMove(state, "player1", { type: "flag", row: 0, col: 0 });
      s = engine.processMove(s, "player1", { type: "flag", row: 0, col: 0 });
      expect(s.flagCount).toBe(1);
    });

    it("hidden 셀에 question은 무시된다", () => {
      const state = engine.initState(mockPlayers);
      const s = engine.processMove(state, "player1", { type: "question", row: 0, col: 0 });
      expect(s.board[0][0].status).toBe("hidden");
    });

    it("hidden 셀에 unquestion은 무시된다", () => {
      const state = engine.initState(mockPlayers);
      const s = engine.processMove(state, "player1", { type: "unquestion", row: 0, col: 0 });
      expect(s.board[0][0].status).toBe("hidden");
    });

    it("questioned 셀은 reveal할 수 없다", () => {
      const state = engine.initState(mockPlayers);
      const board = createTestBoard(9, 9, [[8, 8]]);
      engine._setBoard(board);
      engine._setStartedAt(Date.now());

      let s = engine.processMove(state, "player1", { type: "flag", row: 0, col: 0 });
      s = engine.processMove(s, "player1", { type: "question", row: 0, col: 0 });
      tick();
      s = engine.processMove(s, "player1", { type: "reveal", row: 0, col: 0 });
      expect(s.board[0][0].status).toBe("questioned");
    });

    it("우클릭 순환: hidden → flagged → questioned → hidden", () => {
      const state = engine.initState(mockPlayers);
      let s = engine.processMove(state, "player1", { type: "flag", row: 0, col: 0 });
      expect(s.board[0][0].status).toBe("flagged");
      expect(s.flagCount).toBe(1);

      s = engine.processMove(s, "player1", { type: "question", row: 0, col: 0 });
      expect(s.board[0][0].status).toBe("questioned");
      expect(s.flagCount).toBe(0);

      s = engine.processMove(s, "player1", { type: "unquestion", row: 0, col: 0 });
      expect(s.board[0][0].status).toBe("hidden");
      expect(s.flagCount).toBe(0);
    });
  });

  describe("checkWin", () => {
    it("won 상태일 때 GameResult를 반환한다", () => {
      const state = engine.initState(mockPlayers);
      const board = createTestBoard(9, 9, [[8, 8]]);
      engine._setBoard(board);
      engine._setStartedAt(Date.now());

      // 모든 비지뢰 셀 열기
      let s: MinesweeperPublicState = state;
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (!(r === 8 && c === 8)) {
            tick();
            s = engine.processMove(s, "player1", { type: "reveal", row: r, col: c });
          }
        }
      }

      const result = engine.checkWin(s);
      expect(result).not.toBeNull();
      expect(result!.winnerId).toBe("player1");
    });

    it("lost 상태일 때 winnerId가 null이다", () => {
      const state = engine.initState(mockPlayers);
      const board = createTestBoard(9, 9, [[0, 0]]);
      engine._setBoard(board);
      engine._setStartedAt(Date.now());

      const s = engine.processMove(state, "player1", { type: "reveal", row: 0, col: 0 });
      const result = engine.checkWin(s);
      expect(result).not.toBeNull();
      expect(result!.winnerId).toBeNull();
    });

    it("게임 진행 중이면 null을 반환한다", () => {
      const state = engine.initState(mockPlayers);
      expect(engine.checkWin(state)).toBeNull();
    });
  });

  describe("getCompletionTime", () => {
    it("승리 전에는 null을 반환한다", () => {
      engine.initState(mockPlayers);
      expect(engine.getCompletionTime()).toBeNull();
    });

    it("승리 후 완료 시간을 반환한다", () => {
      engine.initState(mockPlayers);
      // 10개 지뢰를 교차 배치하여 대부분의 안전 셀이 인접 지뢰 보유
      // beginner mineCount=10에 맞춰야 checkWinCondition이 정상 작동
      const mines: [number, number][] = [
        [0, 0], [0, 3], [0, 6],
        [3, 1], [3, 4], [3, 7],
        [6, 0], [6, 3], [6, 6],
        [8, 8],
      ];
      const board = createTestBoard(9, 9, mines);
      engine._setBoard(board);
      engine._setStartedAt(Date.now() - 5000);

      // 모든 비지뢰 셀을 인간적 간격으로 열기
      let s = engine.toPublicState();
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (!board[r][c].hasMine && s.board[r][c].status === "hidden") {
            humanTick();
            s = engine.processMove(s, "player1", { type: "reveal", row: r, col: c });
          }
        }
      }

      const time = engine.getCompletionTime();
      expect(time).not.toBeNull();
      expect(time!).toBeGreaterThanOrEqual(4000);
    });

    it("최소 시간 미만이면 null을 반환한다 (치팅 방지)", () => {
      // beginner 최소 시간: 3000ms
      engine.initState(mockPlayers);
      const board = createTestBoard(9, 9, [[0, 0], [0, 8], [8, 0]]);
      engine._setBoard(board);
      engine._setStartedAt(Date.now() - 1000); // 1초 전 시작 → 3초 미만

      // 여러 클릭으로 moveCount 충족하되 시간은 부족
      let s = engine.processMove(engine.toPublicState(), "player1", { type: "reveal", row: 4, col: 4 });
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (s.board[r][c].status === "hidden" && !board[r][c].hasMine) {
            tick();
            s = engine.processMove(s, "player1", { type: "reveal", row: r, col: c });
          }
        }
      }

      expect(engine.getCompletionTime()).toBeNull();
    });

    it("승리 시 completedAt을 즉시 기록하여 정확한 시간을 반환한다", () => {
      engine.initState(mockPlayers);
      // 10개 지뢰 교차 배치 (beginner mineCount=10)
      const mines: [number, number][] = [
        [0, 0], [0, 3], [0, 6],
        [3, 1], [3, 4], [3, 7],
        [6, 0], [6, 3], [6, 6],
        [8, 8],
      ];
      const board = createTestBoard(9, 9, mines);
      engine._setBoard(board);
      engine._setStartedAt(Date.now() - 5000);

      let s = engine.toPublicState();
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (!board[r][c].hasMine && s.board[r][c].status === "hidden") {
            humanTick();
            s = engine.processMove(s, "player1", { type: "reveal", row: r, col: c });
          }
        }
      }

      const time = engine.getCompletionTime();
      expect(time).not.toBeNull();
      expect(time!).toBeGreaterThanOrEqual(5000);
    });

    it("최소 클릭 수 미만이면 null을 반환한다", () => {
      // beginner MIN_MOVE_COUNT = 3
      // 단 1번의 reveal로 floodFill로 전체 열린 경우
      engine.initState(mockPlayers);
      const board = createTestBoard(9, 9, [[0, 0]]);
      engine._setBoard(board);
      engine._setStartedAt(Date.now() - 5000);

      // 단 1번 클릭으로 승리 → moveCount=1 < MIN_MOVE_COUNT=3
      engine.processMove(engine.toPublicState(), "player1", { type: "reveal", row: 8, col: 8 });

      expect(engine.getCompletionTime()).toBeNull();
    });

    it("중급 최소 시간 미만이면 null을 반환한다", () => {
      const intermediateEngine = new MinesweeperEngine("intermediate");
      intermediateEngine.initState(mockPlayers);
      const board = createTestBoard(16, 16, [[0, 0]]);
      intermediateEngine._setBoard(board);
      intermediateEngine._setStartedAt(Date.now() - 5000); // 5초 → 15초 미만

      // 모든 비지뢰 셀 열기
      for (let r = 0; r < 16; r++) {
        for (let c = 0; c < 16; c++) {
          if (!(r === 0 && c === 0)) {
            tick();
            intermediateEngine.processMove(intermediateEngine.toPublicState(), "player1", { type: "reveal", row: r, col: c });
          }
        }
      }

      expect(intermediateEngine.getCompletionTime()).toBeNull();
    });
  });

  describe("이동 속도 제한", () => {
    it("50ms 미만 간격의 reveal은 무시된다", () => {
      engine.initState(mockPlayers);
      const board = createTestBoard(9, 9, [[8, 8]]);
      engine._setBoard(board);
      engine._setStartedAt(Date.now());

      // 첫 reveal 성공
      const s1 = engine.processMove(engine.toPublicState(), "player1", { type: "reveal", row: 0, col: 0 });
      expect(s1.revealedCount).toBeGreaterThan(0);

      // 즉시 두 번째 reveal → rate limit에 의해 무시
      const s2 = engine.processMove(s1, "player1", { type: "reveal", row: 5, col: 5 });
      expect(s2.revealedCount).toBe(s1.revealedCount);
    });

    it("50ms 미만 간격의 chord도 무시된다", () => {
      engine.initState(mockPlayers);
      const board = createTestBoard(9, 9, [[0, 0]]);
      engine._setBoard(board);
      engine._setStartedAt(Date.now() - 10000);

      // (1,1) reveal
      let s = engine.processMove(engine.toPublicState(), "player1", { type: "reveal", row: 1, col: 1 });
      // (0,0)에 깃발
      s = engine.processMove(s, "player1", { type: "flag", row: 0, col: 0 });
      // 즉시 chord → rate limit에 의해 무시
      const countBefore = s.revealedCount;
      s = engine.processMove(s, "player1", { type: "chord", row: 1, col: 1 });
      expect(s.revealedCount).toBe(countBefore);
    });
  });

  describe("processMove - chord", () => {
    it("올바른 깃발 수일 때 주변 hidden 셀을 reveal한다", () => {
      engine.initState(mockPlayers);
      const board = createTestBoard(9, 9, [[0, 0]]);
      engine._setBoard(board);
      engine._setStartedAt(Date.now() - 10000);

      // (1,1) reveal
      let s = engine.processMove(engine.toPublicState(), "player1", { type: "reveal", row: 1, col: 1 });
      expect(s.board[1][1].status).toBe("revealed");
      expect(s.board[1][1].adjacentMines).toBe(1);

      // (0,0)에 깃발
      s = engine.processMove(s, "player1", { type: "flag", row: 0, col: 0 });

      // chord on (1,1)
      tick();
      s = engine.processMove(s, "player1", { type: "chord", row: 1, col: 1 });

      // (0,1), (1,0) 등 주변 hidden 셀이 열려야 함
      expect(s.board[0][1].status).toBe("revealed");
      expect(s.board[1][0].status).toBe("revealed");
    });

    it("깃발 수 불일치 시 무동작한다", () => {
      engine.initState(mockPlayers);
      const board = createTestBoard(9, 9, [[0, 0]]);
      engine._setBoard(board);
      engine._setStartedAt(Date.now() - 10000);

      let s = engine.processMove(engine.toPublicState(), "player1", { type: "reveal", row: 1, col: 1 });
      const countBefore = s.revealedCount;

      // 깃발 없이 chord — 깃발 수 불일치로 무동작 (간격 무관)
      tick();
      s = engine.processMove(s, "player1", { type: "chord", row: 1, col: 1 });
      expect(s.revealedCount).toBe(countBefore);
    });

    it("hidden 셀에서 chord는 무동작한다", () => {
      const state = engine.initState(mockPlayers);
      const board = createTestBoard(9, 9, [[8, 8]]);
      engine._setBoard(board);
      engine._setStartedAt(Date.now());

      const s = engine.processMove(state, "player1", { type: "chord", row: 0, col: 0 });
      expect(s.revealedCount).toBe(0);
    });

    it("adjacentMines=0인 셀에서 chord는 무동작한다", () => {
      engine.initState(mockPlayers);
      const board = createTestBoard(9, 9, [[8, 8]]);
      engine._setBoard(board);
      engine._setStartedAt(Date.now() - 10000);

      // (0,0) reveal → adjacentMines=0이므로 flood fill
      let s = engine.processMove(engine.toPublicState(), "player1", { type: "reveal", row: 0, col: 0 });
      const countBefore = s.revealedCount;

      // chord on (0,0) which has adjacentMines=0
      tick();
      s = engine.processMove(s, "player1", { type: "chord", row: 0, col: 0 });
      expect(s.revealedCount).toBe(countBefore);
    });

    it("chord로 지뢰를 밟으면 lost 상태가 된다", () => {
      engine.initState(mockPlayers);
      // (0,0)과 (0,2)에 지뢰 → (0,1)의 adjacentMines=2
      // (0,0)에만 깃발을 놓고 chord하면 (0,2) 지뢰를 밟음 — 깃발 수 불일치로 무동작
      // 대신: (0,0)에 지뢰, (0,1)에 잘못된 깃발 → (1,0)에서 chord
      // (1,0)의 adjacentMines=1, (0,0)이 아닌 (0,1)에 깃발 → chord로 (0,0) 열림 → lost
      const board = createTestBoard(9, 9, [[0, 0]]);
      engine._setBoard(board);
      engine._setStartedAt(Date.now() - 10000);

      // (1,0) reveal — adjacentMines=1
      let s = engine.processMove(engine.toPublicState(), "player1", { type: "reveal", row: 1, col: 0 });
      // (0,1)에 잘못된 깃발 (지뢰 없는 곳)
      s = engine.processMove(s, "player1", { type: "flag", row: 0, col: 1 });
      // chord on (1,0) → (0,0) 지뢰 열림
      tick();
      s = engine.processMove(s, "player1", { type: "chord", row: 1, col: 0 });
      expect(s.status).toBe("lost");
    });

    it("chord가 flagged/questioned 이웃을 건너뛴다", () => {
      engine.initState(mockPlayers);
      // (0,0), (0,2)에 지뢰 → (1,1)의 adjacentMines=2
      const board = createTestBoard(9, 9, [[0, 0], [0, 2]]);
      engine._setBoard(board);
      engine._setStartedAt(Date.now() - 10000);

      // (1,1) reveal
      let s = engine.processMove(engine.toPublicState(), "player1", { type: "reveal", row: 1, col: 1 });
      // (0,0)에 깃발, (0,2)에 깃발
      s = engine.processMove(s, "player1", { type: "flag", row: 0, col: 0 });
      s = engine.processMove(s, "player1", { type: "flag", row: 0, col: 2 });

      // (0,1)에 깃발 → 물음표로 변경
      s = engine.processMove(s, "player1", { type: "flag", row: 0, col: 1 });
      s = engine.processMove(s, "player1", { type: "question", row: 0, col: 1 });

      // chord on (1,1) — flagged 2개 == adjacentMines 2
      tick();
      s = engine.processMove(s, "player1", { type: "chord", row: 1, col: 1 });

      // (0,1)은 questioned이므로 건너뜀
      expect(s.board[0][1].status).toBe("questioned");
      // (1,0), (1,2) 등 hidden이었던 셀은 열림
      expect(s.board[1][0].status).toBe("revealed");
      expect(s.board[1][2].status).toBe("revealed");
    });

    it("chord로 승리할 수 있다", () => {
      engine.initState(mockPlayers);
      // 지뢰 1개만: (0,0)
      const board = createTestBoard(9, 9, [[0, 0]]);
      engine._setBoard(board);
      engine._setStartedAt(Date.now() - 10000);

      // 대부분의 셀을 열기
      let s = engine.processMove(engine.toPublicState(), "player1", { type: "reveal", row: 8, col: 8 });

      // (0,0)에 깃발
      s = engine.processMove(s, "player1", { type: "flag", row: 0, col: 0 });

      // 남은 hidden 셀 개별 reveal로 모두 열기
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (s.board[r][c].status === "hidden") {
            tick();
            s = engine.processMove(s, "player1", { type: "reveal", row: r, col: c });
          }
        }
      }

      expect(s.status).toBe("won");
    });

    it("floodFill이 questioned 셀을 건너뛴다", () => {
      engine.initState(mockPlayers);
      // (8,8)에만 지뢰
      const board = createTestBoard(9, 9, [[8, 8]]);
      engine._setBoard(board);
      engine._setStartedAt(Date.now() - 10000);

      // (4,4)에 깃발 → 물음표
      let s = engine.processMove(engine.toPublicState(), "player1", { type: "flag", row: 4, col: 4 });
      s = engine.processMove(s, "player1", { type: "question", row: 4, col: 4 });

      // (0,0) reveal → flood fill
      s = engine.processMove(s, "player1", { type: "reveal", row: 0, col: 0 });

      // (4,4)는 questioned 상태 유지
      expect(s.board[4][4].status).toBe("questioned");
    });
  });

  describe("getDifficulty", () => {
    it("설정된 난이도를 반환한다", () => {
      expect(engine.getDifficulty()).toBe("beginner");
    });

    it("expert 난이도를 반환한다", () => {
      const expertEngine = new MinesweeperEngine("expert");
      expect(expertEngine.getDifficulty()).toBe("expert");
    });
  });
});
