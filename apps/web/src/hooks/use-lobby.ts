"use client";

import { useEffect, useCallback, useRef } from "react";
import { useLobbyStore } from "@/stores/lobby-store";
import { useGameStore } from "@/stores/game-store";
import type { GameSocket } from "@/lib/socket";
import type { CreateRoomPayload, GameOptions, Room } from "@game-hub/shared-types";
import { toast } from "sonner";

export function useLobby(socket: GameSocket | null) {
  const { rooms, currentRoom, isSpectating, isGhostSpectating, setRooms, setCurrentRoom, setIsSpectating, setIsGhostSpectating, addRoom, updateRoom, removeRoom } =
    useLobbyStore();
  const resetGame = useGameStore((s) => s.reset);

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

    socket.on("lobby:spectator-kicked", () => {
      setCurrentRoom(null);
      setIsSpectating(false);
      setIsGhostSpectating(false);
      resetGame();
      toast.info("방장이 관전을 비활성화하여 로비로 이동합니다.");
    });

    socket.on("lobby:kicked", () => {
      setCurrentRoom(null);
      setIsSpectating(false);
      setIsGhostSpectating(false);
      resetGame();
      toast.info("방장에 의해 내보내졌습니다.");
    });

    return () => {
      socket.off("lobby:room-created");
      socket.off("lobby:room-updated");
      socket.off("lobby:room-removed");
      socket.off("lobby:error");
      socket.off("lobby:spectator-kicked");
      socket.off("lobby:kicked");
    };
  }, [socket, setRooms, addRoom, updateRoom, removeRoom, setCurrentRoom, setIsSpectating, setIsGhostSpectating, resetGame]);

  const createRoom = useCallback(
    (payload: CreateRoomPayload): Promise<Room> => {
      return new Promise((resolve, reject) => {
        if (!socket) return reject("Not connected");
        resetGame();
        socket.emit("lobby:create-room", payload, (room) => {
          setCurrentRoom(room);
          setIsSpectating(false);
          resolve(room);
        });
      });
    },
    [socket, setCurrentRoom, setIsSpectating, resetGame]
  );

  const joinRoom = useCallback(
    (roomId: string): Promise<Room> => {
      return new Promise((resolve, reject) => {
        if (!socket) return reject("Not connected");
        resetGame();
        socket.emit("lobby:join-room", { roomId }, (room, error) => {
          if (!room) return reject(error || "Failed to join");
          setCurrentRoom(room);
          setIsSpectating(false);
          resolve(room);
        });
      });
    },
    [socket, setCurrentRoom, setIsSpectating, resetGame]
  );

  const spectateRoom = useCallback(
    (roomId: string, ghost?: boolean): Promise<Room> => {
      return new Promise((resolve, reject) => {
        if (!socket) return reject("Not connected");
        resetGame();
        socket.emit("lobby:join-spectate", { roomId, ghost }, (room, error) => {
          if (!room) return reject(error || "Failed to spectate");
          setCurrentRoom(room);
          setIsSpectating(true);
          setIsGhostSpectating(!!ghost);
          resolve(room);
        });
      });
    },
    [socket, setCurrentRoom, setIsSpectating, setIsGhostSpectating, resetGame]
  );

  const leaveRoom = useCallback(() => {
    if (!socket) return;
    socket.emit("lobby:leave-room");
    setCurrentRoom(null);
    setIsSpectating(false);
    setIsGhostSpectating(false);
    resetGame();
  }, [socket, setCurrentRoom, setIsSpectating, setIsGhostSpectating, resetGame]);

  const kickSpectators = useCallback((): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!socket) return reject("Not connected");
      socket.emit("lobby:kick-spectators", (result) => {
        if (!result.success) return reject(result.error);
        resolve();
      });
    });
  }, [socket]);

  const kickPlayer = useCallback(
    (targetId: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (!socket) return reject("Not connected");
        socket.emit("lobby:kick", targetId, (result) => {
          if (!result.success) return reject(result.error);
          resolve();
        });
      });
    },
    [socket]
  );

  const switchRole = useCallback((): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!socket) return reject("Not connected");
      socket.emit("lobby:switch-role", (result) => {
        if (!result.success) return reject(result.error);
        setIsSpectating(result.role === "spectator");
        resolve();
      });
    });
  }, [socket, setIsSpectating]);

  const toggleReady = useCallback(() => {
    if (!socket) return;
    socket.emit("lobby:toggle-ready");
  }, [socket]);

  const updateRoomName = useCallback(
    (name: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (!socket) return reject("Not connected");
        socket.emit("lobby:update-room-name", name, (result) => {
          if (!result.success) return reject(result.error);
          resolve();
        });
      });
    },
    [socket]
  );

  const updateTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const updateGameOptions = useCallback(
    (gameOptions: GameOptions) => {
      if (!socket) return;
      if (updateTimerRef.current) clearTimeout(updateTimerRef.current);
      updateTimerRef.current = setTimeout(() => {
        socket.emit("lobby:update-game-options", gameOptions, (result) => {
          if (!result.success) {
            console.error("[lobby] update game options failed:", result.error);
          }
        });
      }, 300);
    },
    [socket]
  );

  return { rooms, currentRoom, isSpectating, isGhostSpectating, createRoom, joinRoom, spectateRoom, leaveRoom, kickSpectators, kickPlayer, switchRole, toggleReady, updateRoomName, updateGameOptions };
}
