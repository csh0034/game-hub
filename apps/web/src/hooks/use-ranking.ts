"use client";

import { useEffect, useCallback } from "react";
import { useRankingStore } from "@/stores/ranking-store";
import type { GameSocket } from "@/lib/socket";
import type { RankingKey, RankingEntry } from "@game-hub/shared-types";

export function useRanking(socket: GameSocket | null) {
  const { rankings, setRankings } = useRankingStore();

  useEffect(() => {
    if (!socket) return;

    const onUpdated = (data: { key: RankingKey; rankings: RankingEntry[] }) => {
      setRankings(data.key, data.rankings);
    };

    socket.on("ranking:updated", onUpdated);
    return () => {
      socket.off("ranking:updated", onUpdated);
    };
  }, [socket, setRankings]);

  const fetchRankings = useCallback(
    (key: RankingKey) => {
      if (!socket) return;
      socket.emit("ranking:get", key, (entries) => {
        setRankings(key, entries);
      });
    },
    [socket, setRankings],
  );

  return { rankings, fetchRankings };
}
