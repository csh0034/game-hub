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
    <div className="flex flex-col items-center gap-4">
      <div className="text-lg font-display font-bold tracking-wide text-glow-cyan">라이어를 찾아주세요!</div>
      <div className="text-sm text-muted-foreground">
        투표 현황: {state.votedPlayerIds.length} / {state.players.length}
      </div>

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
              className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-colors ${
                isSelected
                  ? "border-primary bg-primary/10"
                  : isMe
                    ? "border-border opacity-50 cursor-not-allowed"
                    : hasVoted
                      ? "border-border cursor-default"
                      : "border-border hover:border-primary/50 cursor-pointer"
              }`}
            >
              <DrawingCanvas
                points={state.canvases[player.id] || []}
                isMyTurn={false}
                tool="pen"
                color="black"
                thickness={5}
                readOnly
                size={120}
              />
              <div className="text-xs font-medium">
                {player.nickname}
                {isMe && " (나)"}
              </div>
            </button>
          );
        })}
      </div>

      {isSpectating ? (
        <div className="text-sm text-muted-foreground">관전 중입니다</div>
      ) : !hasVoted ? (
        <button
          onClick={handleVote}
          disabled={!selectedId}
          className="px-6 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
        >
          {selectedId
            ? `${state.players.find((p) => p.id === selectedId)?.nickname}에게 투표`
            : "투표 대상을 선택하세요"}
        </button>
      ) : (
        <div className="text-sm text-muted-foreground">투표 완료! 다른 플레이어를 기다리는 중...</div>
      )}
    </div>
  );
}
