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
    return <div className={`${boxClass} bg-secondary/50 rounded border border-border`} />;
  }

  const cells = TETROMINO_SHAPES[type][0];
  const minR = Math.min(...cells.map(([r]) => r));
  const maxR = Math.max(...cells.map(([r]) => r));
  const minC = Math.min(...cells.map(([, c]) => c));
  const maxC = Math.max(...cells.map(([, c]) => c));
  const h = maxR - minR + 1;
  const w = maxC - minC + 1;

  return (
    <div className={`${boxClass} bg-secondary/50 rounded border border-border flex items-center justify-center`}>
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

  return (
    <div className="flex gap-2">
      {/* Hold */}
      {!compact && (
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs text-muted-foreground font-medium">HOLD</span>
          <MiniPiecePreview type={board.holdPiece} size={previewSize} />
        </div>
      )}

      {/* Board */}
      <div className="flex flex-col items-center gap-1">
        {nickname && <span className={`${textSm} text-muted-foreground font-medium`}>{nickname}</span>}
        <div
          className="border border-border rounded bg-secondary/30 relative"
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(10, ${cellSize}px)`,
            gridTemplateRows: `repeat(20, ${cellSize}px)`,
          }}
        >
          {displayGrid.map((row, r) =>
            row.map((cell, c) => {
              let className = "border border-border/20 ";
              if (cell.type && cell.isGhost) {
                className += `${TETROMINO_COLORS[cell.type]} opacity-25 ${TETROMINO_BORDER_COLORS[cell.type]}`;
              } else if (cell.type) {
                className += `${TETROMINO_COLORS[cell.type]} border ${TETROMINO_BORDER_COLORS[cell.type]}`;
              } else {
                className += "bg-secondary/20";
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
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded">
              <span className={`text-white font-bold ${compact ? "text-xs" : "text-lg"}`}>GAME OVER</span>
            </div>
          )}
          {resultOverlay}
        </div>
      </div>

      {/* Info panel */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-col items-center gap-1">
          <span className={`${textSm} text-muted-foreground font-medium`}>NEXT</span>
          {board.nextPieces.map((type, i) => (
            <MiniPiecePreview key={i} type={type} size={previewSize} />
          ))}
        </div>
        <div className="space-y-1 text-center">
          {isSpeedRace ? (
            <>
              <div>
                <div className={`${textSm} text-muted-foreground`}>TIME</div>
                <div className={`${textLg} font-bold font-mono`}>{((elapsedTime ?? 0) / 1000).toFixed(1)}초</div>
              </div>
              <div>
                <div className={`${textSm} text-muted-foreground`}>LINES</div>
                <div className={`${textLg} font-bold font-mono`}>{board.linesCleared}/{SPEED_RACE_TARGET_LINES}</div>
              </div>
              <div className="w-full bg-secondary/50 rounded-full h-2 mt-1">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${Math.min((board.linesCleared / SPEED_RACE_TARGET_LINES) * 100, 100)}%` }}
                />
              </div>
              <div>
                <div className={`${textSm} text-muted-foreground`}>LEVEL</div>
                <div className={`${textLg} font-bold font-mono`}>{board.level}</div>
              </div>
            </>
          ) : (
            <>
              <div>
                <div className={`${textSm} text-muted-foreground`}>SCORE</div>
                <div className={`${textLg} font-bold font-mono`}>{board.score.toLocaleString()}</div>
              </div>
              <div>
                <div className={`${textSm} text-muted-foreground`}>LEVEL</div>
                <div className={`${textLg} font-bold font-mono`}>{board.level}</div>
              </div>
              {dropInterval != null && (
                <div>
                  <div className={`${textSm} text-muted-foreground`}>SPEED</div>
                  <div className={`${textLg} font-bold font-mono`}>{(dropInterval / 1000).toFixed(2)}s</div>
                </div>
              )}
              <div>
                <div className={`${textSm} text-muted-foreground`}>LINES</div>
                <div className={`${textLg} font-bold font-mono`}>{board.linesCleared}</div>
              </div>
            </>
          )}
          {board.pendingGarbage > 0 && (
            <div>
              <div className={`${textSm} text-red-400`}>GARBAGE</div>
              <div className={`${textLg} font-bold font-mono text-red-400`}>{board.pendingGarbage}</div>
            </div>
          )}
          {board.combo > 1 && (
            <div>
              <div className={`${textSm} text-yellow-400`}>COMBO</div>
              <div className={`${textLg} font-bold font-mono text-yellow-400`}>{board.combo}</div>
            </div>
          )}
          {board.backToBack && (
            <div className={`${textSm} text-blue-400 font-bold`}>B2B</div>
          )}
          {board.lastClearType && (
            <div className={`${textSm} text-green-400 font-bold uppercase`}>
              {board.lastClearType.replace(/-/g, " ")}
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
  return true;
});

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

  // Elapsed time for speed-race mode
  const [elapsedTime, setElapsedTime] = useState(0);
  const gameEndedRef = useRef(false);

  useEffect(() => {
    gameEndedRef.current = !!gameResult;
  }, [gameResult]);

  const speedRaceBaseRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isSpeedRace || !startedAt) {
      speedRaceBaseRef.current = null;
      return;
    }
    speedRaceBaseRef.current = Date.now();

    const timer = setInterval(() => {
      if (gameEndedRef.current) return;
      setElapsedTime(Date.now() - speedRaceBaseRef.current!);
    }, 100);

    return () => clearInterval(timer);
  }, [isSpeedRace, startedAt]);

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
          <span className="text-3xl font-bold text-yellow-400 drop-shadow-lg">CLEAR!</span>
          <span className="text-sm text-white/80">
            클리어 시간: {(clearTime / 1000).toFixed(1)}초
          </span>
          {gameResult.rankingResult && gameResult.rankingResult.rank != null && (
            <span className="text-sm text-yellow-400 font-bold">
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
          <span className="text-3xl font-bold text-red-400 drop-shadow-lg">GAME OVER</span>
          <span className="text-sm text-white/80">
            {myBoard?.linesCleared ?? 0}/{SPEED_RACE_TARGET_LINES}줄
          </span>
        </div>
      );
    }

    // Classic solo: 기존 오버레이
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 rounded gap-2">
        <span className="text-3xl font-bold text-red-400 drop-shadow-lg">GAME OVER</span>
        <span className="text-sm text-white/80">
          점수: {myScore.toLocaleString()}
        </span>
        {gameResult.rankingResult && gameResult.rankingResult.rank != null && (
          <span className="text-sm text-yellow-400 font-bold">
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
      titleColor = "text-yellow-400";
    } else if (isDraw) {
      title = "DRAW";
      titleColor = "text-gray-300";
    } else {
      title = "GAME OVER";
      titleColor = "text-red-400";
    }

    const detail = isSpeedRace
      ? (isWinner ? `클리어 시간: ${((gameResult?.completionTimeMs ?? elapsedTime) / 1000).toFixed(1)}초` : `${myBoard?.linesCleared ?? 0}/${SPEED_RACE_TARGET_LINES}줄`)
      : `점수: ${myScore.toLocaleString()}`;

    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 rounded gap-2">
        <span className={`text-3xl font-bold ${titleColor} drop-shadow-lg`}>{title}</span>
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
        {opponentEntries.length > 0 ? (
          <div
            className="grid gap-4"
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
      <div className="text-xs text-muted-foreground text-center space-x-3">
        <span>&larr; &rarr; 이동</span>
        <span>&uarr;/X 회전</span>
        <span>Z 역회전</span>
        <span>&darr; 소프트드롭</span>
        <span>Space 하드드롭</span>
        <span>C/Shift 홀드</span>
      </div>
    </div>
  );
}
