import type { ChatMessage } from "@game-hub/shared-types";
import type { ChatStore } from "./chat-store.js";

const MAX_HISTORY = 50;

export class InMemoryChatStore implements ChatStore {
  private lobbyMessages: ChatMessage[] = [];
  private roomMessages = new Map<string, ChatMessage[]>();

  async pushLobbyMessage(msg: ChatMessage): Promise<void> {
    this.lobbyMessages.push(msg);
    if (this.lobbyMessages.length > MAX_HISTORY) {
      this.lobbyMessages = this.lobbyMessages.slice(-MAX_HISTORY);
    }
  }

  async getLobbyHistory(): Promise<ChatMessage[]> {
    return [...this.lobbyMessages];
  }

  async pushRoomMessage(roomId: string, msg: ChatMessage): Promise<void> {
    let messages = this.roomMessages.get(roomId);
    if (!messages) {
      messages = [];
      this.roomMessages.set(roomId, messages);
    }
    messages.push(msg);
    if (messages.length > MAX_HISTORY) {
      this.roomMessages.set(roomId, messages.slice(-MAX_HISTORY));
    }
  }

  async getRoomHistory(roomId: string): Promise<ChatMessage[]> {
    return [...(this.roomMessages.get(roomId) ?? [])];
  }

  async deleteRoomHistory(roomId: string): Promise<void> {
    this.roomMessages.delete(roomId);
  }
}
