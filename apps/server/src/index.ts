import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from "@game-hub/shared-types";
import { setupLobbyHandler } from "./socket/lobby-handler.js";
import { setupGameHandler } from "./socket/game-handler.js";
import { setupNicknameHandler } from "./socket/nickname-handler.js";
import { broadcastAuthenticatedCount } from "./socket/broadcast-player-count.js";
import { GameManager } from "./games/game-manager.js";
import { parseCorsOrigin } from "./cors.js";

const PORT = parseInt(process.env.PORT || "3001", 10);

const corsOrigin = parseCorsOrigin(process.env.CORS_ORIGIN);

const app = express();
app.use(cors({ origin: corsOrigin }));
app.use(express.json());

const httpServer = createServer(app);
const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(httpServer, {
  cors: {
    origin: corsOrigin,
    methods: ["GET", "POST"],
  },
});

const gameManager = new GameManager();

app.get("/health", (_req, res) => {
  res.json({ status: "ok", rooms: gameManager.getRoomCount() });
});

io.on("connection", (socket) => {
  console.log(`[connect] ${socket.id}`);
  socket.data.playerId = socket.id;
  socket.data.nickname = `Player_${socket.id.slice(0, 4)}`;
  socket.data.roomId = null;
  socket.data.authenticated = false;

  setupNicknameHandler(io, socket);
  setupLobbyHandler(io, socket, gameManager);
  setupGameHandler(io, socket, gameManager);

  socket.on("disconnect", () => {
    console.log(`[disconnect] ${socket.id}`);
    const roomId = socket.data.roomId;
    if (roomId) {
      const room = gameManager.removePlayer(roomId, socket.id);
      if (room) {
        io.to(roomId).emit("lobby:player-left", socket.id);
        io.to(roomId).emit("lobby:room-updated", room);
        io.emit("lobby:room-updated", room);
      } else {
        // Room was deleted (empty)
        io.emit("lobby:room-removed", roomId);
      }
    }
    if (socket.data.authenticated) {
      broadcastAuthenticatedCount(io);
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`🎮 Game Hub server running on http://localhost:${PORT}`);
});
