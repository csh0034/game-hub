import { useChatStore } from "./chat-store";
import type { ChatMessage } from "@game-hub/shared-types";

function createMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: `msg-${Math.random()}`,
    playerId: "player-1",
    nickname: "테스터",
    message: "안녕하세요",
    timestamp: Date.now(),
    ...overrides,
  };
}

describe("useChatStore", () => {
  beforeEach(() => {
    useChatStore.setState(useChatStore.getInitialState());
  });

  describe("addLobbyMessage", () => {
    it("로비 메시지를 추가한다", () => {
      const msg = createMessage();
      useChatStore.getState().addLobbyMessage(msg);
      expect(useChatStore.getState().lobbyMessages).toEqual([msg]);
    });

    it("100개 초과 시 오래된 메시지를 제거한다", () => {
      const messages = Array.from({ length: 100 }, (_, i) =>
        createMessage({ id: `msg-${i}` }),
      );
      useChatStore.setState({ lobbyMessages: messages });
      const newMsg = createMessage({ id: "msg-new" });
      useChatStore.getState().addLobbyMessage(newMsg);
      const result = useChatStore.getState().lobbyMessages;
      expect(result).toHaveLength(100);
      expect(result[0].id).toBe("msg-1");
      expect(result[result.length - 1].id).toBe("msg-new");
    });
  });

  describe("addRoomMessage", () => {
    it("방 메시지를 추가한다", () => {
      const msg = createMessage();
      useChatStore.getState().addRoomMessage(msg);
      expect(useChatStore.getState().roomMessages).toEqual([msg]);
    });

    it("100개 초과 시 오래된 메시지를 제거한다", () => {
      const messages = Array.from({ length: 100 }, (_, i) =>
        createMessage({ id: `msg-${i}` }),
      );
      useChatStore.setState({ roomMessages: messages });
      useChatStore.getState().addRoomMessage(createMessage({ id: "msg-new" }));
      expect(useChatStore.getState().roomMessages).toHaveLength(100);
    });
  });

  describe("setLobbyMessages", () => {
    it("로비 메시지 목록을 설정한다", () => {
      const msgs = [createMessage(), createMessage()];
      useChatStore.getState().setLobbyMessages(msgs);
      expect(useChatStore.getState().lobbyMessages).toEqual(msgs);
    });

    it("100개 초과 메시지는 잘라낸다", () => {
      const msgs = Array.from({ length: 150 }, () => createMessage());
      useChatStore.getState().setLobbyMessages(msgs);
      expect(useChatStore.getState().lobbyMessages).toHaveLength(100);
    });
  });

  describe("setRoomMessages", () => {
    it("방 메시지 목록을 설정한다", () => {
      const msgs = [createMessage()];
      useChatStore.getState().setRoomMessages(msgs);
      expect(useChatStore.getState().roomMessages).toEqual(msgs);
    });
  });

  describe("clearRoomMessages", () => {
    it("방 메시지를 초기화한다", () => {
      useChatStore.getState().addRoomMessage(createMessage());
      useChatStore.getState().clearRoomMessages();
      expect(useChatStore.getState().roomMessages).toEqual([]);
    });
  });

  describe("clearLobbyMessages", () => {
    it("로비 메시지를 초기화한다", () => {
      useChatStore.getState().addLobbyMessage(createMessage());
      useChatStore.getState().clearLobbyMessages();
      expect(useChatStore.getState().lobbyMessages).toEqual([]);
    });
  });

  describe("removeLobbyMessage", () => {
    it("특정 로비 메시지를 제거한다", () => {
      const msg1 = createMessage({ id: "msg-1" });
      const msg2 = createMessage({ id: "msg-2" });
      useChatStore.setState({ lobbyMessages: [msg1, msg2] });
      useChatStore.getState().removeLobbyMessage("msg-1");
      expect(useChatStore.getState().lobbyMessages).toEqual([msg2]);
    });

    it("존재하지 않는 ID는 무시한다", () => {
      const msg = createMessage({ id: "msg-1" });
      useChatStore.setState({ lobbyMessages: [msg] });
      useChatStore.getState().removeLobbyMessage("not-exist");
      expect(useChatStore.getState().lobbyMessages).toHaveLength(1);
    });
  });

  describe("removeRoomMessage", () => {
    it("특정 방 메시지를 제거한다", () => {
      const msg1 = createMessage({ id: "msg-1" });
      const msg2 = createMessage({ id: "msg-2" });
      useChatStore.setState({ roomMessages: [msg1, msg2] });
      useChatStore.getState().removeRoomMessage("msg-2");
      expect(useChatStore.getState().roomMessages).toEqual([msg1]);
    });
  });
});
