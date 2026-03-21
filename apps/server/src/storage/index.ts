import type Redis from "ioredis";
import type { ChatStore } from "./chat-store.js";
import type { RoomStore } from "./room-store.js";
import type { SessionStore } from "./session-store.js";
import type { RequestStore } from "./request-store.js";
import { RedisChatStore } from "./chat-store.js";
import { RedisRoomStore } from "./room-store.js";
import { RedisSessionStore } from "./session-store.js";
import { RedisRequestStore } from "./request-store.js";
import { InMemoryChatStore } from "./in-memory-chat-store.js";
import { InMemorySessionStore } from "./in-memory-session-store.js";

export type { ChatStore } from "./chat-store.js";
export type { RoomStore } from "./room-store.js";
export type { SessionStore } from "./session-store.js";
export type { RequestStore } from "./request-store.js";
export { getRedisClient, connectRedis, closeRedis } from "./redis-client.js";

export function createStorage(redis: Redis): {
  chatStore: ChatStore;
  roomStore: RoomStore;
  sessionStore: SessionStore;
  requestStore: RequestStore;
} {
  return {
    chatStore: new RedisChatStore(redis),
    roomStore: new RedisRoomStore(redis),
    sessionStore: new RedisSessionStore(redis),
    requestStore: new RedisRequestStore(redis),
  };
}

export function createInMemoryStorage(): {
  chatStore: ChatStore;
  sessionStore: SessionStore;
} {
  return {
    chatStore: new InMemoryChatStore(),
    sessionStore: new InMemorySessionStore(),
  };
}
