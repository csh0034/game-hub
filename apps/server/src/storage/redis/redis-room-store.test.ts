import { describe, it, expect, vi, beforeEach } from "vitest";
import { RedisRoomStore } from "./redis-room-store.js";
import type { Room } from "@game-hub/shared-types";

function createMockPipeline() {
  const pipeline = {
    set: vi.fn().mockReturnThis(),
    sadd: vi.fn().mockReturnThis(),
    del: vi.fn().mockReturnThis(),
    srem: vi.fn().mockReturnThis(),
    get: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([]),
  };
  return pipeline;
}

function createMockRedis() {
  const pipeline = createMockPipeline();
  return {
    pipeline: vi.fn(() => pipeline),
    get: vi.fn().mockResolvedValue(null),
    smembers: vi.fn().mockResolvedValue([]),
    srem: vi.fn().mockResolvedValue(1),
    _pipeline: pipeline,
  };
}

const room: Room = {
  id: "ABC123",
  name: "테스트 방",
  gameType: "gomoku",
  hostId: "host-1",
  players: [{ id: "host-1", nickname: "Host", isReady: true }],
  maxPlayers: 2,
  status: "waiting",
  createdAt: 1000,
};

describe("RedisRoomStore", () => {
  let redis: ReturnType<typeof createMockRedis>;
  let store: RedisRoomStore;

  beforeEach(() => {
    redis = createMockRedis();
    store = new RedisRoomStore(redis as never);
  });

  describe("saveRoom", () => {
    it("방을 Redis에 저장하고 rooms SET에 추가한다", async () => {
      await store.saveRoom(room);
      expect(redis._pipeline.set).toHaveBeenCalledWith("room:ABC123", JSON.stringify(room));
      expect(redis._pipeline.sadd).toHaveBeenCalledWith("rooms", "ABC123");
      expect(redis._pipeline.exec).toHaveBeenCalled();
    });
  });

  describe("getRoom", () => {
    it("방을 반환한다", async () => {
      redis.get.mockResolvedValue(JSON.stringify(room));
      const result = await store.getRoom("ABC123");
      expect(result).toEqual(room);
    });

    it("없는 방은 null을 반환한다", async () => {
      const result = await store.getRoom("invalid");
      expect(result).toBeNull();
    });
  });

  describe("getAllRooms", () => {
    it("모든 방을 반환한다", async () => {
      redis.smembers.mockResolvedValue(["ABC123"]);
      const pipeline = createMockPipeline();
      pipeline.exec.mockResolvedValue([[null, JSON.stringify(room)]]);
      redis.pipeline.mockReturnValue(pipeline as never);

      const result = await store.getAllRooms();
      expect(result).toEqual([room]);
    });

    it("빈 목록이면 빈 배열을 반환한다", async () => {
      const result = await store.getAllRooms();
      expect(result).toEqual([]);
    });
  });

  describe("deleteRoom", () => {
    it("방을 삭제하고 rooms SET에서 제거한다", async () => {
      await store.deleteRoom("ABC123");
      expect(redis._pipeline.del).toHaveBeenCalledWith("room:ABC123");
      expect(redis._pipeline.srem).toHaveBeenCalledWith("rooms", "ABC123");
    });
  });
});
