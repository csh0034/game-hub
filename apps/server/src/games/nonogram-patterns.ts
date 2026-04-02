import type { NonogramDifficulty } from "@game-hub/shared-types";
import tinyJson from "./data/nonogram-patterns/tiny.json" with { type: "json" };
import beginnerJson from "./data/nonogram-patterns/beginner.json" with { type: "json" };
import intermediateJson from "./data/nonogram-patterns/intermediate.json" with { type: "json" };
import expertJson from "./data/nonogram-patterns/expert.json" with { type: "json" };
import extremeJson from "./data/nonogram-patterns/extreme.json" with { type: "json" };

export interface NonogramPattern {
  name: string;
  grid: boolean[][];
}

function parseArt(art: string): boolean[][] {
  return art.split("\n").map((line) => [...line].map((c) => c === "#"));
}

function parsePatterns(
  patterns: { name: string; art: string }[],
): NonogramPattern[] {
  return patterns.map((p) => ({ name: p.name, grid: parseArt(p.art) }));
}

export const NONOGRAM_PATTERNS: Record<NonogramDifficulty, NonogramPattern[]> =
  {
    tiny: parsePatterns(tinyJson),
    beginner: parsePatterns(beginnerJson),
    intermediate: parsePatterns(intermediateJson),
    expert: parsePatterns(expertJson),
    extreme: parsePatterns(extremeJson),
  };
