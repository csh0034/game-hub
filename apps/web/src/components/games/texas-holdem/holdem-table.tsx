"use client";

import { useGame } from "@/hooks/use-game";
import { useSocket } from "@/hooks/use-socket";
import type {
  HoldemPublicState,
  HoldemMove,
  HoldemAction,
  Card,
} from "@game-hub/shared-types";
import type { GameComponentProps } from "@/lib/game-registry";
import { useState } from "react";

function CardDisplay({ card, faceDown = false }: { card?: Card; faceDown?: boolean }) {
  if (!card || faceDown) {
    return (
      <div className="w-14 h-20 bg-gradient-to-br from-blue-800 to-blue-950 border border-blue-600 rounded-lg flex items-center justify-center shadow-md">
        <span className="text-blue-400 text-lg font-bold">?</span>
      </div>
    );
  }

  const suitSymbol: Record<string, string> = {
    hearts: "\u2665",
    diamonds: "\u2666",
    clubs: "\u2663",
    spades: "\u2660",
  };

  const isRed = card.suit === "hearts" || card.suit === "diamonds";

  return (
    <div className="w-14 h-20 bg-white rounded-lg border border-gray-300 flex flex-col items-center justify-center shadow-md">
      <span className={`text-sm font-bold ${isRed ? "text-red-600" : "text-gray-900"}`}>
        {card.rank}
      </span>
      <span className={`text-lg ${isRed ? "text-red-600" : "text-gray-900"}`}>
        {suitSymbol[card.suit]}
      </span>
    </div>
  );
}

export default function HoldemTable({ roomId }: GameComponentProps) {
  const { socket } = useSocket();
  const { gameState, privateState, makeMove } = useGame(socket);
  const [raiseAmount, setRaiseAmount] = useState(0);

  const state = gameState as HoldemPublicState | null;
  if (!state) return null;

  const myIndex = state.players.findIndex((p) => p.id === socket?.id);
  const isMyTurn = myIndex === state.currentPlayerIndex;
  const myPlayer = state.players[myIndex];
  const canCheck = myPlayer && myPlayer.currentBet >= state.currentBet;
  const callAmount = myPlayer ? state.currentBet - myPlayer.currentBet : 0;

  const handleAction = (action: HoldemAction, amount?: number) => {
    const move: HoldemMove = { action, amount };
    makeMove(move);
  };

  const phaseLabel: Record<string, string> = {
    preflop: "프리플롭",
    flop: "플롭",
    turn: "턴",
    river: "리버",
    showdown: "쇼다운",
  };

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Phase & Pot */}
      <div className="flex items-center gap-6 text-sm">
        <span className="bg-secondary px-3 py-1 rounded-lg text-muted-foreground">
          {phaseLabel[state.phase] || state.phase}
        </span>
        <span className="font-bold text-lg">
          팟: <span className="text-primary">{state.pot}</span>
        </span>
        <span className="text-muted-foreground text-xs">
          블라인드: {state.smallBlind}/{state.bigBlind}
        </span>
      </div>

      {/* Table */}
      <div className="relative w-[640px] h-[360px] bg-gradient-to-br from-green-800 to-green-900 rounded-[50%] border-4 border-green-700 shadow-2xl flex items-center justify-center">
        {/* Community cards */}
        <div className="flex gap-2">
          {state.communityCards.map((card, i) => (
            <CardDisplay key={i} card={card} />
          ))}
          {Array.from({ length: 5 - state.communityCards.length }).map(
            (_, i) => (
              <div
                key={`empty-${i}`}
                className="w-14 h-20 border border-green-600/30 rounded-lg"
              />
            )
          )}
        </div>

        {/* Players around table */}
        {state.players.map((player, i) => {
          const angle = (i / state.players.length) * Math.PI * 2 - Math.PI / 2;
          const rx = 280;
          const ry = 150;
          const x = Math.cos(angle) * rx;
          const y = Math.sin(angle) * ry;
          const isMe = player.id === socket?.id;

          return (
            <div
              key={player.id}
              className="absolute flex flex-col items-center"
              style={{
                left: `calc(50% + ${x}px)`,
                top: `calc(50% + ${y}px)`,
                transform: "translate(-50%, -50%)",
              }}
            >
              <div
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium whitespace-nowrap ${
                  player.folded
                    ? "bg-muted/50 border-muted text-muted-foreground line-through"
                    : player.isTurn
                    ? "bg-primary/20 border-primary text-primary"
                    : isMe
                    ? "bg-card border-primary/50 text-foreground"
                    : "bg-card border-border text-foreground"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  {player.isDealer && (
                    <span className="bg-yellow-500 text-black px-1 rounded text-[10px] font-bold">
                      D
                    </span>
                  )}
                  <span>{player.nickname}</span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {player.chips} chips
                  {player.currentBet > 0 && (
                    <span className="text-primary ml-1">bet: {player.currentBet}</span>
                  )}
                  {player.isAllIn && (
                    <span className="text-destructive ml-1 font-bold">ALL IN</span>
                  )}
                </div>
              </div>

              {/* Show hole cards for current player */}
              {isMe && privateState && (
                <div className="flex gap-1 mt-1 scale-75">
                  {privateState.holeCards.map((card, ci) => (
                    <CardDisplay key={ci} card={card} />
                  ))}
                </div>
              )}
              {!isMe && !player.folded && (
                <div className="flex gap-1 mt-1 scale-50">
                  <CardDisplay faceDown />
                  <CardDisplay faceDown />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Action buttons */}
      {isMyTurn && state.phase !== "showdown" && myPlayer && !myPlayer.folded && (
        <div className="flex items-center gap-3 bg-card border border-border rounded-xl px-6 py-4">
          <button
            onClick={() => handleAction("fold")}
            className="bg-destructive/20 hover:bg-destructive/30 text-destructive px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            폴드
          </button>

          {canCheck ? (
            <button
              onClick={() => handleAction("check")}
              className="bg-secondary hover:bg-secondary/80 text-foreground px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              체크
            </button>
          ) : (
            <button
              onClick={() => handleAction("call")}
              className="bg-secondary hover:bg-secondary/80 text-foreground px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              콜 ({callAmount})
            </button>
          )}

          <div className="flex items-center gap-2">
            <input
              type="range"
              min={state.currentBet + state.bigBlind}
              max={myPlayer.chips + myPlayer.currentBet}
              value={raiseAmount || state.currentBet + state.bigBlind}
              onChange={(e) => setRaiseAmount(parseInt(e.target.value))}
              className="w-24 accent-primary"
            />
            <button
              onClick={() => handleAction("raise", raiseAmount || state.currentBet + state.bigBlind)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              레이즈 ({raiseAmount || state.currentBet + state.bigBlind})
            </button>
          </div>

          <button
            onClick={() => handleAction("all-in")}
            className="bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-500 hover:to-orange-400 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors"
          >
            올인
          </button>
        </div>
      )}

      {/* Winners */}
      {(state as any).winners && (
        <div className="bg-card border border-primary/30 rounded-lg p-4 text-center">
          {(state as any).winners.map((w: any, i: number) => (
            <p key={i} className="text-lg font-bold">
              {w.handName}(으)로 {w.amount} 획득!
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
