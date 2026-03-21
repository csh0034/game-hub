import type { Room, CreateRoomPayload, JoinRoomPayload } from "./lobby-types";
import type { GameState, GameMove, GameResult, HoldemPrivateState, LiarDrawingPrivateState, Card, DrawPoint, TetrisPlayerUpdate } from "./game-types";
import type { Player } from "./player-types";
import type { FeatureRequest, CreateRequestPayload, ResolveRequestPayload } from "./request-types";

export interface ChatMessage {
  id: string;
  playerId: string;
  nickname: string;
  message: string;
  timestamp: number;
}

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
  "game:draw-points": (points: DrawPoint[]) => void;

  // Player
  "player:set-nickname": (
    nickname: string,
    callback: (result: { success: boolean; error?: string; isAdmin?: boolean; githubRepoUrl?: string }) => void,
  ) => void;
  "player:logout": () => void;

  // Chat
  "chat:lobby-message": (message: string) => void;
  "chat:room-message": (message: string) => void;
  "chat:request-history": (target: "lobby" | "room", callback: (messages: ChatMessage[]) => void) => void;
  "chat:delete-message": (target: "lobby" | "room", messageId: string, callback: (result: { success: boolean; error?: string }) => void) => void;

  // Request Board
  "request:create": (payload: CreateRequestPayload, callback: (request: FeatureRequest | null, error?: string) => void) => void;
  "request:get-all": (callback: (requests: FeatureRequest[]) => void) => void;
  "request:resolve": (payload: ResolveRequestPayload, callback: (result: { success: boolean; error?: string }) => void) => void;
  "request:delete": (requestId: string, callback: (result: { success: boolean; error?: string }) => void) => void;
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
  "game:private-state": (state: HoldemPrivateState | LiarDrawingPrivateState) => void;
  "game:draw-points": (data: { playerId: string; points: DrawPoint[] }) => void;
  "game:clear-canvas": (data: { playerId: string }) => void;
  "game:tetris-player-updated": (data: TetrisPlayerUpdate) => void;
  "game:player-left": (data: { playerId: string; nickname: string; willEnd: boolean }) => void;
  "game:rematch-requested": (playerId: string) => void;
  "game:round-ended": (data: {
    winners: { playerId: string; amount: number; handName: string }[];
    showdownCards?: Record<string, Card[]>;
    eliminatedPlayerIds: string[];
    nextRoundIn: number;
  }) => void;

  // Chat
  "chat:lobby-message": (data: ChatMessage) => void;
  "chat:room-message": (data: ChatMessage) => void;
  "chat:message-deleted": (data: { target: "lobby" | "room"; messageId: string }) => void;

  // Request Board
  "request:created": (request: FeatureRequest) => void;
  "request:resolved": (request: FeatureRequest) => void;
  "request:deleted": (requestId: string) => void;

  // System
  "system:player-count": (data: { count: number; players: { nickname: string; connectedAt: number }[] }) => void;
  "system:version": (data: { commitHash: string }) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  playerId: string;
  nickname: string;
  roomId: string | null;
  authenticated: boolean;
  authenticatedAt: number | null;
}
