"use client";

import { useState, useEffect } from "react";
import type { CatchMindPublicState, ChatMessage } from "@game-hub/shared-types";
import type { GameSocket } from "@/lib/socket";
import { ChatPanel } from "@/components/chat/chat-panel";

interface CatchMindChatProps {
  state: CatchMindPublicState;
  socket: GameSocket;
  myId: string;
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  myNickname?: string;
}

export function CatchMindChat({ state, socket, myId, messages, onSendMessage, myNickname }: CatchMindChatProps) {
  const [systemMessages, setSystemMessages] = useState<ChatMessage[]>([]);

  const isDrawer = state.drawerId === myId;
  const myPlayer = state.players.find((p) => p.id === myId);
  const hasGuessed = myPlayer?.hasGuessedCorrectly ?? false;

  const isDisabled = state.phase === "drawing" && (isDrawer || hasGuessed);

  useEffect(() => {
    const handleCorrect = (data: { playerId: string; nickname: string }) => {
      const sysMsg: ChatMessage = {
        id: `sys-${Date.now()}-${data.playerId}`,
        playerId: "system",
        nickname: "system",
        message: `${data.nickname}님이 정답을 맞추었습니다!`,
        timestamp: Date.now(),
      };
      setSystemMessages((prev) => [...prev, sysMsg]);
    };

    socket.on("game:catch-mind-correct", handleCorrect);
    return () => {
      socket.off("game:catch-mind-correct", handleCorrect);
    };
  }, [socket]);

  const allMessages = [...messages, ...systemMessages].sort((a, b) => a.timestamp - b.timestamp);

  const placeholder = isDrawer
    ? "출제자는 채팅할 수 없습니다"
    : hasGuessed
      ? "이미 정답을 맞추었습니다"
      : "정답을 입력하세요...";

  const handleSend = (message: string) => {
    if (isDisabled) return;
    onSendMessage(message);
  };

  return (
    <div className="h-full">
      <ChatPanel
        messages={allMessages}
        onSendMessage={handleSend}
        placeholder={placeholder}
        myNickname={myNickname}
        disabled={isDisabled}
      />
    </div>
  );
}
