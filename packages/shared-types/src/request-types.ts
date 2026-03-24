export type RequestStatus = "open" | "in-progress" | "rejected" | "resolved" | "stopped";

export type RequestLabel = "feature" | "bug" | "improvement" | "new-game";

export const REQUEST_LABELS: readonly RequestLabel[] = ["feature", "bug", "improvement", "new-game"] as const;

export interface FeatureRequest {
  id: string;
  title: string;
  description: string;
  label: RequestLabel;
  author: string;
  status: RequestStatus;
  createdAt: number;
  inProgressAt: number | null;
  rejectedAt: number | null;
  resolvedAt: number | null;
  stoppedAt: number | null;
  adminResponse: string | null;
  commitHash: string | null;
  commitUrl: string | null;
}

export interface CreateRequestPayload {
  title: string;
  description: string;
  label: RequestLabel;
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
  commitHash?: string;
  adminResponse?: string;
}

export interface StopRequestPayload {
  requestId: string;
  adminResponse: string;
}

export interface ChangeLabelPayload {
  requestId: string;
  label: RequestLabel;
}
