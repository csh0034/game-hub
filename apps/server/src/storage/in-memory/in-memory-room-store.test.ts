import { describe, it, expect, beforeEach } from "vitest";
import type { Room } from "@game-hub/shared-types";
import { InMemoryRoomStore } from "./in-memory-room-store.js";

function createRoom(id: string): Room {
  return {
    id,
    name: `방-${id}`,
    gameType: "gomoku",
    hostId: "host-1",
    players: [{ id: "host-1", nickname: "Host", isReady: true }],
    spectators: [],
    maxPlayers: 2,
    status: "waiting",
    createdAt: Date.now(),
  };
}

describe("InMemoryRoomStore", () => {
  let store: InMemoryRoomStore;

  beforeEach(() => {
    store = new InMemoryRoomStore();
  });

  describe("saveRoom / getRoom", () => {
    it("방을 저장하고 조회한다", async () => {
      const room = createRoom("room-1");
      await store.saveRoom(room);

      expect(await store.getRoom("room-1")).toEqual(room);
    });

    it("존재하지 않는 방은 null을 반환한다", async () => {
      expect(await store.getRoom("unknown")).toBeNull();
    });

    it("같은 ID로 저장하면 덮어쓴다", async () => {
      const room = createRoom("room-1");
      await store.saveRoom(room);

      const updated = { ...room, name: "변경된 방" };
      await store.saveRoom(updated);

      expect(await store.getRoom("room-1")).toEqual(updated);
    });
  });

  describe("getAllRooms", () => {
    it("모든 방을 반환한다", async () => {
      await store.saveRoom(createRoom("room-1"));
      await store.saveRoom(createRoom("room-2"));

      const rooms = await store.getAllRooms();
      expect(rooms).toHaveLength(2);
    });

    it("빈 상태에서 빈 배열을 반환한다", async () => {
      expect(await store.getAllRooms()).toEqual([]);
    });
  });

  describe("deleteRoom", () => {
    it("방을 삭제한다", async () => {
      await store.saveRoom(createRoom("room-1"));
      await store.deleteRoom("room-1");

      expect(await store.getRoom("room-1")).toBeNull();
    });

    it("존재하지 않는 방 삭제 시 에러가 발생하지 않는다", async () => {
      await expect(store.deleteRoom("unknown")).resolves.toBeUndefined();
    });
  });
});
