export interface FeatureRequest {
  id: string;
  title: string;
  description: string;
  author: string;
  status: "open" | "resolved";
  createdAt: number;
  resolvedAt: number | null;
  commitHash: string | null;
  commitUrl: string | null;
}

export interface CreateRequestPayload {
  title: string;
  description: string;
}

export interface ResolveRequestPayload {
  requestId: string;
  commitHash: string;
}
