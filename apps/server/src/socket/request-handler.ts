import { randomUUID } from "crypto";
import type { Server, Socket } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
  FeatureRequest,
} from "@game-hub/shared-types";
import type { RequestStore } from "../storage/index.js";
import { isAdmin } from "../admin.js";

type IOServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

const GITHUB_REPO_URL = process.env.GITHUB_REPO_URL || "https://github.com/csh0034/game-hub";

// 인메모리 폴백 (Redis 미사용 시)
const inMemoryRequests = new Map<string, FeatureRequest>();

export function setupRequestHandler(
  io: IOServer,
  socket: IOSocket,
  requestStore?: RequestStore,
) {
  socket.on("request:get-all", async (callback) => {
    if (requestStore) {
      const requests = await requestStore.getAllRequests();
      callback(requests);
    } else {
      const requests = Array.from(inMemoryRequests.values()).sort(
        (a, b) => b.createdAt - a.createdAt,
      );
      callback(requests);
    }
  });

  socket.on("request:create", async (payload, callback) => {
    if (!socket.data.authenticated) {
      callback(null, "인증이 필요합니다");
      return;
    }

    const title = payload.title?.trim();
    const description = payload.description?.trim();

    if (!title || title.length > 100) {
      callback(null, "제목은 1~100자여야 합니다");
      return;
    }

    if (!description || description.length > 1000) {
      callback(null, "설명은 1~1000자여야 합니다");
      return;
    }

    const request: FeatureRequest = {
      id: randomUUID(),
      title,
      description,
      author: socket.data.nickname,
      status: "open",
      createdAt: Date.now(),
      resolvedAt: null,
      commitHash: null,
      commitUrl: null,
    };

    if (requestStore) {
      await requestStore.createRequest(request);
    } else {
      inMemoryRequests.set(request.id, request);
    }

    io.emit("request:created", request);
    callback(request);
  });

  socket.on("request:resolve", async (payload, callback) => {
    if (!socket.data.authenticated) {
      callback({ success: false, error: "인증이 필요합니다" });
      return;
    }

    if (!isAdmin(socket.data.nickname)) {
      callback({ success: false, error: "권한이 없습니다" });
      return;
    }

    const { requestId, commitHash } = payload;
    if (!commitHash?.trim()) {
      callback({ success: false, error: "커밋 해시를 입력해주세요" });
      return;
    }

    let request: FeatureRequest | null = null;
    if (requestStore) {
      request = await requestStore.getRequest(requestId);
    } else {
      request = inMemoryRequests.get(requestId) ?? null;
    }

    if (!request) {
      callback({ success: false, error: "요청사항을 찾을 수 없습니다" });
      return;
    }

    const hash = commitHash.trim();
    const resolved: FeatureRequest = {
      ...request,
      status: "resolved",
      resolvedAt: Date.now(),
      commitHash: hash,
      commitUrl: GITHUB_REPO_URL ? `${GITHUB_REPO_URL}/commit/${hash}` : null,
    };

    if (requestStore) {
      await requestStore.updateRequest(resolved);
    } else {
      inMemoryRequests.set(resolved.id, resolved);
    }

    io.emit("request:resolved", resolved);
    callback({ success: true });
  });

  socket.on("request:delete", async (requestId, callback) => {
    if (!socket.data.authenticated) {
      callback({ success: false, error: "인증이 필요합니다" });
      return;
    }

    if (!isAdmin(socket.data.nickname)) {
      callback({ success: false, error: "권한이 없습니다" });
      return;
    }

    let request: FeatureRequest | null = null;
    if (requestStore) {
      request = await requestStore.getRequest(requestId);
    } else {
      request = inMemoryRequests.get(requestId) ?? null;
    }

    if (!request) {
      callback({ success: false, error: "요청사항을 찾을 수 없습니다" });
      return;
    }

    if (requestStore) {
      await requestStore.deleteRequest(requestId);
    } else {
      inMemoryRequests.delete(requestId);
    }

    io.emit("request:deleted", requestId);
    callback({ success: true });
  });
}
