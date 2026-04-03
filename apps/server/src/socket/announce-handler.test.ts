import { describe, it, expect, vi, beforeEach } from "vitest";
import { setupAnnounceHandler } from "./announce-handler.js";
import { createMockSocket, createMockIo, type GameServer, type GameSocket } from "./socket-test-helpers.js";

describe("setupAnnounceHandler", () => {
  let socket: ReturnType<typeof createMockSocket>;
  let io: ReturnType<typeof createMockIo>;

  beforeEach(() => {
    socket = createMockSocket("socket-1", "admin");
    io = createMockIo();
  });

  describe("system:announce", () => {
    it("관리자가 공지를 전송하면 전체 브로드캐스트한다", () => {
      setupAnnounceHandler(io as unknown as GameServer, socket as unknown as GameSocket);
      const callback = vi.fn();

      socket._trigger("system:announce", "테스트 공지입니다", callback);

      expect(callback).toHaveBeenCalledWith({ success: true });
      expect(io.emit).toHaveBeenCalledWith("system:announcement", expect.objectContaining({
        message: "테스트 공지입니다",
        nickname: "관리자",
      }));
    });

    it("공지 내용의 앞뒤 공백을 제거한다", () => {
      setupAnnounceHandler(io as unknown as GameServer, socket as unknown as GameSocket);
      const callback = vi.fn();

      socket._trigger("system:announce", "  공백 포함  ", callback);

      expect(callback).toHaveBeenCalledWith({ success: true });
      expect(io.emit).toHaveBeenCalledWith("system:announcement", expect.objectContaining({
        message: "공백 포함",
      }));
    });

    it("timestamp를 포함하여 브로드캐스트한다", () => {
      setupAnnounceHandler(io as unknown as GameServer, socket as unknown as GameSocket);
      const callback = vi.fn();
      const before = Date.now();

      socket._trigger("system:announce", "공지", callback);

      const call = (io.emit as ReturnType<typeof vi.fn>).mock.calls[0];
      const data = call[1] as { timestamp: number };
      expect(data.timestamp).toBeGreaterThanOrEqual(before);
      expect(data.timestamp).toBeLessThanOrEqual(Date.now());
    });

    it("비관리자는 거부한다", () => {
      const normalSocket = createMockSocket("socket-2", "NormalUser");
      setupAnnounceHandler(io as unknown as GameServer, normalSocket as unknown as GameSocket);
      const callback = vi.fn();

      normalSocket._trigger("system:announce", "공지", callback);

      expect(callback).toHaveBeenCalledWith({ success: false, error: "권한이 없습니다" });
      expect(io.emit).not.toHaveBeenCalled();
    });

    it("빈 메시지는 거부한다", () => {
      setupAnnounceHandler(io as unknown as GameServer, socket as unknown as GameSocket);
      const callback = vi.fn();

      socket._trigger("system:announce", "   ", callback);

      expect(callback).toHaveBeenCalledWith({ success: false, error: "공지 내용은 1~200자여야 합니다" });
      expect(io.emit).not.toHaveBeenCalled();
    });

    it("200자 초과 메시지는 거부한다", () => {
      setupAnnounceHandler(io as unknown as GameServer, socket as unknown as GameSocket);
      const callback = vi.fn();
      const longMessage = "가".repeat(201);

      socket._trigger("system:announce", longMessage, callback);

      expect(callback).toHaveBeenCalledWith({ success: false, error: "공지 내용은 1~200자여야 합니다" });
      expect(io.emit).not.toHaveBeenCalled();
    });

    it("200자 이하 메시지는 허용한다", () => {
      setupAnnounceHandler(io as unknown as GameServer, socket as unknown as GameSocket);
      const callback = vi.fn();
      const maxMessage = "가".repeat(200);

      socket._trigger("system:announce", maxMessage, callback);

      expect(callback).toHaveBeenCalledWith({ success: true });
      expect(io.emit).toHaveBeenCalled();
    });
  });
});
