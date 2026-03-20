"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { ChatMessage } from "@game-hub/shared-types";
import { Send } from "lucide-react";

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  placeholder?: string;
  myPlayerId?: string;
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function ChatPanel({
  messages,
  onSendMessage,
  placeholder = "메시지를 입력하세요...",
  myPlayerId,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);

  const checkNearBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const threshold = 60;
    isNearBottomRef.current =
      container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
  }, []);

  useEffect(() => {
    if (isNearBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

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

      <div
        ref={messagesContainerRef}
        onScroll={checkNearBottom}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-2 min-h-0"
      >
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            메시지가 없습니다.
          </p>
        )}
        {messages.map((msg, idx) => {
          const isMe = msg.playerId === myPlayerId;
          return (
            <div key={idx} className={`text-sm ${isMe ? "text-right" : ""}`}>
              <span className="text-muted-foreground text-xs mr-1">
                {formatTime(msg.timestamp)}
              </span>
              <span className={`font-semibold ${isMe ? "text-primary" : ""}`}>
                {msg.nickname}
              </span>
              <p className={`${isMe ? "text-primary/90" : "text-foreground"} break-words`}>
                {msg.message}
              </p>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

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
