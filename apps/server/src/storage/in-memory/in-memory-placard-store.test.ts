import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryPlacardStore } from "./in-memory-placard-store.js";

describe("InMemoryPlacardStore", () => {
  let store: InMemoryPlacardStore;

  beforeEach(() => {
    store = new InMemoryPlacardStore();
  });

  describe("getItems", () => {
    it("초기 상태에서 빈 배열을 반환한다", async () => {
      const result = await store.getItems();
      expect(result).toEqual([]);
    });
  });

  describe("setItems", () => {
    it("아이템 목록을 저장하고 조회한다", async () => {
      await store.setItems(["hello", "world"]);
      const result = await store.getItems();
      expect(result).toEqual(["hello", "world"]);
    });

    it("빈 배열로 설정하면 비운다", async () => {
      await store.setItems(["a", "b"]);
      await store.setItems([]);
      const result = await store.getItems();
      expect(result).toEqual([]);
    });

    it("이전 값을 덮어쓴다", async () => {
      await store.setItems(["a"]);
      await store.setItems(["b", "c"]);
      const result = await store.getItems();
      expect(result).toEqual(["b", "c"]);
    });
  });
});
