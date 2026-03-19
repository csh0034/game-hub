"use client";

import { useEffect, useCallback } from "react";
import { useGameStore } from "@/stores/game-store";
import type { GameSocket } from "@/lib/socket";
import type { GameMove, GameState, GameResult, HoldemPrivateState } from "@game-hub/shared-types";

export function useGame(socket: GameSocket | null) {
  const {
    gameState,
    gameResult,
    privateState,
    setGameState,
    setGameResult,
    setPrivateState,
    reset,
  } = useGameStore();

  useEffect(() => {
    if (!socket) return;

    const onStarted = (state: GameState) => {
      setGameState(state);
      setGameResult(null);
    };
    const onStateUpdated = (state: GameState) => {
      setGameState(state);
    };
    const onEnded = (result: GameResult) => {
      setGameResult(result);
    };
    const onPrivateState = (state: HoldemPrivateState) => {
      setPrivateState(state);
    };
    const onError = (message: string) => {
      console.error("[game error]", message);
    };

    socket.on("game:started", onStarted);
    socket.on("game:state-updated", onStateUpdated);
    socket.on("game:ended", onEnded);
    socket.on("game:private-state", onPrivateState);
    socket.on("game:error", onError);

    return () => {
      socket.off("game:started", onStarted);
      socket.off("game:state-updated", onStateUpdated);
      socket.off("game:ended", onEnded);
      socket.off("game:private-state", onPrivateState);
      socket.off("game:error", onError);
    };
  }, [socket, setGameState, setGameResult, setPrivateState]);

  const makeMove = useCallback(
    (move: GameMove) => {
      if (!socket) return;
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
  }, [socket, reset]);

  return { gameState, gameResult, privateState, makeMove, startGame, requestRematch };
}
