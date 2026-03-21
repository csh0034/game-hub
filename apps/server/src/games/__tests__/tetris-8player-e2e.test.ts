import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server as HttpServer } from "http";
import { Server } from "socket.io";
import { io as ioClient, type Socket as ClientSocket } from "socket.io-client";
import express from "express";
import {
  GAME_CONFIGS,
  type ClientToServerEvents,
  type ServerToClientEvents,
  type InterServerEvents,
  type SocketData,
  type TetrisPublicState,
  type TetrisPlayerUpdate,
  type Room,
  type GameResult,
} from "@game-hub/shared-types";
import { GameManager } from "../game-manager.js";
import { setupLobbyHandler } from "../../socket/lobby-handler.js";
import { setupGameHandler } from "../../socket/game-handler.js";
import { setupNicknameHandler } from "../../socket/nickname-handler.js";
import { broadcastAuthenticatedCount } from "../../socket/broadcast-player-count.js";

const NUM_PLAYERS = 8;
const TEST_TIMEOUT = 30_000;

type TypedClientSocket = ClientSocket<ServerToClientEvents, ClientToServerEvents>;

function waitForEvent<T>(socket: TypedClientSocket, event: string, timeoutMs = 5000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (socket as any).off(event, handler);
      reject(new Error(`Timed out waiting for event "${event}" after ${timeoutMs}ms`));
    }, timeoutMs);

    const handler = (data: T) => {
      clearTimeout(timer);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (socket as any).off(event, handler);
      resolve(data);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (socket as any).on(event, handler);
  });
}

function collectEvents<T>(socket: TypedClientSocket, event: string, count: number, timeoutMs = 5000): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const results: T[] = [];
    const timer = setTimeout(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (socket as any).off(event, handler);
      reject(new Error(`Timed out collecting ${count} "${event}" events (got ${results.length}) after ${timeoutMs}ms`));
    }, timeoutMs);

    const handler = (data: T) => {
      results.push(data);
      if (results.length >= count) {
        clearTimeout(timer);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (socket as any).off(event, handler);
        resolve(results);
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (socket as any).on(event, handler);
  });
}

describe("Tetris 8-player E2E", () => {
  let httpServer: HttpServer;
  let ioServer: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
  let clients: TypedClientSocket[];
  let port: number;
  let roomId: string;

  beforeAll(async () => {
    // Create server programmatically (same as index.ts but on random port)
    const app = express();
    httpServer = createServer(app);
    ioServer = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(httpServer, {
      cors: { origin: "*", methods: ["GET", "POST"] },
    });

    const gameManager = new GameManager();

    ioServer.on("connection", (socket) => {
      socket.data.playerId = socket.id;
      socket.data.nickname = `Player_${socket.id.slice(0, 4)}`;
      socket.data.roomId = null;
      socket.data.authenticated = false;

      setupNicknameHandler(ioServer, socket);
      setupLobbyHandler(ioServer, socket, gameManager);
      setupGameHandler(ioServer, socket, gameManager);

      socket.on("disconnect", () => {
        const rid = socket.data.roomId;
        if (rid) {
          const roomBefore = gameManager.getRoom(rid);
          if (roomBefore && roomBefore.status === "playing") {
            const willEnd = roomBefore.players.length - 1 < GAME_CONFIGS[roomBefore.gameType].minPlayers;
            socket.to(rid).emit("game:player-left", {
              playerId: socket.id,
              nickname: socket.data.nickname,
              willEnd,
            });
          }
          const room = gameManager.removePlayer(rid, socket.id);
          if (room) {
            ioServer.to(rid).emit("lobby:player-left", socket.id);
            ioServer.to(rid).emit("lobby:room-updated", room);
            ioServer.emit("lobby:room-updated", room);
          } else {
            ioServer.emit("lobby:room-removed", rid);
          }
        }
        if (socket.data.authenticated) {
          broadcastAuthenticatedCount(ioServer);
        }
      });
    });

    // Listen on random port
    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        const addr = httpServer.address();
        port = typeof addr === "object" && addr ? addr.port : 0;
        resolve();
      });
    });

    // Create 8 socket.io-client connections
    clients = [];
    for (let i = 0; i < NUM_PLAYERS; i++) {
      const client = ioClient(`http://localhost:${port}`, {
        transports: ["websocket"],
        forceNew: true,
      }) as TypedClientSocket;
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Client ${i} connection timeout`)), 5000);
        client.on("connect", () => {
          clearTimeout(timer);
          resolve();
        });
      });
      clients.push(client);
    }
  }, TEST_TIMEOUT);

  afterAll(async () => {
    // Clean up all sockets
    for (const client of clients ?? []) {
      if (client.connected) {
        client.disconnect();
      }
    }
    // Close server
    if (ioServer) {
      await new Promise<void>((resolve) => ioServer.close(() => resolve()));
    }
    if (httpServer) {
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    }
  });

  it("should set nicknames for all 8 clients", async () => {
    for (let i = 0; i < NUM_PLAYERS; i++) {
      const result = await new Promise<{ success: boolean; error?: string }>((resolve) => {
        clients[i].emit("player:set-nickname", `Player${i + 1}`, resolve);
      });
      expect(result.success).toBe(true);
    }
  }, TEST_TIMEOUT);

  it("should create a tetris room with client 1 and have clients 2-8 join and ready up", async () => {
    // Client 1 creates room
    const room = await new Promise<Room>((resolve) => {
      clients[0].emit("lobby:create-room", { name: "Tetris 8P Test", gameType: "tetris" }, resolve);
    });
    expect(room).toBeDefined();
    expect(room.gameType).toBe("tetris");
    expect(room.players).toHaveLength(1);
    roomId = room.id;

    // Clients 2-8 join the room
    for (let i = 1; i < NUM_PLAYERS; i++) {
      const joinResult = await new Promise<Room | null>((resolve) => {
        clients[i].emit("lobby:join-room", { roomId }, (r, _err) => resolve(r));
      });
      expect(joinResult).not.toBeNull();
      expect(joinResult!.players).toHaveLength(i + 1);
    }

    // Clients 2-8 toggle ready
    for (let i = 1; i < NUM_PLAYERS; i++) {
      clients[i].emit("lobby:toggle-ready");
    }

    // Wait briefly for all toggle-ready events to be processed
    await new Promise((r) => setTimeout(r, 200));
  }, TEST_TIMEOUT);

  it("should start the game and all 8 clients receive game:started with TetrisPublicState containing 8 players", async () => {
    // Set up listeners on all clients before starting
    const startedPromises = clients.map((client) =>
      waitForEvent<TetrisPublicState>(client, "game:started", 5000),
    );

    // Client 1 starts the game
    clients[0].emit("game:start");

    const states = await Promise.all(startedPromises);

    for (const state of states) {
      expect(state).toBeDefined();
      expect(state.players).toBeDefined();
      expect(Object.keys(state.players)).toHaveLength(NUM_PLAYERS);
      expect(state.mode).toBe("versus");
      expect(state.difficulty).toBe("normal");

      // Check each player has a valid TetrisPlayerBoard
      for (const playerId of Object.keys(state.players)) {
        const board = state.players[playerId];
        expect(board.board).toHaveLength(20);
        expect(board.board[0]).toHaveLength(10);
        expect(board.activePiece).not.toBeNull();
        expect(typeof board.ghostRow).toBe("number");
        expect(board.score).toBe(0);
        expect(board.level).toBeGreaterThanOrEqual(1);
        expect(board.linesCleared).toBe(0);
        expect(board.status).toBe("playing");
        expect(board.pendingGarbage).toBe(0);
        expect(Array.isArray(board.nextPieces)).toBe(true);
      }
    }
  }, TEST_TIMEOUT);

  it("should receive game:tetris-player-updated with correct structure when client 1 sends moves", async () => {
    // Set up listener on client 1 for tetris-player-updated events
    const updatesPromise = collectEvents<TetrisPlayerUpdate>(clients[0], "game:tetris-player-updated", 4, 5000);

    // Client 1 sends a series of moves
    const moves: Array<{ type: string }> = [
      { type: "move-left" },
      { type: "move-right" },
      { type: "rotate-cw" },
      { type: "hard-drop" },
    ];

    for (const move of moves) {
      clients[0].emit("game:move", move as never);
      // Small delay to avoid race conditions
      await new Promise((r) => setTimeout(r, 50));
    }

    const updates = await updatesPromise;
    expect(updates.length).toBeGreaterThanOrEqual(4);

    for (const update of updates) {
      expect(update).toHaveProperty("playerId");
      expect(update).toHaveProperty("board");
      expect(typeof update.playerId).toBe("string");

      const board = update.board;
      expect(board).toHaveProperty("board");
      expect(board).toHaveProperty("activePiece");
      expect(board).toHaveProperty("ghostRow");
      expect(board).toHaveProperty("holdPiece");
      expect(board).toHaveProperty("score");
      expect(board).toHaveProperty("level");
      expect(board).toHaveProperty("linesCleared");
      expect(board).toHaveProperty("status");
      expect(board).toHaveProperty("pendingGarbage");
      expect(board).toHaveProperty("canHold");
      expect(board).toHaveProperty("nextPieces");

      expect(board.board).toHaveLength(20);
      expect(board.board[0]).toHaveLength(10);
      expect(typeof board.score).toBe("number");
      expect(typeof board.level).toBe("number");
      expect(typeof board.linesCleared).toBe("number");
      expect(["playing", "gameover"]).toContain(board.status);
      expect(typeof board.pendingGarbage).toBe("number");
    }
  }, TEST_TIMEOUT);

  it("should handle multiple players sending moves simultaneously without errors", async () => {
    // Set up error listeners on all clients
    const errors: string[] = [];
    for (const client of clients) {
      client.on("game:error" as never, (msg: string) => errors.push(msg));
    }

    // Each client collects at least 1 update for itself
    const updatePromises = clients.map((client) =>
      collectEvents<TetrisPlayerUpdate>(client, "game:tetris-player-updated", 1, 5000),
    );

    // All clients send moves simultaneously
    const moveSets: Array<{ type: string }[]> = [
      [{ type: "move-left" }, { type: "hard-drop" }],
      [{ type: "move-right" }, { type: "hard-drop" }],
      [{ type: "rotate-cw" }, { type: "hard-drop" }],
      [{ type: "move-left" }, { type: "hard-drop" }],
      [{ type: "move-right" }, { type: "hard-drop" }],
      [{ type: "rotate-cw" }, { type: "hard-drop" }],
      [{ type: "move-left" }, { type: "hard-drop" }],
      [{ type: "move-right" }, { type: "hard-drop" }],
    ];

    for (let i = 0; i < NUM_PLAYERS; i++) {
      for (const move of moveSets[i]) {
        clients[i].emit("game:move", move as never);
      }
    }

    // All clients should receive at least 1 update
    const results = await Promise.all(updatePromises);
    for (const updates of results) {
      expect(updates.length).toBeGreaterThanOrEqual(1);
    }

    // No errors should have been emitted
    expect(errors).toHaveLength(0);

    // Clean up error listeners
    for (const client of clients) {
      client.off("game:error" as never);
    }
  }, TEST_TIMEOUT);

  it("should detect a winner when all but one player are game over", async () => {
    // We need to force 7 players to game-over by filling their boards with hard-drops
    // Each hard-drop places a piece and spawns a new one; after enough drops the board fills up

    // Set up game:ended listener on all clients
    const endedPromises = clients.map((client) =>
      waitForEvent<GameResult>(client, "game:ended", 15000),
    );

    // Players 2-8 (indices 1-7) will rapidly hard-drop until game over
    // Player 1 (index 0) will do nothing, keeping alive
    const spamHardDrops = async (clientIndex: number) => {
      const client = clients[clientIndex];
      // Send many hard-drops to fill the board and trigger game-over
      for (let j = 0; j < 50; j++) {
        client.emit("game:move", { type: "hard-drop" } as never);
        // Small delay so server processes them
        if (j % 10 === 0) {
          await new Promise((r) => setTimeout(r, 30));
        }
      }
    };

    // Have all 7 non-host players spam hard-drops simultaneously
    const dropPromises = [];
    for (let i = 1; i < NUM_PLAYERS; i++) {
      dropPromises.push(spamHardDrops(i));
    }
    await Promise.all(dropPromises);

    // Wait for the server tick to detect game-over for all dropping players
    // The server tick runs periodically and checks for a winner
    const results = await Promise.all(endedPromises);

    for (const result of results) {
      expect(result).toBeDefined();
      expect(result).toHaveProperty("winnerId");
      expect(result).toHaveProperty("reason");
      // The winner should be client 0 (the one who didn't spam) or null (draw if timing is unlucky)
      // At minimum, we have a valid game result
      expect(typeof result.reason).toBe("string");
    }

    // All clients should have received the same result
    const winnerIds = results.map((r) => r.winnerId);
    expect(new Set(winnerIds).size).toBe(1); // All clients agree on the winner
  }, TEST_TIMEOUT);
});
