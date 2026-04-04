"use client";

import { useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { useGameStore } from "@/stores/game-store";
import { useLobbyStore } from "@/stores/lobby-store";
import { getSocket } from "@/lib/socket";
import type { BilliardsPublicState, BilliardsFrameData } from "@game-hub/shared-types";
import { useBilliardsStore } from "./billiards-store";
import { BilliardsHud } from "./billiards-hud";
import { FloatingChat } from "./floating-chat";

const BilliardsScene = dynamic(
  () => import("./billiards-scene").then((m) => ({ default: m.BilliardsScene })),
  { ssr: false },
);

interface BilliardsBoardProps {
  roomId: string;
  isSpectating?: boolean;
}

export default function BilliardsBoard({ roomId: _roomId }: BilliardsBoardProps) {
  const gameState = useGameStore((s) => s.gameState) as BilliardsPublicState | null;
  const gameResult = useGameStore((s) => s.gameResult);
  const requestRematch = useCallback(() => {
    const socket = getSocket();
    socket.emit("game:rematch");
  }, []);

  const socket = getSocket();
  const myPlayerId = socket?.id;
  const isSpectating = useLobbyStore((s) => s.isSpectating);
  const room = useLobbyStore((s) => s.currentRoom);
  const isHost = room?.hostId === myPlayerId;

  const { applyFrame, applyState, setShotResult, setShowShotResult, setSimulating, reset } = useBilliardsStore();

  // Initialize ball positions from game state and track simulation phase
  useEffect(() => {
    if (gameState) {
      // During simulation, ball positions are driven by billiards-frame events.
      // Only apply state positions when NOT simulating to avoid overwriting frame data.
      if (gameState.phase !== "simulating") {
        applyState(gameState);
      }
      setSimulating(gameState.phase === "simulating");
    }
    return () => {
      reset();
    };
  }, [gameState?.phase, gameState?.currentTurnIndex]);// eslint-disable-line react-hooks/exhaustive-deps

  // Listen for billiards-specific events
  useEffect(() => {
    if (!socket) return;

    const onFrame = (data: BilliardsFrameData) => {
      applyFrame(data);
    };

    const onShotResult = (data: { scored: boolean; cushionCount: number; objectBallsHit: string[] }) => {
      setShotResult(data);
      setShowShotResult(true);
      setTimeout(() => setShowShotResult(false), 1500);
    };

    socket.on("game:billiards-frame", onFrame);
    socket.on("game:billiards-shot-result", onShotResult);

    return () => {
      socket.off("game:billiards-frame", onFrame);
      socket.off("game:billiards-shot-result", onShotResult);
    };
  }, [socket, applyFrame, setShotResult, setShowShotResult]);

  // Handle shot event from scene
  useEffect(() => {
    const handler = (e: Event) => {
      const { directionDeg, power, impactOffsetX, impactOffsetY } = (e as CustomEvent).detail;
      socket?.emit("game:billiards-shot", { directionDeg, power, impactOffsetX, impactOffsetY });
    };
    window.addEventListener("billiards-shot", handler);
    return () => window.removeEventListener("billiards-shot", handler);
  }, [socket]);

  if (!gameState) return null;

  const currentPlayer = gameState.players[gameState.currentTurnIndex];
  const isMyTurn = !isSpectating && currentPlayer?.id === myPlayerId;
  const cueBallId = currentPlayer?.cueBallId ?? "cue";
  const myNickname = gameState.players.find((p) => p.id === myPlayerId)?.nickname ?? "";

  return (
    <div className="relative h-full w-full">
      {/* 3D Scene */}
      <BilliardsScene
        cueBallId={cueBallId}
        isAiming={gameState.phase === "aiming"}
        isMyTurn={isMyTurn}
      />

      {/* HUD Overlay */}
      <BilliardsHud state={gameState} myPlayerId={myPlayerId} />

      {/* Floating Chat */}
      <div className="pointer-events-none absolute inset-0 z-20">
        <FloatingChat
          socket={socket}
          nickname={myNickname}
          disabled={isSpectating && !(room?.gameOptions?.spectateChatEnabled ?? false)}
        />
      </div>

      {/* Game Result Overlay */}
      {gameResult && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60">
          <div className="rounded-xl bg-gray-900 p-8 text-center text-white shadow-2xl">
            <div className="mb-2 text-3xl font-bold">
              {gameResult.winnerId === myPlayerId ? "승리!" : "패배"}
            </div>
            <div className="mb-6 text-gray-400">{gameResult.reason}</div>
            <div className="mb-4">
              {gameState.players.map((p) => (
                <div key={p.id} className="text-lg">
                  {p.nickname}: {p.score}점
                </div>
              ))}
            </div>
            {isHost && (
              <button
                onClick={requestRematch}
                className="rounded-lg bg-blue-600 px-6 py-2 font-semibold text-white hover:bg-blue-700"
              >
                다시 하기
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
