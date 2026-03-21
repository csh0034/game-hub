import { useEffect, useCallback } from "react";
import type { GameSocket } from "@/lib/socket";
import { useRequestStore } from "@/stores/request-store";
import type { CreateRequestPayload } from "@game-hub/shared-types";

export function useRequests(socket: GameSocket | null) {
  const { requests, setRequests, addRequest, updateRequest, removeRequest } =
    useRequestStore();

  useEffect(() => {
    if (!socket) return;

    socket.emit("request:get-all", setRequests);
    socket.on("request:created", addRequest);
    socket.on("request:resolved", updateRequest);
    socket.on("request:deleted", removeRequest);

    return () => {
      socket.off("request:created", addRequest);
      socket.off("request:resolved", updateRequest);
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

  const resolveRequest = useCallback(
    (requestId: string, commitHash: string): Promise<{ success: boolean; error?: string }> => {
      return new Promise((resolve) => {
        if (!socket) {
          resolve({ success: false, error: "소켓 연결이 없습니다" });
          return;
        }
        socket.emit("request:resolve", { requestId, commitHash }, resolve);
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

  return { requests, createRequest, resolveRequest, deleteRequest };
}
