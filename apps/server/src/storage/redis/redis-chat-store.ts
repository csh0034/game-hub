import crypto from "node:crypto";
import type Redis from "ioredis";
import type { ChatMessage } from "@game-hub/shared-types";
import type { ChatStore } from "../interfaces/chat-store.js";

const MAX_HISTORY = 50;

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
      return await this.migrateMessages("chat:lobby", items);
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
      const key = `chat:room:${roomId}`;
      const items = await this.redis.lrange(key, 0, -1);
      return await this.migrateMessages(key, items);
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

  private async migrateMessages(key: string, items: string[]): Promise<ChatMessage[]> {
    let needsMigration = false;
    const messages = items.map((item) => {
      const msg = JSON.parse(item) as ChatMessage;
      if (!msg.id) {
        msg.id = crypto.randomUUID();
        needsMigration = true;
      }
      return msg;
    });
    if (needsMigration) {
      const pipeline = this.redis.pipeline();
      pipeline.del(key);
      for (const msg of messages) {
        pipeline.rpush(key, JSON.stringify(msg));
      }
      await pipeline.exec();
    }
    return messages;
  }

  async deleteLobbyMessage(messageId: string): Promise<boolean> {
    try {
      const items = await this.redis.lrange("chat:lobby", 0, -1);
      const target = items.find((item) => {
        const msg = JSON.parse(item) as ChatMessage;
        return msg.id === messageId;
      });
      if (!target) return false;
      await this.redis.lrem("chat:lobby", 1, target);
      return true;
    } catch (err) {
      console.error("[chat-store] failed to delete lobby message:", err);
      return false;
    }
  }

  async deleteRoomMessage(roomId: string, messageId: string): Promise<boolean> {
    try {
      const key = `chat:room:${roomId}`;
      const items = await this.redis.lrange(key, 0, -1);
      const target = items.find((item) => {
        const msg = JSON.parse(item) as ChatMessage;
        return msg.id === messageId;
      });
      if (!target) return false;
      await this.redis.lrem(key, 1, target);
      return true;
    } catch (err) {
      console.error("[chat-store] failed to delete room message:", err);
      return false;
    }
  }
}
