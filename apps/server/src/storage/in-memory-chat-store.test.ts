import { describe, it, expect, beforeEach } from "vitest";
import type { ChatMessage } from "@game-hub/shared-types";
import { InMemoryChatStore } from "./in-memory-chat-store.js";

function createMsg(id: number): ChatMessage {
  return {
    playerId: `player-${id}`,
    nickname: `Player${id}`,
    message: `msg-${id}`,
    timestamp: Date.now() + id,
  };
}

describe("InMemoryChatStore", () => {
  let store: InMemoryChatStore;

  beforeEach(() => {
    store = new InMemoryChatStore();
  });

  describe("pushLobbyMessage / getLobbyHistory", () => {
    it("메시지를 저장하고 조회한다", async () => {
      const msg = createMsg(1);
      await store.pushLobbyMessage(msg);

      const history = await store.getLobbyHistory();
      expect(history).toEqual([msg]);
    });

    it("빈 상태에서 빈 배열을 반환한다", async () => {
      const history = await store.getLobbyHistory();
      expect(history).toEqual([]);
    });

    it("최대 50개까지만 보관한다", async () => {
      for (let i = 0; i < 55; i++) {
        await store.pushLobbyMessage(createMsg(i));
      }

      const history = await store.getLobbyHistory();
      expect(history).toHaveLength(50);
      expect(history[0].message).toBe("msg-5");
      expect(history[49].message).toBe("msg-54");
    });

    it("반환값은 내부 배열의 복사본이다", async () => {
      await store.pushLobbyMessage(createMsg(1));
      const history = await store.getLobbyHistory();
      history.push(createMsg(99));

      const again = await store.getLobbyHistory();
      expect(again).toHaveLength(1);
    });
  });

  describe("pushRoomMessage / getRoomHistory", () => {
    it("방별로 메시지를 분리 저장한다", async () => {
      const msg1 = createMsg(1);
      const msg2 = createMsg(2);
      await store.pushRoomMessage("room-a", msg1);
      await store.pushRoomMessage("room-b", msg2);

      expect(await store.getRoomHistory("room-a")).toEqual([msg1]);
      expect(await store.getRoomHistory("room-b")).toEqual([msg2]);
    });

    it("존재하지 않는 방은 빈 배열을 반환한다", async () => {
      expect(await store.getRoomHistory("unknown")).toEqual([]);
    });

    it("최대 50개까지만 보관한다", async () => {
      for (let i = 0; i < 55; i++) {
        await store.pushRoomMessage("room-1", createMsg(i));
      }

      const history = await store.getRoomHistory("room-1");
      expect(history).toHaveLength(50);
      expect(history[0].message).toBe("msg-5");
    });
  });

  describe("deleteRoomHistory", () => {
    it("방 채팅 이력을 삭제한다", async () => {
      await store.pushRoomMessage("room-1", createMsg(1));
      await store.deleteRoomHistory("room-1");

      expect(await store.getRoomHistory("room-1")).toEqual([]);
    });

    it("존재하지 않는 방 삭제 시 에러가 발생하지 않는다", async () => {
      await expect(store.deleteRoomHistory("unknown")).resolves.toBeUndefined();
    });
  });
});
