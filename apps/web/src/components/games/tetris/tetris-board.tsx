"use client";

import { useEffect, useRef } from "react";
import { useGame } from "@/hooks/use-game";
import { useSocket } from "@/hooks/use-socket";
import type {
  TetrisPublicState,
  TetrisMove,
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

const TETROMINO_SHAPES: Record<TetrominoType, [number, number][][]> = {
  I: [
    [[0, -1], [0, 0], [0, 1], [0, 2]],
    [[-1, 0], [0, 0], [1, 0], [2, 0]],
    [[0, -1], [0, 0], [0, 1], [0, 2]],
    [[-1, 0], [0, 0], [1, 0], [2, 0]],
  ],
  O: [
    [[0, 0], [0, 1], [1, 0], [1, 1]],
    [[0, 0], [0, 1], [1, 0], [1, 1]],
    [[0, 0], [0, 1], [1, 0], [1, 1]],
    [[0, 0], [0, 1], [1, 0], [1, 1]],
  ],
  T: [
    [[0, -1], [0, 0], [0, 1], [-1, 0]],
    [[-1, 0], [0, 0], [1, 0], [0, 1]],
    [[0, -1], [0, 0], [0, 1], [1, 0]],
    [[-1, 0], [0, 0], [1, 0], [0, -1]],
  ],
  S: [
    [[0, -1], [0, 0], [-1, 0], [-1, 1]],
    [[-1, 0], [0, 0], [0, 1], [1, 1]],
    [[0, -1], [0, 0], [-1, 0], [-1, 1]],
    [[-1, 0], [0, 0], [0, 1], [1, 1]],
  ],
  Z: [
    [[-1, -1], [-1, 0], [0, 0], [0, 1]],
    [[-1, 0], [0, 0], [0, -1], [1, -1]],
    [[-1, -1], [-1, 0], [0, 0], [0, 1]],
    [[-1, 0], [0, 0], [0, -1], [1, -1]],
  ],
  J: [
    [[0, -1], [0, 0], [0, 1], [-1, -1]],
    [[-1, 0], [0, 0], [1, 0], [-1, 1]],
    [[0, -1], [0, 0], [0, 1], [1, 1]],
    [[-1, 0], [0, 0], [1, 0], [1, -1]],
  ],
  L: [
    [[0, -1], [0, 0], [0, 1], [-1, 1]],
    [[-1, 0], [0, 0], [1, 0], [1, 1]],
    [[0, -1], [0, 0], [0, 1], [1, -1]],
    [[-1, 0], [0, 0], [1, 0], [-1, -1]],
  ],
};

function getPieceCells(piece: TetrisActivePiece): [number, number][] {
  return TETROMINO_SHAPES[piece.type][piece.rotation].map(([dr, dc]) => [
    piece.row + dr,
    piece.col + dc,
  ]);
}

function MiniPiecePreview({ type }: { type: TetrominoType | null }) {
  if (!type) {
    return <div className="w-16 h-16 bg-secondary/50 rounded border border-border" />;
  }

  const cells = TETROMINO_SHAPES[type][0];
  const minR = Math.min(...cells.map(([r]) => r));
  const maxR = Math.max(...cells.map(([r]) => r));
  const minC = Math.min(...cells.map(([, c]) => c));
  const maxC = Math.max(...cells.map(([, c]) => c));
  const h = maxR - minR + 1;
  const w = maxC - minC + 1;

  return (
    <div className="w-16 h-16 bg-secondary/50 rounded border border-border flex items-center justify-center">
      <div
        className="grid gap-px"
        style={{
          gridTemplateColumns: `repeat(${w}, 12px)`,
          gridTemplateRows: `repeat(${h}, 12px)`,
        }}
      >
        {Array.from({ length: h }, (_, r) =>
          Array.from({ length: w }, (_, c) => {
            const isFilled = cells.some(([cr, cc]) => cr - minR === r && cc - minC === c);
            return (
              <div
                key={`${r}-${c}`}
                className={`w-3 h-3 rounded-sm ${isFilled ? TETROMINO_COLORS[type] : "bg-transparent"}`}
              />
            );
          }),
        )}
      </div>
    </div>
  );
}

function PlayerBoard({
  board,
  isMe,
  nickname,
}: {
  board: TetrisPlayerBoard;
  isMe: boolean;
  nickname?: string;
}) {
  const cellSize = isMe ? 32 : 18;

  // Build display grid with active piece and ghost
  const displayGrid: { type: TetrominoType | null; isGhost: boolean; isActive: boolean }[][] =
    board.board.map((row) => row.map((cell) => ({ type: cell, isGhost: false, isActive: false })));

  if (board.activePiece) {
    // Ghost piece
    const ghostPiece: TetrisActivePiece = { ...board.activePiece, row: board.ghostRow };
    const ghostCells = getPieceCells(ghostPiece);
    for (const [r, c] of ghostCells) {
      if (r >= 0 && r < 20 && c >= 0 && c < 10 && !displayGrid[r][c].type) {
        displayGrid[r][c] = { type: board.activePiece.type, isGhost: true, isActive: false };
      }
    }

    // Active piece
    const activeCells = getPieceCells(board.activePiece);
    for (const [r, c] of activeCells) {
      if (r >= 0 && r < 20 && c >= 0 && c < 10) {
        displayGrid[r][c] = { type: board.activePiece.type, isGhost: false, isActive: true };
      }
    }
  }

  return (
    <div className="flex gap-3">
      {/* Hold */}
      <div className="flex flex-col items-center gap-1">
        <span className="text-xs text-muted-foreground font-medium">HOLD</span>
        <MiniPiecePreview type={board.holdPiece} />
      </div>

      {/* Board */}
      <div className="flex flex-col items-center gap-1">
        {nickname && <span className="text-xs text-muted-foreground font-medium">{nickname}</span>}
        <div
          className="border border-border rounded bg-secondary/30"
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
        </div>
        {board.status === "gameover" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded">
            <span className="text-white font-bold text-lg">GAME OVER</span>
          </div>
        )}
      </div>

      {/* Info panel */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs text-muted-foreground font-medium">NEXT</span>
          {board.nextPieces.map((type, i) => (
            <MiniPiecePreview key={i} type={type} />
          ))}
        </div>
        <div className="space-y-2 text-center">
          <div>
            <div className="text-xs text-muted-foreground">SCORE</div>
            <div className="text-lg font-bold font-mono">{board.score.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">LEVEL</div>
            <div className="text-lg font-bold font-mono">{board.level}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">LINES</div>
            <div className="text-lg font-bold font-mono">{board.linesCleared}</div>
          </div>
          {board.pendingGarbage > 0 && (
            <div>
              <div className="text-xs text-red-400">GARBAGE</div>
              <div className="text-lg font-bold font-mono text-red-400">{board.pendingGarbage}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TetrisBoard({ roomId }: GameComponentProps) {
  const { socket } = useSocket();
  const { gameState, gameResult, makeMove } = useGame(socket);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const state = gameState as TetrisPublicState | null;
  const myId = socket?.id;
  const myBoard = state && myId ? state.players[myId] : null;
  const opponentEntries = state && myId
    ? Object.entries(state.players).filter(([id]) => id !== myId)
    : [];

  // Tick timer
  useEffect(() => {
    if (!state || !myBoard || myBoard.status !== "playing" || gameResult) return;

    tickRef.current = setInterval(() => {
      const move: TetrisMove = { type: "tick" };
      makeMove(move);
    }, state.dropInterval);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [state?.dropInterval, myBoard?.status, myBoard?.level, gameResult, makeMove, state, myBoard]);

  // Keyboard input
  useEffect(() => {
    if (!myBoard || myBoard.status !== "playing" || gameResult) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      let moveType: TetrisMove["type"] | null = null;

      switch (e.key) {
        case "ArrowLeft":
          moveType = "move-left";
          break;
        case "ArrowRight":
          moveType = "move-right";
          break;
        case "ArrowDown":
          moveType = "soft-drop";
          break;
        case "ArrowUp":
        case "x":
        case "X":
          moveType = "rotate-cw";
          break;
        case "z":
        case "Z":
          moveType = "rotate-ccw";
          break;
        case " ":
          moveType = "hard-drop";
          break;
        case "c":
        case "C":
        case "Shift":
          moveType = "hold";
          break;
        default:
          return;
      }

      e.preventDefault();
      if (moveType) {
        makeMove({ type: moveType });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [myBoard, gameResult, makeMove]);

  if (!state || !myBoard) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        게임 로딩 중...
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      {/* Game result overlay */}
      {gameResult && (
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <div className="text-lg font-bold mb-1">
            {gameResult.winnerId === myId ? "승리!" : gameResult.winnerId ? "패배" : "게임 오버"}
          </div>
          <div className="text-sm text-muted-foreground">{gameResult.reason}</div>
        </div>
      )}

      {/* Boards */}
      <div className={`flex ${state.mode === "versus" ? "gap-6" : ""} items-start flex-wrap justify-center`}>
        <div className="relative">
          <PlayerBoard board={myBoard} isMe={true} />
        </div>

        {opponentEntries.map(([id, board], i) => (
          <div key={id} className="relative">
            <PlayerBoard board={board} isMe={false} nickname={`상대 ${opponentEntries.length > 1 ? i + 1 : ""}`} />
          </div>
        ))}
      </div>

      {/* Controls hint */}
      <div className="text-xs text-muted-foreground text-center space-x-3">
        <span>← → 이동</span>
        <span>↑/X 회전</span>
        <span>Z 역회전</span>
        <span>↓ 소프트드롭</span>
        <span>Space 하드드롭</span>
        <span>C/Shift 홀드</span>
      </div>
    </div>
  );
}
