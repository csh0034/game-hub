import type { Server } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from "@game-hub/shared-types";

type GameServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export function broadcastAuthenticatedCount(io: GameServer) {
  let count = 0;
  const players: { nickname: string; connectedAt: number }[] = [];
  for (const [, s] of io.sockets.sockets) {
    if (s.data.authenticated) {
      count++;
      if (s.data.nickname) {
        players.push({
          nickname: s.data.nickname,
          connectedAt: s.data.authenticatedAt ?? Date.now(),
        });
      }
    }
  }
  io.emit("system:player-count", { count, players });
}
