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
  const nicknames: string[] = [];
  for (const [, s] of io.sockets.sockets) {
    if (s.data.authenticated) {
      count++;
      if (s.data.nickname) {
        nicknames.push(s.data.nickname);
      }
    }
  }
  io.emit("system:player-count", { count, nicknames });
}
