import type Redis from "ioredis";
import type { SocketData } from "@game-hub/shared-types";
import type { SessionStore } from "../interfaces/session-store.js";

const SESSION_TTL = 86400; // 24 hours

export class RedisSessionStore implements SessionStore {
  constructor(private redis: Redis) {}

  async saveSession(socketId: string, data: SocketData): Promise<void> {
    try {
      await this.redis.setex(
        `session:${socketId}`,
        SESSION_TTL,
        JSON.stringify(data),
      );
    } catch (err) {
      console.error("[session-store] failed to save session:", err);
    }
  }

  async getSession(socketId: string): Promise<SocketData | null> {
    try {
      const data = await this.redis.get(`session:${socketId}`);
      return data ? (JSON.parse(data) as SocketData) : null;
    } catch (err) {
      console.error("[session-store] failed to get session:", err);
      return null;
    }
  }

  async deleteSession(socketId: string): Promise<void> {
    try {
      await this.redis.del(`session:${socketId}`);
    } catch (err) {
      console.error("[session-store] failed to delete session:", err);
    }
  }

  async isNicknameTaken(nickname: string, excludeSocketId: string): Promise<boolean> {
    try {
      const holder = await this.redis.get(`nickname:${nickname}`);
      return holder !== null && holder !== excludeSocketId;
    } catch (err) {
      console.error("[session-store] failed to check nickname:", err);
      return false;
    }
  }

  async reserveNickname(nickname: string, socketId: string): Promise<void> {
    try {
      await this.redis.setex(`nickname:${nickname}`, SESSION_TTL, socketId);
    } catch (err) {
      console.error("[session-store] failed to reserve nickname:", err);
    }
  }

  async releaseNickname(nickname: string): Promise<void> {
    try {
      await this.redis.del(`nickname:${nickname}`);
    } catch (err) {
      console.error("[session-store] failed to release nickname:", err);
    }
  }

  async findSessionByNickname(nickname: string): Promise<{ socketId: string; data: SocketData } | null> {
    try {
      const socketId = await this.redis.get(`nickname:${nickname}`);
      if (!socketId) return null;
      const data = await this.getSession(socketId);
      if (!data) return null;
      return { socketId, data };
    } catch (err) {
      console.error("[session-store] failed to find session by nickname:", err);
      return null;
    }
  }
}
