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
import { clearGomokuTimer } from "../games/gomoku-timer.js";
import { clearTetrisTicker } from "../games/tetris-ticker.js";
import { clearCatchMindTimer } from "../games/catch-mind-timer.js";

type IOServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export function setupLobbyHandler(io: IOServer, socket: IOSocket, gameManager: GameManager, chatStore: ChatStore) {
  function emitSystemMessage(roomId: string, message: string) {
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      playerId: "system",
      nickname: "system",
      message,
      timestamp: Date.now(),
    };
    chatStore.pushRoomMessage(roomId, msg);
    io.to(roomId).emit("chat:room-message", msg);
  }

  function emitPlayerLeftIfPlaying(roomId: string) {
    const room = gameManager.getRoom(roomId);
    if (room && room.status === "playing") {
      const willEnd = true;
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

    if (socket.data.isSpectator) {
      const nickname = socket.data.nickname;
      const prevRoom = gameManager.removeSpectator(prevRoomId, socket.id!);
      socket.leave(prevRoomId);
      socket.data.roomId = null;
      socket.data.isSpectator = false;
      if (prevRoom) {
        io.to(prevRoomId).emit("lobby:spectator-left", socket.id!);
        io.to(prevRoomId).emit("lobby:room-updated", prevRoom);
        io.emit("lobby:room-updated", prevRoom);
        emitSystemMessage(prevRoomId, `${nickname}님이 관전을 종료했습니다.`);
      }
      return;
    }

    const nickname = socket.data.nickname;
    emitPlayerLeftIfPlaying(prevRoomId);
    clearGomokuTimer(prevRoomId);
    clearTetrisTicker(prevRoomId);
    clearCatchMindTimer(prevRoomId);
    socket.leave(prevRoomId);
    socket.data.roomId = null;
    const prevRoom = gameManager.removePlayer(prevRoomId, socket.id!);
    if (prevRoom) {
      io.to(prevRoomId).emit("lobby:player-left", socket.id!);
      io.to(prevRoomId).emit("lobby:room-updated", prevRoom);
      io.emit("lobby:room-updated", prevRoom);
      emitSystemMessage(prevRoomId, `${nickname}님이 퇴장했습니다.`);
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
    emitSystemMessage(room.id, `${player.nickname}님이 입장했습니다.`);
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
    emitSystemMessage(room.id, `${player.nickname}님이 입장했습니다.`);
  });

  socket.on("lobby:leave-room", () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    if (socket.data.isSpectator) {
      const nickname = socket.data.nickname;
      const room = gameManager.removeSpectator(roomId, socket.id!);
      socket.leave(roomId);
      socket.data.roomId = null;
      socket.data.isSpectator = false;
      if (room) {
        io.to(roomId).emit("lobby:spectator-left", socket.id!);
        io.to(roomId).emit("lobby:room-updated", room);
        io.emit("lobby:room-updated", room);
        emitSystemMessage(roomId, `${nickname}님이 관전을 종료했습니다.`);
      }
      socket.join("lobby");
      return;
    }

    const nickname = socket.data.nickname;
    emitPlayerLeftIfPlaying(roomId);
    clearGomokuTimer(roomId);
    clearTetrisTicker(roomId);
    clearCatchMindTimer(roomId);
    socket.leave(roomId);
    socket.data.roomId = null;
    const room = gameManager.removePlayer(roomId, socket.id!);
    if (room) {
      io.to(roomId).emit("lobby:player-left", socket.id!);
      io.to(roomId).emit("lobby:room-updated", room);
      io.emit("lobby:room-updated", room);
      emitSystemMessage(roomId, `${nickname}님이 퇴장했습니다.`);
    } else {
      chatStore.deleteRoomHistory(roomId);
      io.emit("lobby:room-removed", roomId);
    }
    socket.join("lobby");
  });

  socket.on("lobby:update-game-options", (gameOptions, callback) => {
    const roomId = socket.data.roomId;
    if (!roomId) return callback({ success: false, error: "방에 참가하고 있지 않습니다." });
    const room = gameManager.updateGameOptions(roomId, socket.id!, gameOptions);
    if (!room) return callback({ success: false, error: "게임 옵션을 변경할 수 없습니다." });
    io.to(roomId).emit("lobby:room-updated", room);
    io.emit("lobby:room-updated", room);
    callback({ success: true });
  });

  socket.on("lobby:update-room-name", (name, callback) => {
    const roomId = socket.data.roomId;
    if (!roomId) return callback({ success: false, error: "방에 참가하고 있지 않습니다." });
    const room = gameManager.updateRoomName(roomId, socket.id!, name);
    if (!room) return callback({ success: false, error: "방 이름을 변경할 수 없습니다." });
    io.to(roomId).emit("lobby:room-updated", room);
    io.emit("lobby:room-updated", room);
    callback({ success: true });
  });

  socket.on("lobby:toggle-ready", () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    if (socket.data.isSpectator) return;
    const room = gameManager.toggleReady(roomId, socket.id!);
    if (room) {
      io.to(roomId).emit("lobby:room-updated", room);
    }
  });

  socket.on("lobby:join-spectate", (payload, callback) => {
    cleanupPreviousRoom();
    socket.leave("lobby");
    const player = {
      id: socket.id!,
      nickname: socket.data.nickname,
      isReady: false,
    };
    const room = gameManager.addSpectator(payload.roomId, player);
    if (!room) {
      callback(null, "관전할 수 없습니다.");
      socket.join("lobby");
      return;
    }
    socket.join(room.id);
    socket.data.roomId = room.id;
    socket.data.isSpectator = true;
    callback(room);
    io.to(room.id).emit("lobby:spectator-joined", player);
    io.emit("lobby:room-updated", room);
    emitSystemMessage(room.id, `${player.nickname}님이 관전을 시작했습니다.`);
    // 게임 중 관전 입장 시 현재 게임 상태 + 비공개 상태 전송
    if (room.status === "playing") {
      const gameState = gameManager.getGameState(room.id);
      if (gameState) {
        socket.emit("game:started", gameState);
      }
      if (room.gameType === "liar-drawing") {
        const liarEngine = gameManager.getLiarDrawingEngine(room.id);
        if (liarEngine) {
          socket.emit("game:private-state", {
            role: "spectator" as const,
            keyword: liarEngine.getKeyword(),
            liarId: liarEngine.getLiarId() ?? undefined,
          });
        }
      }
      if (room.gameType === "catch-mind") {
        const cmEngine = gameManager.getCatchMindEngine(room.id);
        if (cmEngine) {
          socket.emit("game:private-state", { keyword: cmEngine.getKeyword()! });
        }
      }
    }
  });

  socket.on("lobby:kick-spectators", (callback) => {
    const roomId = socket.data.roomId;
    if (!roomId) return callback({ success: false, error: "방에 참가하고 있지 않습니다." });
    const room = gameManager.getRoom(roomId);
    if (!room) return callback({ success: false, error: "방을 찾을 수 없습니다." });
    if (room.hostId !== socket.id) return callback({ success: false, error: "방장만 관전자를 내보낼 수 있습니다." });

    const removedIds = gameManager.removeAllSpectators(roomId);
    for (const spectatorId of removedIds) {
      const spectatorSocket = io.sockets.sockets.get(spectatorId);
      if (spectatorSocket) {
        spectatorSocket.emit("lobby:spectator-kicked");
        spectatorSocket.leave(roomId);
        spectatorSocket.data.roomId = null;
        spectatorSocket.data.isSpectator = false;
        spectatorSocket.join("lobby");
      }
    }
    const updatedRoom = gameManager.getRoom(roomId);
    if (updatedRoom) {
      io.to(roomId).emit("lobby:room-updated", updatedRoom);
      io.emit("lobby:room-updated", updatedRoom);
    }
    callback({ success: true });
  });

  socket.on("lobby:switch-role", (callback) => {
    const roomId = socket.data.roomId;
    if (!roomId) return callback({ success: false, error: "방에 참가하고 있지 않습니다." });

    if (socket.data.isSpectator) {
      const room = gameManager.switchToPlayer(roomId, socket.id!);
      if (!room) return callback({ success: false, error: "플레이어로 전환할 수 없습니다." });
      socket.data.isSpectator = false;
      io.to(roomId).emit("lobby:room-updated", room);
      io.emit("lobby:room-updated", room);
      emitSystemMessage(roomId, `${socket.data.nickname}님이 플레이어로 전환했습니다.`);
      callback({ success: true, role: "player" });
    } else {
      const room = gameManager.switchToSpectator(roomId, socket.id!);
      if (!room) return callback({ success: false, error: "관전자로 전환할 수 없습니다." });
      socket.data.isSpectator = true;
      io.to(roomId).emit("lobby:room-updated", room);
      io.emit("lobby:room-updated", room);
      emitSystemMessage(roomId, `${socket.data.nickname}님이 관전자로 전환했습니다.`);
      callback({ success: true, role: "spectator" });
    }
  });

  socket.on("lobby:kick", (targetId, callback) => {
    const roomId = socket.data.roomId;
    if (!roomId) return callback({ success: false, error: "방에 참가하고 있지 않습니다." });
    const room = gameManager.getRoom(roomId);
    if (!room) return callback({ success: false, error: "방을 찾을 수 없습니다." });
    if (room.status !== "waiting") return callback({ success: false, error: "대기 중일 때만 내보낼 수 있습니다." });
    if (room.hostId !== socket.id) return callback({ success: false, error: "방장만 내보낼 수 있습니다." });
    if (targetId === socket.id) return callback({ success: false, error: "자기 자신은 내보낼 수 없습니다." });

    const isTargetSpectator = room.spectators.some((s) => s.id === targetId);
    const isTargetPlayer = room.players.some((p) => p.id === targetId);

    if (!isTargetPlayer && !isTargetSpectator) {
      return callback({ success: false, error: "대상을 찾을 수 없습니다." });
    }

    const targetSocket = io.sockets.sockets.get(targetId);

    if (isTargetSpectator) {
      gameManager.removeSpectator(roomId, targetId);
      if (targetSocket) {
        targetSocket.emit("lobby:kicked");
        targetSocket.leave(roomId);
        targetSocket.data.roomId = null;
        targetSocket.data.isSpectator = false;
        targetSocket.join("lobby");
      }
      io.to(roomId).emit("lobby:spectator-left", targetId);
    } else {
      gameManager.removePlayer(roomId, targetId);
      if (targetSocket) {
        targetSocket.emit("lobby:kicked");
        targetSocket.leave(roomId);
        targetSocket.data.roomId = null;
        targetSocket.join("lobby");
      }
      io.to(roomId).emit("lobby:player-left", targetId);
    }

    const updatedRoom = gameManager.getRoom(roomId);
    if (updatedRoom) {
      io.to(roomId).emit("lobby:room-updated", updatedRoom);
      io.emit("lobby:room-updated", updatedRoom);
    }
    callback({ success: true });
  });

}
