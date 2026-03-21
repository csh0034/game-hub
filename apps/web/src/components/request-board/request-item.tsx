"use client";

import type { FeatureRequest, RequestLabel } from "@game-hub/shared-types";
import { Check, ExternalLink, Clock, Trash2, X, Play, MessageSquare } from "lucide-react";

const labelConfig: Record<RequestLabel, { name: string; className: string }> = {
  feature: { name: "기능 요청", className: "bg-blue-500/15 text-blue-500" },
  bug: { name: "버그", className: "bg-red-500/15 text-red-500" },
  improvement: { name: "개선", className: "bg-emerald-500/15 text-emerald-500" },
  "new-game": { name: "게임 추가", className: "bg-purple-500/15 text-purple-500" },
};

interface RequestItemProps {
  request: FeatureRequest;
  isAdmin: boolean;
  onAccept: (requestId: string) => void;
  onReject: (requestId: string) => void;
  onResolve: (requestId: string) => void;
  onDelete: (requestId: string) => void;
}

const statusConfig = {
  open: {
    icon: <div className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0 mt-1.5" />,
    border: "border-border bg-card hover:border-border/80",
    titleClass: "",
  },
  "in-progress": {
    icon: <Play className="w-4 h-4 text-blue-500 flex-shrink-0" />,
    border: "border-blue-500/30 bg-blue-500/5",
    titleClass: "",
  },
  resolved: {
    icon: <Check className="w-4 h-4 text-success flex-shrink-0" />,
    border: "border-success/30 bg-success/5",
    titleClass: "text-muted-foreground line-through",
  },
  rejected: {
    icon: <X className="w-4 h-4 text-destructive flex-shrink-0" />,
    border: "border-destructive/30 bg-destructive/5",
    titleClass: "text-muted-foreground line-through",
  },
};

export function RequestItem({ request, isAdmin, onAccept, onReject, onResolve, onDelete }: RequestItemProps) {
  const config = statusConfig[request.status];
  const isOpen = request.status === "open";
  const isInProgress = request.status === "in-progress";

  return (
    <div className={`border rounded-lg px-4 py-3 transition-colors ${config.border}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {config.icon}
            {request.label && labelConfig[request.label] && (
              <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded-full flex-shrink-0 ${labelConfig[request.label].className}`}>
                {labelConfig[request.label].name}
              </span>
            )}
            <h3 className={`font-medium truncate ${config.titleClass}`}>
              {request.title}
            </h3>
          </div>

          <p className="text-sm text-muted-foreground mt-1 ml-6 whitespace-pre-wrap break-words">
            {request.description}
          </p>

          {request.adminResponse && (
            <div className="flex items-start gap-1.5 mt-2 ml-6 text-sm">
              <MessageSquare className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <p className="text-muted-foreground whitespace-pre-wrap break-words">
                {request.adminResponse}
              </p>
            </div>
          )}

          <div className="flex items-center gap-3 mt-2 ml-6 text-xs text-muted-foreground">
            <span>{request.author}</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatTime(request.createdAt)}
            </span>
            {request.status === "resolved" && request.commitHash && (
              <span className="flex items-center gap-1">
                {request.commitUrl ? (
                  <a
                    href={request.commitUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-primary hover:underline"
                  >
                    <code>{request.commitHash.slice(0, 7)}</code>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <code>{request.commitHash.slice(0, 7)}</code>
                )}
              </span>
            )}
          </div>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {isOpen && (
              <button
                onClick={() => onAccept(request.id)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-500/15 text-blue-500 hover:bg-blue-500/25 transition-colors"
              >
                진행
              </button>
            )}
            {(isOpen || isInProgress) && (
              <button
                onClick={() => onResolve(request.id)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-success/15 text-success hover:bg-success/25 transition-colors"
              >
                완료 처리
              </button>
            )}
            {(isOpen || isInProgress) && (
              <button
                onClick={() => onReject(request.id)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-destructive/15 text-destructive hover:bg-destructive/25 transition-colors"
              >
                거부
              </button>
            )}
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
