import { create } from "zustand";
import type { ChatMessage } from "@game-hub/shared-types";

const MAX_MESSAGES = 100;

interface ChatStore {
  lobbyMessages: ChatMessage[];
  roomMessages: ChatMessage[];
  addLobbyMessage: (msg: ChatMessage) => void;
  addRoomMessage: (msg: ChatMessage) => void;
  setLobbyMessages: (msgs: ChatMessage[]) => void;
  setRoomMessages: (msgs: ChatMessage[]) => void;
  clearRoomMessages: () => void;
  clearLobbyMessages: () => void;
  removeLobbyMessage: (messageId: string) => void;
  removeRoomMessage: (messageId: string) => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  lobbyMessages: [],
  roomMessages: [],
  addLobbyMessage: (msg) =>
    set((state) => ({
      lobbyMessages: [...state.lobbyMessages, msg].slice(-MAX_MESSAGES),
    })),
  addRoomMessage: (msg) =>
    set((state) => ({
      roomMessages: [...state.roomMessages, msg].slice(-MAX_MESSAGES),
    })),
  setLobbyMessages: (msgs) => set({ lobbyMessages: msgs.slice(-MAX_MESSAGES) }),
  setRoomMessages: (msgs) => set({ roomMessages: msgs.slice(-MAX_MESSAGES) }),
  clearRoomMessages: () => set({ roomMessages: [] }),
  clearLobbyMessages: () => set({ lobbyMessages: [] }),
  removeLobbyMessage: (messageId) =>
    set((state) => ({
      lobbyMessages: state.lobbyMessages.filter((m) => m.id !== messageId),
    })),
  removeRoomMessage: (messageId) =>
    set((state) => ({
      roomMessages: state.roomMessages.filter((m) => m.id !== messageId),
    })),
}));
