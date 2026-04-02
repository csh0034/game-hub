"use client";

import { useMemo, useState, useEffect, useRef, memo, useCallback } from "react";
import { useGame } from "@/hooks/use-game";
import { useSocket } from "@/hooks/use-socket";
import { useTetrisInput } from "@/hooks/use-tetris-input";
import { useTetrisBoardStore } from "@/stores/tetris-board-store";
import { useLobbyStore } from "@/stores/lobby-store";
import { OpponentCanvas } from "./opponent-canvas";
import {
  TETROMINO_SHAPES,
  getPieceCells,
  tryMove,
  tryRotate,
  calculateGhostRow,
  SPEED_RACE_TARGET_LINES,
} from "@game-hub/shared-types";
import type {
  TetrisPlayerBoard,
  TetrisDifficulty,
  TetrominoType,
  TetrisActivePiece,
} from "@game-hub/shared-types";
import type { GameComponentProps } from "@/lib/game-registry";

const TETROMINO_COLORS: Record<TetrominoType, string> = {
  I: "bg-cyan-400",
  O: "bg-yellow-400",
  T: "bg-purple-500",
  S: "bg-green-500",
  Z: "bg-red-500",
  J: "bg-blue-600",
  L: "bg-orange-500",
};

const TETROMINO_BORDER_COLORS: Record<TetrominoType, string> = {
  I: "border-cyan-300",
  O: "border-yellow-300",
  T: "border-purple-400",
  S: "border-green-400",
  Z: "border-red-400",
  J: "border-blue-500",
  L: "border-orange-400",
};

// Phase 1-1: React.memo for MiniPiecePreview (primitive props → shallow compare sufficient)
const MiniPiecePreview = memo(function MiniPiecePreview({ type, size = "normal" }: { type: TetrominoType | null; size?: "normal" | "small" }) {
  const boxClass = size === "small" ? "w-10 h-10" : "w-16 h-16";
  const cellPx = size === "small" ? 8 : 12;
  const cellClass = size === "small" ? "w-2 h-2" : "w-3 h-3";

  if (!type) {
    return <div className={`${boxClass} rounded-lg border border-border/30 bg-black/30`} />;
  }

  const cells = TETROMINO_SHAPES[type][0];
  const minR = Math.min(...cells.map(([r]) => r));
  const maxR = Math.max(...cells.map(([r]) => r));
  const minC = Math.min(...cells.map(([, c]) => c));
  const maxC = Math.max(...cells.map(([, c]) => c));
  const h = maxR - minR + 1;
  const w = maxC - minC + 1;

  return (
    <div className={`${boxClass} rounded-lg border border-border/30 bg-black/30 flex items-center justify-center`}>
      <div
        className="grid gap-px"
        style={{
          gridTemplateColumns: `repeat(${w}, ${cellPx}px)`,
          gridTemplateRows: `repeat(${h}, ${cellPx}px)`,
        }}
      >
        {Array.from({ length: h }, (_, r) =>
          Array.from({ length: w }, (_, c) => {
            const isFilled = cells.some(([cr, cc]) => cr - minR === r && cc - minC === c);
            return (
              <div
                key={`${r}-${c}`}
                className={`${cellClass} ${isFilled ? `${TETROMINO_COLORS[type]} border ${TETROMINO_BORDER_COLORS[type]}` : "bg-transparent"}`}
              />
            );
          }),
        )}
      </div>
    </div>
  );
});

// Phase 1-2: React.memo for PlayerBoard with custom comparator
const PlayerBoard = memo(function PlayerBoard({
  board,
  cellSize,
  compact,
  nickname,
  resultOverlay,
  dropInterval,
  isSpeedRace,
  elapsedTime,
}: {
  board: TetrisPlayerBoard;
  cellSize: number;
  compact?: boolean;
  nickname?: string;
  resultOverlay?: React.ReactNode;
  dropInterval?: number;
  isSpeedRace?: boolean;
  elapsedTime?: number;
}) {
  const previewSize = compact ? "small" as const : "normal" as const;

  // Phase 1-3: useMemo for displayGrid
  const displayGrid = useMemo(() => {
    const grid: { type: TetrominoType | null; isGhost: boolean; isActive: boolean }[][] =
      board.board.map((row) => row.map((cell) => ({ type: cell, isGhost: false, isActive: false })));

    if (board.activePiece) {
      // Ghost piece (only for own board)
      if (!compact) {
        const ghostPiece: TetrisActivePiece = { ...board.activePiece, row: board.ghostRow };
        const ghostCells = getPieceCells(ghostPiece);
        for (const [r, c] of ghostCells) {
          if (r >= 0 && r < 20 && c >= 0 && c < 10 && !grid[r][c].type) {
            grid[r][c] = { type: board.activePiece.type, isGhost: true, isActive: false };
          }
        }
      }

      // Active piece
      const activeCells = getPieceCells(board.activePiece);
      for (const [r, c] of activeCells) {
        if (r >= 0 && r < 20 && c >= 0 && c < 10) {
          grid[r][c] = { type: board.activePiece.type, isGhost: false, isActive: true };
        }
      }
    }

    return grid;
  }, [board.board, board.activePiece, board.ghostRow, compact]);

  const textSm = compact ? "text-[10px]" : "text-xs";
  const textLg = compact ? "text-sm" : "text-lg";

  const prevLinesClearedRef = useRef(board.linesCleared);
  const [isPulsing, setIsPulsing] = useState(false);
  const remaining = SPEED_RACE_TARGET_LINES - board.linesCleared;
  const speedRaceColors = getSpeedRaceProgress(board.linesCleared);

  useEffect(() => {
    if (isSpeedRace && board.linesCleared !== prevLinesClearedRef.current && board.linesCleared > 0) {
      const startTimer = setTimeout(() => setIsPulsing(true), 0);
      const endTimer = setTimeout(() => setIsPulsing(false), 300);
      prevLinesClearedRef.current = board.linesCleared;
      return () => { clearTimeout(startTimer); clearTimeout(endTimer); };
    }
    prevLinesClearedRef.current = board.linesCleared;
  }, [board.linesCleared, isSpeedRace]);

  return (
    <div className="flex gap-3">
      {/* Left panel: Hold */}
      {!compact && (
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-[10px] text-primary/60 font-display font-semibold tracking-widest uppercase">Hold</span>
          <div className={`rounded-lg border p-1 ${board.canHold === false ? "border-muted/20 opacity-40" : "border-primary/20 bg-black/20"}`}>
            <MiniPiecePreview type={board.holdPiece} size={previewSize} />
          </div>
        </div>
      )}

      {/* Board */}
      <div className="flex flex-col items-center gap-1">
        {nickname && <span className={`${textSm} text-primary font-display font-medium tracking-wide`}>{nickname}</span>}
        <div
          className="border border-primary/15 rounded-lg bg-black/40 relative shadow-[0_0_12px_rgba(34,211,238,0.06)]"
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(10, ${cellSize}px)`,
            gridTemplateRows: `repeat(20, ${cellSize}px)`,
          }}
        >
          {displayGrid.map((row, r) =>
            row.map((cell, c) => {
              let className = "border border-white/5 ";
              if (cell.type && cell.isGhost) {
                className += `${TETROMINO_COLORS[cell.type]} opacity-20 ${TETROMINO_BORDER_COLORS[cell.type]}`;
              } else if (cell.type) {
                className += `${TETROMINO_COLORS[cell.type]} border ${TETROMINO_BORDER_COLORS[cell.type]}`;
              } else {
                className += "bg-white/[0.02]";
              }
              return (
                <div
                  key={`${r}-${c}`}
                  className={className}
                  style={{ width: cellSize, height: cellSize }}
                />
              );
            }),
          )}
          {board.status === "gameover" && !resultOverlay && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-lg">
              <span className={`text-foreground font-display font-bold ${compact ? "text-xs" : "text-lg"}`}>GAME OVER</span>
            </div>
          )}
          {resultOverlay}
        </div>
      </div>

      {/* Right panel: Next + Stats */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col items-center gap-1.5">
          <span className={`text-[10px] text-primary/60 font-display font-semibold tracking-widest uppercase`}>Next</span>
          {board.nextPieces.map((type, i) => (
            <MiniPiecePreview key={i} type={type} size={previewSize} />
          ))}
        </div>

        <div className="rounded-lg border border-primary/15 bg-black/20 px-3 py-2 space-y-2 min-w-[7rem]">
          {isSpeedRace ? (
            <>
              <div className="text-center">
                <div className={`${textSm} text-primary/50 font-display tracking-widest uppercase`}>Time</div>
                <div className={`${textLg} font-bold font-mono text-foreground`}>{((elapsedTime ?? 0) / 1000).toFixed(3)}<span className="text-muted-foreground text-xs">s</span></div>
              </div>
              <div className="text-center">
                <div className={`${textSm} text-primary/50 font-display tracking-widest uppercase`}>Left</div>
                <div className={`${compact ? "text-xl" : "text-2xl"} font-bold font-mono transition-transform duration-200 ${isPulsing ? "scale-125" : "scale-100"} ${speedRaceColors.text}`}>
                  {remaining}
                </div>
                <div className="text-[10px] font-mono text-muted-foreground">
                  {board.linesCleared}/{SPEED_RACE_TARGET_LINES}
                </div>
              </div>
              <div className="w-full bg-black/40 rounded-full h-3 border border-primary/10">
                <div
                  className={`${speedRaceColors.bar} h-full rounded-full transition-all duration-300 ${speedRaceColors.glow ? "shadow-[0_0_8px_rgba(74,222,128,0.5)]" : ""}`}
                  style={{ width: `${Math.min((board.linesCleared / SPEED_RACE_TARGET_LINES) * 100, 100)}%` }}
                />
              </div>
              <div className="text-center">
                <div className={`${textSm} text-primary/50 font-display tracking-widest uppercase`}>Level</div>
                <div className={`${textLg} font-bold font-mono text-foreground`}>{board.level}</div>
              </div>
            </>
          ) : (
            <>
              <div className="text-center">
                <div className={`${textSm} text-primary/50 font-display tracking-widest uppercase`}>Score</div>
                <div className={`${textLg} font-bold font-mono text-foreground`}>{board.score.toLocaleString()}</div>
              </div>
              <div className="text-center">
                <div className={`${textSm} text-primary/50 font-display tracking-widest uppercase`}>Level</div>
                <div className={`${textLg} font-bold font-mono text-foreground`}>{board.level}</div>
              </div>
              {dropInterval != null && (
                <div className="text-center">
                  <div className={`${textSm} text-primary/50 font-display tracking-widest uppercase`}>Speed</div>
                  <div className={`${textLg} font-bold font-mono text-foreground`}>{(dropInterval / 1000).toFixed(2)}<span className="text-muted-foreground text-xs">s</span></div>
                </div>
              )}
              <div className="text-center">
                <div className={`${textSm} text-primary/50 font-display tracking-widest uppercase`}>Lines</div>
                <div className={`${textLg} font-bold font-mono text-foreground`}>{board.linesCleared}</div>
              </div>
              <div className="text-center">
                <div className={`${textSm} text-primary/50 font-display tracking-widest uppercase`}>Time</div>
                <div className={`${textLg} font-bold font-mono text-foreground`}>{((elapsedTime ?? 0) / 1000).toFixed(3)}<span className="text-muted-foreground text-xs">s</span></div>
              </div>
            </>
          )}
        </div>

        {/* Status indicators */}
        <div className="flex flex-col items-center gap-1">
          {board.pendingGarbage > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20">
              <div className={`${textSm} text-red-400 font-display tracking-wider`}>GARBAGE</div>
              <div className={`${textSm} font-bold font-mono text-red-400`}>{board.pendingGarbage}</div>
            </div>
          )}
          {board.combo > 1 && (
            <div className="px-2 py-0.5 rounded bg-neon-yellow/10 border border-neon-yellow/20">
              <span className={`${textSm} font-bold font-mono text-neon-yellow`}>{board.combo}x COMBO</span>
            </div>
          )}
          {board.backToBack && (
            <div className="px-2 py-0.5 rounded bg-neon-purple/10 border border-neon-purple/20">
              <span className={`${textSm} text-neon-purple font-display font-bold tracking-wider`}>B2B</span>
            </div>
          )}
          {board.lastClearType && (
            <div className="px-2 py-0.5 rounded bg-success/10 border border-success/20">
              <span className={`${textSm} text-success font-display font-bold uppercase tracking-wider`}>
                {board.lastClearType.replace(/-/g, " ")}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}, (prev, next) => {
  if (prev.cellSize !== next.cellSize) return false;
  if (prev.compact !== next.compact) return false;
  if (prev.nickname !== next.nickname) return false;
  if (prev.resultOverlay !== next.resultOverlay) return false;
  if (prev.dropInterval !== next.dropInterval) return false;
  if (prev.isSpeedRace !== next.isSpeedRace) return false;
  if (prev.elapsedTime !== next.elapsedTime) return false;
  if (prev.board.version !== next.board.version) return false;
  // Check prediction changes (activePiece/ghostRow may differ with same version)
  if (prev.board.activePiece !== next.board.activePiece) return false;
  if (prev.board.ghostRow !== next.board.ghostRow) return false;
  if (prev.board.canHold !== next.board.canHold) return false;
  if (prev.board.holdPiece !== next.board.holdPiece) return false;
  return true;
});

function getSpeedRaceProgress(linesCleared: number) {
  const remaining = SPEED_RACE_TARGET_LINES - linesCleared;
  if (remaining <= 5) return { text: "text-green-400", bar: "bg-gradient-to-r from-green-400 to-emerald-300", glow: true };
  if (remaining <= 10) return { text: "text-green-400", bar: "bg-gradient-to-r from-neon-yellow to-green-400", glow: false };
  if (remaining <= 20) return { text: "text-neon-yellow", bar: "bg-gradient-to-r from-primary to-neon-yellow", glow: false };
  return { text: "text-primary", bar: "bg-gradient-to-r from-primary to-neon-purple", glow: false };
}

const DIFFICULTY_CONFIGS = {
  beginner: { baseInterval: 800, startLevel: 1 },
  intermediate: { baseInterval: 600, startLevel: 1 },
  expert: { baseInterval: 400, startLevel: 5 },
} as const;

function calculateDropInterval(difficulty: TetrisDifficulty, maxLevel: number): number {
  const config = DIFFICULTY_CONFIGS[difficulty];
  return Math.max(config.baseInterval - (maxLevel - config.startLevel) * 50, 100);
}

function getOpponentCellSize(count: number): number {
  if (count <= 1) return 16;
  if (count <= 2) return 14;
  if (count <= 3) return 12;
  if (count <= 5) return 10;
  return 8;
}

export default function TetrisBoard({ isSpectating }: GameComponentProps) {
  const { socket } = useSocket();
  // useGame is still needed for socket event listening
  const { gameResult, makeMove } = useGame(socket);

  const roomPlayers = useLobbyStore((s) => s.currentRoom?.players ?? []);

  // Tetris board store: fine-grained per-player subscriptions
  const myBoard = useTetrisBoardStore((s) => s.myBoard);
  const opponentBoards = useTetrisBoardStore((s) => s.opponentBoards);
  const difficulty = useTetrisBoardStore((s) => s.difficulty);
  const gameMode = useTetrisBoardStore((s) => s.gameMode);
  const startedAt = useTetrisBoardStore((s) => s.startedAt);

  const isSpeedRace = gameMode === "speed-race";

  // Elapsed time
  const [elapsedTime, setElapsedTime] = useState(0);
  const gameEndedRef = useRef(false);
  const gameStartRef = useRef<{ localStart: number; key: number } | null>(null);

  useEffect(() => {
    gameEndedRef.current = !!gameResult;
  }, [gameResult]);

  useEffect(() => {
    if (!startedAt) return;

    if (!gameStartRef.current || gameStartRef.current.key !== startedAt) {
      gameStartRef.current = { localStart: Date.now(), key: startedAt };
    }

    const timer = setInterval(() => {
      if (gameEndedRef.current) return;
      setElapsedTime(Date.now() - gameStartRef.current!.localStart);
    }, 100);

    return () => clearInterval(timer);
  }, [startedAt]);

  // Client-side prediction for own board
  const [prediction, setPrediction] = useState<{ piece: TetrisActivePiece; version: number } | null>(null);

  // Effective piece: prediction takes priority, but only if it matches current server version
  const effectivePiece = useMemo(() => {
    if (prediction && myBoard && prediction.version === myBoard.version) {
      return prediction.piece;
    }
    return myBoard?.activePiece ?? null;
  }, [prediction, myBoard]);

  const effectiveGhostRow = useMemo(() => {
    if (!effectivePiece || !myBoard) return 0;
    return calculateGhostRow(myBoard.board, effectivePiece);
  }, [effectivePiece, myBoard]);

  const opponentEntries = useMemo(() => {
    return Object.entries(opponentBoards);
  }, [opponentBoards]);

  const opponentCellSize = getOpponentCellSize(opponentEntries.length);

  const currentDropInterval = useMemo(() => {
    if (!difficulty) return null;
    let maxLevel = myBoard?.level ?? 0;
    for (const board of Object.values(opponentBoards)) {
      if (board.level > maxLevel) maxLevel = board.level;
    }
    return calculateDropInterval(difficulty, maxLevel);
  }, [difficulty, myBoard?.level, opponentBoards]);

  // Apply client-side prediction for movement/rotation
  const applyPrediction = useCallback((moveType: string) => {
    if (!myBoard) return;
    const version = myBoard.version;
    setPrediction((prev) => {
      const currentPiece = (prev && prev.version === version) ? prev.piece : myBoard.activePiece;
      if (!currentPiece) return null;

      let newPiece: TetrisActivePiece | null = null;
      switch (moveType) {
        case "move-left":
          newPiece = tryMove(myBoard.board, currentPiece, 0, -1);
          break;
        case "move-right":
          newPiece = tryMove(myBoard.board, currentPiece, 0, 1);
          break;
        case "soft-drop":
          newPiece = tryMove(myBoard.board, currentPiece, 1, 0);
          break;
        case "rotate-cw":
          newPiece = tryRotate(myBoard.board, currentPiece, 1);
          break;
        case "rotate-ccw":
          newPiece = tryRotate(myBoard.board, currentPiece, -1);
          break;
      }

      return newPiece ? { piece: newPiece, version } : prev;
    });
  }, [myBoard]);

  // DAS/ARR keyboard input
  const myStatus = myBoard?.status ?? null;
  useTetrisInput({
    enabled: myStatus === "playing" && !gameResult && !isSpectating,
    onMove: useCallback((moveType) => {
      applyPrediction(moveType);
      makeMove({ type: moveType });
    }, [applyPrediction, makeMove]),
    onInstantMove: useCallback((moveType) => {
      setPrediction(null);
      makeMove({ type: moveType });
    }, [makeMove]),
  });

  const isSolo = Object.keys(opponentBoards).length === 0;
  const myScore = myBoard?.score ?? 0;
  const isSoloGameOver = isSolo && myBoard?.status === "gameover" && gameResult != null;
  const isWinner = !isSolo && gameResult != null && gameResult.winnerId === socket?.id;
  const isLoser = !isSolo && gameResult != null && gameResult.winnerId !== socket?.id && gameResult.winnerId !== null;
  const isDraw = !isSolo && gameResult != null && gameResult.winnerId === null;

  const isSoloSpeedRaceClear = isSolo && isSpeedRace && gameResult != null && gameResult.winnerId != null;

  const soloResultOverlay = useMemo(() => {
    if (!gameResult) return undefined;

    // Speed race solo: 40줄 클리어 성공
    if (isSoloSpeedRaceClear) {
      const clearTime = gameResult.completionTimeMs ?? elapsedTime;
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 rounded gap-2">
          <span className="text-3xl font-display font-bold text-neon-yellow drop-shadow-lg text-glow-cyan">CLEAR!</span>
          <span className="text-sm text-white/80">
            클리어 시간: {(clearTime / 1000).toFixed(3)}초
          </span>
          {gameResult.rankingResult && gameResult.rankingResult.rank != null && (
            <span className="text-sm text-neon-yellow font-bold">
              {gameResult.rankingResult.isNewRecord ? "🏆 새로운 1위!" : `전체 ${gameResult.rankingResult.rank}위`}
            </span>
          )}
        </div>
      );
    }

    if (!isSoloGameOver) return undefined;

    // Speed race solo: 게임오버 (40줄 미달성)
    if (isSpeedRace) {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 rounded gap-2">
          <span className="text-3xl font-display font-bold text-accent drop-shadow-lg text-glow-pink">GAME OVER</span>
          <span className="text-sm text-white/80">
            {myBoard?.linesCleared ?? 0}/{SPEED_RACE_TARGET_LINES}줄
          </span>
        </div>
      );
    }

    // Classic solo: 기존 오버레이
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 rounded gap-2">
        <span className="text-3xl font-display font-bold text-accent drop-shadow-lg text-glow-pink">GAME OVER</span>
        <span className="text-sm text-white/80">
          점수: {myScore.toLocaleString()}
        </span>
        {gameResult.rankingResult && gameResult.rankingResult.rank != null && (
          <span className="text-sm text-neon-yellow font-bold">
            {gameResult.rankingResult.isNewRecord ? "🏆 새로운 1위!" : `전체 ${gameResult.rankingResult.rank}위`}
          </span>
        )}
      </div>
    );
  }, [isSoloGameOver, isSoloSpeedRaceClear, isSpeedRace, gameResult, myScore, elapsedTime, myBoard?.linesCleared]);

  const versusResultOverlay = useMemo(() => {
    if (!isWinner && !isLoser && !isDraw) return undefined;

    let title: string;
    let titleColor: string;
    if (isWinner) {
      title = "WIN!";
      titleColor = "text-neon-yellow";
    } else if (isDraw) {
      title = "DRAW";
      titleColor = "text-muted-foreground";
    } else {
      title = "GAME OVER";
      titleColor = "text-accent";
    }

    const detail = isSpeedRace
      ? (isWinner ? `클리어 시간: ${((gameResult?.completionTimeMs ?? elapsedTime) / 1000).toFixed(3)}초` : `${myBoard?.linesCleared ?? 0}/${SPEED_RACE_TARGET_LINES}줄`)
      : `점수: ${myScore.toLocaleString()}`;

    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 rounded gap-2">
        <span className={`text-3xl font-display font-bold ${titleColor} drop-shadow-lg`}>{title}</span>
        <span className="text-sm text-white/80">{detail}</span>
      </div>
    );
  }, [isWinner, isLoser, isDraw, myScore, isSpeedRace, elapsedTime, gameResult, myBoard?.linesCleared]);

  // 관전자: 플레이어 보드만 표시 (내 보드 없음)
  if (isSpectating) {
    const spectatorCellSize = opponentEntries.length <= 1 ? 24
      : opponentEntries.length <= 2 ? 20
      : opponentEntries.length <= 4 ? 16
      : 12;
    const cols = Math.min(opponentEntries.length, 2);

    return (
      <div className="flex flex-col items-center gap-4 p-4">
        <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground">
          <span className="font-display tracking-wider text-primary/80">SPECTATING</span>
          <span>·</span>
          <span>{isSpeedRace ? "SPEED RACE" : "CLASSIC"}</span>
          <span>·</span>
          <span>{(elapsedTime / 1000).toFixed(1)}초</span>
        </div>
        {opponentEntries.length > 0 ? (
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
          >
            {opponentEntries.map(([id, board], i) => (
              <OpponentCanvas
                key={id}
                board={board}
                cellSize={spectatorCellSize}
                nickname={roomPlayers.find((p) => p.id === id)?.nickname ?? `플레이어 ${i + 1}`}
                isSpeedRace={isSpeedRace}
              />
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            게임 로딩 중...
          </div>
        )}
      </div>
    );
  }

  if (!myBoard) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        게임 로딩 중...
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      {/* Boards */}
      <div className="flex items-start gap-6">
        {/* My board — apply prediction overlay */}
        <div className="relative shrink-0">
          <PlayerBoard
            board={effectivePiece
              ? { ...myBoard, activePiece: effectivePiece, ghostRow: effectiveGhostRow }
              : myBoard}
            cellSize={32}
            resultOverlay={soloResultOverlay ?? versusResultOverlay}
            dropInterval={currentDropInterval ?? undefined}
            isSpeedRace={isSpeedRace}
            elapsedTime={elapsedTime}
          />
        </div>

        {/* Opponents grid: 2 columns on the right */}
        {!isSolo && opponentEntries.length > 0 && (
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: `repeat(${Math.min(opponentEntries.length, 2)}, 1fr)` }}
          >
            {opponentEntries.map(([id, board], i) => (
              <OpponentCanvas
                key={id}
                board={board}
                cellSize={opponentCellSize}
                nickname={roomPlayers.find((p) => p.id === id)?.nickname ?? `상대 ${i + 1}`}
                isSpeedRace={isSpeedRace}
              />
            ))}
          </div>
        )}
      </div>

      {/* Controls hint */}
      <div className="flex items-center justify-center gap-2 text-[10px] text-secondary-foreground font-mono">
        <span className="px-1.5 py-0.5 rounded border border-border/50 bg-black/30">&larr; &rarr;</span><span>이동</span>
        <span className="px-1.5 py-0.5 rounded border border-border/50 bg-black/30">&uarr; X</span><span>회전</span>
        <span className="px-1.5 py-0.5 rounded border border-border/50 bg-black/30">Z</span><span>역회전</span>
        <span className="px-1.5 py-0.5 rounded border border-border/50 bg-black/30">&darr;</span><span>소프트</span>
        <span className="px-1.5 py-0.5 rounded border border-border/50 bg-black/30">Space</span><span>하드</span>
        <span className="px-1.5 py-0.5 rounded border border-border/50 bg-black/30">C</span><span>홀드</span>
      </div>
    </div>
  );
}
