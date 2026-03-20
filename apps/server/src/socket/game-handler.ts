import type { Server, Socket } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
  GomokuState,
  TetrisMove,
  TetrisPublicState,
  HoldemPublicState,
} from "@game-hub/shared-types";
import type { GameManager } from "../games/game-manager.js";
import { startGomokuTimer, clearGomokuTimer } from "../games/gomoku-timer.js";
import { startTetrisTicker, updateTetrisTickerInterval, clearTetrisTicker } from "../games/tetris-ticker.js";

const holdemRoundTimers: Map<string, NodeJS.Timeout> = new Map();

type IOServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

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
        return;
      }

      const newState = tetrisEngine.tickAll();
      gameManager.setGameState(roomId, newState);

      const result = tetrisEngine.checkWin(newState);
      io.to(roomId).emit("game:state-updated", newState);

      if (result) {
        clearTetrisTicker(roomId);
        room.status = "finished";
        io.to(roomId).emit("game:ended", result);
        io.emit("lobby:room-updated", room);
      } else if (newState.dropInterval !== currentInterval) {
        currentInterval = newState.dropInterval;
        updateTetrisTickerInterval(roomId, currentInterval, onTick);
      }
    };

    startTetrisTicker(roomId, currentInterval, onTick);
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

    // Ignore client-side tick moves for tetris — server handles ticks
    const room = gameManager.getRoom(roomId);
    if (room?.gameType === "tetris" && (move as TetrisMove).type === "tick") {
      return;
    }

    const result = gameManager.processMove(roomId, socket.id!, move);
    if (!result) {
      socket.emit("game:error", "잘못된 수입니다.");
      return;
    }

    io.to(roomId).emit("game:state-updated", result.state);

    if (result.result) {
      clearGomokuTimer(roomId);
      clearTetrisTicker(roomId);

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
    }
  });

  socket.on("game:rematch", () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    clearGomokuTimer(roomId);
    clearTetrisTicker(roomId);
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
