import { useEffect, useCallback } from "react";
import type { GameSocket } from "@/lib/socket";
import { useChatStore } from "@/stores/chat-store";

export function useChat(socket: GameSocket | null) {
  const {
    lobbyMessages,
    roomMessages,
    addLobbyMessage,
    addRoomMessage,
    clearRoomMessages,
    clearLobbyMessages,
  } = useChatStore();

  useEffect(() => {
    if (!socket) return;

    socket.on("chat:lobby-message", addLobbyMessage);
    socket.on("chat:room-message", addRoomMessage);

    return () => {
      socket.off("chat:lobby-message", addLobbyMessage);
      socket.off("chat:room-message", addRoomMessage);
    };
  }, [socket, addLobbyMessage, addRoomMessage]);

  const sendLobbyMessage = useCallback(
    (message: string) => {
      socket?.emit("chat:lobby-message", message);
    },
    [socket],
  );

  const sendRoomMessage = useCallback(
    (message: string) => {
      socket?.emit("chat:room-message", message);
    },
    [socket],
  );

  return {
    lobbyMessages,
    roomMessages,
    sendLobbyMessage,
    sendRoomMessage,
    clearRoomMessages,
    clearLobbyMessages,
  };
}
