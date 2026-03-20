"use client";

import { useEffect, useCallback } from "react";
import { useGameStore } from "@/stores/game-store";
import type { RoundResult } from "@/stores/game-store";
import type { GameSocket } from "@/lib/socket";
import type { GameMove, GameState, GameResult, HoldemPrivateState, LiarDrawingPrivateState } from "@game-hub/shared-types";

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
    };
    const onStateUpdated = (state: GameState) => {
      setGameState(state);
    };
    const onEnded = (result: GameResult) => {
      setGameResult(result);
    };
    const onPrivateState = (state: HoldemPrivateState | LiarDrawingPrivateState) => {
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

    socket.on("game:started", onStarted);
    socket.on("game:state-updated", onStateUpdated);
    socket.on("game:ended", onEnded);
    socket.on("game:private-state", onPrivateState);
    socket.on("game:error", onError);
    socket.on("game:player-left", onPlayerLeft);
    socket.on("game:round-ended", onRoundEnded);

    return () => {
      socket.off("game:started", onStarted);
      socket.off("game:state-updated", onStateUpdated);
      socket.off("game:ended", onEnded);
      socket.off("game:private-state", onPrivateState);
      socket.off("game:error", onError);
      socket.off("game:player-left", onPlayerLeft);
      socket.off("game:round-ended", onRoundEnded);
    };
  }, [socket, setGameState, setGameResult, setPrivateState, setPlayerLeftInfo, setRoundResult]);

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

  return { gameState, gameResult, privateState, playerLeftInfo, roundResult, makeMove, startGame, requestRematch, setPlayerLeftInfo, reset };
}
