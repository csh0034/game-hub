"use client";

import { useMemo, useState, memo, useCallback } from "react";
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
} from "@game-hub/shared-types";
import type {
  TetrisPlayerBoard,
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
}: {
  board: TetrisPlayerBoard;
  cellSize: number;
  compact?: boolean;
  nickname?: string;
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
          {board.status === "gameover" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded">
              <span className={`text-white font-bold ${compact ? "text-xs" : "text-lg"}`}>GAME OVER</span>
            </div>
          )}
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
          <div>
            <div className={`${textSm} text-muted-foreground`}>SCORE</div>
            <div className={`${textLg} font-bold font-mono`}>{board.score.toLocaleString()}</div>
          </div>
          <div>
            <div className={`${textSm} text-muted-foreground`}>LEVEL</div>
            <div className={`${textLg} font-bold font-mono`}>{board.level}</div>
          </div>
          <div>
            <div className={`${textSm} text-muted-foreground`}>LINES</div>
            <div className={`${textLg} font-bold font-mono`}>{board.linesCleared}</div>
          </div>
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
  if (prev.board.version !== next.board.version) return false;
  // Check prediction changes (activePiece/ghostRow may differ with same version)
  if (prev.board.activePiece !== next.board.activePiece) return false;
  if (prev.board.ghostRow !== next.board.ghostRow) return false;
  return true;
});

function getOpponentCellSize(count: number): number {
  if (count <= 1) return 16;
  if (count <= 2) return 14;
  if (count <= 3) return 12;
  if (count <= 5) return 10;
  return 8;
}

export default function TetrisBoard({ roomId }: GameComponentProps) {
  const { socket } = useSocket();
  // useGame is still needed for socket event listening
  const { gameResult, makeMove } = useGame(socket);

  const roomPlayers = useLobbyStore((s) => s.currentRoom?.players ?? []);

  // Tetris board store: fine-grained per-player subscriptions
  const myBoard = useTetrisBoardStore((s) => s.myBoard);
  const opponentBoards = useTetrisBoardStore((s) => s.opponentBoards);
  const mode = useTetrisBoardStore((s) => s.mode);

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
    enabled: myStatus === "playing" && !gameResult,
    onMove: useCallback((moveType) => {
      applyPrediction(moveType);
      makeMove({ type: moveType });
    }, [applyPrediction, makeMove]),
    onInstantMove: useCallback((moveType) => {
      setPrediction(null);
      makeMove({ type: moveType });
    }, [makeMove]),
  });

  if (!myBoard) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        게임 로딩 중...
      </div>
    );
  }

  const isSolo = mode === "solo";

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
              />
            ))}
          </div>
        )}
      </div>

      {/* Solo game over result */}
      {isSolo && myBoard.status === "gameover" && gameResult && (
        <div className="text-center">
          <p className="text-lg font-bold text-red-500">GAME OVER</p>
          <p className="text-sm text-muted-foreground mt-1">
            점수: {myBoard.score.toLocaleString()}
          </p>
          {gameResult.rankingResult && gameResult.rankingResult.rank != null && (
            <p className="text-sm text-muted-foreground mt-1">
              {gameResult.rankingResult.isNewRecord ? "🏆 새로운 1위! " : ""}
              전체 {gameResult.rankingResult.rank}위
            </p>
          )}
        </div>
      )}

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
