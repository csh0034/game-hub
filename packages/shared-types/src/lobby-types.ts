import type { GameType, MinesweeperDifficulty, TetrisDifficulty } from "./game-types";
import type { Player } from "./player-types";

export type RoomStatus = "waiting" | "playing" | "finished";

export interface GameOptions {
  minesweeperDifficulty?: MinesweeperDifficulty;
  tetrisDifficulty?: TetrisDifficulty;
  liarDrawingTime?: number;
  liarDrawingRounds?: number;
  catchMindTime?: number;
  catchMindRounds?: number;
  catchMindCharHint?: boolean;
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
