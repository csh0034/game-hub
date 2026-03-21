import { create } from "zustand";
import type { FeatureRequest } from "@game-hub/shared-types";

interface RequestStore {
  requests: FeatureRequest[];
  setRequests: (requests: FeatureRequest[]) => void;
  addRequest: (request: FeatureRequest) => void;
  updateRequest: (request: FeatureRequest) => void;
}

export const useRequestStore = create<RequestStore>((set) => ({
  requests: [],
  setRequests: (requests) => set({ requests }),
  addRequest: (request) =>
    set((state) => ({
      requests: [request, ...state.requests],
    })),
  updateRequest: (request) =>
    set((state) => ({
      requests: state.requests.map((r) =>
        r.id === request.id ? request : r,
      ),
    })),
}));
