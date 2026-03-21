import type { Room } from "@game-hub/shared-types";
import type { RoomStore } from "../interfaces/room-store.js";

export class InMemoryRoomStore implements RoomStore {
  private rooms = new Map<string, Room>();

  async saveRoom(room: Room): Promise<void> {
    this.rooms.set(room.id, room);
  }

  async getRoom(roomId: string): Promise<Room | null> {
    return this.rooms.get(roomId) ?? null;
  }

  async getAllRooms(): Promise<Room[]> {
    return Array.from(this.rooms.values());
  }

  async deleteRoom(roomId: string): Promise<void> {
    this.rooms.delete(roomId);
  }
}
