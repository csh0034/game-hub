import type { Player, GameState, GameMove, GameResult, LiarDrawingPublicState, LiarDrawingMove, DrawPoint } from "@game-hub/shared-types";
import type { GameEngine } from "./engine-interface.js";
import _WORD_BANK from "./data/liar-drawing-words.json" with { type: "json" };

const WORD_BANK: Record<string, string[]> = _WORD_BANK;
const CATEGORIES = Object.keys(WORD_BANK);

export class LiarDrawingEngine implements GameEngine {
  gameType = "liar-drawing" as const;
  minPlayers = 3;
  maxPlayers = 8;

  private liarId: string | null = null;
  private keyword: string | null = null;
  private category: string | null = null;
  private usedWords: Set<string> = new Set();
  private drawTimeSeconds: number;
  private totalRounds: number;

  constructor(drawTimeSeconds = 60, totalRounds = 3) {
    this.drawTimeSeconds = Math.max(1, Math.min(120, drawTimeSeconds));
    this.totalRounds = totalRounds;
  }

  initState(players: Player[]): GameState {
    const playerStates = players.map((p) => ({
      id: p.id,
      nickname: p.nickname,
      score: 0,
      isDrawing: false,
      hasDrawn: false,
      votedFor: null,
    }));

    const state: LiarDrawingPublicState = {
      phase: "role-reveal",
      roundNumber: 1,
      totalRounds: this.totalRounds,
      category: "",
      drawOrder: [],
      currentDrawerIndex: 0,
      drawTimeSeconds: this.drawTimeSeconds,
      turnStartedAt: null,
      players: playerStates,
      canvases: {},
      votes: {},
      votedPlayerIds: [],
      accusedPlayerId: null,
      liarId: null,
      liarGuess: null,
      liarGuessCorrect: null,
      keyword: null,
      roundScores: {},
    };

    return this.startNewRound(state);
  }

  startNewRound(state: LiarDrawingPublicState): LiarDrawingPublicState {
    // Pick random liar
    const playerIds = state.players.map((p) => p.id);
    const liarIndex = Math.floor(Math.random() * playerIds.length);
    this.liarId = playerIds[liarIndex];

    // Pick category and keyword
    const categoryIndex = Math.floor(Math.random() * CATEGORIES.length);
    this.category = CATEGORIES[categoryIndex];
    const words = WORD_BANK[this.category];
    const availableWords = words.filter((w) => !this.usedWords.has(w));
    const wordPool = availableWords.length > 0 ? availableWords : words;
    const wordIndex = Math.floor(Math.random() * wordPool.length);
    this.keyword = wordPool[wordIndex];
    this.usedWords.add(this.keyword);

    // Shuffle draw order
    const drawOrder = [...playerIds];
    for (let i = drawOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [drawOrder[i], drawOrder[j]] = [drawOrder[j], drawOrder[i]];
    }

    const canvases: Record<string, DrawPoint[]> = {};
    for (const id of playerIds) {
      canvases[id] = [];
    }

    return {
      ...state,
      phase: "role-reveal",
      category: this.category,
      drawOrder,
      currentDrawerIndex: 0,
      turnStartedAt: null,
      canvases,
      votes: {},
      votedPlayerIds: [],
      accusedPlayerId: null,
      liarId: null,
      liarGuess: null,
      liarGuessCorrect: null,
      keyword: null,
      roundScores: {},
      players: state.players.map((p) => ({
        ...p,
        isDrawing: false,
        hasDrawn: false,
        votedFor: null,
      })),
    };
  }

  processMove(state: GameState, playerId: string, move: GameMove): GameState {
    const s = state as LiarDrawingPublicState;
    const m = move as LiarDrawingMove;

    switch (m.type) {
      case "draw":
        return this.processDraw(s, playerId, m.points || []);
      case "clear-canvas":
        return this.processClearCanvas(s, playerId);
      case "vote":
        return this.processVote(s, playerId, m.targetPlayerId || "");
      case "liar-guess":
        return this.processLiarGuess(s, playerId, m.guess || "");
      case "complete-turn":
        return this.processCompleteTurn(s, playerId, m.skip);
      case "phase-ready":
        return this.processPhaseReady(s);
      default:
        return s;
    }
  }

  private processDraw(state: LiarDrawingPublicState, playerId: string, points: DrawPoint[]): LiarDrawingPublicState {
    if (state.phase !== "drawing") return state;
    const currentDrawerId = state.drawOrder[state.currentDrawerIndex];
    if (playerId !== currentDrawerId) return state;

    return {
      ...state,
      canvases: {
        ...state.canvases,
        [playerId]: [...(state.canvases[playerId] || []), ...points],
      },
    };
  }

  private processClearCanvas(state: LiarDrawingPublicState, playerId: string): LiarDrawingPublicState {
    if (state.phase !== "drawing") return state;
    const currentDrawerId = state.drawOrder[state.currentDrawerIndex];
    if (playerId !== currentDrawerId) return state;

    return {
      ...state,
      canvases: {
        ...state.canvases,
        [playerId]: [],
      },
    };
  }

  private processCompleteTurn(state: LiarDrawingPublicState, playerId: string, skip?: boolean): LiarDrawingPublicState {
    if (state.phase !== "drawing") return state;
    const currentDrawerId = state.drawOrder[state.currentDrawerIndex];
    if (playerId !== currentDrawerId) return state;

    const stateToAdvance = skip
      ? { ...state, canvases: { ...state.canvases, [playerId]: [] } }
      : state;

    return this.advanceDrawingTurn(stateToAdvance);
  }

  advanceDrawingTurn(state: LiarDrawingPublicState): LiarDrawingPublicState {
    const currentDrawerId = state.drawOrder[state.currentDrawerIndex];
    const nextIndex = state.currentDrawerIndex + 1;

    const updatedPlayers = state.players.map((p) =>
      p.id === currentDrawerId ? { ...p, isDrawing: false, hasDrawn: true } : p,
    );

    if (nextIndex >= state.drawOrder.length) {
      // All players have drawn, move to voting
      return {
        ...state,
        phase: "voting",
        currentDrawerIndex: nextIndex,
        turnStartedAt: null,
        players: updatedPlayers,
      };
    }

    const nextDrawerId = state.drawOrder[nextIndex];
    return {
      ...state,
      currentDrawerIndex: nextIndex,
      turnStartedAt: Date.now(),
      players: updatedPlayers.map((p) =>
        p.id === nextDrawerId ? { ...p, isDrawing: true } : p,
      ),
    };
  }

  startDrawingPhase(state: LiarDrawingPublicState): LiarDrawingPublicState {
    const firstDrawerId = state.drawOrder[0];
    return {
      ...state,
      phase: "drawing",
      currentDrawerIndex: 0,
      turnStartedAt: Date.now(),
      players: state.players.map((p) =>
        p.id === firstDrawerId ? { ...p, isDrawing: true } : p,
      ),
    };
  }

  private processVote(state: LiarDrawingPublicState, playerId: string, targetPlayerId: string): LiarDrawingPublicState {
    if (state.phase !== "voting") return state;
    if (playerId === targetPlayerId) return state;
    if (state.votedPlayerIds.includes(playerId)) return state;
    if (!state.players.some((p) => p.id === targetPlayerId)) return state;

    const newVotes = { ...state.votes, [playerId]: targetPlayerId };
    const newVotedPlayerIds = [...state.votedPlayerIds, playerId];
    const newPlayers = state.players.map((p) =>
      p.id === playerId ? { ...p, votedFor: targetPlayerId } : p,
    );

    const newState: LiarDrawingPublicState = {
      ...state,
      votes: newVotes,
      votedPlayerIds: newVotedPlayerIds,
      players: newPlayers,
    };

    // Check if all players have voted
    if (newVotedPlayerIds.length >= state.players.length) {
      return this.processVotingResult(newState);
    }

    return newState;
  }

  processVotingResult(state: LiarDrawingPublicState): LiarDrawingPublicState {
    // Count votes
    const voteCounts: Record<string, number> = {};
    for (const targetId of Object.values(state.votes)) {
      voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
    }

    // Find max votes
    let maxVotes = 0;
    for (const count of Object.values(voteCounts)) {
      if (count > maxVotes) maxVotes = count;
    }

    // Check for tie
    const topVoted = Object.entries(voteCounts).filter(([, count]) => count === maxVotes);

    if (topVoted.length > 1) {
      // Tie - liar escapes, go to round-result
      const roundScores = this.calculateRoundScores(state, false, false);
      return {
        ...state,
        phase: "round-result",
        accusedPlayerId: null,
        liarId: this.liarId,
        keyword: this.keyword,
        roundScores,
        players: this.applyScores(state.players, roundScores),
      };
    }

    const accusedPlayerId = topVoted[0][0];

    if (accusedPlayerId === this.liarId) {
      // Liar caught, give them a chance to guess
      return {
        ...state,
        phase: "liar-guess",
        accusedPlayerId,
        liarId: this.liarId,
        turnStartedAt: Date.now(),
      };
    }

    // Wrong person accused - liar wins
    const roundScores = this.calculateRoundScores(state, false, false);
    return {
      ...state,
      phase: "round-result",
      accusedPlayerId,
      liarId: this.liarId,
      keyword: this.keyword,
      roundScores,
      players: this.applyScores(state.players, roundScores),
    };
  }

  private processLiarGuess(state: LiarDrawingPublicState, playerId: string, guess: string): LiarDrawingPublicState {
    if (state.phase !== "liar-guess") return state;
    if (playerId !== this.liarId) return state;

    const isCorrect = guess.trim() === this.keyword;
    const roundScores = this.calculateRoundScores(state, true, isCorrect);

    return {
      ...state,
      phase: "round-result",
      liarGuess: guess.trim(),
      liarGuessCorrect: isCorrect,
      keyword: this.keyword,
      roundScores,
      turnStartedAt: null,
      players: this.applyScores(state.players, roundScores),
    };
  }

  private processPhaseReady(state: LiarDrawingPublicState): LiarDrawingPublicState {
    if (state.phase !== "round-result") return state;

    if (state.roundNumber >= state.totalRounds) {
      return { ...state, phase: "final-result" };
    }

    const nextState: LiarDrawingPublicState = {
      ...state,
      roundNumber: state.roundNumber + 1,
    };
    return this.startNewRound(nextState);
  }

  calculateRoundScores(state: LiarDrawingPublicState, liarCaught: boolean, liarGuessedCorrect: boolean): Record<string, number> {
    const scores: Record<string, number> = {};
    for (const p of state.players) {
      scores[p.id] = 0;
    }

    if (!liarCaught) {
      // Liar not caught (wrong accusation or tie) -> liar gets +2
      if (this.liarId) scores[this.liarId] = 2;
    } else if (liarGuessedCorrect) {
      // Liar caught but guessed correctly -> liar gets +3
      if (this.liarId) scores[this.liarId] = 3;
    } else {
      // Liar caught and guessed wrong -> citizens get +1 each
      for (const p of state.players) {
        if (p.id !== this.liarId) {
          scores[p.id] = 1;
        }
      }
    }

    return scores;
  }

  private applyScores(players: LiarDrawingPublicState["players"], roundScores: Record<string, number>): LiarDrawingPublicState["players"] {
    return players.map((p) => ({
      ...p,
      score: p.score + (roundScores[p.id] || 0),
    }));
  }

  checkWin(state: GameState): GameResult | null {
    const s = state as LiarDrawingPublicState;
    if (s.phase !== "final-result") return null;

    // Find highest score
    let maxScore = -1;
    let winnerId: string | null = null;
    for (const p of s.players) {
      if (p.score > maxScore) {
        maxScore = p.score;
        winnerId = p.id;
      }
    }

    // Check for tie
    const topPlayers = s.players.filter((p) => p.score === maxScore);
    if (topPlayers.length > 1) {
      return { winnerId: null, reason: "동점으로 무승부입니다!" };
    }

    const winner = s.players.find((p) => p.id === winnerId);
    return {
      winnerId,
      reason: `${winner?.nickname || ""}님이 ${maxScore}점으로 우승!`,
    };
  }

  getLiarId(): string | null {
    return this.liarId;
  }

  getKeyword(): string | null {
    return this.keyword;
  }

  getCategory(): string | null {
    return this.category;
  }
}
