import { describe, it, expect, beforeEach } from "vitest";
import { HoldemEngine } from "./holdem-engine.js";
import type { Player, HoldemPublicState } from "@game-hub/shared-types";

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

    it("actedPlayerIds가 빈 배열로 초기화된다", () => {
      const state = engine.initState(mockPlayers);
      expect(state.actedPlayerIds).toEqual([]);
    });

    it("minRaise가 bigBlind * 2로 초기화된다", () => {
      const state = engine.initState(mockPlayers);
      expect(state.minRaise).toBe(40);
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

    describe("BB 프리플롭 옵션", () => {
      it("2인 게임에서 콜 후 BB에게 턴이 온다", () => {
        // 2인: dealer=0(SB), BB=1, firstToAct=0(dealer/SB)
        const current = state.players[state.currentPlayerIndex];
        const s = engine.processMove(state, current.id, { action: "call" });
        // BB에게 턴이 와야 한다 (아직 preflop)
        expect(s.phase).toBe("preflop");
        expect(s.currentPlayerIndex).not.toBe(-1);
        const bbPlayer = s.players[s.currentPlayerIndex];
        expect(bbPlayer.currentBet).toBe(20); // BB 강제 베팅
      });

      it("BB가 체크하면 플롭으로 진행한다", () => {
        const current = state.players[state.currentPlayerIndex];
        let s = engine.processMove(state, current.id, { action: "call" });
        // BB 체크
        const bb = s.players[s.currentPlayerIndex];
        s = engine.processMove(s, bb.id, { action: "check" });
        expect(s.phase).toBe("flop");
      });

      it("BB가 레이즈하면 다른 플레이어에게 재액션 기회가 주어진다", () => {
        const current = state.players[state.currentPlayerIndex];
        let s = engine.processMove(state, current.id, { action: "call" });
        // BB 레이즈
        const bb = s.players[s.currentPlayerIndex];
        s = engine.processMove(s, bb.id, { action: "raise", amount: 60 });
        expect(s.phase).toBe("preflop");
        // 다른 플레이어에게 턴
        expect(s.players[s.currentPlayerIndex].id).toBe(current.id);
      });

      it("3인 게임에서 콜 후 BB에게 턴이 온다", () => {
        const engine3 = new HoldemEngine();
        let s = engine3.initState(threePlayers);
        // 3인: dealer=0, SB=1, BB=2, firstToAct=0
        // player0 콜
        let current = s.players[s.currentPlayerIndex];
        s = engine3.processMove(s, current.id, { action: "call" });
        // player1(SB) 콜
        current = s.players[s.currentPlayerIndex];
        s = engine3.processMove(s, current.id, { action: "call" });
        // BB에게 턴이 와야 한다
        expect(s.phase).toBe("preflop");
        expect(s.players[s.currentPlayerIndex].id).toBe("player3");
      });
    });

    describe("minRaise 검증", () => {
      it("minRaise 미만 레이즈를 거부한다", () => {
        const current = state.players[state.currentPlayerIndex];
        // minRaise는 40, 30으로 레이즈 시도
        const result = engine.processMove(state, current.id, { action: "raise", amount: 30 });
        expect(result).toBe(state);
      });

      it("minRaise 이상 레이즈는 허용된다", () => {
        const current = state.players[state.currentPlayerIndex];
        const result = engine.processMove(state, current.id, { action: "raise", amount: 40 });
        expect(result).not.toBe(state);
        expect(result.currentBet).toBe(40);
      });
    });

    describe("페이즈 변경 시 minRaise 리셋", () => {
      it("플롭 진행 시 minRaise가 bigBlind * 2로 리셋된다", () => {
        // preflop 진행: 콜 → BB 체크
        let current = state.players[state.currentPlayerIndex];
        let s = engine.processMove(state, current.id, { action: "call" });
        current = s.players[s.currentPlayerIndex];
        s = engine.processMove(s, current.id, { action: "check" });
        expect(s.phase).toBe("flop");
        expect(s.minRaise).toBe(40); // bigBlind * 2
      });

      it("프리플롭에서 레이즈 후 플롭에서 minRaise가 리셋된다", () => {
        // 레이즈 → 콜 → BB 체크 또는 콜
        let current = state.players[state.currentPlayerIndex];
        let s = engine.processMove(state, current.id, { action: "raise", amount: 100 });
        // BB 콜
        current = s.players[s.currentPlayerIndex];
        s = engine.processMove(s, current.id, { action: "call" });
        expect(s.phase).toBe("flop");
        expect(s.minRaise).toBe(40);
      });
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

  describe("initState 새 필드", () => {
    it("roundNumber가 1로 시작한다", () => {
      const state = engine.initState(mockPlayers);
      expect(state.roundNumber).toBe(1);
    });

    it("eliminatedPlayerIds가 빈 배열로 시작한다", () => {
      const state = engine.initState(mockPlayers);
      expect(state.eliminatedPlayerIds).toEqual([]);
    });

    it("플레이어의 eliminated가 false로 시작한다", () => {
      const state = engine.initState(mockPlayers);
      expect(state.players.every((p) => p.eliminated === false)).toBe(true);
    });
  });

  describe("checkWin — 쇼다운 카드 공개", () => {
    it("쇼다운 시 showdownCards에 활성 플레이어만 포함된다", () => {
      const state = engine.initState(mockPlayers);
      let s = state;

      // showdown까지 진행
      let current = s.players[s.currentPlayerIndex];
      s = engine.processMove(s, current.id, { action: "call" });
      if (s.phase === "preflop" && s.currentPlayerIndex !== -1) {
        current = s.players[s.currentPlayerIndex];
        s = engine.processMove(s, current.id, { action: "check" });
      }
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
        engine.checkWin(s);
        expect(s.showdownCards).toBeDefined();
        const cardPlayerIds = Object.keys(s.showdownCards!);
        expect(cardPlayerIds).toHaveLength(2); // 폴드 없으므로 2명 모두
        for (const id of cardPlayerIds) {
          expect(s.showdownCards![id]).toHaveLength(2);
        }
      }
    });

    it("폴드 승리 시 showdownCards가 undefined이다", () => {
      const state = engine.initState(mockPlayers);
      const currentPlayer = state.players[state.currentPlayerIndex];
      const foldedState = engine.processMove(state, currentPlayer.id, { action: "fold" });
      engine.checkWin(foldedState);
      expect(foldedState.showdownCards).toBeUndefined();
    });

    it("쇼다운 승자에게 pot이 지급된다", () => {
      const state = engine.initState(mockPlayers);
      let s = state;

      let current = s.players[s.currentPlayerIndex];
      s = engine.processMove(s, current.id, { action: "call" });
      if (s.phase === "preflop" && s.currentPlayerIndex !== -1) {
        current = s.players[s.currentPlayerIndex];
        s = engine.processMove(s, current.id, { action: "check" });
      }
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
        const pot = s.pot;
        const result = engine.checkWin(s);
        expect(result).not.toBeNull();
        const winner = s.players.find((p) => p.id === result!.winnerId)!;
        // 승자의 칩은 시작칩 - blind + pot 이상이어야 한다
        expect(winner.chips).toBeGreaterThanOrEqual(pot);
      }
    });

    it("폴드 승자에게 pot이 지급된다", () => {
      const state = engine.initState(mockPlayers);
      const currentPlayer = state.players[state.currentPlayerIndex];
      const potBefore = state.pot;
      const foldedState = engine.processMove(state, currentPlayer.id, { action: "fold" });
      const result = engine.checkWin(foldedState);
      expect(result).not.toBeNull();
      const winner = foldedState.players.find((p) => p.id === result!.winnerId)!;
      // BB가 승리: 원래 칩(1000-20) + pot(30)
      expect(winner.chips).toBe(1000 - 20 + potBefore);
    });
  });

  describe("startNewRound", () => {
    function playToShowdown(eng: HoldemEngine, state: HoldemPublicState): HoldemPublicState {
      let s = state;
      let current = s.players[s.currentPlayerIndex];
      s = eng.processMove(s, current.id, { action: "call" });
      if (s.phase === "preflop" && s.currentPlayerIndex !== -1) {
        current = s.players[s.currentPlayerIndex];
        s = eng.processMove(s, current.id, { action: "check" });
      }
      for (const phase of ["flop", "turn", "river"]) {
        if (s.phase === phase && s.currentPlayerIndex !== -1) {
          current = s.players[s.currentPlayerIndex];
          s = eng.processMove(s, current.id, { action: "check" });
          if (s.phase === phase && s.currentPlayerIndex !== -1) {
            current = s.players[s.currentPlayerIndex];
            s = eng.processMove(s, current.id, { action: "check" });
          }
        }
      }
      if (s.phase === "showdown") {
        eng.checkWin(s);
      }
      return s;
    }

    it("칩이 유지된 채로 새 라운드가 시작된다", () => {
      const state = engine.initState(mockPlayers);
      const endState = playToShowdown(engine, state);
      const totalChipsBefore = endState.players.reduce((sum, p) => sum + p.chips, 0);

      const { state: newState } = engine.startNewRound(endState);
      const totalChipsAfter = newState.players.reduce((sum, p) => sum + p.chips + p.currentBet, 0);
      expect(totalChipsAfter).toBe(totalChipsBefore);
    });

    it("roundNumber가 증가한다", () => {
      const state = engine.initState(mockPlayers);
      const endState = playToShowdown(engine, state);
      const { state: newState } = engine.startNewRound(endState);
      expect(newState.roundNumber).toBe(2);
    });

    it("딜러가 로테이션된다", () => {
      const state = engine.initState(mockPlayers);
      const endState = playToShowdown(engine, state);
      const oldDealerIndex = endState.dealerIndex;
      const { state: newState } = engine.startNewRound(endState);
      expect(newState.dealerIndex).not.toBe(oldDealerIndex);
    });

    it("새 홀 카드가 배분된다", () => {
      const state = engine.initState(mockPlayers);
      const endState = playToShowdown(engine, state);
      const { holeCardsMap } = engine.startNewRound(endState);
      for (const [, cards] of holeCardsMap) {
        expect(cards).toHaveLength(2);
      }
    });

    it("eliminated 플레이어는 참여하지 않는다", () => {
      const eng = new HoldemEngine();
      const state = eng.initState(threePlayers);
      // 라운드를 진행하여 종료시킨다 (player1이 폴드하여 패배 시뮬레이션)
      const current = state.players[state.currentPlayerIndex];
      const foldedState = eng.processMove(state, current.id, { action: "fold" });
      eng.checkWin(foldedState);

      // player1의 칩을 0으로 수동 설정 (탈락 시뮬레이션)
      foldedState.players[0].chips = 0;

      const { state: newState, holeCardsMap } = eng.startNewRound(foldedState);
      // player1이 eliminated 되었는지 확인
      expect(newState.eliminatedPlayerIds).toContain("player1");
      expect(newState.players.find((p) => p.id === "player1")!.eliminated).toBe(true);
      // eliminated 플레이어에게는 카드가 없다
      expect(holeCardsMap.has("player1")).toBe(false);
    });
  });

  describe("getActivePlayerCount", () => {
    it("칩이 있는 플레이어 수를 반환한다", () => {
      const state = engine.initState(mockPlayers);
      expect(engine.getActivePlayerCount(state)).toBe(2);
    });

    it("eliminated 플레이어는 제외된다", () => {
      const state = engine.initState(threePlayers);
      state.players[0].eliminated = true;
      state.players[0].chips = 0;
      expect(engine.getActivePlayerCount(state)).toBe(2);
    });
  });
});
