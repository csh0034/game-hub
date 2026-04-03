/**
 * webpbn.com 노노그램 퍼즐 대량 수집 스크립트
 *
 * 사용법:
 *   node scripts/fetch-webpbn.mjs [startId] [endId] [concurrency]
 *
 * 예시:
 *   node scripts/fetch-webpbn.mjs 1 30000 10
 *
 * 출력 디렉토리: scripts/webpbn-patterns/{cols}x{rows}/
 * 파일 형식: {id}.json → { "id": number, "name": string, "art": string[] }
 */

import { mkdirSync, writeFileSync, existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── 설정 ──────────────────────────────────────────────
const START_ID = parseInt(process.argv[2] || "1", 10);
const END_ID = parseInt(process.argv[3] || "30000", 10);
const CONCURRENCY = parseInt(process.argv[4] || "10", 10);
const OUTPUT_DIR = join(__dirname, "webpbn-patterns");
const PROGRESS_FILE = join(OUTPUT_DIR, "_progress.json");
const RETRY_LIMIT = 3;
const DELAY_BETWEEN_BATCHES_MS = 500;
const ALLOWED_SIZES = new Set(["5x5", "10x10", "15x15", "20x20", "40x40"]);

// ── 진행 상황 관리 ────────────────────────────────────
function loadProgress() {
  if (existsSync(PROGRESS_FILE)) {
    return JSON.parse(readFileSync(PROGRESS_FILE, "utf-8"));
  }
  return { lastProcessedId: START_ID - 1, successCount: 0, skipCount: 0, errorCount: 0 };
}

function saveProgress(progress) {
  writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2) + "\n");
}

// ── XML 파싱 ──────────────────────────────────────────
function parseXml(xml, id) {
  // 존재하지 않는 퍼즐
  if (xml.includes("does not exist")) return null;

  // 멀티컬러 퍼즐 제외 (color 태그가 white, black 외에 있으면 멀티컬러)
  const colorMatches = xml.match(/<color\s+name="([^"]+)"/g);
  if (colorMatches) {
    const colorNames = colorMatches.map((m) => {
      const match = m.match(/name="([^"]+)"/);
      return match ? match[1] : "";
    });
    const nonStandard = colorNames.filter((c) => c !== "white" && c !== "black");
    if (nonStandard.length > 0) return null;
  }

  // 타이틀 추출
  const titleMatch = xml.match(/<title>([^<]*)<\/title>/);
  if (!titleMatch) return null;
  const name = decodeXmlEntities(titleMatch[1]).trim();
  if (!name) return null;

  // solution 이미지 추출
  const solutionMatch = xml.match(/<solution[^>]*>\s*<image>([\s\S]*?)<\/image>/);
  if (!solutionMatch) return null;

  const imageText = solutionMatch[1].trim();
  const lines = imageText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|") && line.endsWith("|"))
    .map((line) => {
      const inner = line.slice(1, -1);
      return inner.replace(/X/g, "#");
    });

  if (lines.length === 0) return null;

  const cols = lines[0].length;
  const rows = lines.length;
  if (cols === 0 || rows === 0) return null;
  if (lines.some((l) => l.length !== cols)) return null;

  // 유효 문자 검증
  if (lines.some((l) => !/^[#.]+$/.test(l))) return null;

  // 허용 크기만 통과
  if (!ALLOWED_SIZES.has(`${cols}x${rows}`)) return null;

  return { id, name, art: lines, cols, rows };
}

function decodeXmlEntities(str) {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
}

// ── HTTP 요청 ─────────────────────────────────────────
async function fetchPuzzle(id) {
  for (let attempt = 1; attempt <= RETRY_LIMIT; attempt++) {
    try {
      const response = await fetch("https://webpbn.com/export.cgi", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `id=${id}&fmt=xml&go=1&xml_soln=on`,
      });

      if (!response.ok) {
        if (response.status === 429 || response.status >= 500) {
          await sleep(2000 * attempt);
          continue;
        }
        return null;
      }

      const text = await response.text();
      return parseXml(text, id);
    } catch (err) {
      if (attempt === RETRY_LIMIT) {
        console.error(`  [ERROR] ID ${id}: ${err.message}`);
        return null;
      }
      await sleep(1000 * attempt);
    }
  }
  return null;
}

// ── 파일 저장 ─────────────────────────────────────────
function savePuzzle(puzzle) {
  const sizeDir = `${puzzle.cols}x${puzzle.rows}`;
  const dir = join(OUTPUT_DIR, sizeDir);
  mkdirSync(dir, { recursive: true });

  const filePath = join(dir, `${puzzle.id}.json`);
  const json = JSON.stringify(
    { id: puzzle.id, name: puzzle.name, art: puzzle.art },
    null,
    2
  );
  writeFileSync(filePath, json + "\n");
}

// ── 유틸 ──────────────────────────────────────────────
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── 메인 ──────────────────────────────────────────────
async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const progress = loadProgress();
  const resumeId = Math.max(START_ID, progress.lastProcessedId + 1);

  console.log(`\n=== webpbn.com 노노그램 수집 ===`);
  console.log(`범위: ${resumeId} ~ ${END_ID}`);
  console.log(`동시 요청 수: ${CONCURRENCY}`);
  console.log(`출력 디렉토리: ${OUTPUT_DIR}`);
  if (resumeId > START_ID) {
    console.log(`이전 진행 이어서 시작 (성공: ${progress.successCount}, 스킵: ${progress.skipCount}, 에러: ${progress.errorCount})`);
  }
  console.log("");

  let { successCount, skipCount, errorCount } = progress;
  const totalToProcess = END_ID - resumeId + 1;
  let processed = 0;

  for (let batchStart = resumeId; batchStart <= END_ID; batchStart += CONCURRENCY) {
    const batchEnd = Math.min(batchStart + CONCURRENCY - 1, END_ID);
    const ids = Array.from({ length: batchEnd - batchStart + 1 }, (_, i) => batchStart + i);

    const results = await Promise.all(ids.map((id) => fetchPuzzle(id)));

    for (let i = 0; i < results.length; i++) {
      const puzzle = results[i];

      if (puzzle) {
        savePuzzle(puzzle);
        successCount++;
      } else {
        skipCount++;
      }

      processed++;
    }

    progress.lastProcessedId = batchEnd;
    progress.successCount = successCount;
    progress.skipCount = skipCount;
    progress.errorCount = errorCount;
    saveProgress(progress);

    const pct = ((processed / totalToProcess) * 100).toFixed(1);
    process.stdout.write(
      `\r[${pct}%] ${processed}/${totalToProcess} | 성공: ${successCount} | 스킵: ${skipCount} | 현재 ID: ${batchEnd}`
    );

    if (batchEnd < END_ID) {
      await sleep(DELAY_BETWEEN_BATCHES_MS);
    }
  }

  console.log(`\n\n=== 완료 ===`);
  console.log(`성공: ${successCount}`);
  console.log(`스킵: ${skipCount} (미존재/멀티컬러/솔루션없음)`);
  console.log(`에러: ${errorCount}`);
  console.log(`출력: ${OUTPUT_DIR}/`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
