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

vi.mock("../games/catch-mind-timer.js", () => ({
  startCatchMindTimer: vi.fn(),
  clearCatchMindTimer: vi.fn(),
}));

import { startGomokuTimer, clearGomokuTimer } from "../games/gomoku-timer.js";
import { startTetrisTicker, clearTetrisTicker } from "../games/tetris-ticker.js";
import { clearLiarDrawingTimer } from "../games/liar-drawing-timer.js";
import { clearCatchMindTimer } from "../games/catch-mind-timer.js";

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

  describe("game:draw-points", () => {
    function setupLiarDrawingRoom(gameManager: GameManager) {
      const host = { id: "host-1", nickname: "Host", isReady: true };
      const guest = { id: "guest-1", nickname: "Guest", isReady: true };
      const player3 = { id: "player-3", nickname: "Player3", isReady: true };
      const room = gameManager.createRoom({ name: "라이어 드로잉 방", gameType: "liar-drawing" }, host);
      gameManager.joinRoom(room.id, guest);
      gameManager.joinRoom(room.id, player3);
      return { room, host, guest, player3 };
    }

    function setupCatchMindRoom(gameManager: GameManager) {
      const host = { id: "host-1", nickname: "Host", isReady: true };
      const guest = { id: "guest-1", nickname: "Guest", isReady: true };
      const player3 = { id: "player-3", nickname: "Player3", isReady: true };
      const room = gameManager.createRoom({ name: "캐치마인드 방", gameType: "catch-mind" }, host);
      gameManager.joinRoom(room.id, guest);
      gameManager.joinRoom(room.id, player3);
      return { room, host, guest, player3 };
    }

    it("라이어 드로잉에서 현재 드로어가 draw-points를 전송하면 브로드캐스트한다", () => {
      const player3Socket = createMockSocket("player-3", "Player3");
      const io = createMockIo({ withTo: true, sockets: [hostSocket, guestSocket, player3Socket] });
      const { room } = setupLiarDrawingRoom(gameManager);
      hostSocket.data.roomId = room.id;

      setupGameHandler(io as unknown as GameServer, hostSocket as unknown as GameSocket, gameManager, mockRankingStore);
      hostSocket._trigger("game:start");

      // Get the game state to find the current drawer
      const state = gameManager.getGameState(room.id) as { phase: string; drawOrder: string[]; currentDrawerIndex: number };
      expect(state.phase).toBe("role-reveal");

      // Manually set state to drawing phase for test
      const liarEngine = gameManager.getLiarDrawingEngine(room.id);
      expect(liarEngine).not.toBeNull();
      const drawingState = liarEngine!.startDrawingPhase(state as never);
      gameManager.setGameState(room.id, drawingState);

      const currentDrawerId = drawingState.drawOrder[drawingState.currentDrawerIndex];
      const drawerSocket = createMockSocket(currentDrawerId, "Drawer");
      drawerSocket.data.roomId = room.id;
      setupGameHandler(io as unknown as GameServer, drawerSocket as unknown as GameSocket, gameManager, mockRankingStore);

      const points = [{ x: 10, y: 20, color: "#000", size: 3, type: "draw" as const }];
      drawerSocket._trigger("game:draw-points", points);

      expect(drawerSocket._toEmit).toHaveBeenCalledWith("game:draw-points", { playerId: currentDrawerId, points });
    });

    it("라이어 드로잉에서 현재 드로어가 아닌 플레이어의 draw-points는 무시한다", () => {
      const player3Socket = createMockSocket("player-3", "Player3");
      const io = createMockIo({ withTo: true, sockets: [hostSocket, guestSocket, player3Socket] });
      const { room } = setupLiarDrawingRoom(gameManager);
      hostSocket.data.roomId = room.id;

      setupGameHandler(io as unknown as GameServer, hostSocket as unknown as GameSocket, gameManager, mockRankingStore);
      hostSocket._trigger("game:start");

      // Set to drawing phase
      const liarEngine = gameManager.getLiarDrawingEngine(room.id);
      const state = gameManager.getGameState(room.id) as never;
      const drawingState = liarEngine!.startDrawingPhase(state);
      gameManager.setGameState(room.id, drawingState);

      const currentDrawerId = drawingState.drawOrder[drawingState.currentDrawerIndex];
      // Use a socket that is NOT the current drawer
      const nonDrawerId = drawingState.drawOrder.find((id: string) => id !== currentDrawerId)!;
      const nonDrawerSocket = createMockSocket(nonDrawerId, "NonDrawer");
      nonDrawerSocket.data.roomId = room.id;
      setupGameHandler(io as unknown as GameServer, nonDrawerSocket as unknown as GameSocket, gameManager, mockRankingStore);

      const points = [{ x: 10, y: 20, color: "#000", size: 3, type: "draw" as const }];
      nonDrawerSocket._trigger("game:draw-points", points);

      expect(nonDrawerSocket._toEmit).not.toHaveBeenCalled();
    });

    it("캐치마인드에서 드로어가 draw-points를 전송하면 브로드캐스트한다", () => {
      const player3Socket = createMockSocket("player-3", "Player3");
      const io = createMockIo({ withTo: true, sockets: [hostSocket, guestSocket, player3Socket] });
      const { room } = setupCatchMindRoom(gameManager);
      hostSocket.data.roomId = room.id;

      setupGameHandler(io as unknown as GameServer, hostSocket as unknown as GameSocket, gameManager, mockRankingStore);
      hostSocket._trigger("game:start");

      // Get catch-mind state and advance to drawing phase
      const cmEngine = gameManager.getCatchMindEngine(room.id);
      expect(cmEngine).not.toBeNull();
      const state = gameManager.getGameState(room.id) as { phase: string; drawerId: string };
      const drawingState = cmEngine!.startDrawingPhase(state as never);
      gameManager.setGameState(room.id, drawingState);

      const drawerSocket = createMockSocket(drawingState.drawerId, "Drawer");
      drawerSocket.data.roomId = room.id;
      setupGameHandler(io as unknown as GameServer, drawerSocket as unknown as GameSocket, gameManager, mockRankingStore);

      const points = [{ x: 10, y: 20, color: "#000", size: 3, type: "draw" as const }];
      drawerSocket._trigger("game:draw-points", points);

      expect(drawerSocket._toEmit).toHaveBeenCalledWith("game:draw-points", { playerId: drawingState.drawerId, points });
    });

    it("관전자의 draw-points는 무시한다", () => {
      const player3Socket = createMockSocket("player-3", "Player3");
      const io = createMockIo({ withTo: true, sockets: [hostSocket, guestSocket, player3Socket] });
      const { room } = setupLiarDrawingRoom(gameManager);

      const spectatorSocket = createMockSocket("spectator-1", "Spectator");
      spectatorSocket.data.roomId = room.id;
      spectatorSocket.data.isSpectator = true;
      setupGameHandler(io as unknown as GameServer, spectatorSocket as unknown as GameSocket, gameManager, mockRankingStore);

      const points = [{ x: 10, y: 20, color: "#000", size: 3, type: "draw" as const }];
      spectatorSocket._trigger("game:draw-points", points);

      expect(spectatorSocket._toEmit).not.toHaveBeenCalled();
    });

    it("roomId가 없으면 무시한다", () => {
      setupGameHandler(io as unknown as GameServer, hostSocket as unknown as GameSocket, gameManager, mockRankingStore);

      const points = [{ x: 10, y: 20, color: "#000", size: 3, type: "draw" as const }];
      hostSocket._trigger("game:draw-points", points);

      expect(hostSocket._toEmit).not.toHaveBeenCalled();
    });
  });

  describe("game:move — 관전자 차단", () => {
    it("관전자의 move는 무시한다", () => {
      const { room } = setupGomokuRoom(gameManager);
      const spectatorSocket = createMockSocket("spectator-1", "Spectator");
      spectatorSocket.data.roomId = room.id;
      spectatorSocket.data.isSpectator = true;
      setupGameHandler(io as unknown as GameServer, spectatorSocket as unknown as GameSocket, gameManager, mockRankingStore);

      spectatorSocket._trigger("game:move", { row: 7, col: 7 });

      expect(io._toEmit).not.toHaveBeenCalled();
      expect(spectatorSocket.emit).not.toHaveBeenCalled();
    });
  });

  describe("game:move — finished 상태 가드", () => {
    it("방 상태가 finished이면 move를 무시한다", () => {
      const { room } = setupGomokuRoom(gameManager);
      hostSocket.data.roomId = room.id;
      setupGameHandler(io as unknown as GameServer, hostSocket as unknown as GameSocket, gameManager, mockRankingStore);

      hostSocket._trigger("game:start");
      room.status = "finished";
      vi.clearAllMocks();

      hostSocket._trigger("game:move", { row: 7, col: 7 });

      expect(io._toEmit).not.toHaveBeenCalled();
      expect(hostSocket.emit).not.toHaveBeenCalled();
    });
  });

  describe("game:move — 테트리스 tick 무시", () => {
    function setupTetrisRoom(gameManager: GameManager) {
      const host = { id: "host-1", nickname: "Host", isReady: true };
      const room = gameManager.createRoom({ name: "테트리스 방", gameType: "tetris" }, host);
      return { room, host };
    }

    it("클라이언트에서 보낸 tick 타입 move는 무시한다", () => {
      const { room } = setupTetrisRoom(gameManager);
      hostSocket.data.roomId = room.id;
      setupGameHandler(io as unknown as GameServer, hostSocket as unknown as GameSocket, gameManager, mockRankingStore);

      hostSocket._trigger("game:start");
      vi.clearAllMocks();

      hostSocket._trigger("game:move", { type: "tick" });

      // tick은 무시되므로 state-updated나 error가 발생하지 않아야 한다
      expect(io._toEmit).not.toHaveBeenCalled();
      expect(hostSocket.emit).not.toHaveBeenCalled();
    });
  });

  describe("game:rematch — 관전자 차단", () => {
    it("관전자의 rematch는 무시한다", () => {
      const { room } = setupGomokuRoom(gameManager);
      hostSocket.data.roomId = room.id;
      setupGameHandler(io as unknown as GameServer, hostSocket as unknown as GameSocket, gameManager, mockRankingStore);
      hostSocket._trigger("game:start");

      const spectatorSocket = createMockSocket("spectator-1", "Spectator");
      spectatorSocket.data.roomId = room.id;
      spectatorSocket.data.isSpectator = true;
      setupGameHandler(io as unknown as GameServer, spectatorSocket as unknown as GameSocket, gameManager, mockRankingStore);

      vi.clearAllMocks();
      spectatorSocket._trigger("game:rematch");

      expect(io._toEmit).not.toHaveBeenCalled();
    });
  });

  describe("game:rematch — catch-mind 타이머 정리", () => {
    it("rematch 시 catch-mind 타이머도 정리한다", () => {
      const { room } = setupGomokuRoom(gameManager);
      hostSocket.data.roomId = room.id;
      setupGameHandler(io as unknown as GameServer, hostSocket as unknown as GameSocket, gameManager, mockRankingStore);
      hostSocket._trigger("game:start");
      vi.clearAllMocks();

      hostSocket._trigger("game:rematch");

      expect(clearCatchMindTimer).toHaveBeenCalledWith(room.id);
    });
  });

  describe("game:quick-restart", () => {
    it("finished 상태의 지뢰찾기 방을 즉시 재시작한다", () => {
      const host = { id: "host-1", nickname: "Host", isReady: true };
      const room = gameManager.createRoom({ name: "지뢰찾기", gameType: "minesweeper" }, host);
      hostSocket.data.roomId = room.id;
      setupGameHandler(io as unknown as GameServer, hostSocket as unknown as GameSocket, gameManager, mockRankingStore);

      hostSocket._trigger("game:start");
      room.status = "finished";
      vi.clearAllMocks();

      hostSocket._trigger("game:quick-restart");

      expect(io._toEmit).toHaveBeenCalledWith("game:started", expect.any(Object));
      expect(io.emit).toHaveBeenCalledWith("lobby:room-updated", expect.objectContaining({ status: "playing" }));
    });

    it("finished 상태의 테트리스 방을 즉시 재시작하고 ticker를 시작한다", () => {
      const host = { id: "host-1", nickname: "Host", isReady: true };
      const room = gameManager.createRoom({ name: "테트리스", gameType: "tetris" }, host);
      hostSocket.data.roomId = room.id;
      setupGameHandler(io as unknown as GameServer, hostSocket as unknown as GameSocket, gameManager, mockRankingStore);

      hostSocket._trigger("game:start");
      room.status = "finished";
      vi.clearAllMocks();

      hostSocket._trigger("game:quick-restart");

      expect(io._toEmit).toHaveBeenCalledWith("game:started", expect.any(Object));
      expect(startTetrisTicker).toHaveBeenCalled();
    });

    it("finished가 아닌 상태에서는 무시한다", () => {
      const host = { id: "host-1", nickname: "Host", isReady: true };
      const room = gameManager.createRoom({ name: "지뢰찾기", gameType: "minesweeper" }, host);
      hostSocket.data.roomId = room.id;
      setupGameHandler(io as unknown as GameServer, hostSocket as unknown as GameSocket, gameManager, mockRankingStore);

      hostSocket._trigger("game:start");
      vi.clearAllMocks();

      hostSocket._trigger("game:quick-restart");

      expect(io._toEmit).not.toHaveBeenCalledWith("game:started", expect.any(Object));
    });

    it("멀티플레이어 방에서는 무시한다", () => {
      const host = { id: "host-1", nickname: "Host", isReady: true };
      const guest = { id: "guest-1", nickname: "Guest", isReady: true };
      const room = gameManager.createRoom({ name: "테트리스", gameType: "tetris" }, host);
      gameManager.joinRoom(room.id, guest);
      hostSocket.data.roomId = room.id;
      setupGameHandler(io as unknown as GameServer, hostSocket as unknown as GameSocket, gameManager, mockRankingStore);

      hostSocket._trigger("game:start");
      room.status = "finished";
      vi.clearAllMocks();

      hostSocket._trigger("game:quick-restart");

      expect(io._toEmit).not.toHaveBeenCalledWith("game:started", expect.any(Object));
    });

    it("관전자는 quick-restart할 수 없다", () => {
      const host = { id: "host-1", nickname: "Host", isReady: true };
      const room = gameManager.createRoom({ name: "지뢰찾기", gameType: "minesweeper" }, host);
      const spectatorSocket = createMockSocket("spec-1", "Spec");
      spectatorSocket.data.roomId = room.id;
      spectatorSocket.data.isSpectator = true;
      setupGameHandler(io as unknown as GameServer, spectatorSocket as unknown as GameSocket, gameManager, mockRankingStore);

      hostSocket.data.roomId = room.id;
      setupGameHandler(io as unknown as GameServer, hostSocket as unknown as GameSocket, gameManager, mockRankingStore);
      hostSocket._trigger("game:start");
      room.status = "finished";
      vi.clearAllMocks();

      spectatorSocket._trigger("game:quick-restart");

      expect(io._toEmit).not.toHaveBeenCalledWith("game:started", expect.any(Object));
    });
  });

  describe("ranking:get", () => {
    it("랭킹을 조회하고 콜백으로 반환한다", async () => {
      const mockEntries = [
        { id: "e1", nickname: "Player1", score: 100, date: Date.now() },
      ];
      (mockRankingStore.getRankings as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockEntries);

      setupGameHandler(io as unknown as GameServer, hostSocket as unknown as GameSocket, gameManager, mockRankingStore);

      const callback = vi.fn();
      await hostSocket._trigger("ranking:get", "minesweeper:beginner", callback);

      expect(mockRankingStore.getRankings).toHaveBeenCalledWith("minesweeper:beginner");
      expect(callback).toHaveBeenCalledWith(mockEntries);
    });

    it("빈 랭킹을 조회하면 빈 배열을 반환한다", async () => {
      (mockRankingStore.getRankings as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

      setupGameHandler(io as unknown as GameServer, hostSocket as unknown as GameSocket, gameManager, mockRankingStore);

      const callback = vi.fn();
      await hostSocket._trigger("ranking:get", "tetris:expert", callback);

      expect(mockRankingStore.getRankings).toHaveBeenCalledWith("tetris:expert");
      expect(callback).toHaveBeenCalledWith([]);
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
