import type { NonogramDifficulty } from "@game-hub/shared-types";
import patternsJson from "./data/nonogram-patterns.json" with { type: "json" };

export interface NonogramPattern {
  name: string;
  grid: boolean[][];
}

function parseArt(art: string): boolean[][] {
  return art.split("\n").map((line) => [...line].map((c) => c === "#"));
}

const parsed = Object.fromEntries(
  Object.entries(patternsJson).map(([diff, patterns]) => [
    diff,
    patterns.map((p) => ({ name: p.name, grid: parseArt(p.art) })),
  ]),
) as Record<NonogramDifficulty, NonogramPattern[]>;

export const NONOGRAM_PATTERNS = parsed;
