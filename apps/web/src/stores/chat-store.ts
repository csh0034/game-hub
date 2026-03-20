import { create } from "zustand";
import type { ChatMessage } from "@game-hub/shared-types";

const MAX_MESSAGES = 100;

interface ChatStore {
  lobbyMessages: ChatMessage[];
  roomMessages: ChatMessage[];
  addLobbyMessage: (msg: ChatMessage) => void;
  addRoomMessage: (msg: ChatMessage) => void;
  clearRoomMessages: () => void;
  clearLobbyMessages: () => void;
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
  clearRoomMessages: () => set({ roomMessages: [] }),
  clearLobbyMessages: () => set({ lobbyMessages: [] }),
}));
