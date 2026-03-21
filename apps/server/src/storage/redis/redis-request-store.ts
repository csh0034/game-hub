import type Redis from "ioredis";
import type { FeatureRequest } from "@game-hub/shared-types";
import type { RequestStore } from "../interfaces/request-store.js";

function normalizeRequest(raw: Record<string, unknown>): FeatureRequest {
  return {
    ...raw,
    adminResponse: raw.adminResponse ?? null,
    rejectedAt: raw.rejectedAt ?? null,
    inProgressAt: raw.inProgressAt ?? null,
  } as FeatureRequest;
}

export class RedisRequestStore implements RequestStore {
  constructor(private redis: Redis) {}

  async createRequest(request: FeatureRequest): Promise<void> {
    try {
      const pipeline = this.redis.pipeline();
      pipeline.set(`request:${request.id}`, JSON.stringify(request));
      pipeline.sadd("requests", request.id);
      await pipeline.exec();
    } catch (err) {
      console.error("[request-store] failed to create request:", err);
    }
  }

  async getRequest(id: string): Promise<FeatureRequest | null> {
    try {
      const data = await this.redis.get(`request:${id}`);
      return data ? normalizeRequest(JSON.parse(data) as Record<string, unknown>) : null;
    } catch (err) {
      console.error("[request-store] failed to get request:", err);
      return null;
    }
  }

  async getAllRequests(): Promise<FeatureRequest[]> {
    try {
      const ids = await this.redis.smembers("requests");
      if (ids.length === 0) return [];

      const pipeline = this.redis.pipeline();
      for (const id of ids) {
        pipeline.get(`request:${id}`);
      }
      const results = await pipeline.exec();
      if (!results) return [];

      const requests: FeatureRequest[] = [];
      const staleIds: string[] = [];

      for (let i = 0; i < results.length; i++) {
        const [err, data] = results[i];
        if (!err && data) {
          requests.push(normalizeRequest(JSON.parse(data as string) as Record<string, unknown>));
        } else if (!err && !data) {
          staleIds.push(ids[i]);
        }
      }

      if (staleIds.length > 0) {
        this.redis.srem("requests", ...staleIds).catch(() => {});
      }

      return requests.sort((a, b) => b.createdAt - a.createdAt);
    } catch (err) {
      console.error("[request-store] failed to get all requests:", err);
      return [];
    }
  }

  async updateRequest(request: FeatureRequest): Promise<void> {
    try {
      await this.redis.set(`request:${request.id}`, JSON.stringify(request));
    } catch (err) {
      console.error("[request-store] failed to update request:", err);
    }
  }

  async deleteRequest(id: string): Promise<void> {
    try {
      const pipeline = this.redis.pipeline();
      pipeline.del(`request:${id}`);
      pipeline.srem("requests", id);
      await pipeline.exec();
    } catch (err) {
      console.error("[request-store] failed to delete request:", err);
    }
  }
}
