"use client";

import { useState, useCallback } from "react";
import { ChatPanel } from "@/components/chat/chat-panel";
import { useChatStore } from "@/stores/chat-store";
import type { GameSocket } from "@/lib/socket";

interface FloatingChatProps {
  socket: GameSocket | null;
  nickname: string;
  disabled?: boolean;
}

export function FloatingChat({ socket, nickname, disabled }: FloatingChatProps) {
  const [isOpen, setIsOpen] = useState(true);

  const roomMessages = useChatStore((s) => s.roomMessages);

  const onSendRoomMessage = useCallback(
    (message: string) => {
      if (!socket) return;
      socket.emit("chat:room-message", message);
    },
    [socket],
  );

  return (
    <>
      {/* Toggle button — always bottom-right */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="pointer-events-auto fixed bottom-4 right-4 z-20 rounded-full bg-gray-800/80 p-3 text-white shadow-lg transition hover:bg-gray-700"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zm-4 0H9v2h2V9z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Chat panel — fixed bottom-right, responsive width */}
      {isOpen && (
        <div className="pointer-events-auto fixed right-4 bottom-16 z-20 w-72 max-w-[calc(100vw-2rem)] rounded-lg bg-gray-900/95 shadow-2xl backdrop-blur-sm sm:w-80">
          {/* Header */}
          <div className="flex items-center justify-between rounded-t-lg bg-gray-800 px-3 py-2">
            <span className="text-sm font-semibold text-white">채팅</span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-white"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
          {/* Chat body */}
          <div data-chat-body className="h-64">
            <ChatPanel
              messages={roomMessages}
              onSendMessage={onSendRoomMessage}
              placeholder={disabled ? "관전자 채팅이 허용되지 않습니다" : "채팅..."}
              myNickname={nickname}
              disabled={disabled}
              hideHeader
            />
          </div>
        </div>
      )}
    </>
  );
}
