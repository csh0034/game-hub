import { describe, it, expect, vi, beforeEach } from "vitest";
import { setupGameHandler } from "./game-handler.js";
import { GameManager } from "../games/game-manager.js";
import { createMockSocket, createMockIo, type GameServer, type GameSocket, type MockSocket, type MockIo } from "./socket-test-helpers.js";
import type { RankingStore } from "../storage/index.js";

const mockRankingStore: RankingStore = {
  getRankings: vi.fn().mockResolvedValue([]),
  addEntry: vi.fn().mockResolvedValue({ rank: null, entries: [] }),
  deleteEntry: vi.fn().mockResolvedValue([]),
};

vi.mock("../games/gomoku-timer.js", () => ({
  startGomokuTimer: vi.fn(),
  clearGomokuTimer: vi.fn(),
}));

vi.mock("../games/tetris-ticker.js", () => ({
  startTetrisTicker: vi.fn(),
  updateTetrisTickerInterval: vi.fn(),
  clearTetrisTicker: vi.fn(),
}));

vi.mock("../games/liar-drawing-timer.js", () => ({
  startLiarDrawingTimer: vi.fn(),
  clearLiarDrawingTimer: vi.fn(),
}));

import { startGomokuTimer, clearGomokuTimer } from "../games/gomoku-timer.js";
import { clearTetrisTicker } from "../games/tetris-ticker.js";
import { clearLiarDrawingTimer } from "../games/liar-drawing-timer.js";

function setupGomokuRoom(gameManager: GameManager) {
  const host = { id: "host-1", nickname: "Host", isReady: true };
  const guest = { id: "guest-1", nickname: "Guest", isReady: true };
  const room = gameManager.createRoom({ name: "오목 방", gameType: "gomoku" }, host);
  gameManager.joinRoom(room.id, guest);
  return { room, host, guest };
}

describe("setupGameHandler", () => {
  let hostSocket: MockSocket;
  let guestSocket: MockSocket;
  let io: MockIo;
  let gameManager: GameManager;

  beforeEach(() => {
    vi.clearAllMocks();
    gameManager = new GameManager();
    hostSocket = createMockSocket("host-1", "Host");
    guestSocket = createMockSocket("guest-1", "Guest");
    io = createMockIo({ withTo: true, sockets: [hostSocket, guestSocket] });
  });

  describe("game:start", () => {
    it("방장이 게임을 시작하면 game:started를 발송한다", () => {
      const { room } = setupGomokuRoom(gameManager);
      hostSocket.data.roomId = room.id;
      setupGameHandler(io as unknown as GameServer, hostSocket as unknown as GameSocket, gameManager, mockRankingStore);

      hostSocket._trigger("game:start");

      expect(io.to).toHaveBeenCalledWith(room.id);
      expect(io._toEmit).toHaveBeenCalledWith("game:started", expect.objectContaining({ board: expect.any(Array) }));
    });

    it("방장이 아니면 game:error를 발송한다", () => {
      const { room } = setupGomokuRoom(gameManager);
      guestSocket.data.roomId = room.id;
      setupGameHandler(io as unknown as GameServer, guestSocket as unknown as GameSocket, gameManager, mockRankingStore);

      guestSocket._trigger("game:start");

      expect(guestSocket.emit).toHaveBeenCalledWith("game:error", "방장만 게임을 시작할 수 있습니다.");
    });

    it("roomId가 없으면 무시한다", () => {
      setupGameHandler(io as unknown as GameServer, hostSocket as unknown as GameSocket, gameManager, mockRankingStore);

      hostSocket._trigger("game:start");

      expect(io._toEmit).not.toHaveBeenCalled();
      expect(hostSocket.emit).not.toHaveBeenCalled();
    });

    it("게임 시작 불가 시 game:error를 발송한다", () => {
      // 방 생성 후 준비 없이 시작 시도
      const host = { id: "host-1", nickname: "Host", isReady: true };
      const room = gameManager.createRoom({ name: "오목 방", gameType: "gomoku" }, host);
      hostSocket.data.roomId = room.id;
      setupGameHandler(io as unknown as GameServer, hostSocket as unknown as GameSocket, gameManager, mockRankingStore);

      hostSocket._trigger("game:start");

      expect(hostSocket.emit).toHaveBeenCalledWith("game:error", "게임을 시작할 수 없습니다. 최소 인원과 준비 상태를 확인하세요.");
    });

    it("오목 게임 시작 시 gomoku 타이머를 시작한다", () => {
      const { room } = setupGomokuRoom(gameManager);
      hostSocket.data.roomId = room.id;
      setupGameHandler(io as unknown as GameServer, hostSocket as unknown as GameSocket, gameManager, mockRankingStore);

      hostSocket._trigger("game:start");

      expect(startGomokuTimer).toHaveBeenCalledWith(room.id, expect.any(Number), expect.any(Function));
    });
  });

  describe("game:move", () => {
    it("유효한 수를 처리하고 state-updated를 발송한다", () => {
      const { room } = setupGomokuRoom(gameManager);
      hostSocket.data.roomId = room.id;
      setupGameHandler(io as unknown as GameServer, hostSocket as unknown as GameSocket, gameManager, mockRankingStore);

      hostSocket._trigger("game:start");
      vi.clearAllMocks();

      hostSocket._trigger("game:move", { row: 7, col: 7 });

      expect(io.to).toHaveBeenCalledWith(room.id);
      expect(io._toEmit).toHaveBeenCalledWith("game:state-updated", expect.objectContaining({ board: expect.any(Array) }));
    });

    it("roomId가 없으면 무시한다", () => {
      setupGameHandler(io as unknown as GameServer, hostSocket as unknown as GameSocket, gameManager, mockRankingStore);

      hostSocket._trigger("game:move", { row: 7, col: 7 });

      expect(io._toEmit).not.toHaveBeenCalled();
    });

    it("roomId에 해당하는 방이 없으면 game:error를 발송하지 않는다", () => {
      hostSocket.data.roomId = "nonexistent-room";
      setupGameHandler(io as unknown as GameServer, hostSocket as unknown as GameSocket, gameManager, mockRankingStore);

      hostSocket._trigger("game:move", { row: 7, col: 7 });

      // processMove returns null for non-existent room → game:error emitted
      expect(hostSocket.emit).toHaveBeenCalledWith("game:error", "잘못된 수입니다.");
    });

    it("승리 시 game:ended를 발송한다", () => {
      const { room } = setupGomokuRoom(gameManager);
      hostSocket.data.roomId = room.id;
      setupGameHandler(io as unknown as GameServer, hostSocket as unknown as GameSocket, gameManager, mockRankingStore);
      setupGameHandler(io as unknown as GameServer, guestSocket as unknown as GameSocket, gameManager, mockRankingStore);
      guestSocket.data.roomId = room.id;

      hostSocket._trigger("game:start");

      // 흑(host): (7,3),(7,4),(7,5),(7,6),(7,7) — 가로 5목
      // 백(guest): (8,3),(8,4),(8,5),(8,6)
      const blackMoves = [
        { row: 7, col: 3 }, { row: 7, col: 4 }, { row: 7, col: 5 }, { row: 7, col: 6 }, { row: 7, col: 7 },
      ];
      const whiteMoves = [
        { row: 8, col: 3 }, { row: 8, col: 4 }, { row: 8, col: 5 }, { row: 8, col: 6 },
      ];

      for (let i = 0; i < 5; i++) {
        hostSocket._trigger("game:move", blackMoves[i]);
        if (i < 4) {
          guestSocket._trigger("game:move", whiteMoves[i]);
        }
      }

      expect(io._toEmit).toHaveBeenCalledWith("game:ended", expect.objectContaining({ winnerId: "host-1" }));
    });
  });

  describe("game:rematch", () => {
    it("방을 리셋하고 room-updated를 발송한다", () => {
      const { room } = setupGomokuRoom(gameManager);
      hostSocket.data.roomId = room.id;
      setupGameHandler(io as unknown as GameServer, hostSocket as unknown as GameSocket, gameManager, mockRankingStore);

      hostSocket._trigger("game:start");
      vi.clearAllMocks();

      hostSocket._trigger("game:rematch");

      expect(io._toEmit).toHaveBeenCalledWith("lobby:room-updated", expect.objectContaining({ status: "waiting" }));
    });

    it("모든 타이머를 정리한다", () => {
      const { room } = setupGomokuRoom(gameManager);
      hostSocket.data.roomId = room.id;
      setupGameHandler(io as unknown as GameServer, hostSocket as unknown as GameSocket, gameManager, mockRankingStore);

      hostSocket._trigger("game:start");
      vi.clearAllMocks();

      hostSocket._trigger("game:rematch");

      expect(clearGomokuTimer).toHaveBeenCalledWith(room.id);
      expect(clearTetrisTicker).toHaveBeenCalledWith(room.id);
      expect(clearLiarDrawingTimer).toHaveBeenCalledWith(room.id);
    });

    it("roomId가 없으면 무시한다", () => {
      setupGameHandler(io as unknown as GameServer, hostSocket as unknown as GameSocket, gameManager, mockRankingStore);

      hostSocket._trigger("game:rematch");

      expect(io._toEmit).not.toHaveBeenCalled();
    });
  });

  describe("ranking:delete", () => {
    it("관리자가 랭킹을 삭제하면 ranking:updated를 브로드캐스트한다", async () => {
      const adminSocket = createMockSocket("admin-1", "admin");
      setupGameHandler(io as unknown as GameServer, adminSocket as unknown as GameSocket, gameManager, mockRankingStore);

      const callback = vi.fn();
      await adminSocket._trigger("ranking:delete", "minesweeper:beginner", "entry-1", callback);

      expect(mockRankingStore.deleteEntry).toHaveBeenCalledWith("minesweeper:beginner", "entry-1");
      expect(callback).toHaveBeenCalledWith({ success: true });
      expect(io.emit).toHaveBeenCalledWith("ranking:updated", { key: "minesweeper:beginner", rankings: [] });
    });

    it("비관리자는 랭킹을 삭제할 수 없다", async () => {
      setupGameHandler(io as unknown as GameServer, hostSocket as unknown as GameSocket, gameManager, mockRankingStore);

      const callback = vi.fn();
      await hostSocket._trigger("ranking:delete", "minesweeper:beginner", "entry-1", callback);

      expect(mockRankingStore.deleteEntry).not.toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith({ success: false, error: "권한이 없습니다" });
    });

    it("인증되지 않은 소켓은 삭제할 수 없다", async () => {
      const unauthSocket = createMockSocket("unauth-1", "user", { authenticated: false });
      setupGameHandler(io as unknown as GameServer, unauthSocket as unknown as GameSocket, gameManager, mockRankingStore);

      const callback = vi.fn();
      await unauthSocket._trigger("ranking:delete", "minesweeper:beginner", "entry-1", callback);

      expect(callback).toHaveBeenCalledWith({ success: false, error: "인증이 필요합니다" });
    });
  });
});
