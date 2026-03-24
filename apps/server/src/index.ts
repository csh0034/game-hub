import express from "express";
import { createServer } from "http";
import { execSync } from "child_process";
import { Server } from "socket.io";
import cors from "cors";
import {
  type ClientToServerEvents,
  type ServerToClientEvents,
  type InterServerEvents,
  type SocketData,
} from "@game-hub/shared-types";
import { setupLobbyHandler } from "./socket/lobby-handler.js";
import { setupGameHandler } from "./socket/game-handler.js";
import { setupNicknameHandler } from "./socket/nickname-handler.js";
import { setupRequestHandler } from "./socket/request-handler.js";
import { setupAnnounceHandler } from "./socket/announce-handler.js";
import { broadcastAuthenticatedCount } from "./socket/broadcast-player-count.js";
import { GameManager } from "./games/game-manager.js";
import { parseCorsOrigin } from "./cors.js";
import { connectRedis, closeRedis, createStorage, createInMemoryStorage, type Storage } from "./storage/index.js";

function getCommitHash(): string {
  if (process.env.COMMIT_HASH) return process.env.COMMIT_HASH;
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf-8" }).trim();
  } catch {
    return "unknown";
  }
}

const PORT = parseInt(process.env.PORT || "3001", 10);
const COMMIT_HASH = getCommitHash();

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

  // Initialize storage
  let storage: Storage;
  let gameManager: GameManager;

  try {
    const redis = await connectRedis();
    storage = createStorage(redis);
    if ("migrateTetrisKeys" in storage.rankingStore) {
      await (storage.rankingStore as { migrateTetrisKeys: () => Promise<void> }).migrateTetrisKeys();
    }
    gameManager = new GameManager(storage.roomStore);
    await gameManager.loadRoomsFromStore();
    console.log("[bootstrap] Redis connected, persistence enabled");
  } catch {
    console.warn("[bootstrap] Redis unavailable, running in memory-only mode");
    await closeRedis();
    storage = createInMemoryStorage();
    gameManager = new GameManager(storage.roomStore);
  }

  const { chatStore, sessionStore, requestStore, rankingStore } = storage;

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

    socket.emit("system:version", { commitHash: COMMIT_HASH });

    setupNicknameHandler(io, socket, sessionStore, gameManager);
    setupLobbyHandler(io, socket, gameManager, chatStore);
    setupGameHandler(io, socket, gameManager, rankingStore);
    setupRequestHandler(io, socket, requestStore);
    setupAnnounceHandler(io, socket);

    socket.on("disconnect", async () => {
      console.log(`[disconnect] ${socket.id}`);
      const roomId = socket.data.roomId;
      if (roomId) {
        const roomBefore = gameManager.getRoom(roomId);
        if (roomBefore && roomBefore.status === "playing") {
          const willEnd = true;
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
          chatStore.deleteRoomHistory(roomId);
          io.emit("lobby:room-removed", roomId);
        }
      }
      if (socket.data.authenticated) {
        await sessionStore.releaseNickname(socket.data.nickname);
        await sessionStore.deleteSession(socket.id);
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
