import { vi } from "vitest";
import type { Server, Socket } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from "@game-hub/shared-types";

export type GameServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
export type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export interface MockSocketOptions {
  authenticated?: boolean;
  authenticatedAt?: number | null;
  roomId?: string | null;
  withEmit?: boolean;
  withTo?: boolean;
  withJoin?: boolean;
  withLeave?: boolean;
}

export type MockSocket = GameSocket & {
  _trigger: (event: string, ...args: unknown[]) => void;
  _toEmit: ReturnType<typeof vi.fn>;
};

export function createMockSocket(id: string, nickname: string, options?: MockSocketOptions): MockSocket {
  const {
    authenticated = true,
    authenticatedAt = null,
    roomId = null,
    withEmit = true,
    withTo = true,
    withJoin = true,
    withLeave = true,
  } = options ?? {};

  const handlers = new Map<string, (...args: unknown[]) => void>();
  const toEmit = vi.fn();

  const socket: Record<string, unknown> = {
    id,
    data: {
      playerId: id,
      nickname,
      roomId,
      authenticated,
      ...(authenticatedAt != null && { authenticatedAt }),
    },
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      handlers.set(event, handler);
    }),
    _trigger: (event: string, ...args: unknown[]) => {
      handlers.get(event)?.(...args);
    },
    _toEmit: toEmit,
  };

  socket.disconnect = vi.fn();
  if (withJoin) socket.join = vi.fn();
  if (withLeave) socket.leave = vi.fn();
  if (withEmit) socket.emit = vi.fn();
  if (withTo) socket.to = vi.fn(() => ({ emit: toEmit }));

  return socket as unknown as MockSocket;
}

export interface MockIoOptions {
  sockets?: GameSocket[];
  withTo?: boolean;
}

export type MockIo = GameServer & { _toEmit: ReturnType<typeof vi.fn> };

export function createMockIo(options?: MockIoOptions): MockIo {
  const { sockets, withTo = false } = options ?? {};
  const toEmit = vi.fn();

  const io: Record<string, unknown> = {
    emit: vi.fn(),
    _toEmit: toEmit,
  };

  if (withTo) {
    io.to = vi.fn(() => ({ emit: toEmit }));
  }

  if (sockets) {
    const socketMap = new Map(sockets.map((s) => [s.id, s]));
    io.sockets = { sockets: socketMap };
  }

  return io as unknown as MockIo;
}
