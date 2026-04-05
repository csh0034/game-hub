import { describe, it, expect, vi, beforeEach } from "vitest";
import { RedisSessionStore } from "./redis-session-store.js";
import type { SocketData } from "@game-hub/shared-types";

function createMockRedis() {
  return {
    setex: vi.fn().mockResolvedValue("OK"),
    get: vi.fn().mockResolvedValue(null),
    del: vi.fn().mockResolvedValue(1),
  };
}

const sessionData: SocketData = {
  playerId: "socket-1",
  nickname: "홍길동",
  roomId: "room-1",
  authenticated: true,
  authenticatedAt: 1000,
};

describe("RedisSessionStore", () => {
  let redis: ReturnType<typeof createMockRedis>;
  let store: RedisSessionStore;

  beforeEach(() => {
    redis = createMockRedis();
    store = new RedisSessionStore(redis as never);
  });

  describe("saveSession", () => {
    it("세션을 24시간 TTL로 저장한다", async () => {
      await store.saveSession("socket-1", sessionData);
      expect(redis.setex).toHaveBeenCalledWith(
        "session:socket-1",
        86400,
        JSON.stringify(sessionData),
      );
    });
  });

  describe("getSession", () => {
    it("세션을 반환한다", async () => {
      redis.get.mockResolvedValue(JSON.stringify(sessionData));
      const result = await store.getSession("socket-1");
      expect(result).toEqual(sessionData);
    });

    it("없는 세션은 null을 반환한다", async () => {
      const result = await store.getSession("invalid");
      expect(result).toBeNull();
    });
  });

  describe("deleteSession", () => {
    it("세션을 삭제한다", async () => {
      await store.deleteSession("socket-1");
      expect(redis.del).toHaveBeenCalledWith("session:socket-1");
    });
  });

  describe("isNicknameTaken", () => {
    it("다른 소켓이 점유 중이면 true를 반환한다", async () => {
      redis.get.mockResolvedValue("other-socket");
      const result = await store.isNicknameTaken("홍길동", "socket-1");
      expect(result).toBe(true);
    });

    it("자기 자신이면 false를 반환한다", async () => {
      redis.get.mockResolvedValue("socket-1");
      const result = await store.isNicknameTaken("홍길동", "socket-1");
      expect(result).toBe(false);
    });

    it("점유자가 없으면 false를 반환한다", async () => {
      const result = await store.isNicknameTaken("홍길동", "socket-1");
      expect(result).toBe(false);
    });
  });

  describe("reserveNickname", () => {
    it("닉네임을 예약한다", async () => {
      await store.reserveNickname("홍길동", "socket-1");
      expect(redis.setex).toHaveBeenCalledWith("nickname:홍길동", 86400, "socket-1");
    });
  });

  describe("releaseNickname", () => {
    it("닉네임 예약을 해제한다", async () => {
      await store.releaseNickname("홍길동");
      expect(redis.del).toHaveBeenCalledWith("nickname:홍길동");
    });
  });

  describe("findSessionByNickname", () => {
    it("닉네임으로 세션을 찾는다", async () => {
      redis.get
        .mockResolvedValueOnce("socket-1") // nickname:홍길동
        .mockResolvedValueOnce(JSON.stringify(sessionData)); // session:socket-1
      const result = await store.findSessionByNickname("홍길동");
      expect(result).toEqual({ socketId: "socket-1", data: sessionData });
    });

    it("닉네임이 없으면 null을 반환한다", async () => {
      const result = await store.findSessionByNickname("없는닉네임");
      expect(result).toBeNull();
    });

    it("닉네임은 있지만 세션이 없으면 null을 반환한다", async () => {
      redis.get
        .mockResolvedValueOnce("socket-1") // nickname:홍길동
        .mockResolvedValueOnce(null); // session:socket-1
      const result = await store.findSessionByNickname("홍길동");
      expect(result).toBeNull();
    });

    it("Redis 에러 시 null을 반환한다", async () => {
      redis.get.mockRejectedValue(new Error("fail"));
      const result = await store.findSessionByNickname("홍길동");
      expect(result).toBeNull();
    });
  });

  describe("에러 처리", () => {
    it("saveSession Redis 에러 시 예외를 던지지 않는다", async () => {
      redis.setex.mockRejectedValue(new Error("fail"));
      await expect(store.saveSession("socket-1", sessionData)).resolves.toBeUndefined();
    });

    it("getSession Redis 에러 시 null을 반환한다", async () => {
      redis.get.mockRejectedValue(new Error("fail"));
      const result = await store.getSession("socket-1");
      expect(result).toBeNull();
    });

    it("deleteSession Redis 에러 시 예외를 던지지 않는다", async () => {
      redis.del.mockRejectedValue(new Error("fail"));
      await expect(store.deleteSession("socket-1")).resolves.toBeUndefined();
    });

    it("isNicknameTaken Redis 에러 시 false를 반환한다", async () => {
      redis.get.mockRejectedValue(new Error("fail"));
      const result = await store.isNicknameTaken("홍길동", "socket-1");
      expect(result).toBe(false);
    });

    it("reserveNickname Redis 에러 시 예외를 던지지 않는다", async () => {
      redis.setex.mockRejectedValue(new Error("fail"));
      await expect(store.reserveNickname("홍길동", "socket-1")).resolves.toBeUndefined();
    });

    it("releaseNickname Redis 에러 시 예외를 던지지 않는다", async () => {
      redis.del.mockRejectedValue(new Error("fail"));
      await expect(store.releaseNickname("홍길동")).resolves.toBeUndefined();
    });
  });
});
