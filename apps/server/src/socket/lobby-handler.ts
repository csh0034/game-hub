import type { Server, Socket } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from "@game-hub/shared-types";
import type { GameManager } from "../games/game-manager.js";

type IOServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export function setupLobbyHandler(io: IOServer, socket: IOSocket, gameManager: GameManager) {
  socket.on("lobby:get-rooms", (callback) => {
    callback(gameManager.getRooms());
  });

  socket.on("lobby:create-room", (payload, callback) => {
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
