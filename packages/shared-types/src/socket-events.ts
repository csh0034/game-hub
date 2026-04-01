import type { Room, CreateRoomPayload, JoinRoomPayload, GameOptions } from "./lobby-types";
import type { GameState, GameMove, GameResult, LiarDrawingPrivateState, CatchMindPrivateState, DrawPoint, TetrisPlayerUpdate, TetrisPieceUpdate, TypingWord, TypingPlayerState, TypingTickResult } from "./game-types";
import type { Player } from "./player-types";
import type { FeatureRequest, CreateRequestPayload, ChangeStatusPayload, UpdateRequestPayload, ChangeLabelPayload } from "./request-types";
import type { RankingKey, RankingEntry } from "./ranking-types";

export interface ChatMessage {
  id: string;
  playerId: string;
  nickname: string;
  message: string;
  timestamp: number;
  isAdmin?: boolean;
  isSpectator?: boolean;
}

// Client → Server
export interface ClientToServerEvents {
  // Lobby
  "lobby:create-room": (payload: CreateRoomPayload, callback: (room: Room) => void) => void;
  "lobby:join-room": (payload: JoinRoomPayload, callback: (room: Room | null, error?: string) => void) => void;
  "lobby:leave-room": () => void;
  "lobby:get-rooms": (callback: (rooms: Room[]) => void) => void;
  "lobby:toggle-ready": () => void;
  "lobby:update-game-options": (gameOptions: GameOptions, callback: (result: { success: boolean; error?: string }) => void) => void;
  "lobby:update-room-name": (name: string, callback: (result: { success: boolean; error?: string }) => void) => void;
  "lobby:join-spectate": (payload: JoinRoomPayload, callback: (room: Room | null, error?: string) => void) => void;
  "lobby:kick-spectators": (callback: (result: { success: boolean; error?: string }) => void) => void;
  "lobby:kick": (targetId: string, callback: (result: { success: boolean; error?: string }) => void) => void;
  "lobby:switch-role": (callback: (result: { success: boolean; error?: string; role?: "player" | "spectator" }) => void) => void;

  // Game
  "game:move": (move: GameMove) => void;
  "game:start": () => void;
  "game:rematch": () => void;
  "game:draw-points": (points: DrawPoint[]) => void;

  // Player
  "player:set-nickname": (
    nickname: string,
    browserId: string,
    callback: (result: { success: boolean; error?: string; isAdmin?: boolean; githubRepoUrl?: string }) => void,
  ) => void;
  "player:logout": () => void;

  // Chat
  "chat:lobby-message": (message: string) => void;
  "chat:room-message": (message: string) => void;
  "chat:request-history": (target: "lobby" | "room", callback: (messages: ChatMessage[]) => void) => void;
  "chat:delete-message": (target: "lobby" | "room", messageId: string, callback: (result: { success: boolean; error?: string }) => void) => void;
  "chat:whisper": (payload: { targetNickname: string; message: string }, callback: (result: { success: boolean; error?: string }) => void) => void;

  // Request Board
  "request:create": (payload: CreateRequestPayload, callback: (request: FeatureRequest | null, error?: string) => void) => void;
  "request:get-all": (callback: (requests: FeatureRequest[]) => void) => void;
  "request:change-status": (payload: ChangeStatusPayload, callback: (result: { success: boolean; error?: string }) => void) => void;
  "request:update": (payload: UpdateRequestPayload, callback: (result: { success: boolean; error?: string }) => void) => void;
  "request:change-label": (payload: ChangeLabelPayload, callback: (result: { success: boolean; error?: string }) => void) => void;
  "request:delete": (requestId: string, callback: (result: { success: boolean; error?: string }) => void) => void;

  // Ranking
  "ranking:get": (key: RankingKey, callback: (entries: RankingEntry[]) => void) => void;
  "ranking:delete": (key: RankingKey, entryId: string, callback: (result: { success: boolean; error?: string }) => void) => void;

  // System
  "system:announce": (message: string, callback: (result: { success: boolean; error?: string }) => void) => void;

  // Placard
  "placard:set": (items: string[], callback: (result: { success: boolean; error?: string }) => void) => void;
  "placard:get": (callback: (items: string[]) => void) => void;
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
  "lobby:spectator-joined": (player: Player) => void;
  "lobby:spectator-left": (playerId: string) => void;
  "lobby:spectator-kicked": () => void;
  "lobby:kicked": () => void;
  "lobby:error": (message: string) => void;

  // Game
  "game:started": (state: GameState) => void;
  "game:state-updated": (state: GameState) => void;
  "game:ended": (result: GameResult) => void;
  "game:error": (message: string) => void;
  "game:private-state": (state: LiarDrawingPrivateState | CatchMindPrivateState) => void;
  "game:catch-mind-correct": (data: { playerId: string; nickname: string; rank: number; score: number }) => void;
  "game:draw-points": (data: { playerId: string; points: DrawPoint[] }) => void;
  "game:clear-canvas": (data: { playerId: string }) => void;
  "game:tetris-player-updated": (data: TetrisPlayerUpdate) => void;
  "game:tetris-piece-updated": (data: TetrisPieceUpdate) => void;
  "game:typing-tick-result": (data: TypingTickResult) => void;
  "game:typing-word-cleared": (data: { playerId: string; wordId: number }) => void;
  "game:typing-all-player-words": (data: Record<string, TypingWord[]>) => void;
  "game:typing-player-updated": (data: { playerId: string; player: TypingPlayerState }) => void;
  "game:player-left": (data: { playerId: string; nickname: string; willEnd: boolean }) => void;
  "game:rematch-requested": (playerId: string) => void;

  // Chat
  "chat:lobby-message": (data: ChatMessage) => void;
  "chat:room-message": (data: ChatMessage) => void;
  "chat:message-deleted": (data: { target: "lobby" | "room"; messageId: string }) => void;
  "chat:whisper-received": (data: { fromNickname: string; message: string; timestamp: number }) => void;

  // Request Board
  "request:created": (request: FeatureRequest) => void;
  "request:status-changed": (request: FeatureRequest) => void;
  "request:updated": (request: FeatureRequest) => void;
  "request:label-changed": (request: FeatureRequest) => void;
  "request:deleted": (requestId: string) => void;

  // Ranking
  "ranking:updated": (data: { key: RankingKey; rankings: RankingEntry[] }) => void;

  // Player
  "player:force-logout": () => void;

  // Placard
  "placard:updated": (items: string[]) => void;

  // System
  "system:player-count": (data: { count: number; players: { nickname: string; connectedAt: number; isAdmin?: boolean }[] }) => void;
  "system:version": (data: { commitHash: string }) => void;
  "system:announcement": (data: { message: string; nickname: string; timestamp: number }) => void;
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
  isSpectator?: boolean;
  browserId?: string;
}
