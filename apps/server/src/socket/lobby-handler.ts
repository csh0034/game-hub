import type { Server, Socket } from "socket.io";
import {
  GAME_CONFIGS,
  type ClientToServerEvents,
  type ServerToClientEvents,
  type InterServerEvents,
  type SocketData,
} from "@game-hub/shared-types";
import type { GameManager } from "../games/game-manager.js";
import { clearGomokuTimer } from "../games/gomoku-timer.js";
import { clearTetrisTicker } from "../games/tetris-ticker.js";

type IOServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export function setupLobbyHandler(io: IOServer, socket: IOSocket, gameManager: GameManager) {
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
    const player = {
      id: socket.id!,
      nickname: socket.data.nickname,
      isReady: false,
    };
    const room = gameManager.joinRoom(payload.roomId, player);
    if (!room) {
      callback(null, "방에 참가할 수 없습니다.");
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
      io.emit("lobby:room-removed", roomId);
    }
  });

  socket.on("lobby:toggle-ready", () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const room = gameManager.toggleReady(roomId, socket.id!);
    if (room) {
      io.to(roomId).emit("lobby:room-updated", room);
    }
  });

  socket.on("chat:message", (message) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    io.to(roomId).emit("chat:message", {
      playerId: socket.id!,
      nickname: socket.data.nickname,
      message: message.slice(0, 500),
      timestamp: Date.now(),
    });
  });
}
