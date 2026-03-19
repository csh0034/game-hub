"use client";

import { useGame } from "@/hooks/use-game";
import { useSocket } from "@/hooks/use-socket";
import type {
  HoldemPublicState,
  HoldemPlayerState,
  HoldemMove,
  HoldemAction,
  Card,
} from "@game-hub/shared-types";
import type { GameComponentProps } from "@/lib/game-registry";
import { useState, useMemo } from "react";
import { evaluateBestHand, HAND_RANK_INFO } from "@/lib/hand-evaluator";

const SUIT_SYMBOL: Record<string, string> = {
  hearts: "\u2665",
  diamonds: "\u2666",
  clubs: "\u2663",
  spades: "\u2660",
};

function CardDisplay({ card, faceDown = false, size = "md" }: { card?: Card; faceDown?: boolean; size?: "sm" | "md" | "lg" }) {
  const sizeClasses = {
    sm: "w-10 h-14 text-xs",
    md: "w-14 h-20 text-sm",
    lg: "w-16 h-[88px] text-base",
  };

  if (!card || faceDown) {
    return (
      <div className={`${sizeClasses[size]} bg-gradient-to-br from-blue-800 to-blue-950 border border-blue-600 rounded-lg flex items-center justify-center shadow-md`}>
        <span className="text-blue-400 font-bold">?</span>
      </div>
    );
  }

  const isRed = card.suit === "hearts" || card.suit === "diamonds";
  const color = isRed ? "text-red-600" : "text-gray-900";

  return (
    <div className={`${sizeClasses[size]} bg-white rounded-lg border border-gray-300 flex flex-col items-center justify-center shadow-md hover:shadow-lg transition-shadow`}>
      <span className={`font-bold ${color}`}>{card.rank}</span>
      <span className={`${size === "sm" ? "text-base" : "text-lg"} ${color} -mt-0.5`}>
        {SUIT_SYMBOL[card.suit]}
      </span>
    </div>
  );
}

function HandRankPanel({ holeCards, communityCards }: { holeCards: Card[]; communityCards: Card[] }) {
  const allCards = useMemo(() => [...holeCards, ...communityCards], [holeCards, communityCards]);
  const currentHand = useMemo(() => evaluateBestHand(allCards), [allCards]);

  return (
    <div className="w-52 bg-card border border-border rounded-xl p-4 flex flex-col gap-3 self-start">
      <h3 className="text-sm font-bold text-foreground border-b border-border pb-2">
        My Hand
      </h3>

      {/* 내 카드 */}
      <div className="flex gap-1.5 justify-center">
        {holeCards.map((card, i) => (
          <CardDisplay key={i} card={card} size="sm" />
        ))}
      </div>

      {/* 현재 핸드 랭크 */}
      {currentHand && (
        <div className="bg-primary/10 border border-primary/20 rounded-lg px-3 py-2 text-center">
          <p className="text-xs text-muted-foreground">현재 핸드</p>
          <p className="text-sm font-bold text-primary">{currentHand.nameKr}</p>
          <p className="text-[10px] text-muted-foreground">{currentHand.name}</p>
        </div>
      )}

      {/* 핸드 랭크 목록 */}
      <div className="flex flex-col gap-0.5 mt-1">
        <p className="text-[10px] text-muted-foreground mb-1 font-medium">HAND RANKINGS</p>
        {[...HAND_RANK_INFO].reverse().map((info) => {
          const isCurrentRank = currentHand?.rank === info.rank;
          return (
            <div
              key={info.rank}
              className={`flex items-center justify-between px-2 py-0.5 rounded text-[11px] transition-colors ${
                isCurrentRank
                  ? "bg-primary/15 text-primary font-bold"
                  : "text-muted-foreground"
              }`}
            >
              <span>{info.nameKr}</span>
              <div className="flex gap-px">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-1 h-2.5 rounded-sm ${
                      i <= info.rank
                        ? isCurrentRank
                          ? "bg-primary"
                          : "bg-muted-foreground/30"
                        : "bg-muted/50"
                    }`}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ActionButtons({
  state,
  myPlayer,
  canCheck,
  callAmount,
  canRaise,
  onAction,
}: {
  state: HoldemPublicState;
  myPlayer: Omit<HoldemPlayerState, "holeCards">;
  canCheck: boolean;
  callAmount: number;
  canRaise: boolean;
  onAction: (action: HoldemAction, amount?: number) => void;
}) {
  const [raiseAmount, setRaiseAmount] = useState(0);
  const effectiveRaise = raiseAmount || state.minRaise;

  return (
    <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-5 py-3">
      <button
        onClick={() => onAction("fold")}
        className="bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/20 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
      >
        폴드
      </button>

      {canCheck ? (
        <button
          onClick={() => onAction("check")}
          className="bg-secondary hover:bg-secondary/80 text-foreground border border-border px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          체크
        </button>
      ) : (
        <button
          onClick={() => onAction("call")}
          className="bg-blue-600/15 hover:bg-blue-600/25 text-blue-500 border border-blue-500/20 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          콜 ({callAmount})
        </button>
      )}

      {canRaise && (
        <div className="flex items-center gap-2 border-l border-border pl-3">
          <input
            type="range"
            min={state.minRaise}
            max={myPlayer.chips + myPlayer.currentBet}
            value={effectiveRaise}
            onChange={(e) => setRaiseAmount(parseInt(e.target.value))}
            className="w-28 accent-primary"
          />
          <span className="text-xs text-muted-foreground font-mono w-12 text-right">
            {effectiveRaise}
          </span>
          <button
            onClick={() => onAction("raise", effectiveRaise)}
            className="bg-primary/15 hover:bg-primary/25 text-primary border border-primary/20 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            레이즈
          </button>
        </div>
      )}

      {myPlayer.chips > 0 && (
        <button
          onClick={() => onAction("all-in")}
          className="bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-500 hover:to-orange-400 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-md"
        >
          올인 ({myPlayer.chips})
        </button>
      )}
    </div>
  );
}

function PlayerSeat({
  player,
  isMe,
  totalPlayers,
  index,
  privateState,
}: {
  player: Omit<HoldemPlayerState, "holeCards">;
  isMe: boolean;
  totalPlayers: number;
  index: number;
  privateState: { holeCards: Card[] } | null;
}) {
  const angle = (index / totalPlayers) * Math.PI * 2 - Math.PI / 2;
  const rx = 280;
  const ry = 150;
  const x = Math.cos(angle) * rx;
  const y = Math.sin(angle) * ry;

  return (
    <div
      className="absolute flex flex-col items-center"
      style={{
        left: `calc(50% + ${x}px)`,
        top: `calc(50% + ${y}px)`,
        transform: "translate(-50%, -50%)",
      }}
    >
      {/* Player info card */}
      <div
        className={`px-3 py-2 rounded-xl border text-xs font-medium whitespace-nowrap shadow-lg transition-all ${
          player.folded
            ? "bg-muted/50 border-muted text-muted-foreground opacity-50"
            : player.isTurn
            ? "bg-primary/15 border-primary text-primary ring-2 ring-primary/30 ring-offset-1 ring-offset-transparent"
            : isMe
            ? "bg-card border-primary/40 text-foreground"
            : "bg-card border-border text-foreground"
        }`}
      >
        <div className="flex items-center gap-1.5">
          {player.isDealer && (
            <span className="bg-yellow-400 text-yellow-900 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black shadow-sm">
              D
            </span>
          )}
          <span className={`font-semibold ${player.folded ? "line-through" : ""}`}>
            {player.nickname}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1 text-[10px]">
          <span className="text-muted-foreground font-mono">{player.chips}</span>
          {player.currentBet > 0 && (
            <span className="text-primary font-semibold">
              +{player.currentBet}
            </span>
          )}
          {player.isAllIn && (
            <span className="text-red-500 font-black tracking-wider animate-pulse">
              ALL IN
            </span>
          )}
        </div>
      </div>

      {/* Hole cards */}
      {isMe && privateState && (
        <div className="flex gap-1 mt-1.5">
          {privateState.holeCards.map((card, ci) => (
            <CardDisplay key={ci} card={card} size="sm" />
          ))}
        </div>
      )}
      {!isMe && !player.folded && (
        <div className="flex gap-0.5 mt-1 scale-[0.6] origin-top">
          <CardDisplay faceDown size="sm" />
          <CardDisplay faceDown size="sm" />
        </div>
      )}
    </div>
  );
}

export default function HoldemTable({ roomId }: GameComponentProps) {
  const { socket } = useSocket();
  const { gameState, privateState, makeMove } = useGame(socket);

  const state = gameState as HoldemPublicState | null;
  if (!state) return null;

  const myIndex = state.players.findIndex((p) => p.id === socket?.id);
  const isMyTurn = myIndex === state.currentPlayerIndex;
  const myPlayer = state.players[myIndex];
  const canCheck = myPlayer && myPlayer.currentBet >= state.currentBet;
  const callAmount = myPlayer ? state.currentBet - myPlayer.currentBet : 0;
  const canRaise = myPlayer && myPlayer.chips + myPlayer.currentBet > state.minRaise;

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

  const phaseColors: Record<string, string> = {
    preflop: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    flop: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    turn: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    river: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    showdown: "bg-red-500/10 text-red-400 border-red-500/20",
  };

  return (
    <div className="flex gap-6 justify-center">
      {/* Left panel - Hand rank */}
      {privateState && (
        <HandRankPanel
          holeCards={privateState.holeCards}
          communityCards={state.communityCards}
        />
      )}

      {/* Main area */}
      <div className="flex flex-col items-center gap-5">
        {/* Phase & Pot bar */}
        <div className="flex items-center gap-4 bg-card border border-border rounded-xl px-5 py-2.5">
          <span className={`px-3 py-1 rounded-lg text-xs font-semibold border ${phaseColors[state.phase] || ""}`}>
            {phaseLabel[state.phase] || state.phase}
          </span>
          <div className="h-5 w-px bg-border" />
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">POT</span>
            <span className="font-bold text-lg text-primary font-mono">{state.pot}</span>
          </div>
          <div className="h-5 w-px bg-border" />
          <span className="text-muted-foreground text-xs font-mono">
            SB/BB {state.smallBlind}/{state.bigBlind}
          </span>
        </div>

        {/* Table */}
        <div className="relative w-[640px] h-[360px] bg-gradient-to-br from-green-800 to-green-900 rounded-[50%] border-[6px] border-green-700/80 shadow-[0_0_60px_rgba(0,0,0,0.5),inset_0_2px_30px_rgba(0,0,0,0.3)] flex items-center justify-center">
          {/* Table felt pattern */}
          <div className="absolute inset-4 rounded-[50%] border border-green-600/20" />

          {/* Pot display on table */}
          <div className="absolute top-8 flex flex-col items-center">
            <span className="text-green-300/60 text-[10px] font-semibold tracking-widest">POT</span>
            <span className="text-white font-bold text-lg font-mono drop-shadow-md">{state.pot}</span>
          </div>

          {/* Community cards */}
          <div className="flex gap-2">
            {state.communityCards.map((card, i) => (
              <CardDisplay key={i} card={card} />
            ))}
            {Array.from({ length: 5 - state.communityCards.length }).map(
              (_, i) => (
                <div
                  key={`empty-${i}`}
                  className="w-14 h-20 border border-green-600/20 rounded-lg bg-green-900/30"
                />
              )
            )}
          </div>

          {/* Players around table */}
          {state.players.map((player, i) => (
            <PlayerSeat
              key={player.id}
              player={player}
              isMe={player.id === socket?.id}
              totalPlayers={state.players.length}
              index={i}
              privateState={player.id === socket?.id ? privateState : null}
            />
          ))}
        </div>

        {/* Action buttons */}
        {isMyTurn && state.phase !== "showdown" && myPlayer && !myPlayer.folded && (
          <ActionButtons
            key={state.currentPlayerIndex}
            state={state}
            myPlayer={myPlayer}
            canCheck={canCheck}
            callAmount={callAmount}
            canRaise={canRaise}
            onAction={handleAction}
          />
        )}

        {/* Winners */}
        {state.winners && (
          <div className="bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border border-yellow-500/30 rounded-xl px-6 py-4 text-center shadow-lg">
            {state.winners.map((w, i) => (
              <p key={i} className="text-lg font-bold text-yellow-400">
                {w.handName}(으)로 {w.amount} 획득!
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
