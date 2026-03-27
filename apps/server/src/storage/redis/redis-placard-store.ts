import type Redis from "ioredis";
import type { PlacardStore } from "../interfaces/placard-store.js";

const KEY = "placard:text";

export class RedisPlacardStore implements PlacardStore {
  constructor(private redis: Redis) {}

  async getText(): Promise<string | null> {
    try {
      return await this.redis.get(KEY);
    } catch (err) {
      console.error("[placard-store] failed to get text:", err);
      return null;
    }
  }

  async setText(text: string | null): Promise<void> {
    try {
      if (text === null) {
        await this.redis.del(KEY);
      } else {
        await this.redis.set(KEY, text);
      }
    } catch (err) {
      console.error("[placard-store] failed to set text:", err);
    }
  }
}
