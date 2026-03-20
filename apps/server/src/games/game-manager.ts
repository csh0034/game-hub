import type { Room, CreateRoomPayload, RoomStatus } from "@game-hub/shared-types";
import type { Player, GameType, GameState, GameMove, GameResult } from "@game-hub/shared-types";
import { GomokuEngine } from "./gomoku-engine.js";
import { HoldemEngine } from "./holdem-engine.js";
import { MinesweeperEngine } from "./minesweeper-engine.js";
import { TetrisEngine } from "./tetris-engine.js";
import type { GameEngine } from "./engine-interface.js";

export class GameManager {
  private rooms: Map<string, Room> = new Map();
  private gameStates: Map<string, GameState> = new Map();
  private engines: Map<GameType, GameEngine> = new Map();
  // Per-room stateful engine instances (holdem, minesweeper, tetris)
  private roomEngines: Map<string, GameEngine> = new Map();

  constructor() {
    this.engines.set("gomoku", new GomokuEngine());
    this.engines.set("texas-holdem", new HoldemEngine());
    this.engines.set("minesweeper", new MinesweeperEngine());
    this.engines.set("tetris", new TetrisEngine());
  }

  createRoom(payload: CreateRoomPayload, host: Player): Room {
    const id = this.generateId();
    const engine = this.engines.get(payload.gameType)!;
    const room: Room = {
      id,
      name: payload.name,
      gameType: payload.gameType,
      hostId: host.id,
      players: [host],
      maxPlayers: engine.maxPlayers,
      status: "waiting",
      createdAt: Date.now(),
      gameOptions: payload.gameOptions,
    };
    this.rooms.set(id, room);
    return room;
  }

  joinRoom(roomId: string, player: Player): Room | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    if (room.status !== "waiting") return null;
    if (room.players.length >= room.maxPlayers) return null;
    if (room.players.some((p) => p.id === player.id)) return null;
    room.players.push(player);
    return room;
  }

  removePlayer(roomId: string, playerId: string): Room | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    room.players = room.players.filter((p) => p.id !== playerId);
    if (room.players.length === 0) {
      this.rooms.delete(roomId);
      this.cleanupRoomState(roomId);
      return null;
    }
    if (room.hostId === playerId) {
      room.hostId = room.players[0].id;
    }
    if (room.status === "finished") {
      room.status = "waiting";
      this.cleanupRoomState(roomId);
    } else if (room.status === "playing") {
      const engine = this.engines.get(room.gameType)!;
      if (room.players.length < engine.minPlayers) {
        room.status = "waiting";
        this.cleanupRoomState(roomId);
      }
    }
    return room;
  }

  toggleReady(roomId: string, playerId: string): Room | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    const player = room.players.find((p) => p.id === playerId);
    if (player) {
      player.isReady = !player.isReady;
    }
    return room;
  }

  startGame(roomId: string): GameState | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    const engine = this.engines.get(room.gameType)!;
    if (room.players.length < engine.minPlayers) return null;

    // 방장을 제외한 모든 플레이어가 준비 완료 상태여야 함
    const otherPlayers = room.players.filter((p) => p.id !== room.hostId);
    if (otherPlayers.length > 0 && !otherPlayers.every((p) => p.isReady)) return null;
    room.status = "playing";

    if (room.gameType === "texas-holdem") {
      const holdemEngine = new HoldemEngine();
      this.roomEngines.set(roomId, holdemEngine);
      const state = holdemEngine.initState(room.players);
      this.gameStates.set(roomId, state);
      return state;
    }

    if (room.gameType === "minesweeper") {
      const difficulty = room.gameOptions?.minesweeperDifficulty ?? "beginner";
      const minesweeperEngine = new MinesweeperEngine(difficulty);
      this.roomEngines.set(roomId, minesweeperEngine);
      const state = minesweeperEngine.initState(room.players);
      this.gameStates.set(roomId, state);
      return state;
    }

    if (room.gameType === "tetris") {
      const difficulty = room.gameOptions?.tetrisDifficulty ?? "normal";
      const tetrisEngine = new TetrisEngine(difficulty);
      this.roomEngines.set(roomId, tetrisEngine);
      const state = tetrisEngine.initState(room.players);
      this.gameStates.set(roomId, state);
      return state;
    }

    const state = engine.initState(room.players);
    this.gameStates.set(roomId, state);
    return state;
  }

  processMove(roomId: string, playerId: string, move: GameMove): { state: GameState; result: GameResult | null } | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    const state = this.gameStates.get(roomId);
    if (!state) return null;

    const engine = this.roomEngines.get(roomId) || this.engines.get(room.gameType)!;

    const newState = engine.processMove(state, playerId, move);
    this.gameStates.set(roomId, newState);
    const result = engine.checkWin(newState);
    if (result) {
      room.status = "finished";
    }
    return { state: newState, result };
  }

  resetRoom(roomId: string): Room | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    room.status = "waiting";
    room.players.forEach((p) => (p.isReady = false));
    this.cleanupRoomState(roomId);
    return room;
  }

  getRoom(roomId: string): Room | null {
    return this.rooms.get(roomId) || null;
  }

  getGameState(roomId: string): GameState | null {
    return this.gameStates.get(roomId) || null;
  }

  setGameState(roomId: string, state: GameState): void {
    this.gameStates.set(roomId, state);
  }

  getRooms(): Room[] {
    return Array.from(this.rooms.values());
  }

  getRoomCount(): number {
    return this.rooms.size;
  }

  getHoldemEngine(roomId: string): HoldemEngine | null {
    const engine = this.roomEngines.get(roomId);
    return engine instanceof HoldemEngine ? engine : null;
  }

  getMinesweeperEngine(roomId: string): MinesweeperEngine | null {
    const engine = this.roomEngines.get(roomId);
    return engine instanceof MinesweeperEngine ? engine : null;
  }

  getTetrisEngine(roomId: string): TetrisEngine | null {
    const engine = this.roomEngines.get(roomId);
    return engine instanceof TetrisEngine ? engine : null;
  }

  private cleanupRoomState(roomId: string): void {
    this.gameStates.delete(roomId);
    this.roomEngines.delete(roomId);
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }
}
