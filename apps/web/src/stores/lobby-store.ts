import { create } from "zustand";
import type { Room } from "@game-hub/shared-types";

interface LobbyStore {
  rooms: Room[];
  currentRoom: Room | null;
  setRooms: (rooms: Room[]) => void;
  setCurrentRoom: (room: Room | null) => void;
  addRoom: (room: Room) => void;
  updateRoom: (room: Room) => void;
  removeRoom: (roomId: string) => void;
}

export const useLobbyStore = create<LobbyStore>((set) => ({
  rooms: [],
  currentRoom: null,
  setRooms: (rooms) => set({ rooms }),
  setCurrentRoom: (room) => set({ currentRoom: room }),
  addRoom: (room) =>
    set((state) => ({
      rooms: state.rooms.some((r) => r.id === room.id)
        ? state.rooms
        : [...state.rooms, room],
    })),
  updateRoom: (room) =>
    set((state) => ({
      rooms: state.rooms.map((r) => (r.id === room.id ? room : r)),
      currentRoom: state.currentRoom?.id === room.id ? room : state.currentRoom,
    })),
  removeRoom: (roomId) =>
    set((state) => ({
      rooms: state.rooms.filter((r) => r.id !== roomId),
      currentRoom: state.currentRoom?.id === roomId ? null : state.currentRoom,
    })),
}));
