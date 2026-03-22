"use client";

import { useEffect, useState, useRef, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { getSocket, type GameSocket } from "@/lib/socket";

let globalSocket: GameSocket | null = null;
let cachedPlayerCount = 0;
let cachedOnlinePlayers: { nickname: string; connectedAt: number }[] = [];

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
  const [isConnected, setIsConnected] = useState(() => getSocket().connected);
  const [playerCount, setPlayerCount] = useState(cachedPlayerCount);
  const [onlinePlayers, setOnlinePlayers] = useState(cachedOnlinePlayers);
  const versionToastShown = useRef(false);
  useEffect(() => {
    const s = getSocket();
    globalSocket = s;

    s.on("connect", () => setIsConnected(true));
    s.on("disconnect", () => setIsConnected(false));
    s.on("system:player-count", ({ count, players }) => {
      cachedPlayerCount = count;
      cachedOnlinePlayers = players;
      setPlayerCount(count);
      setOnlinePlayers(players);
    });

    s.on("system:version", ({ commitHash }) => {
      const clientHash = process.env.NEXT_PUBLIC_COMMIT_HASH;
      if (clientHash && commitHash !== "unknown" && clientHash !== commitHash) {
        if (!versionToastShown.current) {
          versionToastShown.current = true;
          toast("새 버전이 배포되었습니다", {
            description: `${clientHash} → ${commitHash}`,
            duration: Infinity,
            action: {
              label: "새로고침",
              onClick: () => window.location.reload(),
            },
          });
        }
      }
    });

    if (!s.connected) {
      s.connect();
    }

    return () => {
      s.off("connect");
      s.off("disconnect");
      s.off("system:player-count");
      s.off("system:version");
    };
  }, []);

  return { socket, isConnected, playerCount, onlinePlayers };
}
