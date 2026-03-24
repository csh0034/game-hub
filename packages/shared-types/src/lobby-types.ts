import type { GameType, MinesweeperDifficulty, TetrisDifficulty } from "./game-types";
import type { Player } from "./player-types";

export type RoomStatus = "waiting" | "playing" | "finished";

export type GomokuFirstColor = "host" | "guest";

export interface GameOptions {
  minesweeperDifficulty?: MinesweeperDifficulty;
  tetrisDifficulty?: TetrisDifficulty;
  liarDrawingTime?: number;
  liarDrawingRounds?: number;
  catchMindTime?: number;
  catchMindRounds?: number;
  catchMindCharHint?: boolean;
  gomokuTurnTime?: number;
  gomokuFirstColor?: GomokuFirstColor;
  spectateEnabled?: boolean;
  spectateChatEnabled?: boolean;
}

export const MAX_SPECTATORS = 4;

export interface Room {
  id: string;
  name: string;
  gameType: GameType;
  hostId: string;
  players: Player[];
  spectators: Player[];
  maxPlayers: number;
  status: RoomStatus;
  createdAt: number;
  gameOptions?: GameOptions;
}

export interface CreateRoomPayload {
  name: string;
  gameType: GameType;
  gameOptions?: GameOptions;
}

export interface JoinRoomPayload {
  roomId: string;
}
