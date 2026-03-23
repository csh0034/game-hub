import type { Server } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from "@game-hub/shared-types";
import { isAdmin } from "../admin.js";

type GameServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export function broadcastAuthenticatedCount(io: GameServer) {
  let count = 0;
  const players: { nickname: string; connectedAt: number; isAdmin?: boolean }[] = [];
  for (const [, s] of io.sockets.sockets) {
    if (s.data.authenticated) {
      count++;
      if (s.data.nickname) {
        const admin = isAdmin(s.data.nickname);
        players.push({
          nickname: admin ? "관리자" : s.data.nickname,
          connectedAt: s.data.authenticatedAt ?? Date.now(),
          isAdmin: admin || undefined,
        });
      }
    }
  }
  io.emit("system:player-count", { count, players });
}
