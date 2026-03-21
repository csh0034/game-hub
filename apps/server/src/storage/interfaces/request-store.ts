import type { FeatureRequest } from "@game-hub/shared-types";

export interface RequestStore {
  createRequest(request: FeatureRequest): Promise<void>;
  getRequest(id: string): Promise<FeatureRequest | null>;
  getAllRequests(): Promise<FeatureRequest[]>;
  updateRequest(request: FeatureRequest): Promise<void>;
  deleteRequest(id: string): Promise<void>;
}
