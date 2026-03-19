import type { Room, CreateRoomPayload, JoinRoomPayload } from "./lobby-types";
import type { GameState, GameMove, GameResult, HoldemPrivateState } from "./game-types";
import type { Player } from "./player-types";

// Client → Server
export interface ClientToServerEvents {
  // Lobby
  "lobby:create-room": (payload: CreateRoomPayload, callback: (room: Room) => void) => void;
  "lobby:join-room": (payload: JoinRoomPayload, callback: (room: Room | null, error?: string) => void) => void;
  "lobby:leave-room": () => void;
  "lobby:get-rooms": (callback: (rooms: Room[]) => void) => void;
  "lobby:toggle-ready": () => void;

  // Game
  "game:move": (move: GameMove) => void;
  "game:start": () => void;
  "game:rematch": () => void;

  // Player
  "player:set-nickname": (
    nickname: string,
    callback: (result: { success: boolean; error?: string }) => void,
  ) => void;
  "player:logout": () => void;

  // Chat
  "chat:message": (message: string) => void;
}

// Server → Client
export interface ServerToClientEvents {
  // Lobby
  "lobby:room-created": (room: Room) => void;
  "lobby:room-updated": (room: Room) => void;
  "lobby:room-removed": (roomId: string) => void;
  "lobby:rooms-list": (rooms: Room[]) => void;
  "lobby:player-joined": (player: Player) => void;
  "lobby:player-left": (playerId: string) => void;
  "lobby:error": (message: string) => void;

  // Game
  "game:started": (state: GameState) => void;
  "game:state-updated": (state: GameState) => void;
  "game:ended": (result: GameResult) => void;
  "game:error": (message: string) => void;
  "game:private-state": (state: HoldemPrivateState) => void;
  "game:rematch-requested": (playerId: string) => void;

  // Chat
  "chat:message": (data: { playerId: string; nickname: string; message: string; timestamp: number }) => void;

  // System
  "system:player-count": (count: number) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  playerId: string;
  nickname: string;
  roomId: string | null;
  authenticated: boolean;
}
