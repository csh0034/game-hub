"use client";

import type { HoldemPlayerState, Card } from "@game-hub/shared-types";
import { CardDisplay } from "./card-display";
import type { CardAnimation } from "./card-display";

export function PlayerSeat({
  player,
  isMe,
  totalPlayers,
  myIndex,
  index,
  privateState,
  showdownCards,
  isWinner,
  cardAnimation,
  animationDelay,
}: {
  player: Omit<HoldemPlayerState, "holeCards">;
  isMe: boolean;
  totalPlayers: number;
  myIndex: number;
  index: number;
  privateState: { holeCards: Card[] } | null;
  showdownCards?: Record<string, Card[]>;
  isWinner: boolean;
  cardAnimation: CardAnimation;
  animationDelay: number;
}) {
  // Position my seat at bottom center, others clockwise from there
  const nonEliminatedOffset = (() => {
    // Compute relative position: myIndex is always at bottom
    const relativeIndex = (index - myIndex + totalPlayers) % totalPlayers;
    const angle = (relativeIndex / totalPlayers) * Math.PI * 2 - Math.PI / 2;
    return angle;
  })();

  const angle = myIndex >= 0 ? nonEliminatedOffset : (index / totalPlayers) * Math.PI * 2 - Math.PI / 2;
  const rx = 340;
  const ry = 185;
  const x = Math.cos(angle) * rx;
  const y = Math.sin(angle) * ry;

  const playerCards = showdownCards?.[player.id];
  const showFaceUp = isMe ? !!privateState : !!playerCards;
  const cards = isMe ? privateState?.holeCards : playerCards;

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
          player.eliminated
            ? "bg-muted/30 border-muted text-muted-foreground opacity-30"
            : player.folded
            ? "bg-muted/50 border-muted text-muted-foreground opacity-50"
            : player.isTurn
            ? "bg-primary/15 border-primary text-primary ring-2 ring-primary/30 ring-offset-1 ring-offset-transparent"
            : isMe
            ? "bg-card border-primary/40 text-foreground"
            : "bg-card border-border text-foreground"
        } ${isWinner ? "animate-[winner-glow_1.5s_ease-in-out_infinite]" : ""}`}
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
          {player.eliminated && (
            <span className="text-[9px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded font-bold">
              OUT
            </span>
          )}
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

      {/* Betting chip display between player and center */}
      {player.currentBet > 0 && !player.eliminated && (
        <div
          className="absolute flex items-center gap-1"
          style={{
            left: "50%",
            top: "50%",
            transform: `translate(calc(-50% + ${-x * 0.3}px), calc(-50% + ${-y * 0.3}px))`,
          }}
        >
          <div className="w-4 h-4 rounded-full bg-gradient-to-b from-yellow-300 to-yellow-600 border border-yellow-700 shadow-sm" />
          <span className="text-[10px] text-yellow-300 font-bold drop-shadow-md">{player.currentBet}</span>
        </div>
      )}

      {/* Hole cards */}
      {!player.eliminated && !player.folded && showFaceUp && cards && (
        <div className="flex gap-1 mt-1.5">
          {cards.map((card, ci) => (
            <CardDisplay
              key={ci}
              card={card}
              size="sm"
              animate={cardAnimation}
              animationDelay={animationDelay + ci * 0.15}
            />
          ))}
        </div>
      )}
      {!player.eliminated && !isMe && !player.folded && !playerCards && (
        <div className="flex gap-0.5 mt-1 scale-[0.6] origin-top">
          <CardDisplay
            faceDown
            size="sm"
            animate={cardAnimation}
            animationDelay={animationDelay}
          />
          <CardDisplay
            faceDown
            size="sm"
            animate={cardAnimation}
            animationDelay={animationDelay + 0.1}
          />
        </div>
      )}
    </div>
  );
}
