"use client";

import { useEffect } from "react";
import { use } from "react";
import { useLobbyStore } from "@/stores/lobby-store";
import GameHub from "@/components/game-hub";

export default function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  useEffect(() => {
    useLobbyStore.getState().setPendingRoomId(id.toUpperCase());
    return () => useLobbyStore.getState().setPendingRoomId(null);
  }, [id]);

  return <GameHub />;
}
