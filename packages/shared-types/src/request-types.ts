export type RequestStatus = "open" | "in-progress" | "rejected" | "resolved";

export interface FeatureRequest {
  id: string;
  title: string;
  description: string;
  author: string;
  status: RequestStatus;
  createdAt: number;
  inProgressAt: number | null;
  rejectedAt: number | null;
  resolvedAt: number | null;
  adminResponse: string | null;
  commitHash: string | null;
  commitUrl: string | null;
}

export interface CreateRequestPayload {
  title: string;
  description: string;
}

export interface AcceptRequestPayload {
  requestId: string;
  adminResponse?: string;
}

export interface RejectRequestPayload {
  requestId: string;
  adminResponse: string;
}

export interface ResolveRequestPayload {
  requestId: string;
  commitHash: string;
  adminResponse?: string;
}
