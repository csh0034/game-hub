import type { GameType, GameState, GameMove, GameResult, Player } from "@game-hub/shared-types";

export interface GameEngine {
  gameType: GameType;
  minPlayers: number;
  maxPlayers: number;
  initState(players: Player[]): GameState;
  processMove(state: GameState, playerId: string, move: GameMove): GameState;
  checkWin(state: GameState): GameResult | null;
}
