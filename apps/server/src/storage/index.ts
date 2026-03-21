import type Redis from "ioredis";
import type { ChatStore } from "./interfaces/chat-store.js";
import type { RoomStore } from "./interfaces/room-store.js";
import type { SessionStore } from "./interfaces/session-store.js";
import type { RequestStore } from "./interfaces/request-store.js";
import { RedisChatStore, RedisRoomStore, RedisSessionStore, RedisRequestStore } from "./redis/index.js";
import { InMemoryChatStore, InMemoryRoomStore, InMemorySessionStore, InMemoryRequestStore } from "./in-memory/index.js";

export type { ChatStore } from "./interfaces/index.js";
export type { RoomStore } from "./interfaces/index.js";
export type { SessionStore } from "./interfaces/index.js";
export type { RequestStore } from "./interfaces/index.js";
export { getRedisClient, connectRedis, closeRedis } from "./redis-client.js";

export interface Storage {
  chatStore: ChatStore;
  roomStore: RoomStore;
  sessionStore: SessionStore;
  requestStore: RequestStore;
}

export function createStorage(redis: Redis): Storage {
  return {
    chatStore: new RedisChatStore(redis),
    roomStore: new RedisRoomStore(redis),
    sessionStore: new RedisSessionStore(redis),
    requestStore: new RedisRequestStore(redis),
  };
}

export function createInMemoryStorage(): Storage {
  return {
    chatStore: new InMemoryChatStore(),
    roomStore: new InMemoryRoomStore(),
    sessionStore: new InMemorySessionStore(),
    requestStore: new InMemoryRequestStore(),
  };
}
