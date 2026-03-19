"use client";

import { useEffect, useRef, useState } from "react";
import { getSocket, type GameSocket } from "@/lib/socket";

export function useSocket() {
  const socketRef = useRef<GameSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [playerCount, setPlayerCount] = useState(0);

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    // Set nickname from localStorage
    const savedNickname = localStorage.getItem("game-hub-nickname");
    if (savedNickname) {
      socket.once("connect", () => {
        socket.emit("player:set-nickname", savedNickname);
      });
    }

    socket.on("connect", () => setIsConnected(true));
    socket.on("disconnect", () => setIsConnected(false));
    socket.on("system:player-count", (count) => setPlayerCount(count));

    if (!socket.connected) {
      socket.connect();
    } else {
      setIsConnected(true);
    }

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("system:player-count");
    };
  }, []);

  return { socket: socketRef.current, isConnected, playerCount };
}
