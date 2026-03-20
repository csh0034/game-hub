import type { GameType, MinesweeperDifficulty, TetrisDifficulty } from "./game-types";
import type { Player } from "./player-types";

export type RoomStatus = "waiting" | "playing" | "finished";

export interface GameOptions {
  minesweeperDifficulty?: MinesweeperDifficulty;
  tetrisDifficulty?: TetrisDifficulty;
  liarDrawingTime?: 30 | 60 | 90;
  liarDrawingRounds?: number;
}

export interface Room {
  id: string;
  name: string;
  gameType: GameType;
  hostId: string;
  players: Player[];
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
