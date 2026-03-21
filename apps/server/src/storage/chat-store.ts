import type Redis from "ioredis";
import type { ChatMessage } from "@game-hub/shared-types";

const MAX_HISTORY = 50;

export interface ChatStore {
  pushLobbyMessage(msg: ChatMessage): Promise<void>;
  getLobbyHistory(): Promise<ChatMessage[]>;
  pushRoomMessage(roomId: string, msg: ChatMessage): Promise<void>;
  getRoomHistory(roomId: string): Promise<ChatMessage[]>;
  deleteRoomHistory(roomId: string): Promise<void>;
}

export class RedisChatStore implements ChatStore {
  constructor(private redis: Redis) {}

  async pushLobbyMessage(msg: ChatMessage): Promise<void> {
    try {
      await this.redis.rpush("chat:lobby", JSON.stringify(msg));
      await this.redis.ltrim("chat:lobby", -MAX_HISTORY, -1);
    } catch (err) {
      console.error("[chat-store] failed to push lobby message:", err);
    }
  }

  async getLobbyHistory(): Promise<ChatMessage[]> {
    try {
      const items = await this.redis.lrange("chat:lobby", 0, -1);
      return items.map((item) => JSON.parse(item) as ChatMessage);
    } catch (err) {
      console.error("[chat-store] failed to get lobby history:", err);
      return [];
    }
  }

  async pushRoomMessage(roomId: string, msg: ChatMessage): Promise<void> {
    try {
      const key = `chat:room:${roomId}`;
      await this.redis.rpush(key, JSON.stringify(msg));
      await this.redis.ltrim(key, -MAX_HISTORY, -1);
    } catch (err) {
      console.error("[chat-store] failed to push room message:", err);
    }
  }

  async getRoomHistory(roomId: string): Promise<ChatMessage[]> {
    try {
      const items = await this.redis.lrange(`chat:room:${roomId}`, 0, -1);
      return items.map((item) => JSON.parse(item) as ChatMessage);
    } catch (err) {
      console.error("[chat-store] failed to get room history:", err);
      return [];
    }
  }

  async deleteRoomHistory(roomId: string): Promise<void> {
    try {
      await this.redis.del(`chat:room:${roomId}`);
    } catch (err) {
      console.error("[chat-store] failed to delete room history:", err);
    }
  }
}
