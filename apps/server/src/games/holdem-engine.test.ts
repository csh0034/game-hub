import { describe, it, expect, beforeEach } from "vitest";
import { HoldemEngine } from "./holdem-engine";
import type { Player, HoldemPublicState, HoldemMove } from "@game-hub/shared-types";

const mockPlayers: Player[] = [
  { id: "player1", nickname: "Alice", isReady: true },
  { id: "player2", nickname: "Bob", isReady: true },
];

const threePlayers: Player[] = [
  { id: "player1", nickname: "Alice", isReady: true },
  { id: "player2", nickname: "Bob", isReady: true },
  { id: "player3", nickname: "Charlie", isReady: true },
];

describe("HoldemEngine", () => {
  let engine: HoldemEngine;

  beforeEach(() => {
    engine = new HoldemEngine();
  });

  it("gameType이 texas-holdem이다", () => {
    expect(engine.gameType).toBe("texas-holdem");
  });

  it("2~8인 게임이다", () => {
    expect(engine.minPlayers).toBe(2);
    expect(engine.maxPlayers).toBe(8);
  });

  describe("initState", () => {
    it("preflop 상태로 시작한다", () => {
      const state = engine.initState(mockPlayers);
      expect(state.phase).toBe("preflop");
    });

    it("커뮤니티 카드가 비어있다", () => {
      const state = engine.initState(mockPlayers);
      expect(state.communityCards).toHaveLength(0);
    });

    it("플레이어 수만큼 플레이어가 생성된다", () => {
      const state = engine.initState(mockPlayers);
      expect(state.players).toHaveLength(2);
    });

    it("시작 칩이 1000이다", () => {
      const state = engine.initState(mockPlayers);
      const totalChips = state.players.reduce((sum, p) => sum + p.chips + p.currentBet, 0);
      expect(totalChips).toBe(2000);
    });

    it("블라인드가 올바르게 설정된다", () => {
      const state = engine.initState(mockPlayers);
      expect(state.smallBlind).toBe(10);
      expect(state.bigBlind).toBe(20);
      expect(state.pot).toBe(30); // SB + BB
    });

    it("2인 게임에서 딜러가 스몰 블라인드를 낸다", () => {
      const state = engine.initState(mockPlayers);
      // dealerIndex=0, 2인이므로 SB=dealer(0), BB=1
      const dealer = state.players.find((p) => p.isDealer)!;
      expect(dealer.currentBet).toBe(10);
    });

    it("3인 게임에서 딜러 다음이 스몰 블라인드이다", () => {
      const state = engine.initState(threePlayers);
      // dealerIndex=0, SB=1, BB=2
      expect(state.players[1].currentBet).toBe(10); // SB
      expect(state.players[2].currentBet).toBe(20); // BB
    });

    it("각 플레이어에게 홀 카드 2장이 배분된다", () => {
      engine.initState(mockPlayers);
      expect(engine.getHoleCards("player1")).toHaveLength(2);
      expect(engine.getHoleCards("player2")).toHaveLength(2);
    });

    it("홀 카드가 서로 겹치지 않는다", () => {
      engine.initState(mockPlayers);
      const cards1 = engine.getHoleCards("player1");
      const cards2 = engine.getHoleCards("player2");
      const allCards = [...cards1, ...cards2];
      const serialized = allCards.map((c) => `${c.rank}_${c.suit}`);
      expect(new Set(serialized).size).toBe(4);
    });
  });

  describe("processMove", () => {
    let state: HoldemPublicState;

    beforeEach(() => {
      state = engine.initState(mockPlayers);
    });

    it("현재 턴이 아닌 플레이어의 이동은 무시된다", () => {
      const wrongPlayer = state.players.find((_, i) => i !== state.currentPlayerIndex)!;
      const result = engine.processMove(state, wrongPlayer.id, { action: "call" });
      expect(result).toBe(state);
    });

    it("폴드하면 해당 플레이어가 folded 상태가 된다", () => {
      const currentPlayer = state.players[state.currentPlayerIndex];
      const newState = engine.processMove(state, currentPlayer.id, { action: "fold" });
      const player = newState.players.find((p) => p.id === currentPlayer.id)!;
      expect(player.folded).toBe(true);
    });

    it("콜하면 현재 베팅액에 맞춰 칩이 차감된다", () => {
      const currentPlayer = state.players[state.currentPlayerIndex];
      const beforeChips = currentPlayer.chips;
      const betDiff = state.currentBet - currentPlayer.currentBet;
      const newState = engine.processMove(state, currentPlayer.id, { action: "call" });
      const player = newState.players.find((p) => p.id === currentPlayer.id)!;
      expect(player.chips).toBe(beforeChips - betDiff);
    });

    it("체크는 베팅액이 같을 때만 가능하다", () => {
      // preflop에서 BB 다음 플레이어는 currentBet보다 낮은 베팅이므로 체크 불가
      const currentPlayer = state.players[state.currentPlayerIndex];
      if (currentPlayer.currentBet < state.currentBet) {
        const result = engine.processMove(state, currentPlayer.id, { action: "check" });
        expect(result).toBe(state);
      }
    });

    it("올인하면 칩이 0이 된다", () => {
      const currentPlayer = state.players[state.currentPlayerIndex];
      const newState = engine.processMove(state, currentPlayer.id, { action: "all-in" });
      const player = newState.players.find((p) => p.id === currentPlayer.id)!;
      expect(player.chips).toBe(0);
      expect(player.isAllIn).toBe(true);
    });

    it("모든 플레이어가 폴드하면 1명 남고 showdown으로 진행된다", () => {
      const currentPlayer = state.players[state.currentPlayerIndex];
      const newState = engine.processMove(state, currentPlayer.id, { action: "fold" });
      // 2인 게임에서 한 명이 폴드하면 showdown
      expect(newState.phase).toBe("showdown");
    });
  });

  describe("checkWin", () => {
    it("showdown이 아니고 활성 플레이어가 2명이면 null을 반환한다", () => {
      const state = engine.initState(mockPlayers);
      expect(engine.checkWin(state)).toBeNull();
    });

    it("한 명만 남으면 해당 플레이어가 승리한다", () => {
      const state = engine.initState(mockPlayers);
      const currentPlayer = state.players[state.currentPlayerIndex];
      const foldedState = engine.processMove(state, currentPlayer.id, { action: "fold" });
      const result = engine.checkWin(foldedState);
      expect(result).not.toBeNull();
      expect(result!.winnerId).not.toBe(currentPlayer.id);
    });

    it("showdown에서 승자를 판정한다", () => {
      const state = engine.initState(mockPlayers);
      // 2인 게임에서 양쪽 콜/체크로 showdown까지 진행
      let s = state;

      // preflop: 첫 플레이어(BB 다음) 콜
      let current = s.players[s.currentPlayerIndex];
      s = engine.processMove(s, current.id, { action: "call" });

      // preflop: BB 체크
      if (s.phase === "preflop" && s.currentPlayerIndex !== -1) {
        current = s.players[s.currentPlayerIndex];
        s = engine.processMove(s, current.id, { action: "check" });
      }

      // flop, turn, river: 양쪽 체크
      for (const phase of ["flop", "turn", "river"]) {
        if (s.phase === phase && s.currentPlayerIndex !== -1) {
          current = s.players[s.currentPlayerIndex];
          s = engine.processMove(s, current.id, { action: "check" });
          if (s.phase === phase && s.currentPlayerIndex !== -1) {
            current = s.players[s.currentPlayerIndex];
            s = engine.processMove(s, current.id, { action: "check" });
          }
        }
      }

      if (s.phase === "showdown") {
        const result = engine.checkWin(s);
        expect(result).not.toBeNull();
        expect(result!.winnerId).toBeTruthy();
      }
    });
  });

  describe("getHoleCards", () => {
    it("존재하지 않는 플레이어에 대해 빈 배열을 반환한다", () => {
      engine.initState(mockPlayers);
      expect(engine.getHoleCards("unknown")).toEqual([]);
    });
  });
});
