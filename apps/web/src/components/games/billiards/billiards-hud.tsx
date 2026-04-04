"use client";

import { useState, useEffect } from "react";
import type { BilliardsPublicState } from "@game-hub/shared-types";
import { useBilliardsStore, MAX_OFFSET } from "./billiards-store";

interface BilliardsHudProps {
  state: BilliardsPublicState;
  myPlayerId: string | undefined;
}

export function BilliardsHud({ state, myPlayerId }: BilliardsHudProps) {
  const { cushionCount, objectBallsHit, lastShotResult, showShotResult, showTrail, toggleTrail } = useBilliardsStore();
  const isAiming = state.phase === "aiming" && state.turnStartedAt != null;
  const [remainingTime, setRemainingTime] = useState(state.turnTimeSeconds);

  useEffect(() => {
    if (!isAiming) return;

    const update = () => {
      const elapsed = (Date.now() - state.turnStartedAt!) / 1000;
      setRemainingTime(Math.max(0, state.turnTimeSeconds - elapsed));
    };
    update();
    const interval = setInterval(update, 100);
    return () => clearInterval(interval);
  }, [isAiming, state.turnStartedAt, state.turnTimeSeconds]);

  const isMyTurn = state.players[state.currentTurnIndex]?.id === myPlayerId;
  const currentPlayer = state.players[state.currentTurnIndex];

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {/* Scoreboard - top left */}
      <div className="pointer-events-auto absolute top-4 left-4 rounded-lg bg-black/70 p-3 text-white backdrop-blur-sm">
        <div className="mb-2 text-xs font-semibold tracking-wider text-gray-400 uppercase">3쿠션 당구</div>
        {state.players.map((player, i) => (
          <div
            key={player.id}
            className={`flex items-center gap-3 rounded px-2 py-1 ${
              state.currentTurnIndex === i ? "bg-white/20" : ""
            }`}
          >
            <div
              className={`h-3 w-3 rounded-full ${
                player.cueBallId === "cue" ? "bg-white" : "bg-yellow-400"
              }`}
            />
            <span className="min-w-[60px] text-sm">
              {player.nickname}
              {player.id === myPlayerId && " (나)"}
            </span>
            <span className="ml-auto text-lg font-bold">{player.score}</span>
            <span className="text-xs text-gray-400">/ {state.targetScore}</span>
          </div>
        ))}

        {/* Timer */}
        {state.phase === "aiming" && (
          <div className="mt-2 border-t border-white/20 pt-2">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-400">남은 시간</span>
              <span className={`font-mono text-sm font-bold ${remainingTime <= 5 ? "text-red-400" : "text-white"}`}>
                {remainingTime.toFixed(1)}초
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Cushion counter - top center (simulating only) */}
      {state.phase === "simulating" && <div className="absolute top-14 left-1/2 -translate-x-1/2 rounded-lg bg-black/70 p-3 text-white backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-bold ${
                  cushionCount >= n ? "border-green-400 bg-green-400/30 text-green-400" : "border-gray-600 text-gray-600"
                }`}
              >
                {n}
              </div>
            ))}
          </div>
          <div className="h-6 w-px bg-white/20" />
          <div className="text-xs text-gray-400">
            목적구 {objectBallsHit.length}/2
          </div>
        </div>
      </div>}

      {/* Options panel - top right */}
      <div className="pointer-events-auto absolute top-14 right-4 rounded-lg border border-border bg-card px-3 py-2.5 backdrop-blur-sm">
        <button
          onClick={toggleTrail}
          className="flex w-full items-center gap-2.5 text-sm"
        >
          <div className={`flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${showTrail ? "bg-neon-cyan" : "bg-foreground/20"}`}>
            <div className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${showTrail ? "translate-x-4" : "translate-x-0"}`} />
          </div>
          <span className={`font-medium transition-colors ${showTrail ? "text-neon-cyan" : "text-foreground/40"}`}>공 궤적</span>
        </button>
      </div>

      {/* Shot result popup */}
      {showShotResult && lastShotResult && (
        <div className="absolute inset-x-0 top-1/3 flex justify-center">
          <div
            className={`rounded-xl px-8 py-4 text-2xl font-bold shadow-lg ${
              lastShotResult.scored
                ? "bg-green-500/90 text-white"
                : "bg-red-500/80 text-white"
            }`}
          >
            {lastShotResult.scored ? "득점!" : "MISS"}
            <div className="mt-1 text-center text-sm font-normal">
              쿠션 {lastShotResult.cushionCount}회 · 목적구 {lastShotResult.objectBallsHit.length}개
            </div>
          </div>
        </div>
      )}

      {/* Impact point indicator + controls help */}
      {state.phase === "aiming" && isMyTurn && (
        <ImpactPointIndicator />
      )}

      {/* Turn indicator */}
      {state.phase === "aiming" && (
        <div className="absolute inset-x-0 bottom-4 flex justify-center">
          <div className={`rounded-lg px-4 py-2 text-sm font-semibold ${
            isMyTurn ? "bg-blue-500/90 text-white" : "bg-gray-700/80 text-gray-300"
          }`}>
            {isMyTurn ? "좌클릭 아래: 파워→샷 · 우클릭 좌우: 조준 · 우클릭 상하: 시점 · 휠: 줌 · ←→ 조준 · WASD 당점" : `${currentPlayer?.nickname}의 차례`}
          </div>
        </div>
      )}

      {/* Power gauge */}
      {state.phase === "aiming" && isMyTurn && (
        <PowerGauge />
      )}
    </div>
  );
}

function ImpactPointIndicator() {
  const { impactOffsetX, impactOffsetY } = useBilliardsStore();

  const offsetRatio = Math.sqrt(impactOffsetX ** 2 + impactOffsetY ** 2) / MAX_OFFSET;
  const isMiscueRisk = offsetRatio > 0.85;

  // Normalize offsets to -1~1 range for the visual
  const nx = impactOffsetX / MAX_OFFSET;
  const ny = impactOffsetY / MAX_OFFSET;

  // Only show if offset is non-zero
  const hasOffset = Math.abs(impactOffsetX) > 0.0001 || Math.abs(impactOffsetY) > 0.0001;

  return (
    <div className="absolute bottom-20 left-4 w-[76px] rounded-lg bg-black/70 p-3 text-white backdrop-blur-sm">
      <div className="mb-1.5 text-center text-xs text-gray-400">당점</div>
      {/* Ball circle with impact dot */}
      <div className="relative mx-auto h-14 w-14">
        {/* Ball outline */}
        <div className="absolute inset-0 rounded-full border-2 border-gray-500" />
        {/* Crosshair */}
        <div className="absolute top-1/2 left-1 right-1 h-px bg-gray-600" />
        <div className="absolute left-1/2 top-1 bottom-1 w-px bg-gray-600" />
        {/* Impact dot */}
        <div
          className={`absolute h-2.5 w-2.5 rounded-full ${isMiscueRisk ? "bg-red-500 animate-pulse" : "bg-red-400"}`}
          style={{
            left: `${50 + nx * 40}%`,
            top: `${50 - ny * 40}%`,
            transform: "translate(-50%, -50%)",
          }}
        />
      </div>
      {/* Fixed-height info area to prevent layout shift */}
      <div className="mt-1.5 h-[28px]">
        {isMiscueRisk ? (
          <div className="text-center text-[10px] font-bold text-red-400">미스큐 위험!</div>
        ) : hasOffset ? (
          <div className="text-center text-[10px] leading-tight text-gray-400">
            {nx !== 0 && <div>{nx > 0 ? "우" : "좌"} {Math.round(Math.abs(nx) * 100)}%</div>}
            {ny !== 0 && <div>{ny > 0 ? "상" : "하"} {Math.round(Math.abs(ny) * 100)}%</div>}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PowerGauge() {
  const { power, isDragging } = useBilliardsStore();

  if (!isDragging) return null;

  // Speed mapping: matches server dragToSpeed (1.0 ~ 13.89 m/s ≈ 3.6 ~ 50 km/h)
  const speedKmh = (1.0 + power * 12.89) * 3.6;

  const getColor = (p: number) => {
    if (p < 0.25) return "from-green-400 to-green-500";
    if (p < 0.50) return "from-green-500 to-yellow-500";
    if (p < 0.75) return "from-yellow-500 to-orange-500";
    return "from-orange-500 to-red-500";
  };

  return (
    <div className="pointer-events-auto absolute bottom-16 left-1/2 -translate-x-1/2 flex items-center gap-3">
      {/* Horizontal bar */}
      <div className="relative h-5 w-52 overflow-hidden rounded-full bg-gray-800/80 shadow-lg border border-white/10">
        <div
          className={`absolute top-0 bottom-0 left-0 rounded-full bg-gradient-to-r ${getColor(power)} transition-all duration-75`}
          style={{ width: `${power * 100}%` }}
        />
        {/* Tick marks */}
        {[25, 50, 75].map((tick) => (
          <div
            key={tick}
            className="absolute top-0 bottom-0 w-px bg-white/30"
            style={{ left: `${tick}%` }}
          />
        ))}
      </div>
      {/* Numeric readout */}
      <div className="rounded-lg bg-black/80 px-3 py-1 text-center border border-white/10 whitespace-nowrap">
        <div className="text-sm font-bold text-white">{Math.round(power * 100)}% <span className="text-xs font-normal text-gray-400">{speedKmh.toFixed(0)} km/h</span></div>
      </div>
    </div>
  );
}
