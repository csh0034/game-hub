import { describe, it, expect, beforeEach, vi } from "vitest";
import { setupConceptVoteHandler } from "./concept-vote-handler.js";
import { createMockSocket, createMockIo } from "./socket-test-helpers.js";
import { InMemoryConceptVoteStore } from "../storage/in-memory/in-memory-concept-vote-store.js";

function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("concept-vote-handler", () => {
  let io: ReturnType<typeof createMockIo>;
  let socket: ReturnType<typeof createMockSocket>;
  let store: InMemoryConceptVoteStore;

  beforeEach(() => {
    io = createMockIo();
    socket = createMockSocket("socket-1", "Player1");
    store = new InMemoryConceptVoteStore();
    setupConceptVoteHandler(io as never, socket as never, store);
  });

  describe("concept-vote:get", () => {
    it("현재 투표 상태를 반환한다", async () => {
      const callback = vi.fn();
      socket._trigger("concept-vote:get", "browser-1", callback);
      await flushPromises();
      expect(callback).toHaveBeenCalledWith({ votes: {} });
    });
  });

  describe("concept-vote:toggle", () => {
    it("유효한 컨셉에 투표하면 성공한다", async () => {
      const callback = vi.fn();
      socket._trigger("concept-vote:toggle", "1-retro-arcade.html", "browser-1", callback);
      await flushPromises();
      expect(callback).toHaveBeenCalledWith({ success: true });
    });

    it("투표 후 전체 브로드캐스트한다", async () => {
      socket._trigger("concept-vote:toggle", "1-retro-arcade.html", "browser-1", vi.fn());
      await flushPromises();
      expect(io.emit).toHaveBeenCalledWith("concept-vote:updated", {
        votes: { "1-retro-arcade.html": ["browser-1"] },
      });
    });

    it("잘못된 컨셉 파일이면 실패한다", async () => {
      const callback = vi.fn();
      socket._trigger("concept-vote:toggle", "invalid.html", "browser-1", callback);
      await flushPromises();
      expect(callback).toHaveBeenCalledWith({ success: false, error: "잘못된 컨셉입니다" });
    });

    it("browserId가 없으면 실패한다", async () => {
      const callback = vi.fn();
      socket._trigger("concept-vote:toggle", "1-retro-arcade.html", "", callback);
      await flushPromises();
      expect(callback).toHaveBeenCalledWith({ success: false, error: "브라우저 ID가 필요합니다" });
    });

    it("같은 컨셉을 다시 투표하면 토글(취소)된다", async () => {
      socket._trigger("concept-vote:toggle", "1-retro-arcade.html", "browser-1", vi.fn());
      await flushPromises();
      socket._trigger("concept-vote:toggle", "1-retro-arcade.html", "browser-1", vi.fn());
      await flushPromises();
      expect(io.emit).toHaveBeenLastCalledWith("concept-vote:updated", { votes: {} });
    });
  });
});
