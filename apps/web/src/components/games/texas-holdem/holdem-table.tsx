"use client";

import { useGame } from "@/hooks/use-game";
import { useSocket } from "@/hooks/use-socket";
import type {
  HoldemPublicState,
  HoldemPrivateState,
  HoldemMove,
  HoldemAction,
} from "@game-hub/shared-types";
import type { GameComponentProps } from "@/lib/game-registry";
import { CardDisplay } from "./card-display";
import { PlayerSeat } from "./player-seat";
import { ActionButtons } from "./action-buttons";
import { HandRankPanel } from "./hand-rank-panel";
import { RoundResultOverlay } from "./round-result-overlay";

export default function HoldemTable({ roomId: _roomId }: GameComponentProps) {
  const { socket } = useSocket();
  const { gameState, privateState: rawPrivateState, roundResult, makeMove } = useGame(socket);
  const privateState = rawPrivateState as HoldemPrivateState | null;

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
        {/* Phase & Pot & Round bar */}
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
          {state.roundNumber > 1 && (
            <>
              <div className="h-5 w-px bg-border" />
              <span className="text-xs text-muted-foreground font-mono">
                R{state.roundNumber}
              </span>
            </>
          )}
        </div>

        {/* Table with wood rail */}
        <div className="relative p-3 bg-gradient-to-b from-amber-800 to-amber-950 rounded-[55%] shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
          <div className="relative w-[800px] h-[440px] bg-gradient-to-br from-green-700 via-green-800 to-green-900 rounded-[50%] border-[3px] border-green-600/40 shadow-[inset_0_2px_40px_rgba(0,0,0,0.4)] flex items-center justify-center max-[900px]:scale-90 max-[750px]:scale-75 origin-center">
            {/* Felt inner border */}
            <div className="absolute inset-5 rounded-[50%] border border-green-600/15" />

            {/* Community card zone */}
            <div className="absolute inset-x-[28%] inset-y-[30%] rounded-[50%] bg-green-900/40 border border-green-700/20" />

            {/* Pot display on table */}
            <div className="absolute top-10 flex flex-col items-center">
              <span className="text-green-300/60 text-[10px] font-semibold tracking-widest">POT</span>
              <div className="flex items-center gap-1.5">
                <div className="w-3.5 h-3.5 rounded-full bg-gradient-to-b from-yellow-300 to-yellow-600 border border-yellow-700 shadow-sm" />
                <span className="text-white font-bold text-lg font-mono drop-shadow-md">{state.pot}</span>
              </div>
            </div>

            {/* Community cards — key includes phase+round to re-trigger animation on new cards */}
            <div className="flex gap-2">
              {state.communityCards.map((card, i) => (
                <CardDisplay
                  key={`${state.roundNumber}-${state.phase}-${card.suit}-${card.rank}`}
                  card={card}
                  animate="flip"
                  animationDelay={i * 0.15}
                />
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
                myIndex={myIndex}
                index={i}
                privateState={player.id === socket?.id ? privateState : null}
                showdownCards={state.showdownCards}
                isWinner={!!state.winners?.some((w) => w.playerId === player.id)}
                cardAnimation={state.showdownCards?.[player.id] ? "flip" : state.phase === "preflop" ? "deal" : "none"}
                animationDelay={i * 0.2}
              />
            ))}

            {/* Round result overlay */}
            {roundResult && (
              <RoundResultOverlay
                roundResult={roundResult}
                players={state.players.map((p) => ({ id: p.id, nickname: p.nickname }))}
              />
            )}
          </div>
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

        {/* Winners display (final game end) */}
        {state.winners && !roundResult && (
          <div className="bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border border-yellow-500/30 rounded-xl px-6 py-4 text-center shadow-lg">
            {state.winners.map((w, i) => {
              const winnerPlayer = state.players.find((p) => p.id === w.playerId);
              return (
                <p key={i} className="text-lg font-bold text-yellow-400">
                  {winnerPlayer?.nickname} - {w.handName}(으)로 {w.amount} 획득!
                </p>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
