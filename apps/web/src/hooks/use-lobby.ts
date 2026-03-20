"use client";

import { useEffect, useCallback } from "react";
import { useLobbyStore } from "@/stores/lobby-store";
import { useGameStore } from "@/stores/game-store";
import type { GameSocket } from "@/lib/socket";
import type { CreateRoomPayload, Room } from "@game-hub/shared-types";

export function useLobby(socket: GameSocket | null) {
  const { rooms, currentRoom, setRooms, setCurrentRoom, addRoom, updateRoom, removeRoom } =
    useLobbyStore();

  useEffect(() => {
    if (!socket) return;

    // Fetch initial rooms
    socket.emit("lobby:get-rooms", (rooms) => {
      setRooms(rooms);
    });

    socket.on("lobby:room-created", (room) => addRoom(room));
    socket.on("lobby:room-updated", (room) => updateRoom(room));
    socket.on("lobby:room-removed", (roomId) => removeRoom(roomId));
    socket.on("lobby:error", (message) => {
      console.error("[lobby error]", message);
    });

    return () => {
      socket.off("lobby:room-created");
      socket.off("lobby:room-updated");
      socket.off("lobby:room-removed");
      socket.off("lobby:error");
    };
  }, [socket, setRooms, addRoom, updateRoom, removeRoom]);

  const resetGame = useGameStore((s) => s.reset);

  const createRoom = useCallback(
    (payload: CreateRoomPayload): Promise<Room> => {
      return new Promise((resolve, reject) => {
        if (!socket) return reject("Not connected");
        resetGame();
        socket.emit("lobby:create-room", payload, (room) => {
          setCurrentRoom(room);
          resolve(room);
        });
      });
    },
    [socket, setCurrentRoom, resetGame]
  );

  const joinRoom = useCallback(
    (roomId: string): Promise<Room> => {
      return new Promise((resolve, reject) => {
        if (!socket) return reject("Not connected");
        resetGame();
        socket.emit("lobby:join-room", { roomId }, (room, error) => {
          if (!room) return reject(error || "Failed to join");
          setCurrentRoom(room);
          resolve(room);
        });
      });
    },
    [socket, setCurrentRoom, resetGame]
  );

  const leaveRoom = useCallback(() => {
    if (!socket) return;
    socket.emit("lobby:leave-room");
    setCurrentRoom(null);
    resetGame();
  }, [socket, setCurrentRoom, resetGame]);

  const toggleReady = useCallback(() => {
    if (!socket) return;
    socket.emit("lobby:toggle-ready");
  }, [socket]);

  return { rooms, currentRoom, createRoom, joinRoom, leaveRoom, toggleReady };
}
