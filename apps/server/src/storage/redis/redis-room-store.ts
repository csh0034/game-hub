import type Redis from "ioredis";
import type { Room } from "@game-hub/shared-types";
import type { RoomStore } from "../interfaces/room-store.js";

export class RedisRoomStore implements RoomStore {
  constructor(private redis: Redis) {}

  async saveRoom(room: Room): Promise<void> {
    try {
      await this.redis
        .pipeline()
        .set(`room:${room.id}`, JSON.stringify(room))
        .sadd("rooms", room.id)
        .exec();
    } catch (err) {
      console.error("[room-store] failed to save room:", err);
    }
  }

  async getRoom(roomId: string): Promise<Room | null> {
    try {
      const data = await this.redis.get(`room:${roomId}`);
      return data ? (JSON.parse(data) as Room) : null;
    } catch (err) {
      console.error("[room-store] failed to get room:", err);
      return null;
    }
  }

  async getAllRooms(): Promise<Room[]> {
    try {
      const ids = await this.redis.smembers("rooms");
      if (ids.length === 0) return [];
      const pipeline = this.redis.pipeline();
      for (const id of ids) {
        pipeline.get(`room:${id}`);
      }
      const results = await pipeline.exec();
      if (!results) return [];

      const rooms: Room[] = [];
      for (let i = 0; i < results.length; i++) {
        const [err, data] = results[i];
        if (!err && data) {
          rooms.push(JSON.parse(data as string) as Room);
        } else if (!data) {
          // Stale ID in set, clean up
          this.redis.srem("rooms", ids[i]).catch(() => {});
        }
      }
      return rooms;
    } catch (err) {
      console.error("[room-store] failed to get all rooms:", err);
      return [];
    }
  }

  async deleteRoom(roomId: string): Promise<void> {
    try {
      await this.redis
        .pipeline()
        .del(`room:${roomId}`)
        .srem("rooms", roomId)
        .exec();
    } catch (err) {
      console.error("[room-store] failed to delete room:", err);
    }
  }
}
