import { lazy, type ComponentType } from "react";
import type { GameType } from "@game-hub/shared-types";

export interface GameComponentProps {
  roomId: string;
}

const GAME_COMPONENTS: Record<GameType, React.LazyExoticComponent<ComponentType<GameComponentProps>>> = {
  gomoku: lazy(() => import("@/components/games/gomoku/gomoku-board")),
  "texas-holdem": lazy(() => import("@/components/games/texas-holdem/holdem-table")),
  minesweeper: lazy(() => import("@/components/games/minesweeper/minesweeper-board")),
};

export function getGameComponent(gameType: GameType) {
  return GAME_COMPONENTS[gameType];
}

const GomokuGame = GAME_COMPONENTS["gomoku"];
const HoldemGame = GAME_COMPONENTS["texas-holdem"];
const MinesweeperGame = GAME_COMPONENTS["minesweeper"];

export function GameRenderer({ gameType, roomId }: { gameType: GameType; roomId: string }) {
  switch (gameType) {
    case "gomoku":
      return <GomokuGame roomId={roomId} />;
    case "texas-holdem":
      return <HoldemGame roomId={roomId} />;
    case "minesweeper":
      return <MinesweeperGame roomId={roomId} />;
  }
}
