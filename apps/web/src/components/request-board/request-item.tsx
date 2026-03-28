"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { FeatureRequest, RequestLabel, RequestStatus } from "@game-hub/shared-types";
import { REQUEST_LABELS } from "@game-hub/shared-types";
import { Ban, Check, ExternalLink, Clock, Trash2, X, Play, MessageSquare, RotateCcw, ChevronDown, GitCommitHorizontal, Pencil } from "lucide-react";

const labelConfig: Record<RequestLabel, { name: string; className: string }> = {
  feature: { name: "기능 요청", className: "bg-blue-500/15 text-blue-500" },
  bug: { name: "버그", className: "bg-red-500/15 text-red-500" },
  improvement: { name: "개선", className: "bg-emerald-500/15 text-emerald-500" },
  "new-game": { name: "게임 추가", className: "bg-purple-500/15 text-purple-500" },
};

interface RequestItemProps {
  request: FeatureRequest;
  isAdmin: boolean;
  onChangeStatus: (requestId: string, targetStatus: RequestStatus) => void;
  onChangeLabel: (requestId: string, label: RequestLabel) => void;
  onUpdateFields: (requestId: string, fields: Record<string, string | null>) => void;
  onDelete: (requestId: string) => void;
}

const statusConfig: Record<RequestStatus, {
  icon: React.ReactNode;
  border: string;
  titleClass: string;
  name: string;
  className: string;
}> = {
  open: {
    icon: <div className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0 mt-1.5" />,
    border: "border-border bg-card hover:border-border/80",
    titleClass: "",
    name: "요청",
    className: "text-amber-500",
  },
  "in-progress": {
    icon: <Play className="w-4 h-4 text-blue-500 flex-shrink-0" />,
    border: "border-blue-500/30 bg-blue-500/5",
    titleClass: "",
    name: "진행",
    className: "text-blue-500",
  },
  resolved: {
    icon: <Check className="w-4 h-4 text-success flex-shrink-0" />,
    border: "border-success/30 bg-success/5",
    titleClass: "text-muted-foreground line-through",
    name: "완료",
    className: "text-success",
  },
  rejected: {
    icon: <X className="w-4 h-4 text-destructive flex-shrink-0" />,
    border: "border-destructive/30 bg-destructive/5",
    titleClass: "text-muted-foreground line-through",
    name: "거부",
    className: "text-destructive",
  },
  stopped: {
    icon: <Ban className="w-4 h-4 text-orange-500 flex-shrink-0" />,
    border: "border-orange-500/30 bg-orange-500/5",
    titleClass: "text-muted-foreground line-through",
    name: "중단",
    className: "text-orange-500",
  },
};

const statusMenuConfig: Record<RequestStatus, { icon: React.ReactNode; name: string; className: string }> = {
  open: { icon: <RotateCcw className="w-3.5 h-3.5" />, name: "재오픈", className: "text-amber-500" },
  "in-progress": { icon: <Play className="w-3.5 h-3.5" />, name: "진행", className: "text-blue-500" },
  resolved: { icon: <Check className="w-3.5 h-3.5" />, name: "완료", className: "text-success" },
  rejected: { icon: <X className="w-3.5 h-3.5" />, name: "거부", className: "text-destructive" },
  stopped: { icon: <Ban className="w-3.5 h-3.5" />, name: "중단", className: "text-orange-500" },
};

const ALL_STATUSES: RequestStatus[] = ["open", "in-progress", "resolved", "rejected", "stopped"];

function InlineInput({ value, onSave, onCancel, maxLength, className }: {
  value: string;
  onSave: (value: string) => void;
  onCancel: () => void;
  maxLength: number;
  className?: string;
}) {
  const [text, setText] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);

  const handleSave = () => {
    const trimmed = text.trim();
    if (trimmed && trimmed !== value) onSave(trimmed);
    else onCancel();
  };

  return (
    <input
      ref={ref}
      type="text"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={handleSave}
      onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") onCancel(); }}
      maxLength={maxLength}
      className={`w-full bg-secondary/50 border border-primary/50 rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary ${className ?? ""}`}
    />
  );
}

function InlineTextarea({ value, onSave, onCancel, maxLength, placeholder, allowEmpty }: {
  value: string;
  onSave: (value: string | null) => void;
  onCancel: () => void;
  maxLength: number;
  placeholder?: string;
  allowEmpty?: boolean;
}) {
  const [text, setText] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);

  const handleSave = () => {
    const trimmed = text.trim();
    if (allowEmpty && !trimmed) { onSave(null); return; }
    if (trimmed && trimmed !== value) onSave(trimmed);
    else onCancel();
  };

  return (
    <textarea
      ref={ref}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={handleSave}
      onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); onCancel(); } }}
      maxLength={maxLength}
      placeholder={placeholder}
      rows={2}
      className="w-full bg-secondary/50 border border-primary/50 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
    />
  );
}

export function RequestItem({ request, isAdmin, onChangeStatus, onChangeLabel, onUpdateFields, onDelete }: RequestItemProps) {
  const config = statusConfig[request.status];
  const [showLabelMenu, setShowLabelMenu] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [editField, setEditField] = useState<"title" | "description" | "adminResponse" | "commitHash" | null>(null);
  const labelMenuRef = useRef<HTMLDivElement>(null);
  const statusMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showLabelMenu && !showStatusMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (showLabelMenu && labelMenuRef.current && !labelMenuRef.current.contains(e.target as Node)) {
        setShowLabelMenu(false);
      }
      if (showStatusMenu && statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) {
        setShowStatusMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showLabelMenu, showStatusMenu]);

  const handleFieldSave = useCallback((field: "title" | "description" | "adminResponse" | "commitHash", value: string | null) => {
    onUpdateFields(request.id, { [field]: value });
    setEditField(null);
  }, [request.id, onUpdateFields]);

  const startEdit = (field: "title" | "description" | "adminResponse" | "commitHash") => {
    if (isAdmin) setEditField(field);
  };

  return (
    <div className={`border rounded-lg px-4 py-3 transition-colors ${config.border}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {config.icon}
            {request.label && labelConfig[request.label] && (
              <div className="relative flex-shrink-0" ref={labelMenuRef}>
                <button
                  type="button"
                  onClick={() => isAdmin && setShowLabelMenu(!showLabelMenu)}
                  className={`px-1.5 py-0.5 text-[10px] font-medium rounded-full ${labelConfig[request.label].className} ${isAdmin ? "cursor-pointer hover:opacity-80" : "cursor-default"}`}
                >
                  {labelConfig[request.label].name}
                </button>
                {showLabelMenu && (
                  <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-lg shadow-lg py-1 z-10 min-w-[100px]">
                    {REQUEST_LABELS.filter((l) => l !== request.label).map((l) => (
                      <button
                        key={l}
                        type="button"
                        onClick={() => {
                          onChangeLabel(request.id, l);
                          setShowLabelMenu(false);
                        }}
                        className={`w-full px-3 py-1.5 text-xs text-left hover:bg-secondary/50 transition-colors ${labelConfig[l].className.split(" ").filter((c) => c.startsWith("text-")).join(" ")}`}
                      >
                        {labelConfig[l].name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {editField === "title" ? (
              <InlineInput
                value={request.title}
                onSave={(v) => handleFieldSave("title", v)}
                onCancel={() => setEditField(null)}
                maxLength={100}
                className="font-medium"
              />
            ) : (
              <h3
                onDoubleClick={() => startEdit("title")}
                className={`font-medium truncate ${config.titleClass} ${isAdmin ? "group/title cursor-pointer" : ""}`}
              >
                {request.title}
                {isAdmin && <Pencil className="w-3 h-3 ml-1 inline-block opacity-0 group-hover/title:opacity-40 hover:!opacity-70 transition-opacity cursor-pointer" onClick={() => startEdit("title")} />}
              </h3>
            )}
          </div>

          {editField === "description" ? (
            <div className="mt-1 ml-6">
              <InlineTextarea
                value={request.description}
                onSave={(v) => handleFieldSave("description", v)}
                onCancel={() => setEditField(null)}
                maxLength={1000}
              />
            </div>
          ) : (
            <p
              onDoubleClick={() => startEdit("description")}
              className={`text-sm text-muted-foreground mt-1 ml-6 whitespace-pre-wrap break-words ${isAdmin ? "group/desc cursor-pointer" : ""}`}
            >
              {request.description}
              {isAdmin && <Pencil className="w-3 h-3 ml-1 inline-block opacity-0 group-hover/desc:opacity-40 hover:!opacity-70 transition-opacity cursor-pointer" onClick={() => startEdit("description")} />}
            </p>
          )}

          {editField === "adminResponse" ? (
            <div className="mt-2 ml-6">
              <InlineTextarea
                value={request.adminResponse ?? ""}
                onSave={(v) => handleFieldSave("adminResponse", v)}
                onCancel={() => setEditField(null)}
                maxLength={500}
                placeholder="답변 입력"
                allowEmpty
              />
            </div>
          ) : request.adminResponse ? (
            <div
              onDoubleClick={() => startEdit("adminResponse")}
              className={`flex items-start gap-1.5 mt-2 ml-6 text-sm ${isAdmin ? "group/resp cursor-pointer" : ""}`}
            >
              <MessageSquare className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <p className="text-muted-foreground whitespace-pre-wrap break-words">
                {request.adminResponse}
                {isAdmin && <Pencil className="w-3 h-3 ml-1 inline-block opacity-0 group-hover/resp:opacity-40 hover:!opacity-70 transition-opacity cursor-pointer" onClick={() => startEdit("adminResponse")} />}
              </p>
            </div>
          ) : isAdmin ? (
            <button
              type="button"
              onClick={() => setEditField("adminResponse")}
              className="flex items-center gap-1 mt-2 ml-6 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              <MessageSquare className="w-3 h-3" />
              답변 추가
            </button>
          ) : null}

          <div className="flex items-center gap-3 mt-2 ml-6 text-xs text-muted-foreground">
            <span>{request.author}</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatTime(request.createdAt)}
            </span>
            {editField === "commitHash" ? (
              <InlineInput
                value={request.commitHash ?? ""}
                onSave={(v) => handleFieldSave("commitHash", v)}
                onCancel={() => setEditField(null)}
                maxLength={40}
                className="font-mono w-32"
              />
            ) : request.commitHash ? (
              <span className="flex items-center gap-1 group/hash" onDoubleClick={() => startEdit("commitHash")}>
                <code className={isAdmin ? "cursor-pointer" : ""}>{request.commitHash.slice(0, 7)}</code>
                {request.commitUrl && (
                  <a
                    href={request.commitUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:text-primary/80 transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => startEdit("commitHash")}
                    className="opacity-0 group-hover/hash:opacity-40 hover:!opacity-70 transition-opacity"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                )}
              </span>
            ) : isAdmin && request.status === "resolved" ? (
              <button
                type="button"
                onClick={() => setEditField("commitHash")}
                className="flex items-center gap-1 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              >
                <GitCommitHorizontal className="w-3 h-3" />
                해시 추가
              </button>
            ) : null}
          </div>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <div className="relative" ref={statusMenuRef}>
              <button
                type="button"
                onClick={() => setShowStatusMenu(!showStatusMenu)}
                className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-secondary/50 transition-colors ${config.className}`}
              >
                {config.name}
                <ChevronDown className="w-3 h-3" />
              </button>
              {showStatusMenu && (
                <div className="absolute top-full right-0 mt-1 bg-card border border-border rounded-lg shadow-lg py-1 z-10 min-w-[100px]">
                  {ALL_STATUSES.filter((s) => s !== request.status).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        onChangeStatus(request.id, s);
                        setShowStatusMenu(false);
                      }}
                      className={`w-full px-3 py-1.5 text-xs text-left hover:bg-secondary/50 transition-colors flex items-center gap-2 ${statusMenuConfig[s].className}`}
                    >
                      {statusMenuConfig[s].icon}
                      {statusMenuConfig[s].name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => onDelete(request.id)}
              className="p-1.5 text-xs rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="삭제"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function formatTime(timestamp: number): string {
  const diff = Math.floor((Date.now() - timestamp) / 1000);
  if (diff < 60) return "방금 전";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}
