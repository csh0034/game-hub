import { useEffect, useCallback } from "react";
import type { GameSocket } from "@/lib/socket";
import { useChatStore } from "@/stores/chat-store";
import { toast } from "sonner";

export function useChat(socket: GameSocket | null) {
  const {
    lobbyMessages,
    roomMessages,
    addLobbyMessage,
    addRoomMessage,
    setLobbyMessages,
    setRoomMessages,
    clearRoomMessages,
    clearLobbyMessages,
    removeLobbyMessage,
    removeRoomMessage,
  } = useChatStore();

  useEffect(() => {
    if (!socket) return;

    socket.on("chat:lobby-message", addLobbyMessage);
    socket.on("chat:room-message", addRoomMessage);
    const handleMessageDeleted = (data: { target: "lobby" | "room"; messageId: string }) => {
      if (data.target === "lobby") {
        removeLobbyMessage(data.messageId);
      } else {
        removeRoomMessage(data.messageId);
      }
    };
    socket.on("chat:message-deleted", handleMessageDeleted);
    const handleWhisperReceived = (data: { fromNickname: string; message: string }) => {
      toast(`${data.fromNickname}님의 귓속말`, { description: data.message, duration: 5000 });
    };
    socket.on("chat:whisper-received", handleWhisperReceived);

    return () => {
      socket.off("chat:lobby-message", addLobbyMessage);
      socket.off("chat:room-message", addRoomMessage);
      socket.off("chat:message-deleted", handleMessageDeleted);
      socket.off("chat:whisper-received", handleWhisperReceived);
    };
  }, [socket, addLobbyMessage, addRoomMessage, removeLobbyMessage, removeRoomMessage]);

  const requestLobbyHistory = useCallback(() => {
    if (!socket) return;
    socket.emit("chat:request-history", "lobby", setLobbyMessages);
  }, [socket, setLobbyMessages]);

  const requestRoomHistory = useCallback(() => {
    if (!socket) return;
    socket.emit("chat:request-history", "room", setRoomMessages);
  }, [socket, setRoomMessages]);

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

  const deleteMessage = useCallback(
    (target: "lobby" | "room", messageId: string) => {
      socket?.emit("chat:delete-message", target, messageId, () => {});
    },
    [socket],
  );

  const sendWhisper = useCallback(
    (targetNickname: string, message: string) => {
      socket?.emit("chat:whisper", { targetNickname, message }, (result) => {
        if (result.success) {
          toast("귓속말이 전송되었습니다", { duration: 2000 });
        } else {
          toast.error(result.error ?? "귓속말 전송에 실패했습니다");
        }
      });
    },
    [socket],
  );

  return {
    lobbyMessages,
    roomMessages,
    sendLobbyMessage,
    sendRoomMessage,
    requestLobbyHistory,
    requestRoomHistory,
    clearRoomMessages,
    clearLobbyMessages,
    deleteMessage,
    sendWhisper,
  };
}
