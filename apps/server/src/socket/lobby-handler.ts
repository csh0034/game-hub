import type { Server, Socket } from "socket.io";
import {
  GAME_CONFIGS,
  type ChatMessage,
  type ClientToServerEvents,
  type ServerToClientEvents,
  type InterServerEvents,
  type SocketData,
} from "@game-hub/shared-types";
import crypto from "node:crypto";
import type { GameManager } from "../games/game-manager.js";
import type { ChatStore } from "../storage/index.js";
import { isAdmin } from "../admin.js";
import { clearGomokuTimer } from "../games/gomoku-timer.js";
import { clearTetrisTicker } from "../games/tetris-ticker.js";

type IOServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export function setupLobbyHandler(io: IOServer, socket: IOSocket, gameManager: GameManager, chatStore: ChatStore) {
  function emitPlayerLeftIfPlaying(roomId: string) {
    const room = gameManager.getRoom(roomId);
    if (room && room.status === "playing") {
      const willEnd = room.players.length - 1 < GAME_CONFIGS[room.gameType].minPlayers;
      socket.to(roomId).emit("game:player-left", {
        playerId: socket.id!,
        nickname: socket.data.nickname,
        willEnd,
      });
    }
  }

  function cleanupPreviousRoom() {
    const prevRoomId = socket.data.roomId;
    if (!prevRoomId) return;
    emitPlayerLeftIfPlaying(prevRoomId);
    clearGomokuTimer(prevRoomId);
    clearTetrisTicker(prevRoomId);
    socket.leave(prevRoomId);
    socket.data.roomId = null;
    const prevRoom = gameManager.removePlayer(prevRoomId, socket.id!);
    if (prevRoom) {
      io.to(prevRoomId).emit("lobby:player-left", socket.id!);
      io.to(prevRoomId).emit("lobby:room-updated", prevRoom);
      io.emit("lobby:room-updated", prevRoom);
    } else {
      chatStore.deleteRoomHistory(prevRoomId);
      io.emit("lobby:room-removed", prevRoomId);
    }
  }

  socket.on("lobby:get-rooms", (callback) => {
    callback(gameManager.getRooms());
  });

  socket.on("lobby:create-room", (payload, callback) => {
    const config = GAME_CONFIGS[payload.gameType];
    if (config.disabled) {
      socket.emit("game:error", config.disabledReason ?? "이 게임은 현재 이용할 수 없습니다.");
      return;
    }
    cleanupPreviousRoom();
    socket.leave("lobby");
    const player = {
      id: socket.id!,
      nickname: socket.data.nickname,
      isReady: false,
    };
    const room = gameManager.createRoom(payload, player);
    socket.join(room.id);
    socket.data.roomId = room.id;
    callback(room);
    io.emit("lobby:room-created", room);
  });

  socket.on("lobby:join-room", (payload, callback) => {
    cleanupPreviousRoom();
    socket.leave("lobby");
    const player = {
      id: socket.id!,
      nickname: socket.data.nickname,
      isReady: false,
    };
    const room = gameManager.joinRoom(payload.roomId, player);
    if (!room) {
      callback(null, "방에 참가할 수 없습니다.");
      socket.join("lobby");
      return;
    }
    socket.join(room.id);
    socket.data.roomId = room.id;
    callback(room);
    io.to(room.id).emit("lobby:player-joined", player);
    io.emit("lobby:room-updated", room);
  });

  socket.on("lobby:leave-room", () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    emitPlayerLeftIfPlaying(roomId);
    clearGomokuTimer(roomId);
    clearTetrisTicker(roomId);
    socket.leave(roomId);
    socket.data.roomId = null;
    const room = gameManager.removePlayer(roomId, socket.id!);
    if (room) {
      io.to(roomId).emit("lobby:player-left", socket.id!);
      io.to(roomId).emit("lobby:room-updated", room);
      io.emit("lobby:room-updated", room);
    } else {
      chatStore.deleteRoomHistory(roomId);
      io.emit("lobby:room-removed", roomId);
    }
    socket.join("lobby");
  });

  socket.on("lobby:toggle-ready", () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const room = gameManager.toggleReady(roomId, socket.id!);
    if (room) {
      io.to(roomId).emit("lobby:room-updated", room);
    }
  });

  socket.on("chat:lobby-message", (message) => {
    if (!socket.data.authenticated) return;
    if (socket.data.roomId) return;
    const chatMsg: ChatMessage = {
      id: crypto.randomUUID(),
      playerId: socket.id!,
      nickname: socket.data.nickname,
      message: message.slice(0, 500),
      timestamp: Date.now(),
    };
    chatStore.pushLobbyMessage(chatMsg);
    io.to("lobby").emit("chat:lobby-message", chatMsg);
  });

  socket.on("chat:room-message", (message) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const chatMsg: ChatMessage = {
      id: crypto.randomUUID(),
      playerId: socket.id!,
      nickname: socket.data.nickname,
      message: message.slice(0, 500),
      timestamp: Date.now(),
    };
    chatStore.pushRoomMessage(roomId, chatMsg);
    io.to(roomId).emit("chat:room-message", chatMsg);
  });

  socket.on("chat:request-history", async (target, callback) => {
    if (!socket.data.authenticated) return callback([]);
    if (target === "lobby") {
      callback(await chatStore.getLobbyHistory());
    } else {
      const roomId = socket.data.roomId;
      if (!roomId) return callback([]);
      callback(await chatStore.getRoomHistory(roomId));
    }
  });

  socket.on("chat:delete-message", async (target, messageId, callback) => {
    if (!isAdmin(socket.data.nickname)) {
      return callback({ success: false, error: "권한이 없습니다." });
    }
    if (!chatStore) {
      return callback({ success: false, error: "채팅 저장소를 사용할 수 없습니다." });
    }

    if (target !== "lobby") {
      return callback({ success: false, error: "로비 채팅만 삭제할 수 있습니다." });
    }

    const deleted = await chatStore.deleteLobbyMessage(messageId);
    if (deleted) {
      io.to("lobby").emit("chat:message-deleted", { target: "lobby", messageId });
    }

    callback({ success: deleted, error: deleted ? undefined : "메시지를 찾을 수 없습니다." });
  });
}
