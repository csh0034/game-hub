import type { SocketData } from "@game-hub/shared-types";

export interface SessionStore {
  saveSession(socketId: string, data: SocketData): Promise<void>;
  getSession(socketId: string): Promise<SocketData | null>;
  deleteSession(socketId: string): Promise<void>;
  isNicknameTaken(nickname: string, excludeSocketId: string): Promise<boolean>;
  reserveNickname(nickname: string, socketId: string): Promise<void>;
  releaseNickname(nickname: string): Promise<void>;
  findSessionByNickname(nickname: string): Promise<{ socketId: string; data: SocketData } | null>;
}
