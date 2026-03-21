"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { getSocket, type GameSocket } from "@/lib/socket";

let globalSocket: GameSocket | null = null;

function subscribeSocket(callback: () => void) {
  const socket = getSocket();
  globalSocket = socket;
  socket.on("connect", callback);
  socket.on("disconnect", callback);
  return () => {
    socket.off("connect", callback);
    socket.off("disconnect", callback);
  };
}

function getSocketSnapshot(): GameSocket | null {
  return globalSocket;
}

export function useSocket() {
  const socket = useSyncExternalStore(subscribeSocket, getSocketSnapshot, () => null);
  const [isConnected, setIsConnected] = useState(false);
  const [playerCount, setPlayerCount] = useState(0);
  const [onlinePlayers, setOnlinePlayers] = useState<{ nickname: string; connectedAt: number }[]>([]);
  useEffect(() => {
    const s = getSocket();
    globalSocket = s;

    s.on("connect", () => setIsConnected(true));
    s.on("disconnect", () => setIsConnected(false));
    s.on("system:player-count", ({ count, players }) => {
      setPlayerCount(count);
      setOnlinePlayers(players);
    });

    if (!s.connected) {
      s.connect();
    }

    return () => {
      s.off("connect");
      s.off("disconnect");
      s.off("system:player-count");
    };
  }, []);

  return { socket, isConnected, playerCount, onlinePlayers };
}
