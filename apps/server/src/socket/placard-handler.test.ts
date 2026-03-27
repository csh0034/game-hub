import { describe, it, expect, vi, beforeEach } from "vitest";
import { setupPlacardHandler } from "./placard-handler.js";
import { createMockSocket, createMockIo, type GameServer, type GameSocket } from "./socket-test-helpers.js";
import type { PlacardStore } from "../storage/interfaces/placard-store.js";

function createMockPlacardStore(): PlacardStore {
  let text: string | null = null;
  return {
    getText: vi.fn(async () => text),
    setText: vi.fn(async (t: string | null) => { text = t; }),
  };
}

describe("setupPlacardHandler", () => {
  let socket: ReturnType<typeof createMockSocket>;
  let io: ReturnType<typeof createMockIo>;
  let placardStore: PlacardStore;

  beforeEach(() => {
    socket = createMockSocket("socket-1", "admin");
    io = createMockIo();
    placardStore = createMockPlacardStore();
  });

  describe("placard:get", () => {
    it("저장된 플랜카드 텍스트를 반환한다", async () => {
      await placardStore.setText("테스트 배너");
      setupPlacardHandler(io as unknown as GameServer, socket as unknown as GameSocket, placardStore);
      const callback = vi.fn();

      await socket._trigger("placard:get", callback);

      await vi.waitFor(() => {
        expect(callback).toHaveBeenCalledWith("테스트 배너");
      });
    });

    it("플랜카드가 없으면 null을 반환한다", async () => {
      setupPlacardHandler(io as unknown as GameServer, socket as unknown as GameSocket, placardStore);
      const callback = vi.fn();

      await socket._trigger("placard:get", callback);

      await vi.waitFor(() => {
        expect(callback).toHaveBeenCalledWith(null);
      });
    });
  });

  describe("placard:set", () => {
    it("관리자가 텍스트를 설정하면 저장하고 브로드캐스트한다", async () => {
      setupPlacardHandler(io as unknown as GameServer, socket as unknown as GameSocket, placardStore);
      const callback = vi.fn();

      await socket._trigger("placard:set", "새 배너", callback);

      await vi.waitFor(() => {
        expect(callback).toHaveBeenCalledWith({ success: true });
      });
      expect(placardStore.setText).toHaveBeenCalledWith("새 배너");
      expect(io.emit).toHaveBeenCalledWith("placard:updated", "새 배너");
    });

    it("빈 텍스트를 설정하면 null로 저장하고 브로드캐스트한다", async () => {
      setupPlacardHandler(io as unknown as GameServer, socket as unknown as GameSocket, placardStore);
      const callback = vi.fn();

      await socket._trigger("placard:set", "   ", callback);

      await vi.waitFor(() => {
        expect(callback).toHaveBeenCalledWith({ success: true });
      });
      expect(placardStore.setText).toHaveBeenCalledWith(null);
      expect(io.emit).toHaveBeenCalledWith("placard:updated", null);
    });

    it("앞뒤 공백을 제거한다", async () => {
      setupPlacardHandler(io as unknown as GameServer, socket as unknown as GameSocket, placardStore);
      const callback = vi.fn();

      await socket._trigger("placard:set", "  공백 포함  ", callback);

      await vi.waitFor(() => {
        expect(callback).toHaveBeenCalledWith({ success: true });
      });
      expect(placardStore.setText).toHaveBeenCalledWith("공백 포함");
    });

    it("비관리자는 거부한다", async () => {
      const normalSocket = createMockSocket("socket-2", "NormalUser");
      setupPlacardHandler(io as unknown as GameServer, normalSocket as unknown as GameSocket, placardStore);
      const callback = vi.fn();

      await normalSocket._trigger("placard:set", "배너", callback);

      await vi.waitFor(() => {
        expect(callback).toHaveBeenCalledWith({ success: false, error: "권한이 없습니다" });
      });
      expect(io.emit).not.toHaveBeenCalled();
    });

    it("50자 초과 메시지는 거부한다", async () => {
      setupPlacardHandler(io as unknown as GameServer, socket as unknown as GameSocket, placardStore);
      const callback = vi.fn();
      const longText = "가".repeat(51);

      await socket._trigger("placard:set", longText, callback);

      await vi.waitFor(() => {
        expect(callback).toHaveBeenCalledWith({ success: false, error: "플랜카드는 50자 이하여야 합니다" });
      });
      expect(io.emit).not.toHaveBeenCalled();
    });

    it("50자 이하 메시지는 허용한다", async () => {
      setupPlacardHandler(io as unknown as GameServer, socket as unknown as GameSocket, placardStore);
      const callback = vi.fn();
      const maxText = "가".repeat(50);

      await socket._trigger("placard:set", maxText, callback);

      await vi.waitFor(() => {
        expect(callback).toHaveBeenCalledWith({ success: true });
      });
      expect(io.emit).toHaveBeenCalled();
    });
  });
});
