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

export function setupGameHandler(io: IOServer, socket: IOSocket, gameManager: GameManager) {
  socket.on("game:start", () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const room = gameManager.getRoom(roomId);
    if (!room) return;
    if (room.hostId !== socket.id) {
      socket.emit("game:error", "방장만 게임을 시작할 수 있습니다.");
      return;
    }

    const state = gameManager.startGame(roomId);
    if (!state) {
      socket.emit("game:error", "게임을 시작할 수 없습니다. 최소 인원을 확인하세요.");
      return;
    }

    io.to(roomId).emit("game:started", state);
    io.emit("lobby:room-updated", room);

    // For holdem, send private hole cards
    if (room.gameType === "texas-holdem") {
      const holdemEngine = gameManager.getHoldemEngine(roomId);
      if (holdemEngine) {
        for (const player of room.players) {
          const holeCards = holdemEngine.getHoleCards(player.id);
          const playerSocket = io.sockets.sockets.get(player.id);
          if (playerSocket) {
            playerSocket.emit("game:private-state", { holeCards });
          }
        }
      }
    }
  });

  socket.on("game:move", (move) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const result = gameManager.processMove(roomId, socket.id!, move);
    if (!result) {
      socket.emit("game:error", "잘못된 수입니다.");
      return;
    }

    io.to(roomId).emit("game:state-updated", result.state);

    if (result.result) {
      io.to(roomId).emit("game:ended", result.result);
      const room = gameManager.getRoom(roomId);
      if (room) {
        io.emit("lobby:room-updated", room);
      }
    }
  });

  socket.on("game:rematch", () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    // For simplicity, reset the room immediately
    const room = gameManager.resetRoom(roomId);
    if (room) {
      io.to(roomId).emit("lobby:room-updated", room);
      io.emit("lobby:room-updated", room);
    }
  });
}
