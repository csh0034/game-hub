import type { Server, Socket } from "socket.io";
import {
  type ChatMessage,
  type ClientToServerEvents,
  type ServerToClientEvents,
  type InterServerEvents,
  type SocketData,
} from "@game-hub/shared-types";
import crypto from "node:crypto";
import type { CatchMindPublicState } from "@game-hub/shared-types";
import type { GameManager } from "../games/game-manager.js";
import type { ChatStore, SessionStore } from "../storage/index.js";
import { isAdmin, getDisplayNickname } from "../admin.js";
import { clearCatchMindTimer } from "../games/catch-mind-timer.js";
import { startCatchMindNextRound } from "./game-handler.js";

type IOServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export function setupChatHandler(io: IOServer, socket: IOSocket, gameManager: GameManager, chatStore: ChatStore, sessionStore: SessionStore) {
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
          const score = rankScores[rank - 1] || 0;
          io.to(roomId).emit("game:catch-mind-correct", {
            playerId: socket.id!,
            nickname: getDisplayNickname(socket.data.nickname),
            rank,
            score,
          });
          const sysMsg: ChatMessage = {
            id: crypto.randomUUID(),
            playerId: "system",
            nickname: "system",
            message: `${getDisplayNickname(socket.data.nickname)}님이 정답을 맞추었습니다! (${rank}등, +${score}점)`,
            timestamp: Date.now(),
          };
          chatStore.pushRoomMessage(roomId, sysMsg);
          io.to(roomId).emit("chat:room-message", sysMsg);

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

  socket.on("chat:whisper", async (payload, callback) => {
    if (!socket.data.authenticated) return callback({ success: false, error: "인증이 필요합니다." });

    const { targetNickname, message } = payload;
    if (!targetNickname || !message) return callback({ success: false, error: "잘못된 요청입니다." });
    if (targetNickname === socket.data.nickname) return callback({ success: false, error: "자신에게는 귓속말을 보낼 수 없습니다." });

    const target = await sessionStore.findSessionByNickname(targetNickname);
    if (!target) return callback({ success: false, error: "접속 중이 아닌 사용자입니다." });

    const admin = isAdmin(socket.data.nickname);
    io.to(target.socketId).emit("chat:whisper-received", {
      fromNickname: admin ? "관리자" : socket.data.nickname,
      message: message.slice(0, 500),
      timestamp: Date.now(),
    });

    callback({ success: true });
  });
}
