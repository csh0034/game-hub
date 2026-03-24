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

  socket.on("request:accept", async (payload, callback) => {
    if (!socket.data.authenticated) {
      callback({ success: false, error: "인증이 필요합니다" });
      return;
    }

    if (!isAdmin(socket.data.nickname)) {
      callback({ success: false, error: "권한이 없습니다" });
      return;
    }

    const { requestId, adminResponse } = payload;
    const request = await requestStore.getRequest(requestId);

    if (!request) {
      callback({ success: false, error: "요청사항을 찾을 수 없습니다" });
      return;
    }

    if (request.status !== "open") {
      callback({ success: false, error: "요청 상태의 항목만 수락할 수 있습니다" });
      return;
    }

    const accepted: FeatureRequest = {
      ...request,
      status: "in-progress",
      inProgressAt: Date.now(),
      adminResponse: adminResponse?.trim() || null,
    };

    await requestStore.updateRequest(accepted);

    io.emit("request:accepted", accepted);
    callback({ success: true });
  });

  socket.on("request:reject", async (payload, callback) => {
    if (!socket.data.authenticated) {
      callback({ success: false, error: "인증이 필요합니다" });
      return;
    }

    if (!isAdmin(socket.data.nickname)) {
      callback({ success: false, error: "권한이 없습니다" });
      return;
    }

    const { requestId, adminResponse } = payload;

    if (!adminResponse?.trim()) {
      callback({ success: false, error: "거부 사유를 입력해주세요" });
      return;
    }

    const request = await requestStore.getRequest(requestId);

    if (!request) {
      callback({ success: false, error: "요청사항을 찾을 수 없습니다" });
      return;
    }

    if (request.status !== "open" && request.status !== "in-progress") {
      callback({ success: false, error: "요청 또는 진행중 상태의 항목만 거부할 수 있습니다" });
      return;
    }

    const rejected: FeatureRequest = {
      ...request,
      status: "rejected",
      rejectedAt: Date.now(),
      adminResponse: adminResponse.trim(),
    };

    await requestStore.updateRequest(rejected);

    io.emit("request:rejected", rejected);
    callback({ success: true });
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

    const { requestId, commitHash, adminResponse } = payload;

    const request = await requestStore.getRequest(requestId);

    if (!request) {
      callback({ success: false, error: "요청사항을 찾을 수 없습니다" });
      return;
    }

    if (request.status !== "open" && request.status !== "in-progress") {
      callback({ success: false, error: "요청 또는 진행중 상태의 항목만 완료할 수 있습니다" });
      return;
    }

    const hash = commitHash?.trim() || null;
    const resolved: FeatureRequest = {
      ...request,
      status: "resolved",
      resolvedAt: Date.now(),
      commitHash: hash,
      commitUrl: hash && GITHUB_REPO_URL ? `${GITHUB_REPO_URL}/commit/${hash}` : null,
      adminResponse: adminResponse?.trim() || request.adminResponse,
    };

    await requestStore.updateRequest(resolved);

    io.emit("request:resolved", resolved);
    callback({ success: true });
  });

  socket.on("request:stop", async (payload, callback) => {
    if (!socket.data.authenticated) {
      callback({ success: false, error: "인증이 필요합니다" });
      return;
    }

    if (!isAdmin(socket.data.nickname)) {
      callback({ success: false, error: "권한이 없습니다" });
      return;
    }

    const { requestId, adminResponse } = payload;

    if (!adminResponse?.trim()) {
      callback({ success: false, error: "중단 사유를 입력해주세요" });
      return;
    }

    const request = await requestStore.getRequest(requestId);

    if (!request) {
      callback({ success: false, error: "요청사항을 찾을 수 없습니다" });
      return;
    }

    if (request.status !== "open" && request.status !== "in-progress") {
      callback({ success: false, error: "요청 또는 진행중 상태의 항목만 중단할 수 있습니다" });
      return;
    }

    const stopped: FeatureRequest = {
      ...request,
      status: "stopped",
      stoppedAt: Date.now(),
      adminResponse: adminResponse.trim(),
    };

    await requestStore.updateRequest(stopped);

    io.emit("request:stopped", stopped);
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
