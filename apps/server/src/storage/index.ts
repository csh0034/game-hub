import type Redis from "ioredis";
import type { ChatStore } from "./chat-store.js";
import type { RoomStore } from "./room-store.js";
import type { SessionStore } from "./session-store.js";
import { RedisChatStore } from "./chat-store.js";
import { RedisRoomStore } from "./room-store.js";
import { RedisSessionStore } from "./session-store.js";

export type { ChatStore } from "./chat-store.js";
export type { RoomStore } from "./room-store.js";
export type { SessionStore } from "./session-store.js";
export { getRedisClient, closeRedis } from "./redis-client.js";

export function createStorage(redis: Redis): {
  chatStore: ChatStore;
  roomStore: RoomStore;
  sessionStore: SessionStore;
} {
  return {
    chatStore: new RedisChatStore(redis),
    roomStore: new RedisRoomStore(redis),
    sessionStore: new RedisSessionStore(redis),
  };
}
