import { lazy, type ComponentType } from "react";
import type { GameType } from "@game-hub/shared-types";

export interface GameComponentProps {
  roomId: string;
}

const GAME_COMPONENTS: Record<GameType, React.LazyExoticComponent<ComponentType<GameComponentProps>>> = {
  gomoku: lazy(() => import("@/components/games/gomoku/gomoku-board")),
  "texas-holdem": lazy(() => import("@/components/games/texas-holdem/holdem-table")),
  minesweeper: lazy(() => import("@/components/games/minesweeper/minesweeper-board")),
  tetris: lazy(() => import("@/components/games/tetris/tetris-board")),
  "liar-drawing": lazy(() => import("@/components/games/liar-drawing/liar-drawing-board")),
  "catch-mind": lazy(() => import("@/components/games/catch-mind/catch-mind-board")),
};

export function getGameComponent(gameType: GameType) {
  return GAME_COMPONENTS[gameType];
}

const GomokuGame = GAME_COMPONENTS["gomoku"];
const HoldemGame = GAME_COMPONENTS["texas-holdem"];
const MinesweeperGame = GAME_COMPONENTS["minesweeper"];
const TetrisGame = GAME_COMPONENTS["tetris"];
const LiarDrawingGame = GAME_COMPONENTS["liar-drawing"];
const CatchMindGame = GAME_COMPONENTS["catch-mind"];

export function GameRenderer({ gameType, roomId }: { gameType: GameType; roomId: string }) {
  switch (gameType) {
    case "gomoku":
      return <GomokuGame roomId={roomId} />;
    case "texas-holdem":
      return <HoldemGame roomId={roomId} />;
    case "minesweeper":
      return <MinesweeperGame roomId={roomId} />;
    case "tetris":
      return <TetrisGame roomId={roomId} />;
    case "liar-drawing":
      return <LiarDrawingGame roomId={roomId} />;
    case "catch-mind":
      return <CatchMindGame roomId={roomId} />;
  }
}
