import type { Card, Rank } from "@game-hub/shared-types";

const HAND_NAMES_KR: Record<string, string> = {
  "Royal Flush": "로얄 플러시",
  "Straight Flush": "스트레이트 플러시",
  "Four of a Kind": "포카드",
  "Full House": "풀하우스",
  "Flush": "플러시",
  "Straight": "스트레이트",
  "Three of a Kind": "트리플",
  "Two Pair": "투페어",
  "One Pair": "원페어",
  "High Card": "하이카드",
};

interface HandEvaluation {
  rank: number;
  name: string;
  nameKr: string;
}

function rankValue(rank: Rank): number {
  const map: Record<Rank, number> = {
    "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8,
    "9": 9, "10": 10, J: 11, Q: 12, K: 13, A: 14,
  };
  return map[rank];
}

function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length === 0) return [];
  const [first, ...rest] = arr;
  const withFirst = combinations(rest, k - 1).map((c) => [first, ...c]);
  const withoutFirst = combinations(rest, k);
  return [...withFirst, ...withoutFirst];
}

function checkStraight(values: number[]): boolean {
  for (let i = 0; i < values.length - 1; i++) {
    if (values[i] - values[i + 1] !== 1) return false;
  }
  return true;
}

function checkLowStraight(values: number[]): boolean {
  const set = new Set(values);
  return set.has(14) && set.has(2) && set.has(3) && set.has(4) && set.has(5);
}

function evaluateHand(cards: Card[]): { rank: number; name: string; tiebreakers: number[] } {
  const sorted = [...cards].sort((a, b) => rankValue(b.rank) - rankValue(a.rank));
  const values = sorted.map((c) => rankValue(c.rank));
  const suits = sorted.map((c) => c.suit);

  const isFlush = suits.every((s) => s === suits[0]);
  const isStraight = checkStraight(values);
  const isLowStraight = checkLowStraight(values);

  const counts: Map<number, number> = new Map();
  for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
  const groups = Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || b[0] - a[0]);

  if (isFlush && isStraight && values[0] === 14)
    return { rank: 9, name: "Royal Flush", tiebreakers: [] };
  if (isFlush && (isStraight || isLowStraight))
    return { rank: 8, name: "Straight Flush", tiebreakers: [isLowStraight ? 5 : values[0]] };
  if (groups[0][1] === 4)
    return { rank: 7, name: "Four of a Kind", tiebreakers: [groups[0][0], groups[1][0]] };
  if (groups[0][1] === 3 && groups[1][1] === 2)
    return { rank: 6, name: "Full House", tiebreakers: [groups[0][0], groups[1][0]] };
  if (isFlush)
    return { rank: 5, name: "Flush", tiebreakers: values };
  if (isStraight)
    return { rank: 4, name: "Straight", tiebreakers: [values[0]] };
  if (isLowStraight)
    return { rank: 4, name: "Straight", tiebreakers: [5] };
  if (groups[0][1] === 3)
    return { rank: 3, name: "Three of a Kind", tiebreakers: [groups[0][0], ...groups.slice(1).map((g) => g[0])] };
  if (groups[0][1] === 2 && groups[1][1] === 2)
    return { rank: 2, name: "Two Pair", tiebreakers: [groups[0][0], groups[1][0], groups[2][0]] };
  if (groups[0][1] === 2)
    return { rank: 1, name: "One Pair", tiebreakers: [groups[0][0], ...groups.slice(1).map((g) => g[0])] };
  return { rank: 0, name: "High Card", tiebreakers: values };
}

function compareHands(a: { rank: number; tiebreakers: number[] }, b: { rank: number; tiebreakers: number[] }): number {
  if (a.rank !== b.rank) return a.rank - b.rank;
  for (let i = 0; i < Math.min(a.tiebreakers.length, b.tiebreakers.length); i++) {
    if (a.tiebreakers[i] !== b.tiebreakers[i]) return a.tiebreakers[i] - b.tiebreakers[i];
  }
  return 0;
}

export function evaluateBestHand(cards: Card[]): HandEvaluation | null {
  if (cards.length < 2) return null;

  if (cards.length < 5) {
    if (cards.length === 2) {
      // 2장만 있을 때는 페어 여부만 판단
      const isPair = cards[0].rank === cards[1].rank;
      const highCard = rankValue(cards[0].rank) >= rankValue(cards[1].rank) ? cards[0] : cards[1];
      if (isPair) {
        return { rank: 1, name: "One Pair", nameKr: "원페어" };
      }
      return { rank: 0, name: "High Card", nameKr: `하이카드 (${highCard.rank})` };
    }

    // 3~4장이면 조합 가능한 것 중 최선
    const combos = combinations(cards, Math.min(cards.length, 5));
    let best = { rank: -1, name: "", tiebreakers: [] as number[] };
    for (const combo of combos) {
      if (combo.length === 5) {
        const ev = evaluateHand(combo);
        if (compareHands(ev, best) > 0) best = ev;
      }
    }
    if (best.rank === -1) return null;
    const name = best.name;
    return { rank: best.rank, name, nameKr: HAND_NAMES_KR[name] || name };
  }

  // 5장 이상
  let best = { rank: -1, name: "", tiebreakers: [] as number[] };
  const combos = combinations(cards, 5);
  for (const combo of combos) {
    const ev = evaluateHand(combo);
    if (compareHands(ev, best) > 0) best = ev;
  }

  if (best.rank === -1) return null;
  const name = best.name;
  return { rank: best.rank, name, nameKr: HAND_NAMES_KR[name] || name };
}

export const HAND_RANK_INFO = [
  { rank: 0, name: "High Card", nameKr: "하이카드" },
  { rank: 1, name: "One Pair", nameKr: "원페어" },
  { rank: 2, name: "Two Pair", nameKr: "투페어" },
  { rank: 3, name: "Three of a Kind", nameKr: "트리플" },
  { rank: 4, name: "Straight", nameKr: "스트레이트" },
  { rank: 5, name: "Flush", nameKr: "플러시" },
  { rank: 6, name: "Full House", nameKr: "풀하우스" },
  { rank: 7, name: "Four of a Kind", nameKr: "포카드" },
  { rank: 8, name: "Straight Flush", nameKr: "스트레이트 플러시" },
  { rank: 9, name: "Royal Flush", nameKr: "로얄 플러시" },
];
