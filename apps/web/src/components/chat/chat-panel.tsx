"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { ChatMessage } from "@game-hub/shared-types";
import { Send, ChevronDown, Trash2 } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { ConfirmDialog } from "@/components/common/confirm-dialog";

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  placeholder?: string;
  myNickname?: string;
  onNewMessage?: () => void;
  showNewMessageButton?: boolean;
  isAdmin?: boolean;
  onDeleteMessage?: (messageId: string) => void;
  disabled?: boolean;
  newMessageButtonBottom?: string;
}


export function ChatPanel({
  messages,
  onSendMessage,
  placeholder = "메시지를 입력하세요...",
  myNickname,
  onNewMessage,
  showNewMessageButton = false,
  isAdmin = false,
  onDeleteMessage,
  disabled = false,
  newMessageButtonBottom = "bottom-6",
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
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
            const isSystem = msg.playerId === "system";
            const isMe = msg.nickname === myNickname;

            if (isSystem) {
              return (
                <div key={msg.id ?? idx} className="text-center py-1">
                  <span className="text-xs text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-full">
                    {msg.message}
                  </span>
                </div>
              );
            }

            return (
              <div key={msg.id ?? idx} className={`group text-sm ${isMe ? "text-right" : ""}`}>
                {isMe ? (
                  <>
                    <span className="text-muted-foreground text-xs mr-1">
                      {formatDateTime(msg.timestamp)}
                    </span>
                    {msg.isSpectator && <span className="text-xs text-amber-500 mr-1">[관전]</span>}
                    <span className={`font-semibold ${msg.isAdmin ? "text-red-400" : "text-sky-400"}`}>
                      {msg.nickname}
                    </span>
                  </>
                ) : (
                  <>
                    {msg.isSpectator && <span className="text-xs text-amber-500 mr-1">[관전]</span>}
                    <span className={`font-semibold ${msg.isAdmin ? "text-red-400" : ""}`}>
                      {msg.nickname}
                    </span>
                    <span className="text-muted-foreground text-xs ml-1">
                      {formatDateTime(msg.timestamp)}
                    </span>
                  </>
                )}
                {isAdmin && onDeleteMessage && msg.id && (
                  <button
                    onClick={() => setDeleteTargetId(msg.id)}
                    className="ml-1 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity"
                    title="메시지 삭제"
                  >
                    <Trash2 className="w-3 h-3 inline" />
                  </button>
                )}
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
          className={`fixed ${newMessageButtonBottom} left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-full shadow-lg hover:bg-primary/90 transition-colors`}
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
          disabled={disabled}
          className="flex-1 bg-secondary/50 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <button
          type="submit"
          disabled={disabled || !input.trim()}
          className="bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground text-primary-foreground p-2 rounded-lg transition-colors disabled:cursor-not-allowed"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>

      {onDeleteMessage && (
        <ConfirmDialog
          open={deleteTargetId !== null}
          title="메시지 삭제"
          message="이 메시지를 삭제하시겠습니까?"
          confirmText="삭제"
          cancelText="취소"
          onConfirm={() => {
            if (deleteTargetId) {
              onDeleteMessage(deleteTargetId);
            }
            setDeleteTargetId(null);
          }}
          onCancel={() => setDeleteTargetId(null)}
        />
      )}
    </div>
  );
}
