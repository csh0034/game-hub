import type { NonogramDifficulty } from "@game-hub/shared-types";
import patternsJson from "./data/nonogram-patterns.json" with { type: "json" };

function parseArt(art: string): boolean[][] {
  return art.split("\n").map((line) => [...line].map((c) => c === "#"));
}

const parsed = Object.fromEntries(
  Object.entries(patternsJson).map(([diff, patterns]) => [
    diff,
    patterns.map((p) => parseArt(p.art)),
  ]),
) as Record<NonogramDifficulty, boolean[][][]>;

export const NONOGRAM_PATTERNS = parsed;
