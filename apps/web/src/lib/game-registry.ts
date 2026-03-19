import { lazy, type ComponentType } from "react";
import type { GameType } from "@game-hub/shared-types";

export interface GameComponentProps {
  roomId: string;
}

const GAME_COMPONENTS: Record<GameType, React.LazyExoticComponent<ComponentType<GameComponentProps>>> = {
  gomoku: lazy(() => import("@/components/games/gomoku/gomoku-board")),
  "texas-holdem": lazy(() => import("@/components/games/texas-holdem/holdem-table")),
};

export function getGameComponent(gameType: GameType) {
  return GAME_COMPONENTS[gameType];
}
