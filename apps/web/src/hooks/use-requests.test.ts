import { renderHook, act } from "@testing-library/react";
import { useRequests } from "./use-requests";
import { useRequestStore } from "@/stores/request-store";
import type { FeatureRequest } from "@game-hub/shared-types";

type Handler = (...args: unknown[]) => void;

function createMockSocket() {
  const handlers = new Map<string, Handler[]>();
  return {
    on: vi.fn((event: string, handler: Handler) => {
      if (!handlers.has(event)) handlers.set(event, []);
      handlers.get(event)!.push(handler);
    }),
    off: vi.fn(),
    emit: vi.fn(),
    connected: true,
    id: "test-socket-id",
    _trigger(event: string, ...args: unknown[]) {
      handlers.get(event)?.forEach((h) => h(...args));
    },
  };
}

function createRequest(overrides: Partial<FeatureRequest> = {}): FeatureRequest {
  return {
    id: "req-1",
    title: "기능 요청",
    description: "설명",
    label: "feature",
    author: "작성자",
    status: "open",
    createdAt: Date.now(),
    inProgressAt: null,
    rejectedAt: null,
    resolvedAt: null,
    adminResponse: null,
    commitHash: null,
    commitUrl: null,
    ...overrides,
  };
}

describe("useRequests", () => {
  beforeEach(() => {
    useRequestStore.setState(useRequestStore.getInitialState());
  });

  it("마운트 시 request:get-all을 emit한다", () => {
    const socket = createMockSocket();
    renderHook(() => useRequests(socket as never));
    expect(socket.emit).toHaveBeenCalledWith("request:get-all", expect.any(Function));
  });

  it("request:created 이벤트로 요청을 추가한다", () => {
    const socket = createMockSocket();
    renderHook(() => useRequests(socket as never));
    const req = createRequest();

    act(() => {
      socket._trigger("request:created", req);
    });

    expect(useRequestStore.getState().requests).toContainEqual(req);
  });

  it("request:accepted 이벤트로 요청을 갱신한다", () => {
    useRequestStore.setState({ requests: [createRequest()] });
    const socket = createMockSocket();
    renderHook(() => useRequests(socket as never));

    act(() => {
      socket._trigger("request:accepted", createRequest({ status: "in-progress" }));
    });

    expect(useRequestStore.getState().requests[0].status).toBe("in-progress");
  });

  it("request:rejected 이벤트로 요청을 갱신한다", () => {
    useRequestStore.setState({ requests: [createRequest()] });
    const socket = createMockSocket();
    renderHook(() => useRequests(socket as never));

    act(() => {
      socket._trigger("request:rejected", createRequest({ status: "rejected", adminResponse: "거부 사유" }));
    });

    expect(useRequestStore.getState().requests[0].status).toBe("rejected");
  });

  it("request:resolved 이벤트로 요청을 갱신한다", () => {
    useRequestStore.setState({ requests: [createRequest()] });
    const socket = createMockSocket();
    renderHook(() => useRequests(socket as never));

    act(() => {
      socket._trigger("request:resolved", createRequest({ status: "resolved", commitHash: "abc123" }));
    });

    expect(useRequestStore.getState().requests[0].status).toBe("resolved");
  });

  it("request:deleted 이벤트로 요청을 제거한다", () => {
    useRequestStore.setState({ requests: [createRequest()] });
    const socket = createMockSocket();
    renderHook(() => useRequests(socket as never));

    act(() => {
      socket._trigger("request:deleted", "req-1");
    });

    expect(useRequestStore.getState().requests).toHaveLength(0);
  });

  it("createRequest가 성공 시 success를 반환한다", async () => {
    const socket = createMockSocket();
    const req = createRequest();
    socket.emit.mockImplementation(((event: string, _payload: unknown, callback?: (request: FeatureRequest | null, error?: string) => void) => {
      if (event === "request:create" && callback) callback(req);
    }) as typeof socket.emit);

    const { result } = renderHook(() => useRequests(socket as never));

    let response: { success: boolean; error?: string } | undefined;
    await act(async () => {
      response = await result.current.createRequest({ title: "테스트", description: "설명", label: "feature" });
    });

    expect(response?.success).toBe(true);
  });

  it("socket이 null이면 에러 결과를 반환한다", async () => {
    const { result } = renderHook(() => useRequests(null));

    let response: { success: boolean; error?: string } | undefined;
    await act(async () => {
      response = await result.current.createRequest({ title: "테스트", description: "설명", label: "feature" });
    });

    expect(response?.success).toBe(false);
    expect(response?.error).toBe("소켓 연결이 없습니다");
  });

  it("언마운트 시 이벤트 리스너를 해제한다", () => {
    const socket = createMockSocket();
    const { unmount } = renderHook(() => useRequests(socket as never));

    unmount();

    expect(socket.off).toHaveBeenCalledWith("request:created", expect.any(Function));
    expect(socket.off).toHaveBeenCalledWith("request:accepted", expect.any(Function));
    expect(socket.off).toHaveBeenCalledWith("request:rejected", expect.any(Function));
    expect(socket.off).toHaveBeenCalledWith("request:resolved", expect.any(Function));
    expect(socket.off).toHaveBeenCalledWith("request:deleted", expect.any(Function));
  });
});
