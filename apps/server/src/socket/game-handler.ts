import { randomUUID } from "crypto";
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
  LiarDrawingPublicState,
  CatchMindPublicState,
  BilliardsPublicState,
  DrawPoint,
  GameResult,
  RankingKey,
  RankingEntry,
} from "@game-hub/shared-types";
import type { Room } from "@game-hub/shared-types";
import type { GameManager } from "../games/game-manager.js";
import type { RankingStore } from "../storage/index.js";
import { startGomokuTimer, clearGomokuTimer } from "../games/gomoku-timer.js";
import { startTetrisTicker, updateTetrisTickerInterval, clearTetrisTicker } from "../games/tetris-ticker.js";
import { startLiarDrawingTimer, clearLiarDrawingTimer } from "../games/liar-drawing-timer.js";
import { startCatchMindTimer, clearCatchMindTimer } from "../games/catch-mind-timer.js";
import { startTypingTicker, updateTypingTickerInterval, clearTypingTicker } from "../games/typing-ticker.js";
import { startBilliardsTicker, clearBilliardsTicker, startBilliardsTurnTimer, clearBilliardsTurnTimer, clearAllBilliardsTimers } from "../games/billiards-ticker.js";
import { isAdmin, getDisplayNickname } from "../admin.js";

const typingCountdownTimers: Map<string, NodeJS.Timeout> = new Map();

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
    const roomSockets = io.sockets.adapter.rooms.get(roomId);
    if (!roomSockets) { buffer.clear(); return; }

    for (const [playerId, board] of buffer) {
      // Send to opponents only (exclude the player whose board this is)
      for (const socketId of roomSockets) {
        if (socketId !== playerId) {
          io.sockets.sockets.get(socketId)?.emit(
            "game:tetris-player-updated", { playerId, board },
          );
        }
      }
    }
    buffer.clear();
  }, 500);
  tetrisFlushTimers.set(roomId, timer);
}

function cleanupTetrisFlush(roomId: string, io?: IOServer) {
  const timer = tetrisFlushTimers.get(roomId);
  if (timer) {
    clearInterval(timer);
    tetrisFlushTimers.delete(roomId);
  }
  // Flush remaining dirty buffers so clients see final state
  if (io) {
    const buffer = tetrisDirtyBuffers.get(roomId);
    if (buffer && buffer.size > 0) {
      const roomSockets = io.sockets.adapter.rooms.get(roomId);
      if (roomSockets) {
        for (const [playerId, board] of buffer) {
          for (const socketId of roomSockets) {
            if (socketId !== playerId) {
              io.sockets.sockets.get(socketId)?.emit(
                "game:tetris-player-updated", { playerId, board },
              );
            }
          }
        }
      }
    }
  }
  tetrisDirtyBuffers.delete(roomId);
}

export function startCatchMindNextRound(io: IOServer, roomId: string, gameManager: GameManager) {
  const state = gameManager.getGameState(roomId) as CatchMindPublicState | null;
  if (!state) return;

  startCatchMindTimer(roomId, 10000, () => {
    advanceCatchMindRound(io, roomId, gameManager);
  });
}

function advanceCatchMindRound(io: IOServer, roomId: string, gameManager: GameManager) {
  const cmEngine = gameManager.getCatchMindEngine(roomId);
  if (!cmEngine) return;

  const room = gameManager.getRoom(roomId);
  const state = gameManager.getGameState(roomId) as CatchMindPublicState | null;
  if (!room || !state || room.status !== "playing") return;
  if (state.phase !== "round-result") return;

  const result = gameManager.processMove(roomId, room.hostId, { type: "phase-ready" });
  if (!result) return;

  const newState = result.state as CatchMindPublicState;
  io.to(roomId).emit("game:state-updated", newState);

  if (newState.phase === "final-result") {
    const gameResult = cmEngine.checkWin(newState);
    if (gameResult) {
      room.status = "finished";
      io.to(roomId).emit("game:ended", gameResult);
      io.emit("lobby:room-updated", room);
    }
    return;
  }

  // New round started - send keyword to drawer
  if (newState.phase === "role-reveal") {
    const drawerSocket = io.sockets.sockets.get(newState.drawerId);
    if (drawerSocket) {
      drawerSocket.emit("game:private-state", { keyword: cmEngine.getKeyword()! });
    }
    sendPrivateStateToSpectators(io, room, gameManager);
    // Auto-advance to drawing after 3 seconds
    startCatchMindTimer(roomId, 3000, () => {
      const currentState = gameManager.getGameState(roomId) as CatchMindPublicState | null;
      const currentRoom = gameManager.getRoom(roomId);
      if (!currentState || !currentRoom || currentRoom.status !== "playing") return;
      if (currentState.phase !== "role-reveal") return;

      const drawingState = cmEngine.startDrawingPhase(currentState);
      gameManager.setGameState(roomId, drawingState);
      io.to(roomId).emit("game:state-updated", drawingState);
      startCatchMindDrawTimer(io, roomId, gameManager);
    });
  }
}

function startCatchMindDrawTimer(io: IOServer, roomId: string, gameManager: GameManager) {
  const state = gameManager.getGameState(roomId) as CatchMindPublicState | null;
  if (!state || state.phase !== "drawing") return;

  const durationMs = state.drawTimeSeconds * 1000;
  startCatchMindTimer(roomId, durationMs, () => {
    const room = gameManager.getRoom(roomId);
    const currentState = gameManager.getGameState(roomId) as CatchMindPublicState | null;
    if (!room || !currentState || room.status !== "playing" || currentState.phase !== "drawing") return;

    const cmEngine = gameManager.getCatchMindEngine(roomId);
    if (!cmEngine) return;

    const endedState = cmEngine.endRound(currentState);
    gameManager.setGameState(roomId, endedState);
    io.to(roomId).emit("game:state-updated", endedState);

    startCatchMindNextRound(io, roomId, gameManager);
  });
}

async function submitRanking(
  io: IOServer,
  rankingStore: RankingStore,
  gameType: "minesweeper" | "tetris",
  difficulty: string,
  nickname: string,
  score: number,
  result: GameResult,
): Promise<void> {
  const sortAsc = gameType === "minesweeper" || gameType === "tetris"; // lower time = better
  const key = `${gameType}:${difficulty}` as RankingKey;
  const entry: RankingEntry = {
    id: randomUUID(),
    nickname,
    score,
    date: Date.now(),
  };

  const { rank, entries } = await rankingStore.addEntry(key, entry, sortAsc);
  result.rankingResult = {
    rank,
    isNewRecord: rank === 1,
  };
  io.emit("ranking:updated", { key, rankings: entries });
}

function sendPrivateStateToSpectators(io: IOServer, room: Room, gameManager: GameManager) {
  if (room.spectators.length === 0) return;

  if (room.gameType === "liar-drawing") {
    const liarEngine = gameManager.getLiarDrawingEngine(room.id);
    if (liarEngine) {
      for (const spectator of room.spectators) {
        const spectatorSocket = io.sockets.sockets.get(spectator.id);
        if (spectatorSocket) {
          spectatorSocket.emit("game:private-state", {
            role: "spectator",
            keyword: liarEngine.getKeyword(),
            liarId: liarEngine.getLiarId() ?? undefined,
          });
        }
      }
    }
  }

  if (room.gameType === "catch-mind") {
    const cmEngine = gameManager.getCatchMindEngine(room.id);
    if (cmEngine) {
      for (const spectator of room.spectators) {
        const spectatorSocket = io.sockets.sockets.get(spectator.id);
        if (spectatorSocket) {
          spectatorSocket.emit("game:private-state", { keyword: cmEngine.getKeyword()! });
        }
      }
    }
  }

}

export function setupGameHandler(io: IOServer, socket: IOSocket, gameManager: GameManager, rankingStore: RankingStore) {
  function startGomokuTurnTimer(roomId: string) {
    const state = gameManager.getGameState(roomId) as GomokuState | null;
    if (!state) return;
    const timeoutMs = state.turnTimeSeconds * 1000;

    startGomokuTimer(roomId, timeoutMs, () => {
      const room = gameManager.getRoom(roomId);
      const currentState = gameManager.getGameState(roomId) as GomokuState | null;
      if (!room || !currentState || room.status !== "playing") return;

      const newState: GomokuState = {
        ...currentState,
        currentTurn: currentState.currentTurn === "black" ? "white" : "black",
        turnStartedAt: Date.now(),
      };
      gameManager.setGameState(roomId, newState);
      io.to(roomId).emit("game:state-updated", newState);
      startGomokuTurnTimer(roomId);
    });
  }

  function startTetrisServerTick(roomId: string) {
    const tetrisEngine = gameManager.getTetrisEngine(roomId);
    if (!tetrisEngine) return;

    const state = gameManager.getGameState(roomId) as TetrisPublicState | null;
    if (!state) return;

    let currentInterval = state.dropInterval;

    const onTick = async () => {
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
        if (!board) continue;

        // Send directly to the player themselves (immediate feedback)
        const playerSocket = io.sockets.sockets.get(playerId);
        if (playerSocket) {
          playerSocket.emit("game:tetris-player-updated", { playerId, board });
        }

        // Buffer for opponents (flushed by flush timer)
        let buffer = tetrisDirtyBuffers.get(roomId);
        if (!buffer) {
          buffer = new Map();
          tetrisDirtyBuffers.set(roomId, buffer);
        }
        buffer.set(playerId, board);
      }
      tetrisEngine.clearDirty();

      if (result) {
        clearTetrisTicker(roomId);
        cleanupTetrisFlush(roomId, io);
        room.status = "finished";

        // Submit tetris speed-race solo ranking (time-based)
        if (tetrisEngine.isSolo() && tetrisEngine.isSpeedRace() && result.winnerId) {
          const completionTime = tetrisEngine.getValidatedCompletionTime();
          if (completionTime != null) {
            const playerId = room.players[0]?.id;
            if (playerId) {
              const playerSocket = io.sockets.sockets.get(playerId);
              const nickname = getDisplayNickname(playerSocket?.data?.nickname ?? "Unknown");
              await submitRanking(io, rankingStore, "tetris", tetrisEngine.getDifficulty(), nickname, completionTime, result);
            }
          }
        }

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

  function startTypingServerTick(roomId: string) {
    const typingEngine = gameManager.getTypingEngine(roomId);
    if (!typingEngine) return;

    // 3초 카운트다운 후 게임 시작 — startedAt을 카운트다운 종료 시점으로 재설정
    const countdownTimer = setTimeout(() => {
      typingCountdownTimers.delete(roomId);
      const room = gameManager.getRoom(roomId);
      if (!room || room.status !== "playing") return;

      typingEngine.resetStartedAt();
      const state = typingEngine.toPublicState();
      gameManager.setGameState(roomId, state);
      io.to(roomId).emit("game:state-updated", state);

      let currentInterval = typingEngine.getSpawnIntervalMs();

      const onTick = () => {
        const room = gameManager.getRoom(roomId);
        if (!room || room.status !== "playing") {
          clearTypingTicker(roomId);
          return;
        }

        const tickResult = typingEngine.tick();

        // 틱 결과를 단일 이벤트로 배치 전송
        if (tickResult.spawnedWords.length > 0 || tickResult.missedWordIds.size > 0) {
          io.to(roomId).emit("game:typing-tick-result", {
            spawnedWords: tickResult.spawnedWords,
            missed: Object.fromEntries(tickResult.missedWordIds),
            updatedPlayers: Object.fromEntries(tickResult.updatedPlayers),
          });
        }

        if (tickResult.gameOver) {
          clearTypingTicker(roomId);
          const state = typingEngine.toPublicState();
          gameManager.setGameState(roomId, state);
          const result = typingEngine.checkWin(state);
          if (result) {
            room.status = "finished";
            io.to(roomId).emit("game:ended", result);
            io.emit("lobby:room-updated", room);
          }
          return;
        }

        // 가속에 따라 틱 간격 업데이트
        const newInterval = typingEngine.getSpawnIntervalMs();
        if (Math.abs(newInterval - currentInterval) > 50) {
          currentInterval = newInterval;
          updateTypingTickerInterval(roomId, currentInterval, onTick);
        }
      };

      startTypingTicker(roomId, currentInterval, onTick);
    }, 3000);

    typingCountdownTimers.set(roomId, countdownTimer);
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
      sendPrivateStateToSpectators(io, room, gameManager);
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

    startLiarDrawingTimer(roomId, 10000, () => {
      advanceLiarDrawingRound(roomId);
    });
  }

  function startBilliardsGame(roomId: string) {
    const billiardsEngine = gameManager.getBilliardsEngine(roomId);
    const state = gameManager.getGameState(roomId) as BilliardsPublicState | null;
    if (!billiardsEngine || !state) return;

    startBilliardsTurnTimer(roomId, state.turnTimeSeconds * 1000, () => {
      handleBilliardsTurnTimeout(roomId);
    });
  }

  function handleBilliardsTurnTimeout(roomId: string) {
    const billiardsEngine = gameManager.getBilliardsEngine(roomId);
    const state = gameManager.getGameState(roomId) as BilliardsPublicState | null;
    const room = gameManager.getRoom(roomId);
    if (!billiardsEngine || !state || !room || room.status !== "playing") return;
    if (state.phase !== "aiming") return;

    // Timeout: advance turn without scoring
    const nextState = billiardsEngine.advanceTurn({
      ...state,
      lastShotResult: { scored: false, cushionCount: 0, objectBallsHit: [] },
    });
    gameManager.setGameState(roomId, nextState);
    io.to(roomId).emit("game:billiards-turn-changed", {
      currentTurnIndex: nextState.currentTurnIndex,
      turnStartedAt: nextState.turnStartedAt!,
    });
    io.to(roomId).emit("game:state-updated", nextState);

    startBilliardsTurnTimer(roomId, nextState.turnTimeSeconds * 1000, () => {
      handleBilliardsTurnTimeout(roomId);
    });
  }

  function startBilliardsSimulation(roomId: string) {
    const billiardsEngine = gameManager.getBilliardsEngine(roomId);
    if (!billiardsEngine) return;

    startBilliardsTicker(roomId, () => {
      const state = gameManager.getGameState(roomId) as BilliardsPublicState | null;
      const room = gameManager.getRoom(roomId);
      if (!billiardsEngine || !state || !room || room.status !== "playing") {
        clearBilliardsTicker(roomId);
        return;
      }

      const { frame, settled, updatedState } = billiardsEngine.simulationTick(state);
      gameManager.setGameState(roomId, updatedState);

      io.to(roomId).emit("game:billiards-frame", {
        balls: frame.balls.map((b) => ({ id: b.id, x: b.x, z: b.z, vx: b.vx, vz: b.vz, spinX: b.spinX, spinY: b.spinY, spinZ: b.spinZ })),
        shotEvents: frame.events,
        cushionCount: updatedState.cushionCount,
        objectBallsHit: updatedState.objectBallsHit,
      });

      if (settled) {
        clearBilliardsTicker(roomId);

        io.to(roomId).emit("game:billiards-shot-result", {
          scored: updatedState.lastShotResult?.scored ?? false,
          cushionCount: updatedState.lastShotResult?.cushionCount ?? 0,
          objectBallsHit: updatedState.lastShotResult?.objectBallsHit ?? [],
        });

        // Advance turn after a short delay
        setTimeout(() => {
          const currentState = gameManager.getGameState(roomId) as BilliardsPublicState | null;
          const currentRoom = gameManager.getRoom(roomId);
          if (!currentState || !currentRoom || currentRoom.status !== "playing") return;

          const nextState = billiardsEngine.advanceTurn(currentState);
          gameManager.setGameState(roomId, nextState);

          const winResult = billiardsEngine.checkWin(nextState);
          if (winResult) {
            clearAllBilliardsTimers(roomId);
            currentRoom.status = "finished";
            io.to(roomId).emit("game:state-updated", nextState);
            io.to(roomId).emit("game:ended", winResult);
            io.emit("lobby:room-updated", currentRoom);
          } else {
            io.to(roomId).emit("game:billiards-turn-changed", {
              currentTurnIndex: nextState.currentTurnIndex,
              turnStartedAt: nextState.turnStartedAt!,
            });
            io.to(roomId).emit("game:state-updated", nextState);

            startBilliardsTurnTimer(roomId, nextState.turnTimeSeconds * 1000, () => {
              handleBilliardsTurnTimeout(roomId);
            });
          }
        }, 1500);
      }
    });
  }

  socket.on("game:billiards-shot", (move) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    if (socket.data.isSpectator) return;

    const room = gameManager.getRoom(roomId);
    if (!room || room.gameType !== "billiards" || room.status !== "playing") return;

    const state = gameManager.getGameState(roomId) as BilliardsPublicState | null;
    if (!state || state.phase !== "aiming") return;

    const currentPlayer = state.players[state.currentTurnIndex];
    if (currentPlayer.id !== socket.id) return;

    clearBilliardsTurnTimer(roomId);

    const result = gameManager.processMove(roomId, socket.id!, { type: "shot", directionDeg: move.directionDeg, power: move.power, impactOffsetX: move.impactOffsetX, impactOffsetY: move.impactOffsetY });
    if (!result) return;

    io.to(roomId).emit("game:state-updated", result.state);
    startBilliardsSimulation(roomId);
  });

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

    if (room.gameType === "typing") {
      startTypingServerTick(roomId);
    }

    if (room.gameType === "billiards") {
      startBilliardsGame(roomId);
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

    // For catch-mind, send keyword to drawer and start role-reveal timer
    if (room.gameType === "catch-mind") {
      const cmEngine = gameManager.getCatchMindEngine(roomId);
      if (cmEngine) {
        const cmState = state as CatchMindPublicState;
        const drawerSocket = io.sockets.sockets.get(cmState.drawerId);
        if (drawerSocket) {
          drawerSocket.emit("game:private-state", { keyword: cmEngine.getKeyword()! });
        }
        // Auto-advance from role-reveal to drawing after 3 seconds
        startCatchMindTimer(roomId, 3000, () => {
          const currentState = gameManager.getGameState(roomId) as CatchMindPublicState | null;
          const currentRoom = gameManager.getRoom(roomId);
          if (!currentState || !currentRoom || currentRoom.status !== "playing") return;
          if (currentState.phase !== "role-reveal") return;

          const drawingState = cmEngine.startDrawingPhase(currentState);
          gameManager.setGameState(roomId, drawingState);
          io.to(roomId).emit("game:state-updated", drawingState);
          startCatchMindDrawTimer(io, roomId, gameManager);
        });
      }
    }

    // Send private state to spectators (they see all info)
    sendPrivateStateToSpectators(io, room, gameManager);
  });

  socket.on("game:draw-points", (points: DrawPoint[]) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    if (socket.data.isSpectator) return;
    const room = gameManager.getRoom(roomId);
    if (!room) return;

    if (room.gameType === "liar-drawing") {
      const state = gameManager.getGameState(roomId) as LiarDrawingPublicState | null;
      if (!state || state.phase !== "drawing") return;

      const currentDrawerId = state.drawOrder[state.currentDrawerIndex];
      if (socket.id !== currentDrawerId) return;

      const liarEngine = gameManager.getLiarDrawingEngine(roomId);
      if (!liarEngine) return;
      const newState = liarEngine.processMove(state, socket.id!, { type: "draw", points });
      gameManager.setGameState(roomId, newState);
      socket.to(roomId).emit("game:draw-points", { playerId: socket.id!, points });
    } else if (room.gameType === "catch-mind") {
      const state = gameManager.getGameState(roomId) as CatchMindPublicState | null;
      if (!state || state.phase !== "drawing") return;
      if (socket.id !== state.drawerId) return;

      const cmEngine = gameManager.getCatchMindEngine(roomId);
      if (!cmEngine) return;
      const newState = cmEngine.processMove(state, socket.id!, { type: "draw", points });
      gameManager.setGameState(roomId, newState);
      socket.to(roomId).emit("game:draw-points", { playerId: socket.id!, points });
    }
  });

  socket.on("game:move", async (move) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    if (socket.data.isSpectator) return;

    // Ignore client-side tick moves for tetris — server handles ticks
    const room = gameManager.getRoom(roomId);
    if (room?.gameType === "tetris" && (move as TetrisMove).type === "tick") {
      return;
    }

    // Prevent processing moves on finished games (tick/move race condition)
    if (room?.status === "finished") return;

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
    } else if (room?.gameType === "typing") {
      // Typing: send only the updated player state, not full state
      const typingEngine = gameManager.getTypingEngine(roomId);
      if (typingEngine) {
        const ps = typingEngine.getPlayerState(socket.id!);
        if (ps) {
          io.to(roomId).emit("game:typing-player-updated", { playerId: socket.id!, player: { ...ps } });
        }
        // 단어 클리어 시 모든 클라이언트에 브로드캐스트
        const clearedWordId = typingEngine.getLastClearedWordId();
        if (clearedWordId !== null) {
          io.to(roomId).emit("game:typing-word-cleared", { playerId: socket.id!, wordId: clearedWordId });
          typingEngine.clearLastClearedWordId();
        }
      }
    } else {
      io.to(roomId).emit("game:state-updated", result.state);
    }

    // Notify all clients when canvas is cleared
    if ((room?.gameType === "liar-drawing" || room?.gameType === "catch-mind") && (move as { type: string }).type === "clear-canvas") {
      io.to(roomId).emit("game:clear-canvas", { playerId: socket.id! });
    }

    if (result.result) {
      clearGomokuTimer(roomId);
      clearTetrisTicker(roomId);
      cleanupTetrisFlush(roomId, io);
      clearTypingTicker(roomId);
      clearAllBilliardsTimers(roomId);

      {
        // Submit ranking for single-player games
        if (room?.gameType === "minesweeper" && result.result.winnerId) {
          const msEngine = gameManager.getMinesweeperEngine(roomId);
          if (msEngine) {
            const completionTime = msEngine.getCompletionTime();
            if (completionTime != null) {
              await submitRanking(io, rankingStore, "minesweeper", msEngine.getDifficulty(), getDisplayNickname(socket.data.nickname), completionTime, result.result);
            }
          }
        } else if (room?.gameType === "tetris") {
          const tetrisEngine = gameManager.getTetrisEngine(roomId);
          if (tetrisEngine && tetrisEngine.isSolo() && tetrisEngine.isSpeedRace() && result.result.winnerId) {
            const completionTime = tetrisEngine.getValidatedCompletionTime();
            if (completionTime != null) {
              await submitRanking(io, rankingStore, "tetris", tetrisEngine.getDifficulty(), getDisplayNickname(socket.data.nickname), completionTime, result.result);
            }
          }
        }

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

  socket.on("game:nonogram-verify", (callback) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const engine = gameManager.getNonogramEngine(roomId);
    if (!engine) return;
    callback(engine.verify());
  });

  socket.on("game:nonogram-batch-move", (moves, callback) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const engine = gameManager.getNonogramEngine(roomId);
    if (!engine) return;
    const newState = engine.processBatchMove(socket.id!, moves);
    gameManager.setGameState(roomId, newState);
    io.to(roomId).emit("game:state-updated", newState);
    const result = engine.checkWin(newState);
    if (result) {
      io.to(roomId).emit("game:ended", result);
      const updatedRoom = gameManager.getRoom(roomId);
      if (updatedRoom) {
        updatedRoom.status = "finished";
        io.emit("lobby:room-updated", updatedRoom);
      }
    }
    callback(true);
  });

  socket.on("game:nonogram-restart", (callback) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const engine = gameManager.getNonogramEngine(roomId);
    if (!engine) return;
    const newState = engine.restart();
    gameManager.setGameState(roomId, newState);
    io.to(roomId).emit("game:state-updated", newState);
    callback(true);
  });

  socket.on("game:nonogram-undo", (callback) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const engine = gameManager.getNonogramEngine(roomId);
    if (!engine) return;
    const newState = engine.undo();
    gameManager.setGameState(roomId, newState);
    io.to(roomId).emit("game:state-updated", newState);
    callback(true);
  });

  socket.on("game:nonogram-redo", (callback) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const engine = gameManager.getNonogramEngine(roomId);
    if (!engine) return;
    const newState = engine.redo();
    gameManager.setGameState(roomId, newState);
    io.to(roomId).emit("game:state-updated", newState);
    callback(true);
  });

  socket.on("game:nonogram-toggle-hint", (hintKey, callback) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    if (socket.data.isSpectator) return;
    const engine = gameManager.getNonogramEngine(roomId);
    if (!engine) return;
    const newState = engine.toggleHint(hintKey);
    gameManager.setGameState(roomId, newState);
    io.to(roomId).emit("game:state-updated", newState);
    callback(true);
  });

  socket.on("game:quick-restart", () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    if (socket.data.isSpectator) return;

    const currentRoom = gameManager.getRoom(roomId);
    if (!currentRoom || currentRoom.hostId !== socket.id) return;
    if (currentRoom.status !== "finished") return;
    if (currentRoom.players.length !== 1) return;

    clearTetrisTicker(roomId);
    cleanupTetrisFlush(roomId);

    const state = gameManager.quickRestart(roomId);
    if (!state) return;

    io.to(roomId).emit("game:started", state);
    io.emit("lobby:room-updated", currentRoom);

    if (currentRoom.gameType === "tetris") {
      startTetrisServerTick(roomId);
    }
  });

  socket.on("game:rematch", () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    if (socket.data.isSpectator) return;

    const currentRoom = gameManager.getRoom(roomId);
    if (!currentRoom || currentRoom.hostId !== socket.id) return;

    clearGomokuTimer(roomId);
    clearTetrisTicker(roomId);
    cleanupTetrisFlush(roomId);
    clearLiarDrawingTimer(roomId);
    clearCatchMindTimer(roomId);
    clearTypingTicker(roomId);
    clearAllBilliardsTimers(roomId);
    const typingCountdown = typingCountdownTimers.get(roomId);
    if (typingCountdown) {
      clearTimeout(typingCountdown);
      typingCountdownTimers.delete(roomId);
    }
    const room = gameManager.resetRoom(roomId);
    if (room) {
      io.to(roomId).emit("game:rematch-requested", socket.id!);
      io.to(roomId).emit("lobby:room-updated", room);
      io.emit("lobby:room-updated", room);
    }
  });

  socket.on("ranking:get", async (key, callback) => {
    const entries = await rankingStore.getRankings(key);
    callback(entries);
  });

  socket.on("ranking:delete", async (key, entryId, callback) => {
    if (!socket.data.authenticated) return callback({ success: false, error: "인증이 필요합니다" });
    if (!isAdmin(socket.data.nickname)) return callback({ success: false, error: "권한이 없습니다" });
    const entries = await rankingStore.deleteEntry(key, entryId);
    io.emit("ranking:updated", { key, rankings: entries });
    callback({ success: true });
  });
}
