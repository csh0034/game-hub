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
import type { CatchMindPublicState } from "@game-hub/shared-types";
import type { GameManager } from "../games/game-manager.js";
import type { ChatStore } from "../storage/index.js";
import { isAdmin } from "../admin.js";
import { clearGomokuTimer } from "../games/gomoku-timer.js";
import { clearTetrisTicker } from "../games/tetris-ticker.js";
import { clearCatchMindTimer } from "../games/catch-mind-timer.js";
import { startCatchMindNextRound } from "./game-handler.js";

type IOServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export function setupLobbyHandler(io: IOServer, socket: IOSocket, gameManager: GameManager, chatStore: ChatStore) {
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
      const prevRoom = gameManager.removeSpectator(prevRoomId, socket.id!);
      socket.leave(prevRoomId);
      socket.data.roomId = null;
      socket.data.isSpectator = false;
      if (prevRoom) {
        io.to(prevRoomId).emit("lobby:spectator-left", socket.id!);
        io.to(prevRoomId).emit("lobby:room-updated", prevRoom);
        io.emit("lobby:room-updated", prevRoom);
      }
      return;
    }

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

    if (socket.data.isSpectator) {
      const room = gameManager.removeSpectator(roomId, socket.id!);
      socket.leave(roomId);
      socket.data.roomId = null;
      socket.data.isSpectator = false;
      if (room) {
        io.to(roomId).emit("lobby:spectator-left", socket.id!);
        io.to(roomId).emit("lobby:room-updated", room);
        io.emit("lobby:room-updated", room);
      }
      socket.join("lobby");
      return;
    }

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

  socket.on("chat:lobby-message", (message) => {
    if (!socket.data.authenticated) return;
    if (socket.data.roomId) return;
    const admin = isAdmin(socket.data.nickname);
    const chatMsg: ChatMessage = {
      id: crypto.randomUUID(),
      playerId: socket.id!,
      nickname: admin ? "관리자" : socket.data.nickname,
      message: message.slice(0, 500),
      timestamp: Date.now(),
      isAdmin: admin || undefined,
    };
    chatStore.pushLobbyMessage(chatMsg);
    io.to("lobby").emit("chat:lobby-message", chatMsg);
  });

  socket.on("chat:room-message", (message) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const room = gameManager.getRoom(roomId);

    // 관전자 채팅 차단: spectateChatEnabled가 OFF이면 메시지 차단
    if (socket.data.isSpectator) {
      if (room?.gameOptions?.spectateChatEnabled === false) return;

      const admin = isAdmin(socket.data.nickname);
      const chatMsg: ChatMessage = {
        id: crypto.randomUUID(),
        playerId: socket.id!,
        nickname: admin ? "관리자" : socket.data.nickname,
        message: message.slice(0, 500),
        timestamp: Date.now(),
        isAdmin: admin || undefined,
        isSpectator: true,
      };
      chatStore.pushRoomMessage(roomId, chatMsg);
      io.to(roomId).emit("chat:room-message", chatMsg);
      return;
    }

    // Catch-mind: intercept chat messages during drawing phase
    if (room?.gameType === "catch-mind" && room.status === "playing") {
      const cmEngine = gameManager.getCatchMindEngine(roomId);
      const cmState = gameManager.getGameState(roomId) as CatchMindPublicState | null;

      if (cmEngine && cmState && cmState.phase === "drawing") {
        // Block drawer from chatting
        if (socket.id === cmState.drawerId) return;

        // Block players who already guessed correctly
        const player = cmState.players.find((p) => p.id === socket.id);
        if (player?.hasGuessedCorrectly) return;

        // Check if the message is the correct answer
        const result = cmEngine.checkGuess(cmState, socket.id!, message.trim());
        if (result.correct) {
          gameManager.setGameState(roomId, result.newState);
          io.to(roomId).emit("game:state-updated", result.newState);
          const rank = result.newState.guessOrder.length;
          const rankScores = [3, 2, 1];
          io.to(roomId).emit("game:catch-mind-correct", {
            playerId: socket.id!,
            nickname: socket.data.nickname,
            rank,
            score: rankScores[rank - 1] || 0,
          });

          if (result.newState.roundEnded) {
            clearCatchMindTimer(roomId);
            const endedState = cmEngine.endRound(result.newState);
            gameManager.setGameState(roomId, endedState);
            io.to(roomId).emit("game:state-updated", endedState);

            startCatchMindNextRound(io, roomId, gameManager);
          }
          return; // Don't broadcast the correct answer as chat
        }
        // Incorrect guess — fall through to normal chat
      }
    }

    const admin = isAdmin(socket.data.nickname);
    const chatMsg: ChatMessage = {
      id: crypto.randomUUID(),
      playerId: socket.id!,
      nickname: admin ? "관리자" : socket.data.nickname,
      message: message.slice(0, 500),
      timestamp: Date.now(),
      isAdmin: admin || undefined,
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
