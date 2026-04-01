import { create } from "zustand";
import type { TetrisPlayerBoard, TetrisDifficulty, TetrisGameMode, TetrisPublicState, TetrisActivePiece, TetrominoType } from "@game-hub/shared-types";

interface TetrisBoardStore {
  myBoard: TetrisPlayerBoard | null;
  opponentBoards: Record<string, TetrisPlayerBoard>;
  difficulty: TetrisDifficulty | null;
  gameMode: TetrisGameMode | null;
  startedAt: number | null;
  myId: string | null;
  setPlayerBoard: (playerId: string, board: TetrisPlayerBoard) => void;
  setPlayerPiece: (playerId: string, activePiece: TetrisActivePiece | null, ghostRow: number, version: number, holdPiece: TetrominoType | null, canHold: boolean) => void;
  initFromState: (state: TetrisPublicState, myId: string) => void;
  reset: () => void;
}

export const useTetrisBoardStore = create<TetrisBoardStore>((set, get) => ({
  myBoard: null,
  opponentBoards: {},
  difficulty: null,
  gameMode: null,
  startedAt: null,
  myId: null,

  setPlayerBoard: (playerId, board) => {
    const { myId } = get();
    if (playerId === myId) {
      set({ myBoard: board });
    } else {
      set((state) => ({
        opponentBoards: { ...state.opponentBoards, [playerId]: board },
      }));
    }
  },

  setPlayerPiece: (playerId, activePiece, ghostRow, version, holdPiece, canHold) => {
    const { myId } = get();
    if (playerId === myId) {
      set((state) => {
        if (!state.myBoard) return {};
        return { myBoard: { ...state.myBoard, activePiece, ghostRow, version, holdPiece, canHold } };
      });
    } else {
      set((state) => {
        const existing = state.opponentBoards[playerId];
        if (!existing) return {};
        return {
          opponentBoards: {
            ...state.opponentBoards,
            [playerId]: { ...existing, activePiece, ghostRow, version, holdPiece, canHold },
          },
        };
      });
    }
  },

  initFromState: (state, myId) => {
    const opponentBoards: Record<string, TetrisPlayerBoard> = {};
    let myBoard: TetrisPlayerBoard | null = null;

    for (const [id, board] of Object.entries(state.players)) {
      if (id === myId) {
        myBoard = board;
      } else {
        opponentBoards[id] = board;
      }
    }

    set({
      myBoard,
      opponentBoards,
      difficulty: state.difficulty,
      gameMode: state.gameMode,
      startedAt: state.startedAt,
      myId,
    });
  },

  reset: () => set({
    myBoard: null,
    opponentBoards: {},
    difficulty: null,
    gameMode: null,
    startedAt: null,
    myId: null,
  }),
}));
