import { renderHook, act } from "@testing-library/react";

type Handler = (...args: unknown[]) => void;

const handlers = new Map<string, Handler[]>();
const mockSocket = {
  on: vi.fn((event: string, handler: Handler) => {
    if (!handlers.has(event)) handlers.set(event, []);
    handlers.get(event)!.push(handler);
  }),
  off: vi.fn((event: string) => {
    handlers.delete(event);
  }),
  emit: vi.fn(),
  connect: vi.fn(),
  connected: false,
  id: "test-socket-id",
  _trigger(event: string, ...args: unknown[]) {
    handlers.get(event)?.forEach((h) => h(...args));
  },
};

vi.mock("@/lib/socket", () => ({
  getSocket: () => mockSocket,
}));

vi.mock("sonner", () => ({
  toast: vi.fn(),
}));

describe("useSocket", () => {
  beforeEach(() => {
    handlers.clear();
    vi.clearAllMocks();
    mockSocket.connected = false;
  });

  it("마운트 시 소켓에 연결한다", async () => {
    const { useSocket } = await import("./use-socket");
    renderHook(() => useSocket());
    expect(mockSocket.connect).toHaveBeenCalled();
  });

  it("system:player-count 이벤트로 접속자 수를 갱신한다", async () => {
    const { useSocket } = await import("./use-socket");
    const { result } = renderHook(() => useSocket());

    act(() => {
      mockSocket._trigger("system:player-count", { count: 5, players: [] });
    });

    expect(result.current.playerCount).toBe(5);
  });
});
