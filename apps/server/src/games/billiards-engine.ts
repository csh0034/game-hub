import type { GameType, GameState, GameMove, GameResult, Player, BilliardsPublicState, BilliardsMove } from "@game-hub/shared-types";
import type { GameEngine } from "./engine-interface.js";
import { initBallPositions, applyShotToBall, simulateStep, checkThreeCushionScore, type PhysicsBall } from "./billiards-physics.js";

export class BilliardsEngine implements GameEngine {
  gameType: GameType = "billiards";
  minPlayers = 1;
  maxPlayers = 8;

  private targetScore: number;
  private turnTimeSeconds: number;

  // Simulation state (not in public state)
  private physicsBalls: PhysicsBall[] = [];
  private stopFrameCount = 0;
  private simulating = false;

  constructor(targetScore = 10, turnTimeSeconds = 30) {
    this.targetScore = targetScore;
    this.turnTimeSeconds = turnTimeSeconds;
  }

  initState(players: Player[]): GameState {
    this.physicsBalls = initBallPositions();
    this.stopFrameCount = 0;
    this.simulating = false;

    const cueBallIds: ("cue" | "yellow")[] = ["cue", "yellow"];
    const billiardsPlayers = players.map((p, i) => ({
      id: p.id,
      nickname: p.nickname,
      score: 0,
      cueBallId: cueBallIds[i % cueBallIds.length],
    }));

    const state: BilliardsPublicState = {
      balls: this.physicsBalls.map((b) => ({ id: b.id as "cue" | "red" | "yellow", x: b.x, z: b.z, vx: 0, vz: 0 })),
      players: billiardsPlayers,
      currentTurnIndex: 0,
      phase: "aiming",
      targetScore: this.targetScore,
      turnTimeSeconds: this.turnTimeSeconds,
      turnStartedAt: Date.now(),
      shotEvents: [],
      cushionCount: 0,
      objectBallsHit: [],
      lastShotResult: null,
    };
    return state;
  }

  processMove(state: GameState, playerId: string, move: GameMove): GameState {
    const s = state as BilliardsPublicState;
    const m = move as BilliardsMove;

    if (m.type !== "shot") return s;
    if (s.phase !== "aiming") return s;

    const currentPlayer = s.players[s.currentTurnIndex];
    if (currentPlayer.id !== playerId) return s;

    // Apply shot to physics balls
    const cueBallId = currentPlayer.cueBallId;
    const cueBall = this.physicsBalls.find((b) => b.id === cueBallId);
    if (!cueBall) return s;

    applyShotToBall(cueBall, m.directionDeg, m.power, m.impactOffsetX ?? 0, m.impactOffsetY ?? 0);
    this.simulating = true;
    this.stopFrameCount = 0;

    return {
      ...s,
      balls: this.physicsBalls.map((b) => ({ id: b.id as "cue" | "red" | "yellow", x: b.x, z: b.z, vx: b.vx, vz: b.vz })),
      phase: "simulating",
      shotEvents: [],
      cushionCount: 0,
      objectBallsHit: [],
    };
  }

  checkWin(state: GameState): GameResult | null {
    const s = state as BilliardsPublicState;
    for (const player of s.players) {
      if (player.score >= s.targetScore) {
        return { winnerId: player.id, reason: `${player.nickname}이(가) ${s.targetScore}점에 도달했습니다` };
      }
    }
    return null;
  }

  isSimulating(): boolean {
    return this.simulating;
  }

  getCueBallId(state: BilliardsPublicState): string {
    return state.players[state.currentTurnIndex].cueBallId;
  }

  simulationTick(state: BilliardsPublicState): {
    frame: { balls: { id: string; x: number; z: number; vx: number; vz: number; spinX: number; spinY: number; spinZ: number }[]; events: { type: "cushion" | "ball-hit"; ballId: string; targetId?: string; timestamp: number }[] };
    settled: boolean;
    updatedState: BilliardsPublicState;
  } {
    const cueBallId = this.getCueBallId(state);
    const { frame, settled, stopFrameCount } = simulateStep(this.physicsBalls, cueBallId, this.stopFrameCount);
    this.stopFrameCount = stopFrameCount;

    // Accumulate shot events
    const allEvents = [...state.shotEvents, ...frame.events];
    const result = checkThreeCushionScore(allEvents, cueBallId);

    let updatedState: BilliardsPublicState = {
      ...state,
      balls: this.physicsBalls.map((b) => ({ id: b.id as "cue" | "red" | "yellow", x: b.x, z: b.z, vx: b.vx, vz: b.vz })),
      shotEvents: allEvents,
      cushionCount: result.cushionCount,
      objectBallsHit: result.objectBallsHit,
    };

    if (settled) {
      this.simulating = false;
      updatedState = {
        ...updatedState,
        lastShotResult: { scored: result.scored, cushionCount: result.cushionCount, objectBallsHit: result.objectBallsHit },
        phase: result.scored ? "scored" : "missed",
      };
    }

    return { frame, settled, updatedState };
  }

  advanceTurn(state: BilliardsPublicState): BilliardsPublicState {
    const wasScored = state.lastShotResult?.scored;
    const nextTurnIndex = wasScored ? state.currentTurnIndex : (state.currentTurnIndex + 1) % state.players.length;

    if (wasScored) {
      state.players[state.currentTurnIndex].score += 1;
    }

    return {
      ...state,
      currentTurnIndex: nextTurnIndex,
      phase: "aiming",
      turnStartedAt: Date.now(),
      shotEvents: [],
      cushionCount: 0,
      objectBallsHit: [],
    };
  }

  getPhysicsBalls(): PhysicsBall[] {
    return this.physicsBalls;
  }
}
