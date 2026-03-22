import type { Server, Socket } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
  GomokuState,
  TetrisMove,
  TetrisPublicState,
  TetrisPlayerBoard,
  HoldemPublicState,
  LiarDrawingPublicState,
  DrawPoint,
} from "@game-hub/shared-types";
import type { GameManager } from "../games/game-manager.js";
import { startGomokuTimer, clearGomokuTimer } from "../games/gomoku-timer.js";
import { startTetrisTicker, updateTetrisTickerInterval, clearTetrisTicker } from "../games/tetris-ticker.js";
import { startLiarDrawingTimer, clearLiarDrawingTimer } from "../games/liar-drawing-timer.js";

const holdemRoundTimers: Map<string, NodeJS.Timeout> = new Map();

// Tetris: per-room dirty buffers for opponent board throttling (200ms)
const tetrisDirtyBuffers: Map<string, Map<string, TetrisPlayerBoard>> = new Map();
const tetrisFlushTimers: Map<string, NodeJS.Timeout> = new Map();

type IOServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

function ensureTetrisFlushTimer(io: IOServer, roomId: string) {
  if (tetrisFlushTimers.has(roomId)) return;
  const timer = setInterval(() => {
    const buffer = tetrisDirtyBuffers.get(roomId);
    if (!buffer || buffer.size === 0) return;
    for (const [playerId, board] of buffer) {
      io.to(roomId).emit("game:tetris-player-updated", { playerId, board });
    }
    buffer.clear();
  }, 500);
  tetrisFlushTimers.set(roomId, timer);
}

function cleanupTetrisFlush(roomId: string) {
  const timer = tetrisFlushTimers.get(roomId);
  if (timer) {
    clearInterval(timer);
    tetrisFlushTimers.delete(roomId);
  }
  tetrisDirtyBuffers.delete(roomId);
}

export function setupGameHandler(io: IOServer, socket: IOSocket, gameManager: GameManager) {
  function startGomokuTurnTimer(roomId: string) {
    startGomokuTimer(roomId, () => {
      const room = gameManager.getRoom(roomId);
      const state = gameManager.getGameState(roomId) as GomokuState | null;
      if (!room || !state || room.status !== "playing") return;

      const loserColor = state.currentTurn === "black" ? "흑" : "백";
      room.status = "finished";
      io.to(roomId).emit("game:ended", {
        winnerId: state.players[state.currentTurn === "black" ? "white" : "black"],
        reason: `${loserColor}의 시간이 초과되었습니다!`,
      });
      io.emit("lobby:room-updated", room);
    });
  }

  function startTetrisServerTick(roomId: string) {
    const tetrisEngine = gameManager.getTetrisEngine(roomId);
    if (!tetrisEngine) return;

    const state = gameManager.getGameState(roomId) as TetrisPublicState | null;
    if (!state) return;

    let currentInterval = state.dropInterval;

    const onTick = () => {
      const room = gameManager.getRoom(roomId);
      if (!room || room.status !== "playing") {
        clearTetrisTicker(roomId);
        cleanupTetrisFlush(roomId);
        return;
      }

      tetrisEngine.clearDirty();
      const newState = tetrisEngine.tickAll();
      gameManager.setGameState(roomId, newState);

      const result = tetrisEngine.checkWin(newState);

      // Send per-player updates for dirty players
      const dirtyIds = tetrisEngine.getDirtyPlayers();
      for (const playerId of dirtyIds) {
        const board = tetrisEngine.toPublicStateForPlayer(playerId);
        if (board) {
          io.to(roomId).emit("game:tetris-player-updated", { playerId, board });
        }
      }
      tetrisEngine.clearDirty();

      if (result) {
        clearTetrisTicker(roomId);
        cleanupTetrisFlush(roomId);
        room.status = "finished";
        io.to(roomId).emit("game:ended", result);
        io.emit("lobby:room-updated", room);
      } else if (newState.dropInterval !== currentInterval) {
        currentInterval = newState.dropInterval;
        updateTetrisTickerInterval(roomId, currentInterval, onTick);
      }
    };

    ensureTetrisFlushTimer(io, roomId);
    startTetrisTicker(roomId, currentInterval, onTick);
  }

  function startLiarDrawingTurnTimer(roomId: string) {
    const currentState = gameManager.getGameState(roomId) as LiarDrawingPublicState | null;
    if (!currentState || currentState.phase !== "drawing") return;

    const durationMs = currentState.drawTimeSeconds * 1000;
    startLiarDrawingTimer(roomId, durationMs, () => {
      const room = gameManager.getRoom(roomId);
      const state = gameManager.getGameState(roomId) as LiarDrawingPublicState | null;
      if (!room || !state || room.status !== "playing" || state.phase !== "drawing") return;

      const liarEngine = gameManager.getLiarDrawingEngine(roomId);
      if (!liarEngine) return;

      const newState = liarEngine.advanceDrawingTurn(state);
      gameManager.setGameState(roomId, newState);
      io.to(roomId).emit("game:state-updated", newState);

      if (newState.phase === "drawing") {
        // More turns to go
        startLiarDrawingTurnTimer(roomId);
      }
    });
  }

  function advanceLiarDrawingRound(roomId: string) {
    const liarEngine = gameManager.getLiarDrawingEngine(roomId);
    if (!liarEngine) return;

    const room = gameManager.getRoom(roomId);
    const state = gameManager.getGameState(roomId) as LiarDrawingPublicState | null;
    if (!room || !state || room.status !== "playing") return;
    if (state.phase !== "round-result") return;

    const result = gameManager.processMove(roomId, room.hostId, { type: "phase-ready" });
    if (!result) return;

    const newState = result.state as LiarDrawingPublicState;
    io.to(roomId).emit("game:state-updated", newState);

    if (newState.phase === "final-result") {
      const gameResult = liarEngine.checkWin(newState);
      if (gameResult) {
        room.status = "finished";
        io.to(roomId).emit("game:ended", gameResult);
        io.emit("lobby:room-updated", room);
      }
      return;
    }

    // New round started - send private states
    if (newState.phase === "role-reveal") {
      for (const player of room.players) {
        const playerSocket = io.sockets.sockets.get(player.id);
        if (playerSocket) {
          const isLiar = player.id === liarEngine.getLiarId();
          playerSocket.emit("game:private-state", {
            role: isLiar ? "liar" : "citizen",
            keyword: isLiar ? null : liarEngine.getKeyword(),
          });
        }
      }
      // Auto-advance to drawing after 5 seconds
      startLiarDrawingTimer(roomId, 5000, () => {
        const currentState = gameManager.getGameState(roomId) as LiarDrawingPublicState | null;
        const currentRoom = gameManager.getRoom(roomId);
        if (!currentState || !currentRoom || currentRoom.status !== "playing") return;
        if (currentState.phase !== "role-reveal") return;

        const drawingState = liarEngine.startDrawingPhase(currentState);
        gameManager.setGameState(roomId, drawingState);
        io.to(roomId).emit("game:state-updated", drawingState);
        startLiarDrawingTurnTimer(roomId);
      });
    }
  }

  function startLiarDrawingNextRound(roomId: string) {
    const state = gameManager.getGameState(roomId) as LiarDrawingPublicState | null;
    if (!state) return;

    // Last round - skip countdown and show final result immediately
    if (state.roundNumber >= state.totalRounds) {
      advanceLiarDrawingRound(roomId);
      return;
    }

    startLiarDrawingTimer(roomId, 10000, () => {
      advanceLiarDrawingRound(roomId);
    });
  }

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
      socket.emit("game:error", "게임을 시작할 수 없습니다. 최소 인원과 준비 상태를 확인하세요.");
      return;
    }

    io.to(roomId).emit("game:started", state);
    io.emit("lobby:room-updated", room);

    if (room.gameType === "gomoku") {
      startGomokuTurnTimer(roomId);
    }

    if (room.gameType === "tetris") {
      startTetrisServerTick(roomId);
    }

    // For liar-drawing, send private states and start role-reveal timer
    if (room.gameType === "liar-drawing") {
      const liarEngine = gameManager.getLiarDrawingEngine(roomId);
      if (liarEngine) {
        for (const player of room.players) {
          const playerSocket = io.sockets.sockets.get(player.id);
          if (playerSocket) {
            const isLiar = player.id === liarEngine.getLiarId();
            playerSocket.emit("game:private-state", {
              role: isLiar ? "liar" : "citizen",
              keyword: isLiar ? null : liarEngine.getKeyword(),
            });
          }
        }
        // Auto-advance from role-reveal to drawing after 5 seconds
        startLiarDrawingTimer(roomId, 5000, () => {
          const currentState = gameManager.getGameState(roomId) as LiarDrawingPublicState | null;
          const currentRoom = gameManager.getRoom(roomId);
          if (!currentState || !currentRoom || currentRoom.status !== "playing") return;
          if (currentState.phase !== "role-reveal") return;

          const drawingState = liarEngine.startDrawingPhase(currentState);
          gameManager.setGameState(roomId, drawingState);
          io.to(roomId).emit("game:state-updated", drawingState);

          // Start drawing turn timer
          startLiarDrawingTurnTimer(roomId);
        });
      }
    }

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

  socket.on("game:draw-points", (points: DrawPoint[]) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const room = gameManager.getRoom(roomId);
    if (!room || room.gameType !== "liar-drawing") return;

    const state = gameManager.getGameState(roomId) as LiarDrawingPublicState | null;
    if (!state || state.phase !== "drawing") return;

    const currentDrawerId = state.drawOrder[state.currentDrawerIndex];
    if (socket.id !== currentDrawerId) return;

    // Update engine state with points
    const liarEngine = gameManager.getLiarDrawingEngine(roomId);
    if (!liarEngine) return;
    const newState = liarEngine.processMove(state, socket.id!, { type: "draw", points });
    gameManager.setGameState(roomId, newState);

    // Broadcast to other players in the room
    socket.to(roomId).emit("game:draw-points", { playerId: socket.id!, points });
  });

  socket.on("game:move", (move) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    // Ignore client-side tick moves for tetris — server handles ticks
    const room = gameManager.getRoom(roomId);
    if (room?.gameType === "tetris" && (move as TetrisMove).type === "tick") {
      return;
    }

    const tetrisEngine = room?.gameType === "tetris" ? gameManager.getTetrisEngine(roomId) : null;
    if (tetrisEngine) {
      tetrisEngine.clearDirty();
    }

    const result = gameManager.processMove(roomId, socket.id!, move);
    if (!result) {
      socket.emit("game:error", "잘못된 수입니다.");
      return;
    }

    // Tetris: send per-player updates instead of full state
    if (room?.gameType === "tetris" && tetrisEngine) {
      const dirtyIds = tetrisEngine.getDirtyPlayers();
      const boardDirtyIds = tetrisEngine.getBoardDirtyPlayers();

      for (const dirtyPlayerId of dirtyIds) {
        const needsFullBoard = boardDirtyIds.has(dirtyPlayerId);

        if (dirtyPlayerId === socket.id) {
          if (needsFullBoard) {
            // Board changed (lock/garbage/line clear) — send full update
            const board = tetrisEngine.toPublicStateForPlayer(dirtyPlayerId);
            if (!board) continue;
            socket.emit("game:tetris-player-updated", { playerId: dirtyPlayerId, board });
            let buffer = tetrisDirtyBuffers.get(roomId);
            if (!buffer) {
              buffer = new Map();
              tetrisDirtyBuffers.set(roomId, buffer);
            }
            buffer.set(dirtyPlayerId, board);
          } else {
            // Only piece moved — send lightweight piece update
            const pieceData = tetrisEngine.toPieceUpdate(dirtyPlayerId);
            if (!pieceData) continue;
            socket.emit("game:tetris-piece-updated", { playerId: dirtyPlayerId, ...pieceData });
            // Buffer full board for opponents (they still need full state for flush)
            const board = tetrisEngine.toPublicStateForPlayer(dirtyPlayerId);
            if (board) {
              let buffer = tetrisDirtyBuffers.get(roomId);
              if (!buffer) {
                buffer = new Map();
                tetrisDirtyBuffers.set(roomId, buffer);
              }
              buffer.set(dirtyPlayerId, board);
            }
          }
        } else {
          // Garbage recipient or tick — always send full update
          const board = tetrisEngine.toPublicStateForPlayer(dirtyPlayerId);
          if (!board) continue;
          const targetSocket = io.sockets.sockets.get(dirtyPlayerId);
          if (targetSocket) {
            targetSocket.emit("game:tetris-player-updated", { playerId: dirtyPlayerId, board });
          }
          let buffer = tetrisDirtyBuffers.get(roomId);
          if (!buffer) {
            buffer = new Map();
            tetrisDirtyBuffers.set(roomId, buffer);
          }
          buffer.set(dirtyPlayerId, board);
        }
      }
      tetrisEngine.clearDirty();
    } else {
      io.to(roomId).emit("game:state-updated", result.state);
    }

    // Notify all clients when canvas is cleared
    if (room?.gameType === "liar-drawing" && (move as { type: string }).type === "clear-canvas") {
      io.to(roomId).emit("game:clear-canvas", { playerId: socket.id! });
    }

    if (result.result) {
      clearGomokuTimer(roomId);
      clearTetrisTicker(roomId);
      cleanupTetrisFlush(roomId);

      if (room?.gameType === "texas-holdem") {
        const holdemEngine = gameManager.getHoldemEngine(roomId);
        const holdemState = result.state as HoldemPublicState;

        if (holdemEngine) {
          const activeCount = holdemEngine.getActivePlayerCount(holdemState);

          if (activeCount <= 1) {
            // Final game end — only 1 player left with chips
            room.status = "finished";
            io.to(roomId).emit("game:ended", result.result);
            io.emit("lobby:room-updated", room);
          } else {
            // Round ended, more rounds to play
            const nextRoundIn = 5000;
            io.to(roomId).emit("game:round-ended", {
              winners: holdemState.winners || [],
              showdownCards: holdemState.showdownCards,
              eliminatedPlayerIds: holdemState.eliminatedPlayerIds,
              nextRoundIn,
            });

            // Schedule next round
            const timer = setTimeout(() => {
              holdemRoundTimers.delete(roomId);
              const currentRoom = gameManager.getRoom(roomId);
              if (!currentRoom || currentRoom.status !== "playing") return;

              const currentState = gameManager.getGameState(roomId) as HoldemPublicState | null;
              if (!currentState) return;

              const { state: newState, holeCardsMap } = holdemEngine.startNewRound(currentState);
              gameManager.setGameState(roomId, newState);

              io.to(roomId).emit("game:started", newState);

              // Send private hole cards to each player
              for (const [playerId, holeCards] of holeCardsMap) {
                const playerSocket = io.sockets.sockets.get(playerId);
                if (playerSocket) {
                  playerSocket.emit("game:private-state", { holeCards });
                }
              }
            }, nextRoundIn);

            holdemRoundTimers.set(roomId, timer);
          }
        }
      } else {
        io.to(roomId).emit("game:ended", result.result);
        const updatedRoom = gameManager.getRoom(roomId);
        if (updatedRoom) {
          io.emit("lobby:room-updated", updatedRoom);
        }
      }
    } else {
      if (room?.gameType === "gomoku") {
        startGomokuTurnTimer(roomId);
      }

      // Handle liar-drawing phase transitions
      if (room?.gameType === "liar-drawing") {
        const liarState = result.state as LiarDrawingPublicState;
        const liarMoveType = (move as { type: string; skip?: boolean }).type;

        if (liarMoveType === "complete-turn") {
          clearLiarDrawingTimer(roomId);
          if ((move as { skip?: boolean }).skip) {
            io.to(roomId).emit("game:clear-canvas", { playerId: socket.id! });
          }
          if (liarState.phase === "drawing") {
            startLiarDrawingTurnTimer(roomId);
          }
        }

        if (liarState.phase === "liar-guess") {
          // Start 30s timer for liar to guess
          startLiarDrawingTimer(roomId, 30000, () => {
            const currentRoom = gameManager.getRoom(roomId);
            const currentState = gameManager.getGameState(roomId) as LiarDrawingPublicState | null;
            if (!currentRoom || !currentState || currentRoom.status !== "playing") return;
            if (currentState.phase !== "liar-guess") return;

            // Time's up — liar didn't guess, treat as wrong guess
            const liarEngine = gameManager.getLiarDrawingEngine(roomId);
            if (!liarEngine) return;
            const newState = liarEngine.processMove(currentState, liarEngine.getLiarId()!, { type: "liar-guess", guess: "" });
            gameManager.setGameState(roomId, newState);
            io.to(roomId).emit("game:state-updated", newState);
            startLiarDrawingNextRound(roomId);
          });
        }

        if (liarState.phase === "round-result") {
          clearLiarDrawingTimer(roomId);
          startLiarDrawingNextRound(roomId);
        }
      }
    }
  });

  socket.on("game:rematch", () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    clearGomokuTimer(roomId);
    clearTetrisTicker(roomId);
    cleanupTetrisFlush(roomId);
    clearLiarDrawingTimer(roomId);
    const holdemTimer = holdemRoundTimers.get(roomId);
    if (holdemTimer) {
      clearTimeout(holdemTimer);
      holdemRoundTimers.delete(roomId);
    }

    // For simplicity, reset the room immediately
    const room = gameManager.resetRoom(roomId);
    if (room) {
      io.to(roomId).emit("lobby:room-updated", room);
      io.emit("lobby:room-updated", room);
    }
  });
}
