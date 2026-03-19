"use client";

import { useEffect, useCallback } from "react";
import { useGameStore } from "@/stores/game-store";
import type { GameSocket } from "@/lib/socket";
import type { GameMove } from "@game-hub/shared-types";

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

    socket.on("game:started", (state) => {
      setGameState(state);
      setGameResult(null);
    });

    socket.on("game:state-updated", (state) => {
      setGameState(state);
    });

    socket.on("game:ended", (result) => {
      setGameResult(result);
    });

    socket.on("game:private-state", (state) => {
      setPrivateState(state);
    });

    socket.on("game:error", (message) => {
      console.error("[game error]", message);
    });

    return () => {
      socket.off("game:started");
      socket.off("game:state-updated");
      socket.off("game:ended");
      socket.off("game:private-state");
      socket.off("game:error");
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
