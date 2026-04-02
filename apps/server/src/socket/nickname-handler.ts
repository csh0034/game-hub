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
  socket.on("player:set-nickname", async (nickname, browserIdOrCallback, maybeCallback) => {
    // 하위 호환: browserId 없이 (nickname, callback) 2인자로 호출하는 기존 클라이언트 지원
    const callback = typeof maybeCallback === "function" ? maybeCallback : typeof browserIdOrCallback === "function" ? browserIdOrCallback : null;
    const browserId = typeof browserIdOrCallback === "string" ? browserIdOrCallback : undefined;
    if (!callback) return;
    const trimmed = nickname.trim();

    if (trimmed.length < 3 || trimmed.length > 20) {
      callback({ success: false, error: "닉네임은 3자 이상 20자 이하로 입력해주세요." });
      return;
    }

    if (trimmed === "관리자") {
      callback({ success: false, error: "사용할 수 없는 닉네임입니다." });
      return;
    }

    // Nickname uniqueness check
    const taken = await sessionStore.isNicknameTaken(trimmed, socket.id!);
    if (taken) {
      const prev = await sessionStore.findSessionByNickname(trimmed);
      if (prev) {
        const oldSocket = io.sockets.sockets.get(prev.socketId);
        if (oldSocket) {
          // 같은 브라우저(browserId 일치)만 force-logout 허용
          if (prev.data.browserId !== browserId) {
            callback({ success: false, error: "이미 사용 중인 닉네임입니다." });
            return;
          }
          oldSocket.emit("player:force-logout");
          oldSocket.data.authenticated = false;
          oldSocket.disconnect(true);
        }

        const oldRoomId = prev.data.roomId;
        await sessionStore.deleteSession(prev.socketId);
        await sessionStore.releaseNickname(trimmed);

        // Restore room membership
        if (oldRoomId) {
          const room = gameManager.replacePlayerId(oldRoomId, prev.socketId, socket.id!);
          if (room) {
            socket.join(oldRoomId);
            socket.data.roomId = oldRoomId;
            socket.data.isSpectator = prev.data.isSpectator || false;
            io.to(oldRoomId).emit("lobby:room-updated", room);
            io.emit("lobby:room-updated", room);
          }
        }
      }
    }

    socket.data.browserId = browserId;
    socket.data.nickname = trimmed;
    socket.data.authenticated = true;
    socket.data.authenticatedAt = Date.now();
    if (!socket.data.roomId) {
      socket.join("lobby");
    }

    // 방에 있는 경우 닉네임 동기화
    if (socket.data.roomId) {
      const updatedRoom = gameManager.updatePlayerNickname(socket.data.roomId, socket.id!, trimmed);
      if (updatedRoom) {
        io.to(socket.data.roomId).emit("lobby:room-updated", updatedRoom);
        io.emit("lobby:room-updated", updatedRoom);
      }
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
