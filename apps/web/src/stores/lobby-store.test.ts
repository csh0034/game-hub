import { useLobbyStore } from "./lobby-store";
import type { Room } from "@game-hub/shared-types";

function createRoom(overrides: Partial<Room> = {}): Room {
  return {
    id: "room-1",
    name: "테스트 방",
    gameType: "gomoku",
    hostId: "host-1",
    players: [],
    maxPlayers: 2,
    status: "waiting",
    createdAt: Date.now(),
    ...overrides,
  };
}

describe("useLobbyStore", () => {
  beforeEach(() => {
    useLobbyStore.setState(useLobbyStore.getInitialState());
  });

  describe("setRooms", () => {
    it("방 목록을 설정한다", () => {
      const rooms = [createRoom(), createRoom({ id: "room-2" })];
      useLobbyStore.getState().setRooms(rooms);
      expect(useLobbyStore.getState().rooms).toEqual(rooms);
    });
  });

  describe("setCurrentRoom", () => {
    it("현재 방을 설정한다", () => {
      const room = createRoom();
      useLobbyStore.getState().setCurrentRoom(room);
      expect(useLobbyStore.getState().currentRoom).toEqual(room);
    });

    it("null로 현재 방을 해제한다", () => {
      useLobbyStore.getState().setCurrentRoom(createRoom());
      useLobbyStore.getState().setCurrentRoom(null);
      expect(useLobbyStore.getState().currentRoom).toBeNull();
    });
  });

  describe("setPendingRoomId", () => {
    it("대기 중인 방 ID를 설정한다", () => {
      useLobbyStore.getState().setPendingRoomId("room-1");
      expect(useLobbyStore.getState().pendingRoomId).toBe("room-1");
    });
  });

  describe("addRoom", () => {
    it("방을 추가한다", () => {
      useLobbyStore.getState().addRoom(createRoom());
      expect(useLobbyStore.getState().rooms).toHaveLength(1);
    });

    it("이미 존재하는 방 ID는 추가하지 않는다", () => {
      const room = createRoom();
      useLobbyStore.getState().addRoom(room);
      useLobbyStore.getState().addRoom(room);
      expect(useLobbyStore.getState().rooms).toHaveLength(1);
    });
  });

  describe("updateRoom", () => {
    it("기존 방을 업데이트한다", () => {
      const room = createRoom();
      useLobbyStore.getState().setRooms([room]);
      const updated = createRoom({ name: "업데이트된 방" });
      useLobbyStore.getState().updateRoom(updated);
      expect(useLobbyStore.getState().rooms[0].name).toBe("업데이트된 방");
    });

    it("현재 방이 업데이트 대상이면 currentRoom도 갱신한다", () => {
      const room = createRoom();
      useLobbyStore.getState().setRooms([room]);
      useLobbyStore.getState().setCurrentRoom(room);
      const updated = createRoom({ name: "갱신됨" });
      useLobbyStore.getState().updateRoom(updated);
      expect(useLobbyStore.getState().currentRoom?.name).toBe("갱신됨");
    });

    it("현재 방이 다른 방이면 currentRoom을 유지한다", () => {
      const room1 = createRoom({ id: "room-1" });
      const room2 = createRoom({ id: "room-2" });
      useLobbyStore.getState().setRooms([room1, room2]);
      useLobbyStore.getState().setCurrentRoom(room1);
      useLobbyStore.getState().updateRoom(createRoom({ id: "room-2", name: "갱신됨" }));
      expect(useLobbyStore.getState().currentRoom?.id).toBe("room-1");
    });
  });

  describe("removeRoom", () => {
    it("방을 목록에서 제거한다", () => {
      useLobbyStore.getState().setRooms([createRoom()]);
      useLobbyStore.getState().removeRoom("room-1");
      expect(useLobbyStore.getState().rooms).toHaveLength(0);
    });

    it("현재 방이 제거 대상이면 currentRoom을 null로 설정한다", () => {
      const room = createRoom();
      useLobbyStore.getState().setCurrentRoom(room);
      useLobbyStore.getState().setRooms([room]);
      useLobbyStore.getState().removeRoom("room-1");
      expect(useLobbyStore.getState().currentRoom).toBeNull();
    });

    it("현재 방이 다른 방이면 currentRoom을 유지한다", () => {
      const room1 = createRoom({ id: "room-1" });
      const room2 = createRoom({ id: "room-2" });
      useLobbyStore.getState().setCurrentRoom(room1);
      useLobbyStore.getState().setRooms([room1, room2]);
      useLobbyStore.getState().removeRoom("room-2");
      expect(useLobbyStore.getState().currentRoom?.id).toBe("room-1");
    });
  });
});
