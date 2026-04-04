import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { NonogramDifficulty } from "@game-hub/shared-types";

export interface NonogramPattern {
  name: string;
  grid: boolean[][];
}

function parseArt(art: string[]): boolean[][] {
  return art.map((line) => [...line].map((c) => c === "#"));
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const patternsDir = join(__dirname, "data", "nonogram-patterns");

const DIFFICULTY_DIRS: Record<NonogramDifficulty, string> = {
  tiny: "1. tiny",
  beginner: "2. beginner",
  intermediate: "3. intermediate",
  expert: "4. expert",
  extreme: "5. extreme",
};

function loadPatterns(difficulty: NonogramDifficulty): NonogramPattern[] {
  const dir = join(patternsDir, DIFFICULTY_DIRS[difficulty]);
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  return files.map((file) => {
    const raw = JSON.parse(readFileSync(join(dir, file), "utf-8")) as {
      name: string;
      art: string[];
    };
    return { name: raw.name, grid: parseArt(raw.art) };
  });
}

export const NONOGRAM_PATTERNS: Record<NonogramDifficulty, NonogramPattern[]> =
  {
    tiny: loadPatterns("tiny"),
    beginner: loadPatterns("beginner"),
    intermediate: loadPatterns("intermediate"),
    expert: loadPatterns("expert"),
    extreme: loadPatterns("extreme"),
  };
