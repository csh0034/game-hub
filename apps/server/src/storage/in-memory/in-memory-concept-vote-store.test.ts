import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryConceptVoteStore } from "./in-memory-concept-vote-store.js";

describe("InMemoryConceptVoteStore", () => {
  let store: InMemoryConceptVoteStore;

  beforeEach(() => {
    store = new InMemoryConceptVoteStore();
  });

  describe("getAll", () => {
    it("초기 상태에서 빈 객체를 반환한다", async () => {
      const result = await store.getAll();
      expect(result).toEqual({});
    });
  });

  describe("toggle", () => {
    it("투표가 없으면 추가한다", async () => {
      const result = await store.toggle("1-retro-arcade.html", "browser-1");
      expect(result["1-retro-arcade.html"]).toContain("browser-1");
    });

    it("이미 투표한 경우 취소한다", async () => {
      await store.toggle("1-retro-arcade.html", "browser-1");
      const result = await store.toggle("1-retro-arcade.html", "browser-1");
      expect(result["1-retro-arcade.html"]).toBeUndefined();
    });

    it("여러 컨셉에 복수 투표할 수 있다", async () => {
      await store.toggle("1-retro-arcade.html", "browser-1");
      const result = await store.toggle("2-kawaii-pastel.html", "browser-1");
      expect(result["1-retro-arcade.html"]).toContain("browser-1");
      expect(result["2-kawaii-pastel.html"]).toContain("browser-1");
    });

    it("여러 사용자가 같은 컨셉에 투표할 수 있다", async () => {
      await store.toggle("1-retro-arcade.html", "browser-1");
      const result = await store.toggle("1-retro-arcade.html", "browser-2");
      expect(result["1-retro-arcade.html"]).toHaveLength(2);
      expect(result["1-retro-arcade.html"]).toContain("browser-1");
      expect(result["1-retro-arcade.html"]).toContain("browser-2");
    });

    it("투표 수가 0이 되면 결과에서 제외한다", async () => {
      await store.toggle("1-retro-arcade.html", "browser-1");
      const result = await store.toggle("1-retro-arcade.html", "browser-1");
      expect(Object.keys(result)).not.toContain("1-retro-arcade.html");
    });
  });
});
