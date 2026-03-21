import type { ChatMessage } from "@game-hub/shared-types";

export interface ChatStore {
  pushLobbyMessage(msg: ChatMessage): Promise<void>;
  getLobbyHistory(): Promise<ChatMessage[]>;
  pushRoomMessage(roomId: string, msg: ChatMessage): Promise<void>;
  getRoomHistory(roomId: string): Promise<ChatMessage[]>;
  deleteRoomHistory(roomId: string): Promise<void>;
  deleteLobbyMessage(messageId: string): Promise<boolean>;
  deleteRoomMessage(roomId: string, messageId: string): Promise<boolean>;
}
