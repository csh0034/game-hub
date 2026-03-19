import type { Server, Socket } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from "@game-hub/shared-types";
import { broadcastAuthenticatedCount } from "./broadcast-player-count";

type GameServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export function setupNicknameHandler(io: GameServer, socket: GameSocket) {
  socket.on("player:set-nickname", (nickname, callback) => {
    const trimmed = nickname.trim();

    if (trimmed.length < 3 || trimmed.length > 20) {
      callback({ success: false, error: "닉네임은 3자 이상 20자 이하로 입력해주세요." });
      return;
    }

    for (const [id, s] of io.sockets.sockets) {
      if (id !== socket.id && s.data.nickname === trimmed) {
        callback({ success: false, error: "이미 사용 중인 닉네임입니다." });
        return;
      }
    }

    socket.data.nickname = trimmed;
    socket.data.authenticated = true;
    broadcastAuthenticatedCount(io);
    callback({ success: true });
  });

  socket.on("player:logout", () => {
    socket.data.authenticated = false;
    broadcastAuthenticatedCount(io);
  });
}
