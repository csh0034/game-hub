import { describe, it, expect, vi, beforeEach } from "vitest";
import { RedisChatStore } from "./redis-chat-store.js";
import type { ChatMessage } from "@game-hub/shared-types";

function createMockPipeline() {
  const pipeline = {
    del: vi.fn().mockReturnThis(),
    rpush: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([]),
  };
  return pipeline;
}

function createMockRedis() {
  const pipeline = createMockPipeline();
  return {
    rpush: vi.fn().mockResolvedValue(1),
    ltrim: vi.fn().mockResolvedValue("OK"),
    lrange: vi.fn().mockResolvedValue([]),
    del: vi.fn().mockResolvedValue(1),
    lrem: vi.fn().mockResolvedValue(1),
    pipeline: vi.fn(() => pipeline),
    _pipeline: pipeline,
  };
}

const msg: ChatMessage = {
  id: "msg-1",
  playerId: "p1",
  nickname: "Player1",
  message: "hello",
  timestamp: 1000,
};

describe("RedisChatStore", () => {
  let redis: ReturnType<typeof createMockRedis>;
  let store: RedisChatStore;

  beforeEach(() => {
    redis = createMockRedis();
    store = new RedisChatStore(redis as never);
  });

  describe("pushLobbyMessage", () => {
    it("로비 채팅을 Redis LIST에 추가하고 50개로 제한한다", async () => {
      await store.pushLobbyMessage(msg);
      expect(redis.rpush).toHaveBeenCalledWith("chat:lobby", JSON.stringify(msg));
      expect(redis.ltrim).toHaveBeenCalledWith("chat:lobby", -50, -1);
    });
  });

  describe("getLobbyHistory", () => {
    it("로비 채팅 이력을 반환한다", async () => {
      redis.lrange.mockResolvedValue([JSON.stringify(msg)]);
      const result = await store.getLobbyHistory();
      expect(result).toEqual([msg]);
      expect(redis.lrange).toHaveBeenCalledWith("chat:lobby", 0, -1);
    });

    it("Redis 에러 시 빈 배열을 반환한다", async () => {
      redis.lrange.mockRejectedValue(new Error("fail"));
      const result = await store.getLobbyHistory();
      expect(result).toEqual([]);
    });
  });

  describe("pushRoomMessage", () => {
    it("방 채팅을 Redis LIST에 추가한다", async () => {
      await store.pushRoomMessage("room-1", msg);
      expect(redis.rpush).toHaveBeenCalledWith("chat:room:room-1", JSON.stringify(msg));
      expect(redis.ltrim).toHaveBeenCalledWith("chat:room:room-1", -50, -1);
    });
  });

  describe("getRoomHistory", () => {
    it("방 채팅 이력을 반환한다", async () => {
      redis.lrange.mockResolvedValue([JSON.stringify(msg)]);
      const result = await store.getRoomHistory("room-1");
      expect(result).toEqual([msg]);
    });
  });

  describe("deleteRoomHistory", () => {
    it("방 채팅 이력을 삭제한다", async () => {
      await store.deleteRoomHistory("room-1");
      expect(redis.del).toHaveBeenCalledWith("chat:room:room-1");
    });
  });

  describe("deleteLobbyMessage", () => {
    it("로비 메시지를 ID로 삭제한다", async () => {
      redis.lrange.mockResolvedValue([JSON.stringify(msg)]);
      const result = await store.deleteLobbyMessage("msg-1");
      expect(result).toBe(true);
      expect(redis.lrem).toHaveBeenCalledWith("chat:lobby", 1, JSON.stringify(msg));
    });

    it("존재하지 않는 메시지 삭제 시 false를 반환한다", async () => {
      redis.lrange.mockResolvedValue([JSON.stringify(msg)]);
      const result = await store.deleteLobbyMessage("nonexistent");
      expect(result).toBe(false);
    });
  });

  describe("deleteRoomMessage", () => {
    it("방 메시지를 ID로 삭제한다", async () => {
      redis.lrange.mockResolvedValue([JSON.stringify(msg)]);
      const result = await store.deleteRoomMessage("room-1", "msg-1");
      expect(result).toBe(true);
      expect(redis.lrem).toHaveBeenCalledWith("chat:room:room-1", 1, JSON.stringify(msg));
    });

    it("존재하지 않는 메시지 삭제 시 false를 반환한다", async () => {
      redis.lrange.mockResolvedValue([]);
      const result = await store.deleteRoomMessage("room-1", "nonexistent");
      expect(result).toBe(false);
    });

    it("Redis 에러 시 false를 반환한다", async () => {
      redis.lrange.mockRejectedValue(new Error("fail"));
      const result = await store.deleteRoomMessage("room-1", "msg-1");
      expect(result).toBe(false);
    });
  });

  describe("migrateMessages (getLobbyHistory를 통해)", () => {
    it("id가 없는 메시지에 UUID를 부여하고 Redis를 업데이트한다", async () => {
      const oldMsg = { playerId: "p1", nickname: "Player1", message: "hello", timestamp: 1000 };
      redis.lrange.mockResolvedValue([JSON.stringify(oldMsg)]);

      const result = await store.getLobbyHistory();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBeDefined();
      expect(redis._pipeline.del).toHaveBeenCalledWith("chat:lobby");
      expect(redis._pipeline.rpush).toHaveBeenCalled();
      expect(redis._pipeline.exec).toHaveBeenCalled();
    });
  });

  describe("pushLobbyMessage 에러 처리", () => {
    it("Redis 에러 시 예외를 던지지 않는다", async () => {
      redis.rpush.mockRejectedValue(new Error("fail"));
      await expect(store.pushLobbyMessage(msg)).resolves.toBeUndefined();
    });
  });

  describe("pushRoomMessage 에러 처리", () => {
    it("Redis 에러 시 예외를 던지지 않는다", async () => {
      redis.rpush.mockRejectedValue(new Error("fail"));
      await expect(store.pushRoomMessage("room-1", msg)).resolves.toBeUndefined();
    });
  });

  describe("getRoomHistory 에러 처리", () => {
    it("Redis 에러 시 빈 배열을 반환한다", async () => {
      redis.lrange.mockRejectedValue(new Error("fail"));
      const result = await store.getRoomHistory("room-1");
      expect(result).toEqual([]);
    });
  });

  describe("deleteRoomHistory 에러 처리", () => {
    it("Redis 에러 시 예외를 던지지 않는다", async () => {
      redis.del.mockRejectedValue(new Error("fail"));
      await expect(store.deleteRoomHistory("room-1")).resolves.toBeUndefined();
    });
  });

  describe("deleteLobbyMessage 에러 처리", () => {
    it("Redis 에러 시 false를 반환한다", async () => {
      redis.lrange.mockRejectedValue(new Error("fail"));
      const result = await store.deleteLobbyMessage("msg-1");
      expect(result).toBe(false);
    });
  });
});
