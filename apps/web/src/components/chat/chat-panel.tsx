"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { ChatMessage } from "@game-hub/shared-types";
import { Send, ChevronDown } from "lucide-react";

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  placeholder?: string;
  myNickname?: string;
  onNewMessage?: () => void;
  showNewMessageButton?: boolean;
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function ChatPanel({
  messages,
  onSendMessage,
  placeholder = "메시지를 입력하세요...",
  myNickname,
  onNewMessage,
  showNewMessageButton = false,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [lastSeenCount, setLastSeenCount] = useState(messages.length);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [isChatVisible, setIsChatVisible] = useState(true);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const isChatVisibleRef = useRef(true);

  // 메시지 감소 시 리셋 (방 이동 등)
  if (messages.length < lastSeenCount) {
    setLastSeenCount(messages.length);
  }

  // 채팅이 화면에 안 보이거나, 채팅 내부에서 위로 스크롤한 경우
  const hasNewMessages = messages.length > lastSeenCount && (!isNearBottom || !isChatVisible);

  const scrollToBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollIntoView({ behavior: "smooth", block: "end" });
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    }
    setLastSeenCount(messages.length);
  }, [messages.length]);

  const checkNearBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const threshold = 60;
    const nearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
    isNearBottomRef.current = nearBottom;
    setIsNearBottom(nearBottom);
    if (nearBottom && isChatVisibleRef.current) {
      setLastSeenCount(messages.length);
    }
  }, [messages.length]);

  // 메시지 영역이 뷰포트에 보이는지 감지
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = entry.isIntersecting;
        isChatVisibleRef.current = visible;
        setIsChatVisible(visible);
        if (visible && isNearBottomRef.current) {
          setLastSeenCount(messages.length);
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [messages.length]);

  // DOM 스크롤: 하단 근처이고 채팅이 뷰포트에 보일 때만 자동 스크롤
  useEffect(() => {
    if (isNearBottomRef.current && isChatVisibleRef.current) {
      const container = messagesContainerRef.current;
      if (container) {
        container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
      }
    }
  }, [messages]);

  // 새 메시지 알림 콜백
  useEffect(() => {
    if (hasNewMessages) {
      onNewMessage?.();
    }
  }, [hasNewMessages, onNewMessage]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    onSendMessage(trimmed);
    setInput("");
  };

  return (
    <div className="flex flex-col h-full bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border">
        <h3 className="text-sm font-semibold">채팅</h3>
      </div>

      <div className="relative flex-1 min-h-0">
        <div
          ref={messagesContainerRef}
          onScroll={checkNearBottom}
          className="h-full overflow-y-auto px-4 py-3 space-y-2"
        >
          {messages.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              메시지가 없습니다.
            </p>
          )}
          {messages.map((msg, idx) => {
            const isMe = msg.nickname === myNickname;
            return (
              <div key={idx} className={`text-sm ${isMe ? "text-right" : ""}`}>
                <span className="text-muted-foreground text-xs mr-1">
                  {formatTime(msg.timestamp)}
                </span>
                <span className={`font-semibold ${isMe ? "text-sky-400" : ""}`}>
                  {msg.nickname}
                </span>
                <p className={`${isMe ? "text-sky-400/90" : "text-foreground"} break-words`}>
                  {msg.message}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {showNewMessageButton && hasNewMessages && (
        <button
          onClick={scrollToBottom}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-full shadow-lg hover:bg-primary/90 transition-colors"
        >
          새 메시지
          <ChevronDown className="w-4 h-4" />
        </button>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2 px-3 py-2.5 border-t border-border">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          maxLength={500}
          className="flex-1 bg-secondary/50 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground text-primary-foreground p-2 rounded-lg transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
