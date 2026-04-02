import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@game-hub/shared-types";

const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL ||
  (typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:3001`
    : "http://localhost:3001");

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: GameSocket | null = null;

const BROWSER_ID_KEY = "game-hub-browser-id";

function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // crypto.randomUUID 미지원 환경 (HTTP 등) 폴백
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getBrowserId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(BROWSER_ID_KEY);
  if (!id) {
    id = generateUUID();
    localStorage.setItem(BROWSER_ID_KEY, id);
  }
  return id;
}

// 서버-클라이언트 시간 오프셋 (serverTime - clientTime)
let serverTimeOffset = 0;

export function setServerTimeOffset(serverTime: number) {
  serverTimeOffset = serverTime - Date.now();
}

/** 서버 타임스탬프 기준 경과 시간(ms) 계산. 시계 오차 및 중간 입장 모두 보정. */
export function getServerElapsed(serverTimestamp: number): number {
  return Math.max(0, Date.now() + serverTimeOffset - serverTimestamp);
}

export function getSocket(): GameSocket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });
  }
  return socket;
}
