import { create } from "zustand";
import type { TetrisPlayerBoard, TetrisDifficulty, TetrisPublicState, TetrisActivePiece } from "@game-hub/shared-types";

interface TetrisBoardStore {
  myBoard: TetrisPlayerBoard | null;
  opponentBoards: Record<string, TetrisPlayerBoard>;
  difficulty: TetrisDifficulty | null;
  myId: string | null;
  setPlayerBoard: (playerId: string, board: TetrisPlayerBoard) => void;
  setPlayerPiece: (playerId: string, activePiece: TetrisActivePiece | null, ghostRow: number, version: number) => void;
  initFromState: (state: TetrisPublicState, myId: string) => void;
  reset: () => void;
}

export const useTetrisBoardStore = create<TetrisBoardStore>((set, get) => ({
  myBoard: null,
  opponentBoards: {},
  difficulty: null,
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

  setPlayerPiece: (playerId, activePiece, ghostRow, version) => {
    const { myId } = get();
    if (playerId === myId) {
      set((state) => {
        if (!state.myBoard) return {};
        return { myBoard: { ...state.myBoard, activePiece, ghostRow, version } };
      });
    } else {
      set((state) => {
        const existing = state.opponentBoards[playerId];
        if (!existing) return {};
        return {
          opponentBoards: {
            ...state.opponentBoards,
            [playerId]: { ...existing, activePiece, ghostRow, version },
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
      myId,
    });
  },

  reset: () => set({
    myBoard: null,
    opponentBoards: {},
    difficulty: null,
    myId: null,
  }),
}));
