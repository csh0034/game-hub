"use client";

import type { FeatureRequest } from "@game-hub/shared-types";
import { Check, ExternalLink, Clock, Trash2 } from "lucide-react";

interface RequestItemProps {
  request: FeatureRequest;
  isAdmin: boolean;
  onResolve: (requestId: string) => void;
  onDelete: (requestId: string) => void;
}

export function RequestItem({ request, isAdmin, onResolve, onDelete }: RequestItemProps) {
  const isResolved = request.status === "resolved";

  return (
    <div
      className={`border rounded-lg px-4 py-3 transition-colors ${
        isResolved
          ? "border-success/30 bg-success/5"
          : "border-border bg-card hover:border-border/80"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {isResolved ? (
              <Check className="w-4 h-4 text-success flex-shrink-0" />
            ) : (
              <div className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0 mt-1.5" />
            )}
            <h3
              className={`font-medium truncate ${
                isResolved ? "text-muted-foreground line-through" : ""
              }`}
            >
              {request.title}
            </h3>
          </div>

          <p className="text-sm text-muted-foreground mt-1 ml-6 whitespace-pre-wrap break-words">
            {request.description}
          </p>

          <div className="flex items-center gap-3 mt-2 ml-6 text-xs text-muted-foreground">
            <span>{request.author}</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatTime(request.createdAt)}
            </span>
            {isResolved && request.commitHash && (
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
            {!isResolved && (
              <button
                onClick={() => onResolve(request.id)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-success/15 text-success hover:bg-success/25 transition-colors"
              >
                완료 처리
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
