import { randomUUID } from "crypto";
import type { Server, Socket } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
  FeatureRequest,
} from "@game-hub/shared-types";
import { REQUEST_LABELS } from "@game-hub/shared-types";
import type { RequestStore } from "../storage/index.js";
import { isAdmin } from "../admin.js";

type IOServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

const GITHUB_REPO_URL = process.env.GITHUB_REPO_URL || "https://github.com/csh0034/game-hub";

export function setupRequestHandler(
  io: IOServer,
  socket: IOSocket,
  requestStore: RequestStore,
) {
  socket.on("request:get-all", async (callback) => {
    const requests = await requestStore.getAllRequests();
    callback(requests);
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

    const label = REQUEST_LABELS.includes(payload.label) ? payload.label : "feature";

    const request: FeatureRequest = {
      id: randomUUID(),
      title,
      description,
      label,
      author: socket.data.nickname,
      status: "open",
      createdAt: Date.now(),
      inProgressAt: null,
      rejectedAt: null,
      resolvedAt: null,
      stoppedAt: null,
      adminResponse: null,
      commitHash: null,
      commitUrl: null,
    };

    await requestStore.createRequest(request);

    io.emit("request:created", request);
    callback(request);
  });

  socket.on("request:change-status", async (payload, callback) => {
    if (!socket.data.authenticated) {
      callback({ success: false, error: "인증이 필요합니다" });
      return;
    }

    if (!isAdmin(socket.data.nickname)) {
      callback({ success: false, error: "권한이 없습니다" });
      return;
    }

    const { requestId, status: targetStatus } = payload;
    const request = await requestStore.getRequest(requestId);

    if (!request) {
      callback({ success: false, error: "요청사항을 찾을 수 없습니다" });
      return;
    }

    if (request.status === targetStatus) {
      callback({ success: true });
      return;
    }

    const now = Date.now();
    const updated: FeatureRequest = {
      ...request,
      status: targetStatus,
      inProgressAt: targetStatus === "in-progress" ? now : null,
      rejectedAt: targetStatus === "rejected" ? now : null,
      resolvedAt: targetStatus === "resolved" ? now : null,
      stoppedAt: targetStatus === "stopped" ? now : null,
      commitHash: targetStatus === "resolved" ? request.commitHash : null,
      commitUrl: targetStatus === "resolved" && request.commitHash && GITHUB_REPO_URL
        ? `${GITHUB_REPO_URL}/commit/${request.commitHash}` : null,
    };

    await requestStore.updateRequest(updated);

    io.emit("request:status-changed", updated);
    callback({ success: true });
  });

  socket.on("request:update", async (payload, callback) => {
    if (!socket.data.authenticated) {
      callback({ success: false, error: "인증이 필요합니다" });
      return;
    }

    if (!isAdmin(socket.data.nickname)) {
      callback({ success: false, error: "권한이 없습니다" });
      return;
    }

    const { requestId, title, description, adminResponse, commitHash } = payload;

    const request = await requestStore.getRequest(requestId);

    if (!request) {
      callback({ success: false, error: "요청사항을 찾을 수 없습니다" });
      return;
    }

    const newTitle = title?.trim();
    if (newTitle !== undefined && (!newTitle || newTitle.length > 100)) {
      callback({ success: false, error: "제목은 1~100자여야 합니다" });
      return;
    }

    const newDescription = description?.trim();
    if (newDescription !== undefined && (!newDescription || newDescription.length > 1000)) {
      callback({ success: false, error: "설명은 1~1000자여야 합니다" });
      return;
    }

    const hash = commitHash === undefined ? request.commitHash : (commitHash?.trim() || null);
    const updated: FeatureRequest = {
      ...request,
      ...(newTitle !== undefined && { title: newTitle }),
      ...(newDescription !== undefined && { description: newDescription }),
      ...(adminResponse !== undefined && { adminResponse: adminResponse === null ? null : (adminResponse.trim() || null) }),
      ...(commitHash !== undefined && {
        commitHash: hash,
        commitUrl: hash && GITHUB_REPO_URL ? `${GITHUB_REPO_URL}/commit/${hash}` : null,
      }),
    };

    await requestStore.updateRequest(updated);

    io.emit("request:updated", updated);
    callback({ success: true });
  });

  socket.on("request:change-label", async (payload, callback) => {
    if (!socket.data.authenticated) {
      callback({ success: false, error: "인증이 필요합니다" });
      return;
    }

    if (!isAdmin(socket.data.nickname)) {
      callback({ success: false, error: "권한이 없습니다" });
      return;
    }

    const { requestId, label } = payload;

    if (!REQUEST_LABELS.includes(label)) {
      callback({ success: false, error: "유효하지 않은 라벨입니다" });
      return;
    }

    const request = await requestStore.getRequest(requestId);

    if (!request) {
      callback({ success: false, error: "요청사항을 찾을 수 없습니다" });
      return;
    }

    const updated: FeatureRequest = {
      ...request,
      label,
    };

    await requestStore.updateRequest(updated);

    io.emit("request:label-changed", updated);
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

    const request = await requestStore.getRequest(requestId);

    if (!request) {
      callback({ success: false, error: "요청사항을 찾을 수 없습니다" });
      return;
    }

    await requestStore.deleteRequest(requestId);

    io.emit("request:deleted", requestId);
    callback({ success: true });
  });
}
