import { describe, it, expect, type vi } from "vitest";
import { broadcastAuthenticatedCount } from "./broadcast-player-count.js";
import { createMockSocket, createMockIo } from "./socket-test-helpers.js";

describe("broadcastAuthenticatedCount", () => {
  it("인증된 플레이어만 카운트한다", () => {
    const s1 = createMockSocket("s1", "Player1", { authenticatedAt: 1000 });
    const s2 = createMockSocket("s2", "Player2", { authenticated: false });
    const s3 = createMockSocket("s3", "Player3", { authenticatedAt: 2000 });
    const io = createMockIo({ sockets: [s1, s2, s3] });

    broadcastAuthenticatedCount(io);

    expect(io.emit).toHaveBeenCalledWith("system:player-count", {
      count: 2,
      players: [
        { nickname: "Player1", connectedAt: 1000 },
        { nickname: "Player3", connectedAt: 2000 },
      ],
    });
  });

  it("인증된 플레이어가 없으면 count 0과 빈 목록을 반환한다", () => {
    const s1 = createMockSocket("s1", "Player1", { authenticated: false });
    const io = createMockIo({ sockets: [s1] });

    broadcastAuthenticatedCount(io);

    expect(io.emit).toHaveBeenCalledWith("system:player-count", {
      count: 0,
      players: [],
    });
  });

  it("소켓이 없으면 count 0과 빈 목록을 반환한다", () => {
    const io = createMockIo({ sockets: [] });

    broadcastAuthenticatedCount(io);

    expect(io.emit).toHaveBeenCalledWith("system:player-count", {
      count: 0,
      players: [],
    });
  });

  it("authenticatedAt이 없으면 현재 시간을 사용한다", () => {
    const before = Date.now();
    const s1 = createMockSocket("s1", "Player1");
    const io = createMockIo({ sockets: [s1] });

    broadcastAuthenticatedCount(io);

    const call = (io.emit as ReturnType<typeof vi.fn>).mock.calls[0];
    const players = call[1].players;
    expect(players).toHaveLength(1);
    expect(players[0].connectedAt).toBeGreaterThanOrEqual(before);
    expect(players[0].connectedAt).toBeLessThanOrEqual(Date.now());
  });
});
