import { useTetrisBoardStore } from "./tetris-board-store";
import type { TetrisPublicState, TetrisPlayerBoard, TetrisActivePiece } from "@game-hub/shared-types";

function createBoard(overrides: Partial<TetrisPlayerBoard> = {}): TetrisPlayerBoard {
  return {
    board: Array.from({ length: 20 }, () => Array(10).fill(null)),
    score: 0,
    level: 1,
    lines: 0,
    isGameOver: false,
    activePiece: null,
    ghostRow: 0,
    nextPieces: [],
    holdPiece: null,
    combo: 0,
    backToBack: false,
    version: 0,
    ...overrides,
  } as TetrisPlayerBoard;
}

function createState(myId: string): TetrisPublicState {
  return {
    players: {
      [myId]: createBoard(),
      "opponent-1": createBoard(),
    },
    difficulty: "intermediate",
  } as TetrisPublicState;
}

describe("useTetrisBoardStore", () => {
  beforeEach(() => {
    useTetrisBoardStore.setState(useTetrisBoardStore.getInitialState());
  });

  describe("initFromState", () => {
    it("내 보드와 상대 보드를 분리하여 초기화한다", () => {
      useTetrisBoardStore.getState().initFromState(createState("me"), "me");
      const state = useTetrisBoardStore.getState();
      expect(state.myBoard).not.toBeNull();
      expect(state.opponentBoards["opponent-1"]).toBeDefined();
      expect(state.myId).toBe("me");
    });

    it("difficulty를 설정한다", () => {
      useTetrisBoardStore.getState().initFromState(createState("me"), "me");
      const state = useTetrisBoardStore.getState();
      expect(state.difficulty).toBe("intermediate");
    });
  });

  describe("setPlayerBoard", () => {
    it("내 ID이면 myBoard를 갱신한다", () => {
      useTetrisBoardStore.getState().initFromState(createState("me"), "me");
      const newBoard = createBoard({ score: 500 });
      useTetrisBoardStore.getState().setPlayerBoard("me", newBoard);
      expect(useTetrisBoardStore.getState().myBoard?.score).toBe(500);
    });

    it("다른 ID이면 opponentBoards를 갱신한다", () => {
      useTetrisBoardStore.getState().initFromState(createState("me"), "me");
      const newBoard = createBoard({ score: 300 });
      useTetrisBoardStore.getState().setPlayerBoard("opponent-1", newBoard);
      expect(useTetrisBoardStore.getState().opponentBoards["opponent-1"]?.score).toBe(300);
    });
  });

  describe("setPlayerPiece", () => {
    const piece: TetrisActivePiece = { type: "T", row: 0, col: 4, rotation: 0 } as TetrisActivePiece;

    it("내 ID이면 myBoard의 activePiece를 갱신한다", () => {
      useTetrisBoardStore.getState().initFromState(createState("me"), "me");
      useTetrisBoardStore.getState().setPlayerPiece("me", piece, 18, 1, "T", false);
      const myBoard = useTetrisBoardStore.getState().myBoard;
      expect(myBoard?.activePiece).toEqual(piece);
      expect(myBoard?.ghostRow).toBe(18);
      expect(myBoard?.version).toBe(1);
      expect(myBoard?.holdPiece).toBe("T");
      expect(myBoard?.canHold).toBe(false);
    });

    it("myBoard가 null이면 아무것도 변경하지 않는다", () => {
      useTetrisBoardStore.setState({ myId: "me", myBoard: null });
      useTetrisBoardStore.getState().setPlayerPiece("me", piece, 18, 1, null, true);
      expect(useTetrisBoardStore.getState().myBoard).toBeNull();
    });

    it("다른 ID이면 opponentBoards의 activePiece를 갱신한다", () => {
      useTetrisBoardStore.getState().initFromState(createState("me"), "me");
      useTetrisBoardStore.getState().setPlayerPiece("opponent-1", piece, 15, 2, "I", true);
      expect(useTetrisBoardStore.getState().opponentBoards["opponent-1"]?.activePiece).toEqual(piece);
      expect(useTetrisBoardStore.getState().opponentBoards["opponent-1"]?.holdPiece).toBe("I");
      expect(useTetrisBoardStore.getState().opponentBoards["opponent-1"]?.canHold).toBe(true);
    });

    it("상대 보드가 없으면 아무것도 변경하지 않는다", () => {
      useTetrisBoardStore.getState().initFromState(createState("me"), "me");
      useTetrisBoardStore.getState().setPlayerPiece("unknown", piece, 0, 0, null, true);
      expect(useTetrisBoardStore.getState().opponentBoards["unknown"]).toBeUndefined();
    });
  });

  describe("reset", () => {
    it("모든 상태를 초기값으로 리셋한다", () => {
      useTetrisBoardStore.getState().initFromState(createState("me"), "me");
      useTetrisBoardStore.getState().reset();
      const state = useTetrisBoardStore.getState();
      expect(state.myBoard).toBeNull();
      expect(state.opponentBoards).toEqual({});
      expect(state.difficulty).toBeNull();
      expect(state.myId).toBeNull();
    });
  });
});
