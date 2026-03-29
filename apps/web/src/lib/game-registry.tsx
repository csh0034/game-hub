import { lazy, type ComponentType } from "react";
import type { GameType } from "@game-hub/shared-types";

export interface GameComponentProps {
  roomId: string;
  isSpectating?: boolean;
}

const GAME_COMPONENTS: Record<GameType, React.LazyExoticComponent<ComponentType<GameComponentProps>>> = {
  "liar-drawing": lazy(() => import("@/components/games/liar-drawing/liar-drawing-board")),
  "catch-mind": lazy(() => import("@/components/games/catch-mind/catch-mind-board")),
  tetris: lazy(() => import("@/components/games/tetris/tetris-board")),
  gomoku: lazy(() => import("@/components/games/gomoku/gomoku-board")),
  minesweeper: lazy(() => import("@/components/games/minesweeper/minesweeper-board")),
  typing: lazy(() => import("@/components/games/typing/typing-board")),
};

export function getGameComponent(gameType: GameType) {
  return GAME_COMPONENTS[gameType];
}

const LiarDrawingGame = GAME_COMPONENTS["liar-drawing"];
const CatchMindGame = GAME_COMPONENTS["catch-mind"];
const TetrisGame = GAME_COMPONENTS["tetris"];
const GomokuGame = GAME_COMPONENTS["gomoku"];
const MinesweeperGame = GAME_COMPONENTS["minesweeper"];
const TypingGame = GAME_COMPONENTS["typing"];

export function GameRenderer({ gameType, roomId, isSpectating }: { gameType: GameType; roomId: string; isSpectating?: boolean }) {
  switch (gameType) {
    case "liar-drawing":
      return <LiarDrawingGame roomId={roomId} isSpectating={isSpectating} />;
    case "catch-mind":
      return <CatchMindGame roomId={roomId} isSpectating={isSpectating} />;
    case "tetris":
      return <TetrisGame roomId={roomId} isSpectating={isSpectating} />;
    case "gomoku":
      return <GomokuGame roomId={roomId} isSpectating={isSpectating} />;
    case "minesweeper":
      return <MinesweeperGame roomId={roomId} isSpectating={isSpectating} />;
    case "typing":
      return <TypingGame roomId={roomId} isSpectating={isSpectating} />;
  }
}
