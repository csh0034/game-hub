import type { SocketData } from "@game-hub/shared-types";
import type { SessionStore } from "./session-store.js";

export class InMemorySessionStore implements SessionStore {
  private sessions = new Map<string, SocketData>();
  private nicknames = new Map<string, string>();

  async saveSession(socketId: string, data: SocketData): Promise<void> {
    this.sessions.set(socketId, data);
  }

  async getSession(socketId: string): Promise<SocketData | null> {
    return this.sessions.get(socketId) ?? null;
  }

  async deleteSession(socketId: string): Promise<void> {
    this.sessions.delete(socketId);
  }

  async isNicknameTaken(nickname: string, excludeSocketId: string): Promise<boolean> {
    const holder = this.nicknames.get(nickname);
    return holder !== undefined && holder !== excludeSocketId;
  }

  async reserveNickname(nickname: string, socketId: string): Promise<void> {
    this.nicknames.set(nickname, socketId);
  }

  async releaseNickname(nickname: string): Promise<void> {
    this.nicknames.delete(nickname);
  }

  async findSessionByNickname(nickname: string): Promise<{ socketId: string; data: SocketData } | null> {
    const socketId = this.nicknames.get(nickname);
    if (!socketId) return null;
    const data = this.sessions.get(socketId);
    if (!data) return null;
    return { socketId, data };
  }
}
