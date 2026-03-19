import type { Room, CreateRoomPayload, RoomStatus } from "@game-hub/shared-types";
import type { Player, GameType, GameState, GameMove, GameResult } from "@game-hub/shared-types";
import { GomokuEngine } from "./gomoku-engine";
import { HoldemEngine } from "./holdem-engine";
import { MinesweeperEngine } from "./minesweeper-engine";
import type { GameEngine } from "./engine-interface";

export class GameManager {
  private rooms: Map<string, Room> = new Map();
  private gameStates: Map<string, GameState> = new Map();
  private engines: Map<GameType, GameEngine> = new Map();
  // Holdem: per-room engine instances for stateful deck management
  private holdemInstances: Map<string, HoldemEngine> = new Map();
  // Minesweeper: per-room engine instances for hidden mine state
  private minesweeperInstances: Map<string, MinesweeperEngine> = new Map();

  constructor() {
    this.engines.set("gomoku", new GomokuEngine());
    this.engines.set("texas-holdem", new HoldemEngine());
    this.engines.set("minesweeper", new MinesweeperEngine());
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
      this.gameStates.delete(roomId);
      this.holdemInstances.delete(roomId);
      this.minesweeperInstances.delete(roomId);
      return null;
    }
    if (room.hostId === playerId) {
      room.hostId = room.players[0].id;
    }
    // If game was in progress and not enough players, end it
    if (room.status === "playing") {
      const engine = this.engines.get(room.gameType)!;
      if (room.players.length < engine.minPlayers) {
        room.status = "waiting";
        this.gameStates.delete(roomId);
        this.holdemInstances.delete(roomId);
        this.minesweeperInstances.delete(roomId);
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
    room.status = "playing";

    if (room.gameType === "texas-holdem") {
      const holdemEngine = new HoldemEngine();
      this.holdemInstances.set(roomId, holdemEngine);
      const state = holdemEngine.initState(room.players);
      this.gameStates.set(roomId, state);
      return state;
    }

    if (room.gameType === "minesweeper") {
      const difficulty = room.gameOptions?.minesweeperDifficulty ?? "beginner";
      const minesweeperEngine = new MinesweeperEngine(difficulty);
      this.minesweeperInstances.set(roomId, minesweeperEngine);
      const state = minesweeperEngine.initState(room.players);
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

    let engine: GameEngine;
    if (room.gameType === "texas-holdem") {
      engine = this.holdemInstances.get(roomId) || this.engines.get(room.gameType)!;
    } else if (room.gameType === "minesweeper") {
      engine = this.minesweeperInstances.get(roomId) || this.engines.get(room.gameType)!;
    } else {
      engine = this.engines.get(room.gameType)!;
    }

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
    this.gameStates.delete(roomId);
    this.holdemInstances.delete(roomId);
    this.minesweeperInstances.delete(roomId);
    return room;
  }

  getRoom(roomId: string): Room | null {
    return this.rooms.get(roomId) || null;
  }

  getGameState(roomId: string): GameState | null {
    return this.gameStates.get(roomId) || null;
  }

  getRooms(): Room[] {
    return Array.from(this.rooms.values());
  }

  getRoomCount(): number {
    return this.rooms.size;
  }

  getHoldemEngine(roomId: string): HoldemEngine | null {
    return this.holdemInstances.get(roomId) || null;
  }

  getMinesweeperEngine(roomId: string): MinesweeperEngine | null {
    return this.minesweeperInstances.get(roomId) || null;
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }
}
