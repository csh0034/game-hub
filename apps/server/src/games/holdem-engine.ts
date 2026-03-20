import type {
  Player,
  HoldemPublicState,
  HoldemPlayerState,
  HoldemMove,
  HoldemPhase,
  GameResult,
  Card,
  Suit,
  Rank,
} from "@game-hub/shared-types";
import type { GameEngine } from "./engine-interface.js";

const SUITS: Suit[] = ["hearts", "diamonds", "clubs", "spades"];
const RANKS: Rank[] = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];

const HAND_RANKS = [
  "High Card",
  "One Pair",
  "Two Pair",
  "Three of a Kind",
  "Straight",
  "Flush",
  "Full House",
  "Four of a Kind",
  "Straight Flush",
  "Royal Flush",
] as const;

function rankValue(rank: Rank): number {
  const map: Record<Rank, number> = {
    "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8,
    "9": 9, "10": 10, J: 11, Q: 12, K: 13, A: 14,
  };
  return map[rank];
}

interface HandEvaluation {
  rank: number; // 0-9 index into HAND_RANKS
  name: string;
  tiebreakers: number[]; // for comparing same-rank hands
}

function evaluateBestHand(cards: Card[]): HandEvaluation {
  // Generate all 5-card combinations from 7 cards
  let best: HandEvaluation = { rank: -1, name: "", tiebreakers: [] };
  const combos = combinations(cards, 5);
  for (const combo of combos) {
    const evaluation = evaluateHand(combo);
    if (compareHands(evaluation, best) > 0) {
      best = evaluation;
    }
  }
  return best;
}

function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length === 0) return [];
  const [first, ...rest] = arr;
  const withFirst = combinations(rest, k - 1).map((c) => [first, ...c]);
  const withoutFirst = combinations(rest, k);
  return [...withFirst, ...withoutFirst];
}

function evaluateHand(cards: Card[]): HandEvaluation {
  const sorted = [...cards].sort((a, b) => rankValue(b.rank) - rankValue(a.rank));
  const values = sorted.map((c) => rankValue(c.rank));
  const suits = sorted.map((c) => c.suit);

  const isFlush = suits.every((s) => s === suits[0]);
  const isStraight = checkStraight(values);
  const isLowStraight = checkLowStraight(values);

  // Count ranks
  const counts: Map<number, number> = new Map();
  for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
  const groups = Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || b[0] - a[0]);

  if (isFlush && isStraight && values[0] === 14) {
    return { rank: 9, name: "Royal Flush", tiebreakers: [] };
  }
  if (isFlush && (isStraight || isLowStraight)) {
    const high = isLowStraight ? 5 : values[0];
    return { rank: 8, name: "Straight Flush", tiebreakers: [high] };
  }
  if (groups[0][1] === 4) {
    return { rank: 7, name: "Four of a Kind", tiebreakers: [groups[0][0], groups[1][0]] };
  }
  if (groups[0][1] === 3 && groups[1][1] === 2) {
    return { rank: 6, name: "Full House", tiebreakers: [groups[0][0], groups[1][0]] };
  }
  if (isFlush) {
    return { rank: 5, name: "Flush", tiebreakers: values };
  }
  if (isStraight) {
    return { rank: 4, name: "Straight", tiebreakers: [values[0]] };
  }
  if (isLowStraight) {
    return { rank: 4, name: "Straight", tiebreakers: [5] };
  }
  if (groups[0][1] === 3) {
    const kickers = groups.slice(1).map((g) => g[0]);
    return { rank: 3, name: "Three of a Kind", tiebreakers: [groups[0][0], ...kickers] };
  }
  if (groups[0][1] === 2 && groups[1][1] === 2) {
    const kicker = groups[2][0];
    return { rank: 2, name: "Two Pair", tiebreakers: [groups[0][0], groups[1][0], kicker] };
  }
  if (groups[0][1] === 2) {
    const kickers = groups.slice(1).map((g) => g[0]);
    return { rank: 1, name: "One Pair", tiebreakers: [groups[0][0], ...kickers] };
  }
  return { rank: 0, name: "High Card", tiebreakers: values };
}

function checkStraight(values: number[]): boolean {
  for (let i = 0; i < values.length - 1; i++) {
    if (values[i] - values[i + 1] !== 1) return false;
  }
  return true;
}

function checkLowStraight(values: number[]): boolean {
  // A-2-3-4-5
  const set = new Set(values);
  return set.has(14) && set.has(2) && set.has(3) && set.has(4) && set.has(5);
}

function compareHands(a: HandEvaluation, b: HandEvaluation): number {
  if (a.rank !== b.rank) return a.rank - b.rank;
  for (let i = 0; i < Math.min(a.tiebreakers.length, b.tiebreakers.length); i++) {
    if (a.tiebreakers[i] !== b.tiebreakers[i]) return a.tiebreakers[i] - b.tiebreakers[i];
  }
  return 0;
}

export class HoldemEngine implements GameEngine {
  gameType = "texas-holdem" as const;
  minPlayers = 2;
  maxPlayers = 8;

  private deck: Card[] = [];
  private holeCards: Map<string, Card[]> = new Map();
  private communityCards: Card[] = [];
  private activePlayers: string[] = [];
  private currentDealerIndex = 0;

  private createDeck(): Card[] {
    const deck: Card[] = [];
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        deck.push({ suit, rank });
      }
    }
    // Fisher-Yates shuffle
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  private dealCard(): Card {
    return this.deck.pop()!;
  }

  initState(players: Player[]): HoldemPublicState {
    this.deck = this.createDeck();
    this.holeCards = new Map();
    this.communityCards = [];

    // Deal hole cards
    for (const player of players) {
      this.holeCards.set(player.id, [this.dealCard(), this.dealCard()]);
    }

    const dealerIndex = 0;
    const smallBlind = 10;
    const bigBlind = 20;
    const startingChips = 1000;

    const holdemPlayers: Omit<HoldemPlayerState, "holeCards">[] = players.map((p, i) => ({
      id: p.id,
      nickname: p.nickname,
      chips: startingChips,
      currentBet: 0,
      folded: false,
      isAllIn: false,
      isDealer: i === dealerIndex,
      isTurn: false,
      seatIndex: i,
      eliminated: false,
    }));

    // Post blinds
    const sbIndex = players.length === 2 ? dealerIndex : (dealerIndex + 1) % players.length;
    const bbIndex = (sbIndex + 1) % players.length;

    holdemPlayers[sbIndex].chips -= smallBlind;
    holdemPlayers[sbIndex].currentBet = smallBlind;
    holdemPlayers[bbIndex].chips -= bigBlind;
    holdemPlayers[bbIndex].currentBet = bigBlind;

    // First to act preflop is after big blind
    const firstToAct = (bbIndex + 1) % players.length;
    holdemPlayers[firstToAct].isTurn = true;

    this.activePlayers = players.map((p) => p.id);

    return {
      phase: "preflop",
      communityCards: [],
      pot: smallBlind + bigBlind,
      currentBet: bigBlind,
      dealerIndex,
      currentPlayerIndex: firstToAct,
      players: holdemPlayers,
      smallBlind,
      bigBlind,
      minRaise: bigBlind * 2,
      actedPlayerIds: [],
      roundNumber: 1,
      eliminatedPlayerIds: [],
    };
  }

  getHoleCards(playerId: string): Card[] {
    return this.holeCards.get(playerId) || [];
  }

  processMove(state: HoldemPublicState, playerId: string, move: HoldemMove): HoldemPublicState {
    const playerIndex = state.players.findIndex((p) => p.id === playerId);
    if (playerIndex === -1 || playerIndex !== state.currentPlayerIndex) return state;

    const player = { ...state.players[playerIndex] };
    const newPlayers = state.players.map((p, i) => (i === playerIndex ? player : { ...p }));
    let newState: HoldemPublicState = { ...state, players: newPlayers, actedPlayerIds: [...state.actedPlayerIds] };

    switch (move.action) {
      case "fold": {
        player.folded = true;
        player.isTurn = false;
        newState.actedPlayerIds.push(playerId);
        break;
      }
      case "check": {
        if (player.currentBet < state.currentBet) return state; // Can't check
        player.isTurn = false;
        newState.actedPlayerIds.push(playerId);
        break;
      }
      case "call": {
        const callAmount = Math.min(state.currentBet - player.currentBet, player.chips);
        player.chips -= callAmount;
        player.currentBet += callAmount;
        newState.pot += callAmount;
        if (player.chips === 0) player.isAllIn = true;
        player.isTurn = false;
        newState.actedPlayerIds.push(playerId);
        break;
      }
      case "raise": {
        const raiseAmount = move.amount || state.currentBet * 2;
        const totalBet = raiseAmount;
        if (totalBet < state.minRaise) return state;
        const additionalBet = totalBet - player.currentBet;
        if (additionalBet > player.chips) return state;
        player.chips -= additionalBet;
        player.currentBet = totalBet;
        newState.pot += additionalBet;
        newState.currentBet = totalBet;
        newState.minRaise = totalBet + (totalBet - state.currentBet);
        if (player.chips === 0) player.isAllIn = true;
        player.isTurn = false;
        newState.actedPlayerIds = [playerId];
        break;
      }
      case "all-in": {
        const allInAmount = player.chips;
        player.currentBet += allInAmount;
        newState.pot += allInAmount;
        player.chips = 0;
        player.isAllIn = true;
        if (player.currentBet > state.currentBet) {
          newState.currentBet = player.currentBet;
          newState.actedPlayerIds = [playerId];
        } else {
          newState.actedPlayerIds.push(playerId);
        }
        player.isTurn = false;
        break;
      }
    }

    // Check if only one player remains
    const activePlayers = newState.players.filter((p) => !p.folded);
    if (activePlayers.length === 1) {
      newState.phase = "showdown";
      newState.currentPlayerIndex = -1;
      return newState;
    }

    // Find next player
    const nextPlayerIndex = this.findNextPlayer(newState, playerIndex);

    if (nextPlayerIndex === -1 || this.isRoundComplete(newState, playerIndex)) {
      // Advance phase
      newState = this.advancePhase(newState);
    } else {
      newState.players.forEach((p) => (p.isTurn = false));
      newState.players[nextPlayerIndex].isTurn = true;
      newState.currentPlayerIndex = nextPlayerIndex;
    }

    return newState;
  }

  private findNextPlayer(state: HoldemPublicState, fromIndex: number): number {
    const n = state.players.length;
    for (let i = 1; i < n; i++) {
      const idx = (fromIndex + i) % n;
      const p = state.players[idx];
      if (!p.folded && !p.isAllIn) return idx;
    }
    return -1;
  }

  private isRoundComplete(state: HoldemPublicState, lastActorIndex: number): boolean {
    const active = state.players.filter((p) => !p.folded && !p.isAllIn);
    if (active.length <= 1) return true;
    // All active players have same bet AND have acted
    return active.every((p) => p.currentBet === state.currentBet && state.actedPlayerIds.includes(p.id));
  }

  private advancePhase(state: HoldemPublicState): HoldemPublicState {
    const newState = { ...state };
    newState.players = state.players.map((p) => ({ ...p, currentBet: 0, isTurn: false }));
    newState.currentBet = 0;
    newState.minRaise = state.bigBlind * 2;
    newState.actedPlayerIds = [];

    const phaseOrder: HoldemPhase[] = ["preflop", "flop", "turn", "river", "showdown"];
    const currentPhaseIdx = phaseOrder.indexOf(state.phase);
    const nextPhase = phaseOrder[currentPhaseIdx + 1];
    newState.phase = nextPhase;

    switch (nextPhase) {
      case "flop":
        this.communityCards = [this.dealCard(), this.dealCard(), this.dealCard()];
        newState.communityCards = [...this.communityCards];
        break;
      case "turn":
        this.communityCards.push(this.dealCard());
        newState.communityCards = [...this.communityCards];
        break;
      case "river":
        this.communityCards.push(this.dealCard());
        newState.communityCards = [...this.communityCards];
        break;
      case "showdown":
        newState.currentPlayerIndex = -1;
        return newState;
    }

    // First to act post-flop: first active player after dealer
    const firstActive = this.findNextPlayer(newState, state.dealerIndex);
    if (firstActive !== -1) {
      newState.players[firstActive].isTurn = true;
      newState.currentPlayerIndex = firstActive;
    } else {
      // All-in scenario, advance to showdown
      return this.advancePhase(newState);
    }

    return newState;
  }

  checkWin(state: HoldemPublicState): GameResult | null {
    const active = state.players.filter((p) => !p.folded);

    // Fold victory — only one player left (not folded)
    if (active.length === 1) {
      const winner = active[0];
      const mutableWinner = state.players.find((p) => p.id === winner.id)!;
      mutableWinner.chips += state.pot;
      state.winners = [{
        playerId: winner.id,
        amount: state.pot,
        handName: "폴드 승리",
      }];
      // No showdownCards for fold wins
      return {
        winnerId: winner.id,
        reason: `${winner.nickname}이(가) 승리했습니다! (상대 폴드)`,
      };
    }

    if (state.phase !== "showdown") {
      return null;
    }

    // Showdown - evaluate hands
    let bestHand: HandEvaluation = { rank: -1, name: "", tiebreakers: [] };
    let winnerId = "";
    let winnerNickname = "";

    for (const player of active) {
      const holeCards = this.holeCards.get(player.id) || [];
      const allCards = [...holeCards, ...this.communityCards];
      if (allCards.length < 5) continue;
      const hand = evaluateBestHand(allCards);
      if (compareHands(hand, bestHand) > 0) {
        bestHand = hand;
        winnerId = player.id;
        winnerNickname = player.nickname;
      }
    }

    // Store winners info and showdown cards on state for UI
    state.winners = [{
      playerId: winnerId,
      amount: state.pot,
      handName: bestHand.name,
    }];

    // Record showdown cards for all active (non-folded) players
    const showdownCards: Record<string, Card[]> = {};
    for (const player of active) {
      showdownCards[player.id] = this.holeCards.get(player.id) || [];
    }
    state.showdownCards = showdownCards;

    // Award pot to winner
    const winnerPlayer = state.players.find((p) => p.id === winnerId)!;
    winnerPlayer.chips += state.pot;

    return {
      winnerId,
      reason: `${winnerNickname}이(가) ${bestHand.name}(으)로 승리했습니다!`,
    };
  }

  getActivePlayerCount(state: HoldemPublicState): number {
    return state.players.filter((p) => !p.eliminated && (p.chips > 0 || state.winners?.some((w) => w.playerId === p.id))).length;
  }

  startNewRound(state: HoldemPublicState): { state: HoldemPublicState; holeCardsMap: Map<string, Card[]> } {
    this.deck = this.createDeck();
    this.holeCards = new Map();
    this.communityCards = [];

    // Mark eliminated players (chips === 0 and not a winner of the current round)
    const eliminatedPlayerIds = [...state.eliminatedPlayerIds];
    for (const player of state.players) {
      if (player.chips === 0 && !player.eliminated) {
        player.eliminated = true;
        eliminatedPlayerIds.push(player.id);
      }
    }

    // Rotate dealer to next non-eliminated player
    const nonEliminated = state.players.filter((p) => !p.eliminated);
    const currentDealerPos = nonEliminated.findIndex((p) => p.id === state.players[state.dealerIndex]?.id);
    const nextDealerPos = (currentDealerPos + 1) % nonEliminated.length;
    const nextDealer = nonEliminated[nextDealerPos];
    const newDealerIndex = state.players.findIndex((p) => p.id === nextDealer.id);
    this.currentDealerIndex = newDealerIndex;

    // Deal hole cards to non-eliminated players
    for (const player of nonEliminated) {
      this.holeCards.set(player.id, [this.dealCard(), this.dealCard()]);
    }

    const smallBlind = state.smallBlind;
    const bigBlind = state.bigBlind;

    // Reset player states
    const newPlayers = state.players.map((p, i) => ({
      ...p,
      currentBet: 0,
      folded: p.eliminated,
      isAllIn: false,
      isDealer: i === newDealerIndex,
      isTurn: false,
    }));

    // Post blinds (only among non-eliminated)
    const nonEliminatedIndices = newPlayers
      .map((p, i) => ({ player: p, index: i }))
      .filter(({ player }) => !player.eliminated);

    const dealerLocalIdx = nonEliminatedIndices.findIndex(({ index }) => index === newDealerIndex);
    const sbLocalIdx = nonEliminatedIndices.length === 2
      ? dealerLocalIdx
      : (dealerLocalIdx + 1) % nonEliminatedIndices.length;
    const bbLocalIdx = (sbLocalIdx + 1) % nonEliminatedIndices.length;

    const sbPlayer = newPlayers[nonEliminatedIndices[sbLocalIdx].index];
    const bbPlayer = newPlayers[nonEliminatedIndices[bbLocalIdx].index];

    const sbAmount = Math.min(smallBlind, sbPlayer.chips);
    sbPlayer.chips -= sbAmount;
    sbPlayer.currentBet = sbAmount;
    if (sbPlayer.chips === 0) sbPlayer.isAllIn = true;

    const bbAmount = Math.min(bigBlind, bbPlayer.chips);
    bbPlayer.chips -= bbAmount;
    bbPlayer.currentBet = bbAmount;
    if (bbPlayer.chips === 0) bbPlayer.isAllIn = true;

    // First to act preflop: after big blind
    const firstToActLocalIdx = (bbLocalIdx + 1) % nonEliminatedIndices.length;
    const firstToActIndex = nonEliminatedIndices[firstToActLocalIdx].index;
    newPlayers[firstToActIndex].isTurn = true;

    this.activePlayers = nonEliminated.map((p) => p.id);

    const newState: HoldemPublicState = {
      phase: "preflop",
      communityCards: [],
      pot: sbAmount + bbAmount,
      currentBet: bbAmount,
      dealerIndex: newDealerIndex,
      currentPlayerIndex: firstToActIndex,
      players: newPlayers,
      smallBlind,
      bigBlind,
      minRaise: bigBlind * 2,
      actedPlayerIds: [],
      roundNumber: state.roundNumber + 1,
      eliminatedPlayerIds,
    };

    return { state: newState, holeCardsMap: this.holeCards };
  }
}
