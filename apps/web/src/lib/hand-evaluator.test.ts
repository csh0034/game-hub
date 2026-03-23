import { evaluateBestHand, HAND_RANK_INFO } from "./hand-evaluator";
import type { Card, Suit, Rank } from "@game-hub/shared-types";

function card(rank: Rank, suit: Suit = "spades"): Card {
  return { rank, suit };
}

describe("evaluateBestHand", () => {
  it("카드가 1장이면 null을 반환한다", () => {
    expect(evaluateBestHand([card("A")])).toBeNull();
  });

  it("카드가 0장이면 null을 반환한다", () => {
    expect(evaluateBestHand([])).toBeNull();
  });

  describe("2장", () => {
    it("같은 랭크이면 원페어를 반환한다", () => {
      const result = evaluateBestHand([card("A", "spades"), card("A", "hearts")]);
      expect(result).toEqual({ rank: 1, name: "One Pair", nameKr: "원페어" });
    });

    it("다른 랭크이면 하이카드를 반환한다", () => {
      const result = evaluateBestHand([card("A", "spades"), card("K", "hearts")]);
      expect(result?.rank).toBe(0);
      expect(result?.name).toBe("High Card");
      expect(result?.nameKr).toContain("하이카드");
      expect(result?.nameKr).toContain("A");
    });
  });

  describe("5장 핸드", () => {
    it("로얄 플러시를 감지한다", () => {
      const cards: Card[] = [
        card("A", "spades"), card("K", "spades"), card("Q", "spades"),
        card("J", "spades"), card("10", "spades"),
      ];
      const result = evaluateBestHand(cards);
      expect(result).toEqual({ rank: 9, name: "Royal Flush", nameKr: "로얄 플러시" });
    });

    it("스트레이트 플러시를 감지한다", () => {
      const cards: Card[] = [
        card("9", "hearts"), card("8", "hearts"), card("7", "hearts"),
        card("6", "hearts"), card("5", "hearts"),
      ];
      const result = evaluateBestHand(cards);
      expect(result).toEqual({ rank: 8, name: "Straight Flush", nameKr: "스트레이트 플러시" });
    });

    it("포카드를 감지한다", () => {
      const cards: Card[] = [
        card("K", "spades"), card("K", "hearts"), card("K", "diamonds"),
        card("K", "clubs"), card("2", "spades"),
      ];
      const result = evaluateBestHand(cards);
      expect(result).toEqual({ rank: 7, name: "Four of a Kind", nameKr: "포카드" });
    });

    it("풀하우스를 감지한다", () => {
      const cards: Card[] = [
        card("Q", "spades"), card("Q", "hearts"), card("Q", "diamonds"),
        card("7", "clubs"), card("7", "spades"),
      ];
      const result = evaluateBestHand(cards);
      expect(result).toEqual({ rank: 6, name: "Full House", nameKr: "풀하우스" });
    });

    it("플러시를 감지한다", () => {
      const cards: Card[] = [
        card("A", "clubs"), card("J", "clubs"), card("8", "clubs"),
        card("5", "clubs"), card("2", "clubs"),
      ];
      const result = evaluateBestHand(cards);
      expect(result).toEqual({ rank: 5, name: "Flush", nameKr: "플러시" });
    });

    it("스트레이트를 감지한다", () => {
      const cards: Card[] = [
        card("10", "spades"), card("9", "hearts"), card("8", "diamonds"),
        card("7", "clubs"), card("6", "spades"),
      ];
      const result = evaluateBestHand(cards);
      expect(result).toEqual({ rank: 4, name: "Straight", nameKr: "스트레이트" });
    });

    it("A-2-3-4-5 로우 스트레이트를 감지한다", () => {
      const cards: Card[] = [
        card("A", "spades"), card("2", "hearts"), card("3", "diamonds"),
        card("4", "clubs"), card("5", "spades"),
      ];
      const result = evaluateBestHand(cards);
      expect(result).toEqual({ rank: 4, name: "Straight", nameKr: "스트레이트" });
    });

    it("트리플을 감지한다", () => {
      const cards: Card[] = [
        card("J", "spades"), card("J", "hearts"), card("J", "diamonds"),
        card("8", "clubs"), card("3", "spades"),
      ];
      const result = evaluateBestHand(cards);
      expect(result).toEqual({ rank: 3, name: "Three of a Kind", nameKr: "트리플" });
    });

    it("투페어를 감지한다", () => {
      const cards: Card[] = [
        card("10", "spades"), card("10", "hearts"), card("5", "diamonds"),
        card("5", "clubs"), card("A", "spades"),
      ];
      const result = evaluateBestHand(cards);
      expect(result).toEqual({ rank: 2, name: "Two Pair", nameKr: "투페어" });
    });

    it("원페어를 감지한다", () => {
      const cards: Card[] = [
        card("9", "spades"), card("9", "hearts"), card("A", "diamonds"),
        card("K", "clubs"), card("3", "spades"),
      ];
      const result = evaluateBestHand(cards);
      expect(result).toEqual({ rank: 1, name: "One Pair", nameKr: "원페어" });
    });

    it("하이카드를 감지한다", () => {
      const cards: Card[] = [
        card("A", "spades"), card("J", "hearts"), card("8", "diamonds"),
        card("5", "clubs"), card("2", "hearts"),
      ];
      const result = evaluateBestHand(cards);
      expect(result).toEqual({ rank: 0, name: "High Card", nameKr: "하이카드" });
    });
  });

  describe("7장", () => {
    it("7장에서 최고 5장 조합을 선택한다", () => {
      const cards: Card[] = [
        card("A", "spades"), card("K", "spades"), card("Q", "spades"),
        card("J", "spades"), card("10", "spades"),
        card("2", "hearts"), card("3", "diamonds"),
      ];
      const result = evaluateBestHand(cards);
      expect(result).toEqual({ rank: 9, name: "Royal Flush", nameKr: "로얄 플러시" });
    });

    it("7장에서 풀하우스보다 높은 포카드를 선택한다", () => {
      const cards: Card[] = [
        card("K", "spades"), card("K", "hearts"), card("K", "diamonds"),
        card("K", "clubs"), card("Q", "spades"),
        card("Q", "hearts"), card("3", "diamonds"),
      ];
      const result = evaluateBestHand(cards);
      expect(result?.rank).toBe(7);
      expect(result?.name).toBe("Four of a Kind");
    });
  });
});

describe("HAND_RANK_INFO", () => {
  it("10개의 핸드 랭크를 포함한다", () => {
    expect(HAND_RANK_INFO).toHaveLength(10);
  });

  it("rank 0~9 순서로 정렬되어 있다", () => {
    HAND_RANK_INFO.forEach((info, index) => {
      expect(info.rank).toBe(index);
    });
  });

  it("각 항목에 name과 nameKr을 포함한다", () => {
    for (const info of HAND_RANK_INFO) {
      expect(info.name).toBeTruthy();
      expect(info.nameKr).toBeTruthy();
    }
  });
});
