import { useGameStore } from "./game-store";
import type { GameState, GameResult } from "@game-hub/shared-types";

describe("useGameStore", () => {
  beforeEach(() => {
    useGameStore.setState(useGameStore.getInitialState());
  });

  describe("setGameState", () => {
    it("게임 상태를 설정한다", () => {
      const state = { type: "gomoku" } as unknown as GameState;
      useGameStore.getState().setGameState(state);
      expect(useGameStore.getState().gameState).toBe(state);
    });
  });

  describe("setGameResult", () => {
    it("게임 결과를 설정한다", () => {
      const result: GameResult = { winnerId: "p1", winnerNickname: "Player1", reason: "5목 완성" };
      useGameStore.getState().setGameResult(result);
      expect(useGameStore.getState().gameResult).toEqual(result);
    });

    it("null로 게임 결과를 초기화한다", () => {
      useGameStore.getState().setGameResult({ winnerId: "p1", winnerNickname: "P1", reason: "승리" });
      useGameStore.getState().setGameResult(null);
      expect(useGameStore.getState().gameResult).toBeNull();
    });
  });

  describe("setPrivateState", () => {
    it("비공개 상태를 설정한다", () => {
      const privateState = { cards: [] } as unknown as Parameters<ReturnType<typeof useGameStore.getState>["setPrivateState"]>[0];
      useGameStore.getState().setPrivateState(privateState);
      expect(useGameStore.getState().privateState).toBe(privateState);
    });
  });

  describe("setPlayerLeftInfo", () => {
    it("플레이어 퇴장 정보를 설정한다", () => {
      useGameStore.getState().setPlayerLeftInfo({ nickname: "탈주자", willEnd: true });
      expect(useGameStore.getState().playerLeftInfo).toEqual({ nickname: "탈주자", willEnd: true });
    });

    it("null로 초기화한다", () => {
      useGameStore.getState().setPlayerLeftInfo({ nickname: "탈주자", willEnd: false });
      useGameStore.getState().setPlayerLeftInfo(null);
      expect(useGameStore.getState().playerLeftInfo).toBeNull();
    });
  });

  describe("setRoundResult", () => {
    it("라운드 결과를 설정한다", () => {
      const result = {
        winners: [{ playerId: "p1", amount: 100, handName: "원페어" }],
        eliminatedPlayerIds: [],
        nextRoundIn: 3000,
      };
      useGameStore.getState().setRoundResult(result);
      expect(useGameStore.getState().roundResult).toEqual(result);
    });
  });

  describe("reset", () => {
    it("모든 상태를 null로 초기화한다", () => {
      useGameStore.getState().setGameState({ type: "gomoku" } as unknown as GameState);
      useGameStore.getState().setGameResult({ winnerId: "p1", winnerNickname: "P1", reason: "승리" });
      useGameStore.getState().setPlayerLeftInfo({ nickname: "test", willEnd: false });
      useGameStore.getState().reset();

      const state = useGameStore.getState();
      expect(state.gameState).toBeNull();
      expect(state.gameResult).toBeNull();
      expect(state.privateState).toBeNull();
      expect(state.playerLeftInfo).toBeNull();
      expect(state.roundResult).toBeNull();
    });
  });
});
