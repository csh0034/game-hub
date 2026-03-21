import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import {
  GAME_CONFIGS,
  type ClientToServerEvents,
  type ServerToClientEvents,
  type InterServerEvents,
  type SocketData,
} from "@game-hub/shared-types";
import { setupLobbyHandler } from "./socket/lobby-handler.js";
import { setupGameHandler } from "./socket/game-handler.js";
import { setupNicknameHandler } from "./socket/nickname-handler.js";
import { broadcastAuthenticatedCount } from "./socket/broadcast-player-count.js";
import { GameManager } from "./games/game-manager.js";
import { parseCorsOrigin } from "./cors.js";
import { getRedisClient, closeRedis, createStorage } from "./storage/index.js";
import type { ChatStore, SessionStore } from "./storage/index.js";

const PORT = parseInt(process.env.PORT || "3001", 10);

async function bootstrap() {
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

  // Initialize Redis storage
  let chatStore: ChatStore | undefined;
  let sessionStore: SessionStore | undefined;
  let gameManager: GameManager;

  try {
    const redis = getRedisClient();
    const storage = createStorage(redis);
    chatStore = storage.chatStore;
    sessionStore = storage.sessionStore;
    gameManager = new GameManager(storage.roomStore);
    await gameManager.loadRoomsFromStore();
  } catch (err) {
    console.warn("[bootstrap] Redis unavailable, running in memory-only mode:", err);
    gameManager = new GameManager();
  }

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", rooms: gameManager.getRoomCount() });
  });

  io.on("connection", (socket) => {
    console.log(`[connect] ${socket.id}`);
    socket.data.playerId = socket.id;
    socket.data.nickname = `Player_${socket.id.slice(0, 4)}`;
    socket.data.roomId = null;
    socket.data.authenticated = false;
    socket.data.authenticatedAt = null;

    setupNicknameHandler(io, socket, sessionStore, gameManager);
    setupLobbyHandler(io, socket, gameManager, chatStore);
    setupGameHandler(io, socket, gameManager);

    socket.on("disconnect", async () => {
      console.log(`[disconnect] ${socket.id}`);
      const roomId = socket.data.roomId;
      if (roomId) {
        const roomBefore = gameManager.getRoom(roomId);
        if (roomBefore && roomBefore.status === "playing") {
          const willEnd = roomBefore.players.length - 1 < GAME_CONFIGS[roomBefore.gameType].minPlayers;
          socket.to(roomId).emit("game:player-left", {
            playerId: socket.id,
            nickname: socket.data.nickname,
            willEnd,
          });
        }
        const room = gameManager.removePlayer(roomId, socket.id);
        if (room) {
          io.to(roomId).emit("lobby:player-left", socket.id);
          io.to(roomId).emit("lobby:room-updated", room);
          io.emit("lobby:room-updated", room);
        } else {
          // Room was deleted (empty)
          chatStore?.deleteRoomHistory(roomId);
          io.emit("lobby:room-removed", roomId);
        }
      }
      if (socket.data.authenticated) {
        if (sessionStore) {
          await sessionStore.releaseNickname(socket.data.nickname);
          await sessionStore.deleteSession(socket.id);
        }
        broadcastAuthenticatedCount(io);
      }
    });
  });

  httpServer.listen(PORT, () => {
    console.log(`🎮 Game Hub server running on http://localhost:${PORT}`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log("[shutdown] closing...");
    await closeRedis();
    httpServer.close();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

bootstrap().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
