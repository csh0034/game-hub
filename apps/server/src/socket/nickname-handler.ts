import type { Server, Socket } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from "@game-hub/shared-types";
import { broadcastAuthenticatedCount } from "./broadcast-player-count.js";
import type { SessionStore } from "../storage/index.js";
import type { GameManager } from "../games/game-manager.js";
import { isAdmin } from "../admin.js";

const GITHUB_REPO_URL = process.env.GITHUB_REPO_URL || "https://github.com/csh0034/game-hub";

type GameServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export function setupNicknameHandler(
  io: GameServer,
  socket: GameSocket,
  sessionStore: SessionStore,
  gameManager: GameManager,
) {
  socket.on("player:set-nickname", async (nickname, callback) => {
    const trimmed = nickname.trim();

    if (trimmed.length < 3 || trimmed.length > 20) {
      callback({ success: false, error: "닉네임은 3자 이상 20자 이하로 입력해주세요." });
      return;
    }

    // Nickname uniqueness check
    const taken = await sessionStore.isNicknameTaken(trimmed, socket.id!);
    if (taken) {
      // Check if the holder is actually connected
      const prev = await sessionStore.findSessionByNickname(trimmed);
      if (prev && io.sockets.sockets.has(prev.socketId)) {
        callback({ success: false, error: "이미 사용 중인 닉네임입니다." });
        return;
      }
      // Previous holder disconnected — allow reconnection
      if (prev) {
        const oldRoomId = prev.data.roomId;
        await sessionStore.deleteSession(prev.socketId);
        await sessionStore.releaseNickname(trimmed);

        // Restore room membership
        if (oldRoomId) {
          const room = gameManager.replacePlayerId(oldRoomId, prev.socketId, socket.id!);
          if (room) {
            socket.join(oldRoomId);
            socket.data.roomId = oldRoomId;
            io.to(oldRoomId).emit("lobby:room-updated", room);
            io.emit("lobby:room-updated", room);
          }
        }
      }
    }

    socket.data.nickname = trimmed;
    socket.data.authenticated = true;
    socket.data.authenticatedAt = Date.now();
    if (!socket.data.roomId) {
      socket.join("lobby");
    }

    await sessionStore.reserveNickname(trimmed, socket.id!);
    await sessionStore.saveSession(socket.id!, socket.data);

    broadcastAuthenticatedCount(io);
    callback({ success: true, isAdmin: isAdmin(trimmed), githubRepoUrl: GITHUB_REPO_URL });
  });

  socket.on("player:logout", async () => {
    await sessionStore.releaseNickname(socket.data.nickname);
    await sessionStore.deleteSession(socket.id!);
    socket.data.authenticated = false;
    socket.data.authenticatedAt = null;
    socket.leave("lobby");
    broadcastAuthenticatedCount(io);
  });
}
