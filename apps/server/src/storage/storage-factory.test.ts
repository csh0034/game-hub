import { describe, it, expect } from "vitest";
import { createInMemoryStorage, createStorage } from "./index.js";
import { InMemoryChatStore } from "./in-memory/in-memory-chat-store.js";
import { InMemoryRoomStore } from "./in-memory/in-memory-room-store.js";
import { InMemorySessionStore } from "./in-memory/in-memory-session-store.js";
import { InMemoryRequestStore } from "./in-memory/in-memory-request-store.js";
import { InMemoryRankingStore } from "./in-memory/in-memory-ranking-store.js";
import { RedisChatStore } from "./redis/redis-chat-store.js";
import { RedisRoomStore } from "./redis/redis-room-store.js";
import { RedisSessionStore } from "./redis/redis-session-store.js";
import { RedisRequestStore } from "./redis/redis-request-store.js";
import { RedisRankingStore } from "./redis/redis-ranking-store.js";
import type Redis from "ioredis";

describe("Storage Factory", () => {
  describe("createInMemoryStorage", () => {
    it("모든 스토어를 포함한 Storage를 반환한다", () => {
      const storage = createInMemoryStorage();

      expect(storage.chatStore).toBeInstanceOf(InMemoryChatStore);
      expect(storage.roomStore).toBeInstanceOf(InMemoryRoomStore);
      expect(storage.sessionStore).toBeInstanceOf(InMemorySessionStore);
      expect(storage.requestStore).toBeInstanceOf(InMemoryRequestStore);
      expect(storage.rankingStore).toBeInstanceOf(InMemoryRankingStore);
    });
  });

  describe("createStorage", () => {
    it("모든 스토어를 포함한 Storage를 반환한다", () => {
      const mockRedis = {} as Redis;

      const storage = createStorage(mockRedis);

      expect(storage.chatStore).toBeInstanceOf(RedisChatStore);
      expect(storage.roomStore).toBeInstanceOf(RedisRoomStore);
      expect(storage.sessionStore).toBeInstanceOf(RedisSessionStore);
      expect(storage.requestStore).toBeInstanceOf(RedisRequestStore);
      expect(storage.rankingStore).toBeInstanceOf(RedisRankingStore);
    });
  });
});
