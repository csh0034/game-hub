import type Redis from "ioredis";
import type { ConceptVoteStore } from "../interfaces/concept-vote-store.js";

const KEY_PREFIX = "concept-vote:";
const KNOWN_CONCEPTS = [
  "1-retro-arcade.html",
  "2-kawaii-pastel.html",
  "3-terminal-hacker.html",
  "4-gradient-glass.html",
  "5-neo-tokyo.html",
  "6-clay-3d.html",
];

export class RedisConceptVoteStore implements ConceptVoteStore {
  constructor(private redis: Redis) {}

  async toggle(conceptFile: string, browserId: string): Promise<Record<string, string[]>> {
    try {
      const key = KEY_PREFIX + conceptFile;
      const exists = await this.redis.sismember(key, browserId);
      if (exists) await this.redis.srem(key, browserId);
      else await this.redis.sadd(key, browserId);
    } catch (err) {
      console.error("[concept-vote-store] toggle failed:", err);
    }
    return this.getAll();
  }

  async getAll(): Promise<Record<string, string[]>> {
    const result: Record<string, string[]> = {};
    try {
      for (const concept of KNOWN_CONCEPTS) {
        const members = await this.redis.smembers(KEY_PREFIX + concept);
        if (members.length > 0) result[concept] = members;
      }
    } catch (err) {
      console.error("[concept-vote-store] getAll failed:", err);
    }
    return result;
  }
}
