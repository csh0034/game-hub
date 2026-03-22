import type { Player, GameState, GameMove, GameResult, CatchMindPublicState, CatchMindMove, DrawPoint } from "@game-hub/shared-types";
import type { GameEngine } from "./engine-interface.js";

const WORD_BANK: Record<string, string[]> = {
  동물: ["강아지", "고양이", "코끼리", "펭귄", "토끼", "돌고래", "앵무새", "거북이", "기린", "사자"],
  음식: ["치킨", "피자", "라면", "김밥", "붕어빵", "팥빙수", "케이크", "도넛", "초밥", "햄버거"],
  직업: ["소방관", "경찰관", "의사", "요리사", "선생님", "우주비행사", "어부", "화가", "마술사", "탐정"],
  사물: ["우산", "가위", "시계", "안경", "전화기", "풍선", "양초", "열쇠", "카메라", "기타"],
  탈것: ["자전거", "비행기", "잠수함", "로켓", "헬리콥터", "요트", "기차", "오토바이", "열기구", "스케이트보드"],
  장소: ["학교", "병원", "놀이공원", "도서관", "수영장", "영화관", "소방서", "동물원", "공항", "캠핑장"],
  캐릭터: ["산타클로스", "해적", "공주", "로봇", "닌자", "마녀", "슈퍼히어로", "좀비", "요정", "드래곤"],
  자연: ["무지개", "화산", "폭포", "선인장", "눈사람", "해바라기", "별똥별", "오로라", "토네이도", "번개"],
};

const CATEGORIES = Object.keys(WORD_BANK);

export class CatchMindEngine implements GameEngine {
  gameType = "catch-mind" as const;
  minPlayers = 3;
  maxPlayers = 8;

  private keyword: string | null = null;
  private usedWords: Set<string> = new Set();
  private drawTimeSeconds: number;
  private totalRounds: number;
  private showCharHint: boolean;

  constructor(drawTimeSeconds = 60, totalRounds = 3, showCharHint = false) {
    this.drawTimeSeconds = Math.max(1, Math.min(120, drawTimeSeconds));
    this.totalRounds = Math.max(1, Math.min(10, totalRounds));
    this.showCharHint = showCharHint;
  }

  initState(players: Player[]): GameState {
    const playerStates = players.map((p) => ({
      id: p.id,
      nickname: p.nickname,
      score: 0,
      hasGuessedCorrectly: false,
    }));

    const state: CatchMindPublicState = {
      phase: "role-reveal",
      roundNumber: 1,
      totalRounds: this.totalRounds,
      drawerId: players[0].id,
      drawTimeSeconds: this.drawTimeSeconds,
      turnStartedAt: null,
      players: playerStates,
      canvas: [],
      keyword: null,
      keywordLength: null,
      firstGuesserId: null,
      allGuessedCorrectly: false,
      roundScores: {},
      showCharHint: this.showCharHint,
    };

    return this.startNewRound(state);
  }

  startNewRound(state: CatchMindPublicState): CatchMindPublicState {
    const drawerIndex = (state.roundNumber - 1) % state.players.length;
    const drawerId = state.players[drawerIndex].id;

    // Pick random category and keyword
    const categoryIndex = Math.floor(Math.random() * CATEGORIES.length);
    const category = CATEGORIES[categoryIndex];
    const words = WORD_BANK[category];
    const availableWords = words.filter((w) => !this.usedWords.has(w));
    const wordPool = availableWords.length > 0 ? availableWords : words;
    const wordIndex = Math.floor(Math.random() * wordPool.length);
    this.keyword = wordPool[wordIndex];
    this.usedWords.add(this.keyword);

    return {
      ...state,
      phase: "role-reveal",
      drawerId,
      turnStartedAt: null,
      canvas: [],
      keyword: null,
      keywordLength: this.showCharHint ? this.keyword.length : null,
      firstGuesserId: null,
      allGuessedCorrectly: false,
      roundScores: {},
      players: state.players.map((p) => ({
        ...p,
        hasGuessedCorrectly: false,
      })),
    };
  }

  startDrawingPhase(state: CatchMindPublicState): CatchMindPublicState {
    return {
      ...state,
      phase: "drawing",
      turnStartedAt: Date.now(),
    };
  }

  processMove(state: GameState, playerId: string, move: GameMove): GameState {
    const s = state as CatchMindPublicState;
    const m = move as CatchMindMove;

    switch (m.type) {
      case "draw":
        return this.processDraw(s, playerId, m.points || []);
      case "clear-canvas":
        return this.processClearCanvas(s, playerId);
      case "phase-ready":
        return this.processPhaseReady(s);
      default:
        return s;
    }
  }

  private processDraw(state: CatchMindPublicState, playerId: string, points: DrawPoint[]): CatchMindPublicState {
    if (state.phase !== "drawing") return state;
    if (playerId !== state.drawerId) return state;

    return {
      ...state,
      canvas: [...state.canvas, ...points],
    };
  }

  private processClearCanvas(state: CatchMindPublicState, playerId: string): CatchMindPublicState {
    if (state.phase !== "drawing") return state;
    if (playerId !== state.drawerId) return state;

    return {
      ...state,
      canvas: [],
    };
  }

  private processPhaseReady(state: CatchMindPublicState): CatchMindPublicState {
    if (state.phase !== "round-result") return state;

    if (state.roundNumber >= state.totalRounds) {
      return { ...state, phase: "final-result" };
    }

    const nextState: CatchMindPublicState = {
      ...state,
      roundNumber: state.roundNumber + 1,
    };
    return this.startNewRound(nextState);
  }

  checkGuess(state: CatchMindPublicState, playerId: string, guess: string): { correct: boolean; newState: CatchMindPublicState } {
    if (state.phase !== "drawing") return { correct: false, newState: state };
    if (playerId === state.drawerId) return { correct: false, newState: state };

    const player = state.players.find((p) => p.id === playerId);
    if (!player || player.hasGuessedCorrectly) return { correct: false, newState: state };

    const normalizedGuess = guess.trim().replace(/\s+/g, "");
    const normalizedKeyword = (this.keyword || "").replace(/\s+/g, "");

    if (normalizedGuess.toLowerCase() !== normalizedKeyword.toLowerCase()) {
      return { correct: false, newState: state };
    }

    const isFirstGuesser = state.firstGuesserId === null;
    const newPlayers = state.players.map((p) =>
      p.id === playerId ? { ...p, hasGuessedCorrectly: true } : p,
    );

    const nonDrawerPlayers = newPlayers.filter((p) => p.id !== state.drawerId);
    const allGuessed = nonDrawerPlayers.every((p) => p.hasGuessedCorrectly);

    const newState: CatchMindPublicState = {
      ...state,
      players: newPlayers,
      firstGuesserId: isFirstGuesser ? playerId : state.firstGuesserId,
      allGuessedCorrectly: allGuessed,
    };

    return { correct: true, newState };
  }

  endRound(state: CatchMindPublicState): CatchMindPublicState {
    const roundScores: Record<string, number> = {};
    for (const p of state.players) {
      roundScores[p.id] = 0;
    }

    const someoneGuessed = state.firstGuesserId !== null;

    if (someoneGuessed) {
      // First guesser gets +1
      roundScores[state.firstGuesserId!] = 1;
      // Drawer gets +1
      roundScores[state.drawerId] = 1;
    } else {
      // Nobody guessed, drawer gets -1
      roundScores[state.drawerId] = -1;
    }

    const newPlayers = state.players.map((p) => ({
      ...p,
      score: p.score + (roundScores[p.id] || 0),
    }));

    return {
      ...state,
      phase: "round-result",
      keyword: this.keyword,
      turnStartedAt: null,
      roundScores,
      players: newPlayers,
    };
  }

  checkWin(state: GameState): GameResult | null {
    const s = state as CatchMindPublicState;
    if (s.phase !== "final-result") return null;

    let maxScore = -Infinity;
    for (const p of s.players) {
      if (p.score > maxScore) maxScore = p.score;
    }

    const topPlayers = s.players.filter((p) => p.score === maxScore);
    if (topPlayers.length > 1) {
      return { winnerId: null, reason: "동점으로 무승부입니다!" };
    }

    const winner = topPlayers[0];
    return {
      winnerId: winner.id,
      reason: `${winner.nickname}님이 ${maxScore}점으로 우승!`,
    };
  }

  getKeyword(): string | null {
    return this.keyword;
  }

  getDrawerId(state: CatchMindPublicState): string {
    return state.drawerId;
  }
}
