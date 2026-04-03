import type { Server, Socket } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from "@game-hub/shared-types";
import { isAdmin, getDisplayNickname } from "../admin.js";

type IOServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export function setupAnnounceHandler(io: IOServer, socket: IOSocket) {
  socket.on("system:announce", (message, callback) => {
    if (!isAdmin(socket.data.nickname)) {
      callback({ success: false, error: "권한이 없습니다" });
      return;
    }
    const trimmed = message.trim();
    if (!trimmed || trimmed.length > 200) {
      callback({ success: false, error: "공지 내용은 1~200자여야 합니다" });
      return;
    }
    io.emit("system:announcement", {
      message: trimmed,
      nickname: getDisplayNickname(socket.data.nickname),
      timestamp: Date.now(),
    });
    callback({ success: true });
  });
}
