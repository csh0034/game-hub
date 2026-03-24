"use client";

import { useEffect, useCallback } from "react";
import { useGameStore } from "@/stores/game-store";
import { useLobbyStore } from "@/stores/lobby-store";
import type { RoundResult } from "@/stores/game-store";
import type { GameSocket } from "@/lib/socket";
import { useTetrisBoardStore } from "@/stores/tetris-board-store";
import type { GameMove, GameState, GameResult, HoldemPrivateState, LiarDrawingPrivateState, CatchMindPrivateState, TetrisPlayerUpdate, TetrisPieceUpdate, TetrisPublicState } from "@game-hub/shared-types";

export function useGame(socket: GameSocket | null) {
  const {
    gameState,
    gameResult,
    privateState,
    playerLeftInfo,
    roundResult,
    setGameState,
    setGameResult,
    setPrivateState,
    setPlayerLeftInfo,
    setRoundResult,
    reset,
  } = useGameStore();

  useEffect(() => {
    if (!socket) return;

    const onStarted = (state: GameState) => {
      setGameState(state);
      setGameResult(null);
      setRoundResult(null);
      // Initialize tetris board store if it's a tetris game
      if (state && "players" in state && "mode" in state && socket?.id) {
        useTetrisBoardStore.getState().initFromState(state as TetrisPublicState, socket.id);
      }
    };
    const onStateUpdated = (state: GameState) => {
      setGameState(state);
    };
    const onEnded = (result: GameResult) => {
      setGameResult(result);
    };
    const onPrivateState = (state: HoldemPrivateState | LiarDrawingPrivateState | CatchMindPrivateState) => {
      setPrivateState(state);
    };
    const onError = (message: string) => {
      console.error("[game error]", message);
    };
    const onPlayerLeft = (data: { playerId: string; nickname: string; willEnd: boolean }) => {
      setPlayerLeftInfo({ nickname: data.nickname, willEnd: data.willEnd });
    };
    const onRoundEnded = (data: RoundResult) => {
      setRoundResult(data);
    };
    const onTetrisPlayerUpdated = (data: TetrisPlayerUpdate) => {
      useTetrisBoardStore.getState().setPlayerBoard(data.playerId, data.board);
    };
    const onTetrisPieceUpdated = (data: TetrisPieceUpdate) => {
      useTetrisBoardStore.getState().setPlayerPiece(data.playerId, data.activePiece, data.ghostRow, data.version);
    };

    socket.on("game:started", onStarted);
    socket.on("game:state-updated", onStateUpdated);
    socket.on("game:ended", onEnded);
    socket.on("game:private-state", onPrivateState);
    socket.on("game:error", onError);
    socket.on("game:player-left", onPlayerLeft);
    socket.on("game:round-ended", onRoundEnded);
    socket.on("game:tetris-player-updated", onTetrisPlayerUpdated);
    socket.on("game:tetris-piece-updated", onTetrisPieceUpdated);

    return () => {
      socket.off("game:started", onStarted);
      socket.off("game:state-updated", onStateUpdated);
      socket.off("game:ended", onEnded);
      socket.off("game:private-state", onPrivateState);
      socket.off("game:error", onError);
      socket.off("game:player-left", onPlayerLeft);
      socket.off("game:round-ended", onRoundEnded);
      socket.off("game:tetris-player-updated", onTetrisPlayerUpdated);
      socket.off("game:tetris-piece-updated", onTetrisPieceUpdated);
    };
  }, [socket, setGameState, setGameResult, setPrivateState, setPlayerLeftInfo, setRoundResult]);

  const makeMove = useCallback(
    (move: GameMove) => {
      if (!socket) return;
      if (useLobbyStore.getState().isSpectating) return;
      socket.emit("game:move", move);
    },
    [socket]
  );

  const startGame = useCallback(() => {
    if (!socket) return;
    socket.emit("game:start");
  }, [socket]);

  const requestRematch = useCallback(() => {
    if (!socket) return;
    socket.emit("game:rematch");
    reset();
    useTetrisBoardStore.getState().reset();
  }, [socket, reset]);

  return { gameState, gameResult, privateState, playerLeftInfo, roundResult, makeMove, startGame, requestRematch, setPlayerLeftInfo, reset };
}
