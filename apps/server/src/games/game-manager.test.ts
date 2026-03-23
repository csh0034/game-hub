import { describe, it, expect, beforeEach } from "vitest";
import { GameManager } from "./game-manager.js";
import type { Player, CreateRoomPayload } from "@game-hub/shared-types";

const host: Player = { id: "host-1", nickname: "Host", isReady: true };
const guest: Player = { id: "guest-1", nickname: "Guest", isReady: true };

const gomokuPayload: CreateRoomPayload = { name: "오목 방", gameType: "gomoku" };
const holdemPayload: CreateRoomPayload = { name: "홀덤 방", gameType: "texas-holdem" };

describe("GameManager", () => {
  let gm: GameManager;

  beforeEach(() => {
    gm = new GameManager();
  });

  describe("createRoom", () => {
    it("방을 생성하고 반환한다", () => {
      const room = gm.createRoom(gomokuPayload, host);
      expect(room.name).toBe("오목 방");
      expect(room.gameType).toBe("gomoku");
      expect(room.hostId).toBe("host-1");
      expect(room.players).toHaveLength(1);
      expect(room.status).toBe("waiting");
    });

    it("생성된 방이 목록에 포함된다", () => {
      gm.createRoom(gomokuPayload, host);
      expect(gm.getRooms()).toHaveLength(1);
      expect(gm.getRoomCount()).toBe(1);
    });
  });

  describe("joinRoom", () => {
    it("방에 참가할 수 있다", () => {
      const room = gm.createRoom(gomokuPayload, host);
      const joined = gm.joinRoom(room.id, guest);
      expect(joined).not.toBeNull();
      expect(joined!.players).toHaveLength(2);
    });

    it("존재하지 않는 방에 참가하면 null을 반환한다", () => {
      expect(gm.joinRoom("invalid", guest)).toBeNull();
    });

    it("정원이 가득 찬 방에 참가하면 null을 반환한다", () => {
      const room = gm.createRoom(gomokuPayload, host);
      gm.joinRoom(room.id, guest);
      const third: Player = { id: "third", nickname: "Third", isReady: true };
      expect(gm.joinRoom(room.id, third)).toBeNull();
    });

    it("이미 방에 있는 플레이어가 다시 참가하면 null을 반환한다", () => {
      const room = gm.createRoom(gomokuPayload, host);
      expect(gm.joinRoom(room.id, host)).toBeNull();
    });

    it("playing 상태인 방에 참가하면 null을 반환한다", () => {
      const room = gm.createRoom(gomokuPayload, host);
      gm.joinRoom(room.id, guest);
      gm.startGame(room.id);
      const third: Player = { id: "third", nickname: "Third", isReady: true };
      expect(gm.joinRoom(room.id, third)).toBeNull();
    });
  });

  describe("removePlayer", () => {
    it("플레이어를 제거한다", () => {
      const room = gm.createRoom(gomokuPayload, host);
      gm.joinRoom(room.id, guest);
      const updated = gm.removePlayer(room.id, guest.id);
      expect(updated).not.toBeNull();
      expect(updated!.players).toHaveLength(1);
    });

    it("마지막 플레이어가 나가면 방이 삭제된다", () => {
      const room = gm.createRoom(gomokuPayload, host);
      const result = gm.removePlayer(room.id, host.id);
      expect(result).toBeNull();
      expect(gm.getRoom(room.id)).toBeNull();
    });

    it("방장이 나가면 다음 플레이어가 방장이 된다", () => {
      const room = gm.createRoom(gomokuPayload, host);
      gm.joinRoom(room.id, guest);
      const updated = gm.removePlayer(room.id, host.id);
      expect(updated!.hostId).toBe(guest.id);
    });

    it("게임 중 최소 인원 미달 시 waiting 상태로 전환된다", () => {
      const room = gm.createRoom(gomokuPayload, host);
      gm.joinRoom(room.id, guest);
      gm.startGame(room.id);
      const updated = gm.removePlayer(room.id, guest.id);
      expect(updated!.status).toBe("waiting");
    });

    it("finished 상태에서 플레이어가 나가면 waiting으로 전환되고 게임 상태가 정리된다", () => {
      const room = gm.createRoom(gomokuPayload, host);
      gm.joinRoom(room.id, guest);
      gm.startGame(room.id);

      // 5목 완성하여 게임 종료
      const moves = [
        { player: host.id, move: { row: 7, col: 3 } },
        { player: guest.id, move: { row: 8, col: 3 } },
        { player: host.id, move: { row: 7, col: 4 } },
        { player: guest.id, move: { row: 8, col: 4 } },
        { player: host.id, move: { row: 7, col: 5 } },
        { player: guest.id, move: { row: 8, col: 5 } },
        { player: host.id, move: { row: 7, col: 6 } },
        { player: guest.id, move: { row: 8, col: 6 } },
        { player: host.id, move: { row: 7, col: 7 } },
      ];
      for (const m of moves) {
        gm.processMove(room.id, m.player, m.move);
      }
      expect(gm.getRoom(room.id)!.status).toBe("finished");

      const updated = gm.removePlayer(room.id, guest.id);
      expect(updated!.status).toBe("waiting");
      expect(gm.getGameState(room.id)).toBeNull();
    });
  });

  describe("toggleReady", () => {
    it("레디 상태를 토글한다", () => {
      const room = gm.createRoom(gomokuPayload, host);
      gm.toggleReady(room.id, host.id);
      expect(gm.getRoom(room.id)!.players[0].isReady).toBe(false);
      gm.toggleReady(room.id, host.id);
      expect(gm.getRoom(room.id)!.players[0].isReady).toBe(true);
    });

    it("존재하지 않는 방에 대해 null을 반환한다", () => {
      expect(gm.toggleReady("invalid", host.id)).toBeNull();
    });
  });

  describe("startGame", () => {
    it("오목 게임을 시작한다", () => {
      const room = gm.createRoom(gomokuPayload, host);
      gm.joinRoom(room.id, guest);
      const state = gm.startGame(room.id);
      expect(state).not.toBeNull();
      expect(gm.getRoom(room.id)!.status).toBe("playing");
    });

    it("홀덤 게임을 시작하면 HoldemEngine 인스턴스가 생성된다", () => {
      const room = gm.createRoom(holdemPayload, host);
      gm.joinRoom(room.id, guest);
      gm.startGame(room.id);
      expect(gm.getHoldemEngine(room.id)).not.toBeNull();
    });

    it("최소 인원 미달 시 null을 반환한다", () => {
      const room = gm.createRoom(gomokuPayload, host);
      expect(gm.startGame(room.id)).toBeNull();
    });

    it("방장 외 플레이어가 준비하지 않으면 null을 반환한다", () => {
      const notReadyGuest: Player = { id: "guest-2", nickname: "NotReady", isReady: false };
      const room = gm.createRoom(gomokuPayload, host);
      gm.joinRoom(room.id, notReadyGuest);
      expect(gm.startGame(room.id)).toBeNull();
      expect(gm.getRoom(room.id)!.status).toBe("waiting");
    });

    it("방장 외 플레이어가 모두 준비하면 게임을 시작한다", () => {
      const readyGuest: Player = { id: "guest-3", nickname: "Ready", isReady: true };
      const room = gm.createRoom(gomokuPayload, host);
      gm.joinRoom(room.id, readyGuest);
      const state = gm.startGame(room.id);
      expect(state).not.toBeNull();
      expect(gm.getRoom(room.id)!.status).toBe("playing");
    });
  });

  describe("processMove", () => {
    it("오목에서 유효한 이동을 처리한다", () => {
      const room = gm.createRoom(gomokuPayload, host);
      gm.joinRoom(room.id, guest);
      gm.startGame(room.id);
      const result = gm.processMove(room.id, host.id, { row: 7, col: 7 });
      expect(result).not.toBeNull();
      expect(result!.result).toBeNull();
    });

    it("존재하지 않는 방에 대해 null을 반환한다", () => {
      expect(gm.processMove("invalid", host.id, { row: 0, col: 0 })).toBeNull();
    });

    it("게임 종료 시 방 상태가 finished가 된다", () => {
      const room = gm.createRoom(gomokuPayload, host);
      gm.joinRoom(room.id, guest);
      gm.startGame(room.id);

      // 흑이 5목을 만든다
      const moves = [
        { player: host.id, move: { row: 7, col: 3 } },
        { player: guest.id, move: { row: 8, col: 3 } },
        { player: host.id, move: { row: 7, col: 4 } },
        { player: guest.id, move: { row: 8, col: 4 } },
        { player: host.id, move: { row: 7, col: 5 } },
        { player: guest.id, move: { row: 8, col: 5 } },
        { player: host.id, move: { row: 7, col: 6 } },
        { player: guest.id, move: { row: 8, col: 6 } },
        { player: host.id, move: { row: 7, col: 7 } },
      ];

      let result;
      for (const m of moves) {
        result = gm.processMove(room.id, m.player, m.move);
      }

      expect(result!.result).not.toBeNull();
      expect(result!.result!.winnerId).toBe(host.id);
      expect(gm.getRoom(room.id)!.status).toBe("finished");
    });
  });

  describe("updateGameOptions", () => {
    it("방장이 대기 중인 방의 게임 옵션을 변경한다", () => {
      const room = gm.createRoom(gomokuPayload, host);
      const updated = gm.updateGameOptions(room.id, host.id, { gomokuTurnTime: 45 });
      expect(updated).not.toBeNull();
      expect(updated!.gameOptions?.gomokuTurnTime).toBe(45);
    });

    it("방장이 아닌 플레이어가 변경하면 null을 반환한다", () => {
      const room = gm.createRoom(gomokuPayload, host);
      gm.joinRoom(room.id, guest);
      expect(gm.updateGameOptions(room.id, guest.id, { gomokuTurnTime: 45 })).toBeNull();
    });

    it("playing 상태에서는 null을 반환한다", () => {
      const room = gm.createRoom(gomokuPayload, host);
      gm.joinRoom(room.id, guest);
      gm.startGame(room.id);
      expect(gm.updateGameOptions(room.id, host.id, { gomokuTurnTime: 45 })).toBeNull();
    });

    it("존재하지 않는 방에 대해 null을 반환한다", () => {
      expect(gm.updateGameOptions("invalid", host.id, { gomokuTurnTime: 45 })).toBeNull();
    });
  });

  describe("resetRoom", () => {
    it("방을 waiting 상태로 리셋한다", () => {
      const room = gm.createRoom(gomokuPayload, host);
      gm.joinRoom(room.id, guest);
      gm.startGame(room.id);
      const reset = gm.resetRoom(room.id);
      expect(reset).not.toBeNull();
      expect(reset!.status).toBe("waiting");
      expect(reset!.players.every((p) => !p.isReady)).toBe(true);
    });

    it("존재하지 않는 방에 대해 null을 반환한다", () => {
      expect(gm.resetRoom("invalid")).toBeNull();
    });
  });
});
