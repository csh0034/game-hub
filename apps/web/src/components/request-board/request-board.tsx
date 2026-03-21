"use client";

import { useState, useCallback } from "react";
import type { FeatureRequest, CreateRequestPayload } from "@game-hub/shared-types";
import { Send } from "lucide-react";
import { RequestItem } from "./request-item";
import { ResolveDialog } from "./resolve-dialog";
import { toast } from "sonner";

interface RequestBoardProps {
  requests: FeatureRequest[];
  onCreateRequest: (payload: CreateRequestPayload) => Promise<{ success: boolean; error?: string }>;
  onResolveRequest: (requestId: string, commitHash: string) => Promise<{ success: boolean; error?: string }>;
  isAdmin: boolean;
}

export function RequestBoard({
  requests,
  onCreateRequest,
  onResolveRequest,
  isAdmin,
}: RequestBoardProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resolveTarget, setResolveTarget] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!title.trim() || !description.trim() || isSubmitting) return;

      setIsSubmitting(true);
      const result = await onCreateRequest({
        title: title.trim(),
        description: description.trim(),
      });
      setIsSubmitting(false);

      if (result.success) {
        setTitle("");
        setDescription("");
      } else {
        toast.error(result.error ?? "요청 생성에 실패했습니다");
      }
    },
    [title, description, isSubmitting, onCreateRequest],
  );

  const handleResolve = useCallback(
    async (commitHash: string) => {
      if (!resolveTarget) return;
      const result = await onResolveRequest(resolveTarget, commitHash);
      if (result.success) {
        setResolveTarget(null);
      } else {
        toast.error(result.error ?? "완료 처리에 실패했습니다");
      }
    },
    [resolveTarget, onResolveRequest],
  );

  const openRequests = requests.filter((r) => r.status === "open");
  const resolvedRequests = requests.filter((r) => r.status === "resolved");

  return (
    <div className="space-y-6">
      {/* 작성 폼 */}
      <form
        onSubmit={handleSubmit}
        className="bg-card border border-border rounded-xl p-4 space-y-3"
      >
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="요청 제목 (최대 100자)"
          maxLength={100}
          className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="상세 설명 (최대 1000자)"
          maxLength={1000}
          rows={3}
          className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!title.trim() || !description.trim() || isSubmitting}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
            등록
          </button>
        </div>
      </form>

      {/* 진행 중 목록 */}
      {openRequests.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-muted-foreground mb-2">
            진행 중 ({openRequests.length})
          </h3>
          <div className="space-y-2">
            {openRequests.map((request) => (
              <RequestItem
                key={request.id}
                request={request}
                isAdmin={isAdmin}
                onResolve={setResolveTarget}
              />
            ))}
          </div>
        </section>
      )}

      {/* 완료 목록 */}
      {resolvedRequests.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-muted-foreground mb-2">
            완료 ({resolvedRequests.length})
          </h3>
          <div className="space-y-2">
            {resolvedRequests.map((request) => (
              <RequestItem
                key={request.id}
                request={request}
                isAdmin={isAdmin}
                onResolve={setResolveTarget}
              />
            ))}
          </div>
        </section>
      )}

      {/* 빈 상태 */}
      {requests.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg">아직 요청사항이 없습니다</p>
          <p className="text-sm mt-1">첫 번째 요청을 등록해보세요!</p>
        </div>
      )}

      {/* 완료 처리 다이얼로그 */}
      <ResolveDialog
        open={resolveTarget !== null}
        onConfirm={handleResolve}
        onCancel={() => setResolveTarget(null)}
      />
    </div>
  );
}
