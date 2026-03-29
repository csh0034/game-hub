import type {
  GameState,
  GameMove,
  GameResult,
  Player,
  TypingPublicState,
  TypingPlayerState,
  TypingMove,
  TypingWord,
  TypingDifficulty,
} from "@game-hub/shared-types";
import { TYPING_DIFFICULTY_CONFIGS } from "@game-hub/shared-types";
import type { GameEngine } from "./engine-interface.js";
import _WORD_BANK from "./data/typing-words.json" with { type: "json" };

const WORD_BANK: Record<string, string[]> = _WORD_BANK;
const ALL_WORDS = Object.values(WORD_BANK).flat();

// 콤보 보너스 점수 테이블
const COMBO_BONUSES: [number, number][] = [
  [5, 200],
  [10, 500],
  [20, 1000],
];

// 글자 수별 점수
const CHAR_SCORES: Record<number, number> = {
  2: 100,
  3: 200,
  4: 350,
  5: 500,
};

// 가속 구간 (경과 비율 → 속도/스폰 배율)
const ACCELERATION_PHASES = [
  { threshold: 0.33, speedMult: 1.0, spawnMult: 1.0 },
  { threshold: 0.66, speedMult: 1.25, spawnMult: 0.85 },
  { threshold: 1.0, speedMult: 1.5, spawnMult: 0.7 },
];

function getFilteredWords(minChars: number, maxChars: number): string[] {
  return ALL_WORDS.filter((w) => w.length >= minChars && w.length <= maxChars);
}

export class TypingEngine implements GameEngine {
  gameType = "typing" as const;
  minPlayers = 1;
  maxPlayers = 8;

  private difficulty: TypingDifficulty;
  private timeLimit: number;
  private maxLives: number;
  private wordPool: string[] = [];
  private wordIndex = 0;
  private nextWordId = 1;

  // 플레이어별 내부 상태 (화면에 있는 단어 목록)
  private playerWords: Map<string, TypingWord[]> = new Map();
  private playerStates: Map<string, TypingPlayerState> = new Map();
  private startedAt = 0;

  constructor(difficulty: TypingDifficulty = "beginner", timeLimit = 60, maxLives = 3) {
    this.difficulty = difficulty;
    this.timeLimit = timeLimit;
    this.maxLives = maxLives;
  }

  initState(players: Player[]): TypingPublicState {
    const config = TYPING_DIFFICULTY_CONFIGS[this.difficulty];
    this.wordPool = getFilteredWords(config.minChars, config.maxChars);
    this.shufflePool();
    this.wordIndex = 0;
    this.nextWordId = 1;
    this.startedAt = Date.now();

    this.playerWords.clear();
    this.playerStates.clear();

    const playerRecord: Record<string, TypingPlayerState> = {};
    for (const p of players) {
      const ps: TypingPlayerState = {
        id: p.id,
        nickname: p.nickname,
        score: 0,
        lives: this.maxLives,
        combo: 0,
        wordsCleared: 0,
        status: "playing",
      };
      this.playerStates.set(p.id, ps);
      this.playerWords.set(p.id, []);
      playerRecord[p.id] = ps;
    }

    return {
      players: playerRecord,
      words: [],
      difficulty: this.difficulty,
      timeLimit: this.timeLimit,
      maxLives: this.maxLives,
      startedAt: this.startedAt,
      speedMultiplier: 1.0,
      spawnMultiplier: 1.0,
    };
  }

  processMove(state: GameState, playerId: string, move: GameMove): TypingPublicState {
    const typingState = state as TypingPublicState;
    const typingMove = move as TypingMove;

    if (typingMove.type !== "submit") return typingState;

    const ps = this.playerStates.get(playerId);
    if (!ps || ps.status !== "playing") return typingState;

    const words = this.playerWords.get(playerId);
    if (!words) return typingState;

    const submittedWord = typingMove.word.trim();
    const matchIndex = words.findIndex((w) => w.text === submittedWord);

    if (matchIndex === -1) {
      // 오타 — 콤보만 리셋 (목숨 차감 없음)
      ps.combo = 0;
    } else {
      // 정답 — 단어 제거, 점수 부여
      const word = words[matchIndex];
      words.splice(matchIndex, 1);
      const charLen = word.text.length;
      const baseScore = CHAR_SCORES[charLen] ?? charLen * 100;
      ps.score += baseScore;
      ps.combo++;
      ps.wordsCleared++;

      // 콤보 보너스
      for (const [threshold, bonus] of COMBO_BONUSES) {
        if (ps.combo === threshold) {
          ps.score += bonus;
          break;
        }
      }
      // 30콤보 이상은 10콤보마다 +1000
      if (ps.combo > 20 && ps.combo % 10 === 0) {
        ps.score += 1000;
      }
    }

    return this.toPublicStateFromPrev(typingState);
  }

  checkWin(state: GameState): GameResult | null {
    const typingState = state as TypingPublicState;
    const now = Date.now();
    const elapsed = now - typingState.startedAt;
    const timeUp = elapsed >= typingState.timeLimit * 1000;
    const allDead = [...this.playerStates.values()].every((ps) => ps.status === "gameover");

    if (!timeUp && !allDead) return null;

    // 승리 판정: 최고 점수
    let bestScore = -1;
    let winnerId: string | null = null;
    let isDraw = false;

    for (const ps of this.playerStates.values()) {
      if (ps.score > bestScore) {
        bestScore = ps.score;
        winnerId = ps.id;
        isDraw = false;
      } else if (ps.score === bestScore) {
        isDraw = true;
      }
    }

    return {
      winnerId: isDraw ? null : winnerId,
      reason: "",
    };
  }

  /** 서버 틱에서 호출: 새 단어 스폰 + 바닥 도달 체크 */
  tick(): {
    spawnedWords: TypingWord[];
    missedWordIds: Map<string, number[]>;
    updatedPlayers: Map<string, TypingPlayerState>;
    gameOver: boolean;
  } {
    const now = Date.now();
    const config = TYPING_DIFFICULTY_CONFIGS[this.difficulty];
    const { speedMult } = this.getAcceleration(now);

    // 바닥 도달한 단어 체크 (플레이어별)
    const missedWordIds = new Map<string, number[]>();
    const updatedPlayers = new Map<string, TypingPlayerState>();

    for (const [playerId, words] of this.playerWords) {
      const ps = this.playerStates.get(playerId);
      if (!ps || ps.status !== "playing") continue;

      const missed: number[] = [];
      const remaining: TypingWord[] = [];

      for (const w of words) {
        // fallDurationMs는 스폰 시점에 이미 가속이 반영된 값
        const elapsed = now - w.spawnedAt;
        if (elapsed >= w.fallDurationMs) {
          missed.push(w.id);
        } else {
          remaining.push(w);
        }
      }

      if (missed.length > 0) {
        ps.lives -= missed.length;
        ps.combo = 0;
        if (ps.lives <= 0) {
          ps.lives = 0;
          ps.status = "gameover";
        }
        this.playerWords.set(playerId, remaining);
        missedWordIds.set(playerId, missed);
        updatedPlayers.set(playerId, { ...ps });
      }
    }

    // 새 단어 스폰 (모든 활성 플레이어에게 동일 단어)
    const spawnedWords: TypingWord[] = [];
    const activePlayers = [...this.playerStates.values()].filter((ps) => ps.status === "playing");
    if (activePlayers.length > 0) {
      const maxCurrentWords = Math.max(
        ...activePlayers.map((ps) => this.playerWords.get(ps.id)?.length ?? 0),
      );

      if (maxCurrentWords < config.maxWords) {
        const word = this.pickWord();
        if (word) {
          const adjustedFallDuration = config.fallDurationMs / speedMult;
          const x = 5 + Math.floor(Math.random() * 90); // 5~95% 랜덤 수평 위치
          const typingWord: TypingWord = {
            id: this.nextWordId++,
            text: word,
            spawnedAt: now,
            fallDurationMs: adjustedFallDuration,
            x,
          };
          spawnedWords.push(typingWord);

          // 모든 활성 플레이어에게 동일 단어 추가
          for (const ps of activePlayers) {
            this.playerWords.get(ps.id)?.push({ ...typingWord });
          }
        }
      }
    }

    const allDead = activePlayers.length === 0 ||
      [...this.playerStates.values()].every((ps) => ps.status === "gameover");
    const timeUp = now - this.startedAt >= this.timeLimit * 1000;

    return {
      spawnedWords,
      missedWordIds,
      updatedPlayers,
      gameOver: allDead || timeUp,
    };
  }

  getPlayerState(playerId: string): TypingPlayerState | undefined {
    return this.playerStates.get(playerId);
  }

  getPlayerWords(playerId: string): TypingWord[] {
    return this.playerWords.get(playerId) ?? [];
  }

  getAllPlayerStates(): Record<string, TypingPlayerState> {
    const record: Record<string, TypingPlayerState> = {};
    for (const [id, ps] of this.playerStates) {
      record[id] = { ...ps };
    }
    return record;
  }

  /** 카운트다운 완료 후 startedAt을 현재 시각으로 재설정 */
  resetStartedAt(): void {
    this.startedAt = Date.now();
  }

  getDifficulty(): TypingDifficulty {
    return this.difficulty;
  }

  getSpawnIntervalMs(): number {
    const config = TYPING_DIFFICULTY_CONFIGS[this.difficulty];
    const { spawnMult } = this.getAcceleration(Date.now());
    return config.spawnIntervalMs * spawnMult;
  }

  getAcceleration(now: number): { speedMult: number; spawnMult: number } {
    const elapsed = now - this.startedAt;
    const ratio = Math.min(elapsed / (this.timeLimit * 1000), 1);

    for (const phase of ACCELERATION_PHASES) {
      if (ratio <= phase.threshold) {
        return { speedMult: phase.speedMult, spawnMult: phase.spawnMult };
      }
    }
    return { speedMult: 1.5, spawnMult: 0.7 };
  }

  /** processMove 후 결과가 오타인지 확인 (UI 피드백 용) */
  wasLastMoveTypo(playerId: string, submittedWord: string): boolean {
    const words = this.playerWords.get(playerId);
    if (!words) return true;
    return !words.some((w) => w.text === submittedWord);
  }

  /** 현재 상태를 PublicState로 변환 */
  toPublicState(): TypingPublicState {
    const { speedMult, spawnMult } = this.getAcceleration(Date.now());
    return {
      players: this.getAllPlayerStates(),
      words: [],
      difficulty: this.difficulty,
      timeLimit: this.timeLimit,
      maxLives: this.maxLives,
      startedAt: this.startedAt,
      speedMultiplier: speedMult,
      spawnMultiplier: spawnMult,
    };
  }

  private toPublicStateFromPrev(prev: TypingPublicState): TypingPublicState {
    const { speedMult, spawnMult } = this.getAcceleration(Date.now());
    return {
      ...prev,
      players: this.getAllPlayerStates(),
      speedMultiplier: speedMult,
      spawnMultiplier: spawnMult,
    };
  }

  private pickWord(): string | null {
    if (this.wordPool.length === 0) return null;
    if (this.wordIndex >= this.wordPool.length) {
      this.shufflePool();
      this.wordIndex = 0;
    }

    // 현재 모든 활성 플레이어 화면에 있는 단어와 중복되지 않는 단어 선택
    const activeWordTexts = new Set<string>();
    for (const words of this.playerWords.values()) {
      for (const w of words) {
        activeWordTexts.add(w.text);
      }
    }

    const startIndex = this.wordIndex;
    do {
      const word = this.wordPool[this.wordIndex];
      this.wordIndex++;
      if (this.wordIndex >= this.wordPool.length) {
        this.shufflePool();
        this.wordIndex = 0;
      }
      if (!activeWordTexts.has(word)) {
        return word;
      }
    } while (this.wordIndex !== startIndex);

    return null; // 모든 단어가 화면에 있음
  }

  private shufflePool(): void {
    for (let i = this.wordPool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.wordPool[i], this.wordPool[j]] = [this.wordPool[j], this.wordPool[i]];
    }
  }
}
