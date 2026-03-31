"use client";

import type { CatchMindPublicState, ChatMessage } from "@game-hub/shared-types";
import { ChatPanel } from "@/components/chat/chat-panel";

interface CatchMindChatProps {
  state: CatchMindPublicState;
  myId: string;
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  myNickname?: string;
}

export function CatchMindChat({ state, myId, messages, onSendMessage, myNickname }: CatchMindChatProps) {
  const isDrawer = state.drawerId === myId;
  const myPlayer = state.players.find((p) => p.id === myId);
  const hasGuessed = myPlayer?.hasGuessedCorrectly ?? false;

  const isDrawingPhase = state.phase === "drawing";
  const isDisabled = isDrawingPhase && (isDrawer || hasGuessed);

  const placeholder = !isDrawingPhase
    ? "메시지를 입력하세요..."
    : isDrawer
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
        messages={messages}
        onSendMessage={handleSend}
        placeholder={placeholder}
        myNickname={myNickname}
        mySocketId={myId}
        disabled={isDisabled}
      />
    </div>
  );
}
