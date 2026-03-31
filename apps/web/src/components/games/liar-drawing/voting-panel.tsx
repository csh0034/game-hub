"use client";

import { useState } from "react";
import type { LiarDrawingPublicState } from "@game-hub/shared-types";
import { DrawingCanvas } from "./drawing-canvas";

interface VotingPanelProps {
  state: LiarDrawingPublicState;
  myId: string;
  onVote: (targetPlayerId: string) => void;
  isSpectating?: boolean;
}

export function VotingPanel({ state, myId, onVote, isSpectating }: VotingPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const hasVoted = state.votedPlayerIds.includes(myId);

  const handleVote = () => {
    if (selectedId && !hasVoted) {
      onVote(selectedId);
    }
  };

  return (
    <div className="flex flex-col items-center gap-5 phase-fade-up">
      {/* 헤더 */}
      <div className="text-center">
        <div className="text-2xl font-display font-bold tracking-wide text-glow-cyan mb-1">🔍 VOTE</div>
        <div className="text-sm text-muted-foreground">라이어를 찾아주세요!</div>
      </div>

      {/* 투표 현황 바 */}
      <div className="flex items-center gap-3">
        <div className="flex gap-1">
          {state.players.map((p) => (
            <div
              key={p.id}
              className={`w-2.5 h-2.5 rounded-full transition-colors ${
                state.votedPlayerIds.includes(p.id) ? "bg-primary neon-glow-cyan" : "bg-border"
              }`}
            />
          ))}
        </div>
        <span className="text-xs text-muted-foreground font-mono tabular-nums">
          {state.votedPlayerIds.length}/{state.players.length}
        </span>
      </div>

      {/* 플레이어 카드 그리드 */}
      <div className="flex flex-wrap justify-center gap-3">
        {state.players.map((player) => {
          const isMe = player.id === myId;
          const isSelected = selectedId === player.id;
          const canSelect = !isMe && !hasVoted;

          return (
            <button
              key={player.id}
              onClick={() => canSelect && setSelectedId(player.id)}
              disabled={isMe || hasVoted}
              className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                isSelected
                  ? "border-primary bg-primary/10 neon-glow-cyan scale-[1.03]"
                  : isMe
                    ? "border-border/30 bg-card/30 opacity-40 cursor-not-allowed"
                    : hasVoted
                      ? "border-border/50 bg-card/30 cursor-default"
                      : "border-border/50 bg-card/30 hover:border-primary/40 hover:bg-primary/5 cursor-pointer"
              }`}
            >
              <div className={`rounded-lg overflow-hidden ${isSelected ? "ring-2 ring-primary/30" : ""}`}>
                <DrawingCanvas
                  points={state.canvases[player.id] || []}
                  isMyTurn={false}
                  tool="pen"
                  color="black"
                  thickness={5}
                  readOnly
                  size={120}
                />
              </div>
              <div className={`text-xs font-medium ${isSelected ? "text-primary" : isMe ? "text-muted-foreground" : "text-foreground"}`}>
                {player.nickname}
                {isMe && " (나)"}
              </div>
            </button>
          );
        })}
      </div>

      {/* 투표 버튼 */}
      {isSpectating ? (
        <div className="text-sm text-muted-foreground">관전 중입니다</div>
      ) : !hasVoted ? (
        <button
          onClick={handleVote}
          disabled={!selectedId}
          className="px-8 py-2.5 rounded-xl text-sm font-display font-medium tracking-wide transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-gradient-to-r from-neon-cyan to-neon-purple text-primary-foreground hover:shadow-[0_0_20px_rgba(0,229,255,0.3)]"
        >
          {selectedId
            ? `${state.players.find((p) => p.id === selectedId)?.nickname}에게 투표`
            : "투표 대상을 선택하세요"}
        </button>
      ) : (
        <div className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-primary/20 bg-primary/5 text-sm">
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span className="text-muted-foreground">투표 완료! 다른 플레이어를 기다리는 중...</span>
        </div>
      )}
    </div>
  );
}
