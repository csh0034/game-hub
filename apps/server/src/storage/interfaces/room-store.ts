import type { Room } from "@game-hub/shared-types";

export interface RoomStore {
  saveRoom(room: Room): Promise<void>;
  getRoom(roomId: string): Promise<Room | null>;
  getAllRooms(): Promise<Room[]>;
  deleteRoom(roomId: string): Promise<void>;
}
