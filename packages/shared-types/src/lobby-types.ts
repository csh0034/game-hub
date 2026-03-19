import type { GameType } from "./game-types";
import type { Player } from "./player-types";

export type RoomStatus = "waiting" | "playing" | "finished";

export interface Room {
  id: string;
  name: string;
  gameType: GameType;
  hostId: string;
  players: Player[];
  maxPlayers: number;
  status: RoomStatus;
  createdAt: number;
}

export interface CreateRoomPayload {
  name: string;
  gameType: GameType;
}

export interface JoinRoomPayload {
  roomId: string;
}
