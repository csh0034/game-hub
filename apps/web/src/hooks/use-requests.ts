import { useEffect, useCallback } from "react";
import type { GameSocket } from "@/lib/socket";
import { useRequestStore } from "@/stores/request-store";
import type { CreateRequestPayload, UpdateRequestPayload, RequestLabel, RequestStatus } from "@game-hub/shared-types";

export function useRequests(socket: GameSocket | null) {
  const { requests, setRequests, addRequest, updateRequest, removeRequest } =
    useRequestStore();

  useEffect(() => {
    if (!socket) return;

    socket.emit("request:get-all", setRequests);
    socket.on("request:created", addRequest);
    socket.on("request:status-changed", updateRequest);
    socket.on("request:updated", updateRequest);
    socket.on("request:label-changed", updateRequest);
    socket.on("request:deleted", removeRequest);

    return () => {
      socket.off("request:created", addRequest);
      socket.off("request:status-changed", updateRequest);
      socket.off("request:updated", updateRequest);
      socket.off("request:label-changed", updateRequest);
      socket.off("request:deleted", removeRequest);
    };
  }, [socket, setRequests, addRequest, updateRequest, removeRequest]);

  const createRequest = useCallback(
    (payload: CreateRequestPayload): Promise<{ success: boolean; error?: string }> => {
      return new Promise((resolve) => {
        if (!socket) {
          resolve({ success: false, error: "소켓 연결이 없습니다" });
          return;
        }
        socket.emit("request:create", payload, (request, error) => {
          if (error || !request) {
            resolve({ success: false, error: error ?? "요청 생성 실패" });
          } else {
            resolve({ success: true });
          }
        });
      });
    },
    [socket],
  );

  const changeStatus = useCallback(
    (requestId: string, status: RequestStatus): Promise<{ success: boolean; error?: string }> => {
      return new Promise((resolve) => {
        if (!socket) {
          resolve({ success: false, error: "소켓 연결이 없습니다" });
          return;
        }
        socket.emit("request:change-status", { requestId, status }, resolve);
      });
    },
    [socket],
  );

  const updateRequestFields = useCallback(
    (payload: UpdateRequestPayload): Promise<{ success: boolean; error?: string }> => {
      return new Promise((resolve) => {
        if (!socket) {
          resolve({ success: false, error: "소켓 연결이 없습니다" });
          return;
        }
        socket.emit("request:update", payload, resolve);
      });
    },
    [socket],
  );

  const changeLabelRequest = useCallback(
    (requestId: string, label: RequestLabel): Promise<{ success: boolean; error?: string }> => {
      return new Promise((resolve) => {
        if (!socket) {
          resolve({ success: false, error: "소켓 연결이 없습니다" });
          return;
        }
        socket.emit("request:change-label", { requestId, label }, resolve);
      });
    },
    [socket],
  );

  const deleteRequest = useCallback(
    (requestId: string): Promise<{ success: boolean; error?: string }> => {
      return new Promise((resolve) => {
        if (!socket) {
          resolve({ success: false, error: "소켓 연결이 없습니다" });
          return;
        }
        socket.emit("request:delete", requestId, resolve);
      });
    },
    [socket],
  );

  return { requests, createRequest, changeStatus, updateRequestFields, changeLabelRequest, deleteRequest };
}
