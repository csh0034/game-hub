"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import type { ChatMessage } from "@game-hub/shared-types";
import { Send, Trash2 } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { ConfirmDialog } from "@/components/common/confirm-dialog";

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  placeholder?: string;
  myNickname?: string;
  isAdmin?: boolean;
  onDeleteMessage?: (messageId: string) => void;
  disabled?: boolean;
  onlinePlayers?: { nickname: string }[];
  onWhisper?: (targetNickname: string, message: string) => void;
}


export function ChatPanel({
  messages,
  onSendMessage,
  placeholder = "메시지를 입력하세요...",
  myNickname,
  isAdmin = false,
  onDeleteMessage,
  disabled = false,
  onlinePlayers,
  onWhisper,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isComposingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredPlayers = useMemo(() => {
    if (!onlinePlayers || !showMentionDropdown) return [];
    return onlinePlayers
      .filter((p) => p.nickname !== myNickname)
      .filter((p) => p.nickname.toLowerCase().includes(mentionFilter.toLowerCase()))
      .slice(0, 8);
  }, [onlinePlayers, showMentionDropdown, mentionFilter, myNickname]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInput(value);

    if (value.startsWith("@") && onlinePlayers && onWhisper) {
      const spaceIdx = value.indexOf(" ");
      const filterText = spaceIdx === -1 ? value.slice(1) : "";
      if (spaceIdx === -1) {
        setMentionFilter(filterText);
        setShowMentionDropdown(true);
        setMentionIndex(0);
      } else {
        setShowMentionDropdown(false);
      }
    } else {
      setShowMentionDropdown(false);
    }
  };

  const handleSelectMention = (nickname: string) => {
    setInput(`@${nickname} `);
    setShowMentionDropdown(false);
    inputRef.current?.focus();
  };

  // 새 메시지 시 자동 스크롤
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;

    if (trimmed.startsWith("@") && onWhisper && onlinePlayers) {
      const matched = onlinePlayers
        .filter((p) => p.nickname !== myNickname)
        .sort((a, b) => b.nickname.length - a.nickname.length)
        .find((p) => trimmed.startsWith(`@${p.nickname} `));

      if (matched) {
        const message = trimmed.slice(matched.nickname.length + 2);
        if (message) {
          onWhisper(matched.nickname, message);
          setInput("");
          return;
        }
      }
    }

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
                  <span className="text-xs text-primary bg-primary/10 px-2.5 py-1 rounded-full">
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

      <form onSubmit={handleSubmit} className="relative flex gap-2 px-3 py-2.5 border-t border-border">
        {showMentionDropdown && filteredPlayers.length > 0 && (
          <div className="absolute bottom-full left-0 right-0 mb-1 bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto z-50">
            {filteredPlayers.map((player, idx) => (
              <button
                key={player.nickname}
                type="button"
                className={`w-full text-left px-3 py-2 text-sm hover:bg-secondary/50 ${idx === mentionIndex ? "bg-secondary/50" : ""}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelectMention(player.nickname);
                }}
              >
                {player.nickname}
              </button>
            ))}
          </div>
        )}
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={handleInputChange}
          onCompositionStart={() => { isComposingRef.current = true; }}
          onCompositionEnd={() => { isComposingRef.current = false; }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && isComposingRef.current) {
              e.preventDefault();
              return;
            }
            if (showMentionDropdown && filteredPlayers.length > 0) {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setMentionIndex((prev) => Math.min(prev + 1, filteredPlayers.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setMentionIndex((prev) => Math.max(prev - 1, 0));
              } else if (e.key === "Tab" || (e.key === "Enter" && !isComposingRef.current)) {
                e.preventDefault();
                handleSelectMention(filteredPlayers[mentionIndex].nickname);
              } else if (e.key === "Escape") {
                setShowMentionDropdown(false);
              }
            }
          }}
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
