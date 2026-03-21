"use client";

import { useState, useCallback } from "react";
import type { FeatureRequest, CreateRequestPayload, RequestLabel } from "@game-hub/shared-types";
import { Send } from "lucide-react";

const labelOptions: { value: RequestLabel; name: string; color: string }[] = [
  { value: "feature", name: "기능 요청", color: "bg-blue-500/15 text-blue-500 border-blue-500/30" },
  { value: "bug", name: "버그", color: "bg-red-500/15 text-red-500 border-red-500/30" },
  { value: "improvement", name: "개선", color: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
  { value: "new-game", name: "게임 추가", color: "bg-purple-500/15 text-purple-500 border-purple-500/30" },
];
import { RequestItem } from "./request-item";
import { AcceptDialog } from "./accept-dialog";
import { RejectDialog } from "./reject-dialog";
import { ResolveDialog } from "./resolve-dialog";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { toast } from "sonner";

interface RequestBoardProps {
  requests: FeatureRequest[];
  onCreateRequest: (payload: CreateRequestPayload) => Promise<{ success: boolean; error?: string }>;
  onAcceptRequest: (requestId: string, adminResponse?: string) => Promise<{ success: boolean; error?: string }>;
  onRejectRequest: (requestId: string, adminResponse: string) => Promise<{ success: boolean; error?: string }>;
  onResolveRequest: (requestId: string, commitHash: string, adminResponse?: string) => Promise<{ success: boolean; error?: string }>;
  onDeleteRequest: (requestId: string) => Promise<{ success: boolean; error?: string }>;
  isAdmin: boolean;
}

export function RequestBoard({
  requests,
  onCreateRequest,
  onAcceptRequest,
  onRejectRequest,
  onResolveRequest,
  onDeleteRequest,
  isAdmin,
}: RequestBoardProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [label, setLabel] = useState<RequestLabel>("feature");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [acceptTarget, setAcceptTarget] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [resolveTarget, setResolveTarget] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    const result = await onDeleteRequest(deleteTarget);
    setDeleteTarget(null);
    if (!result.success) {
      toast.error(result.error ?? "삭제에 실패했습니다");
    }
  }, [deleteTarget, onDeleteRequest]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!title.trim() || !description.trim() || isSubmitting) return;

      setIsSubmitting(true);
      const result = await onCreateRequest({
        title: title.trim(),
        description: description.trim(),
        label,
      });
      setIsSubmitting(false);

      if (result.success) {
        setTitle("");
        setDescription("");
        setLabel("feature");
      } else {
        toast.error(result.error ?? "요청 생성에 실패했습니다");
      }
    },
    [title, description, label, isSubmitting, onCreateRequest],
  );

  const handleAccept = useCallback(
    async (adminResponse?: string) => {
      if (!acceptTarget) return;
      const result = await onAcceptRequest(acceptTarget, adminResponse);
      if (result.success) {
        setAcceptTarget(null);
      } else {
        toast.error(result.error ?? "진행 처리에 실패했습니다");
      }
    },
    [acceptTarget, onAcceptRequest],
  );

  const handleReject = useCallback(
    async (adminResponse: string) => {
      if (!rejectTarget) return;
      const result = await onRejectRequest(rejectTarget, adminResponse);
      if (result.success) {
        setRejectTarget(null);
      } else {
        toast.error(result.error ?? "거부 처리에 실패했습니다");
      }
    },
    [rejectTarget, onRejectRequest],
  );

  const handleResolve = useCallback(
    async (commitHash: string, adminResponse?: string) => {
      if (!resolveTarget) return;
      const result = await onResolveRequest(resolveTarget, commitHash, adminResponse);
      if (result.success) {
        setResolveTarget(null);
      } else {
        toast.error(result.error ?? "완료 처리에 실패했습니다");
      }
    },
    [resolveTarget, onResolveRequest],
  );

  const openRequests = requests.filter((r) => r.status === "open");
  const inProgressRequests = requests.filter((r) => r.status === "in-progress");
  const resolvedRequests = requests.filter((r) => r.status === "resolved");
  const rejectedRequests = requests.filter((r) => r.status === "rejected");

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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {labelOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setLabel(opt.value)}
                className={`px-2.5 py-1 text-xs font-medium rounded-full border transition-colors ${
                  label === opt.value
                    ? opt.color
                    : "border-border text-muted-foreground hover:border-border/80"
                }`}
              >
                {opt.name}
              </button>
            ))}
          </div>
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

      {/* 요청 목록 */}
      {openRequests.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-muted-foreground mb-2">
            요청 ({openRequests.length})
          </h3>
          <div className="space-y-2">
            {openRequests.map((request) => (
              <RequestItem
                key={request.id}
                request={request}
                isAdmin={isAdmin}
                onAccept={setAcceptTarget}
                onReject={setRejectTarget}
                onResolve={setResolveTarget}
                onDelete={setDeleteTarget}
              />
            ))}
          </div>
        </section>
      )}

      {/* 진행중 목록 */}
      {inProgressRequests.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-muted-foreground mb-2">
            진행중 ({inProgressRequests.length})
          </h3>
          <div className="space-y-2">
            {inProgressRequests.map((request) => (
              <RequestItem
                key={request.id}
                request={request}
                isAdmin={isAdmin}
                onAccept={setAcceptTarget}
                onReject={setRejectTarget}
                onResolve={setResolveTarget}
                onDelete={setDeleteTarget}
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
                onAccept={setAcceptTarget}
                onReject={setRejectTarget}
                onResolve={setResolveTarget}
                onDelete={setDeleteTarget}
              />
            ))}
          </div>
        </section>
      )}

      {/* 거부 목록 */}
      {rejectedRequests.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-muted-foreground mb-2">
            거부 ({rejectedRequests.length})
          </h3>
          <div className="space-y-2">
            {rejectedRequests.map((request) => (
              <RequestItem
                key={request.id}
                request={request}
                isAdmin={isAdmin}
                onAccept={setAcceptTarget}
                onReject={setRejectTarget}
                onResolve={setResolveTarget}
                onDelete={setDeleteTarget}
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

      {/* 진행 처리 다이얼로그 */}
      <AcceptDialog
        open={acceptTarget !== null}
        onConfirm={handleAccept}
        onCancel={() => setAcceptTarget(null)}
      />

      {/* 거부 다이얼로그 */}
      <RejectDialog
        open={rejectTarget !== null}
        onConfirm={handleReject}
        onCancel={() => setRejectTarget(null)}
      />

      {/* 완료 처리 다이얼로그 */}
      <ResolveDialog
        open={resolveTarget !== null}
        onConfirm={handleResolve}
        onCancel={() => setResolveTarget(null)}
      />

      {/* 삭제 확인 다이얼로그 */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="요청사항 삭제"
        message="이 요청사항을 삭제하시겠습니까? 삭제 후 복구할 수 없습니다."
        confirmText="삭제"
        cancelText="취소"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
