import type Redis from "ioredis";
import type { PlacardStore } from "../interfaces/placard-store.js";

const KEY = "placard:items";
const OLD_KEY = "placard:text";

export class RedisPlacardStore implements PlacardStore {
  constructor(private redis: Redis) {}

  async getItems(): Promise<string[]> {
    try {
      const json = await this.redis.get(KEY);
      if (json) return JSON.parse(json) as string[];

      const oldText = await this.redis.get(OLD_KEY);
      if (oldText) {
        const items = [oldText];
        await this.redis.set(KEY, JSON.stringify(items));
        await this.redis.del(OLD_KEY);
        return items;
      }

      return [];
    } catch (err) {
      console.error("[placard-store] failed to get items:", err);
      return [];
    }
  }

  async setItems(items: string[]): Promise<void> {
    try {
      if (items.length === 0) {
        await this.redis.del(KEY);
      } else {
        await this.redis.set(KEY, JSON.stringify(items));
      }
    } catch (err) {
      console.error("[placard-store] failed to set items:", err);
    }
  }
}
