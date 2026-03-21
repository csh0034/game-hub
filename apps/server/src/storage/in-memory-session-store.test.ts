import { describe, it, expect, beforeEach } from "vitest";
import type { SocketData } from "@game-hub/shared-types";
import { InMemorySessionStore } from "./in-memory-session-store.js";

function createSocketData(nickname: string): SocketData {
  return {
    playerId: `player-${nickname}`,
    nickname,
    roomId: null,
    authenticated: true,
    authenticatedAt: Date.now(),
  };
}

describe("InMemorySessionStore", () => {
  let store: InMemorySessionStore;

  beforeEach(() => {
    store = new InMemorySessionStore();
  });

  describe("saveSession / getSession", () => {
    it("세션을 저장하고 조회한다", async () => {
      const data = createSocketData("Alice");
      await store.saveSession("sock-1", data);

      expect(await store.getSession("sock-1")).toEqual(data);
    });

    it("존재하지 않는 세션은 null을 반환한다", async () => {
      expect(await store.getSession("unknown")).toBeNull();
    });
  });

  describe("deleteSession", () => {
    it("세션을 삭제한다", async () => {
      await store.saveSession("sock-1", createSocketData("Alice"));
      await store.deleteSession("sock-1");

      expect(await store.getSession("sock-1")).toBeNull();
    });
  });

  describe("isNicknameTaken", () => {
    it("다른 소켓이 점유 중이면 true를 반환한다", async () => {
      await store.reserveNickname("Alice", "sock-1");

      expect(await store.isNicknameTaken("Alice", "sock-2")).toBe(true);
    });

    it("자기 자신이 점유 중이면 false를 반환한다", async () => {
      await store.reserveNickname("Alice", "sock-1");

      expect(await store.isNicknameTaken("Alice", "sock-1")).toBe(false);
    });

    it("점유되지 않은 닉네임은 false를 반환한다", async () => {
      expect(await store.isNicknameTaken("Bob", "sock-1")).toBe(false);
    });
  });

  describe("reserveNickname / releaseNickname", () => {
    it("닉네임을 예약하고 해제한다", async () => {
      await store.reserveNickname("Alice", "sock-1");
      expect(await store.isNicknameTaken("Alice", "sock-2")).toBe(true);

      await store.releaseNickname("Alice");
      expect(await store.isNicknameTaken("Alice", "sock-2")).toBe(false);
    });
  });

  describe("findSessionByNickname", () => {
    it("닉네임으로 세션을 찾는다", async () => {
      const data = createSocketData("Alice");
      await store.saveSession("sock-1", data);
      await store.reserveNickname("Alice", "sock-1");

      const result = await store.findSessionByNickname("Alice");
      expect(result).toEqual({ socketId: "sock-1", data });
    });

    it("닉네임이 예약되지 않았으면 null을 반환한다", async () => {
      expect(await store.findSessionByNickname("Unknown")).toBeNull();
    });

    it("닉네임은 있지만 세션이 없으면 null을 반환한다", async () => {
      await store.reserveNickname("Alice", "sock-1");

      expect(await store.findSessionByNickname("Alice")).toBeNull();
    });
  });
});
