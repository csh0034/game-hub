import type { FeatureRequest } from "@game-hub/shared-types";
import type { RequestStore } from "../interfaces/request-store.js";

export class InMemoryRequestStore implements RequestStore {
  private requests = new Map<string, FeatureRequest>();

  async createRequest(request: FeatureRequest): Promise<void> {
    this.requests.set(request.id, request);
  }

  async getRequest(id: string): Promise<FeatureRequest | null> {
    return this.requests.get(id) ?? null;
  }

  async getAllRequests(): Promise<FeatureRequest[]> {
    return Array.from(this.requests.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  async updateRequest(request: FeatureRequest): Promise<void> {
    this.requests.set(request.id, request);
  }

  async deleteRequest(id: string): Promise<void> {
    this.requests.delete(id);
  }
}
