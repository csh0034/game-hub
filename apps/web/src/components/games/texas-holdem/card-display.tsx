"use client";

import type { Card } from "@game-hub/shared-types";

const SUIT_SYMBOL: Record<string, string> = {
  hearts: "\u2665",
  diamonds: "\u2666",
  clubs: "\u2663",
  spades: "\u2660",
};

export type CardAnimation = "deal" | "flip" | "fold" | "none";

const animationStyles: Record<CardAnimation, string> = {
  deal: "animate-[card-deal_0.4s_ease-out_both]",
  flip: "animate-[card-flip_0.5s_ease-in-out_both]",
  fold: "animate-[card-fold-out_0.3s_ease-in_forwards]",
  none: "",
};

export function CardDisplay({
  card,
  faceDown = false,
  size = "md",
  animate = "none",
  animationDelay = 0,
}: {
  card?: Card;
  faceDown?: boolean;
  size?: "sm" | "md" | "lg";
  animate?: CardAnimation;
  animationDelay?: number;
}) {
  const sizeClasses = {
    sm: "w-10 h-14 text-xs",
    md: "w-14 h-20 text-sm",
    lg: "w-16 h-[88px] text-base",
  };

  const style: React.CSSProperties = animationDelay > 0
    ? { animationDelay: `${animationDelay}s` }
    : {};

  if (!card || faceDown) {
    return (
      <div
        className={`${sizeClasses[size]} bg-gradient-to-br from-blue-800 to-blue-950 border border-blue-600 rounded-lg flex items-center justify-center shadow-md ${animationStyles[animate]}`}
        style={{ ...style, perspective: "600px", backfaceVisibility: "hidden" }}
      >
        <span className="text-blue-400 font-bold">?</span>
      </div>
    );
  }

  const isRed = card.suit === "hearts" || card.suit === "diamonds";
  const color = isRed ? "text-red-600" : "text-gray-900";

  return (
    <div
      className={`${sizeClasses[size]} bg-white rounded-lg border border-gray-300 flex flex-col items-center justify-center shadow-md hover:shadow-lg transition-shadow ${animationStyles[animate]}`}
      style={{ ...style, perspective: "600px", backfaceVisibility: "hidden" }}
    >
      <span className={`font-bold ${color}`}>{card.rank}</span>
      <span className={`${size === "sm" ? "text-base" : "text-lg"} ${color} -mt-0.5`}>
        {SUIT_SYMBOL[card.suit]}
      </span>
    </div>
  );
}
