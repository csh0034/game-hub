"use client";

import { useState, useCallback, useMemo } from "react";
import type { FeatureRequest, CreateRequestPayload, RequestLabel, RequestStatus } from "@game-hub/shared-types";
import { Send } from "lucide-react";

const labelOptions: { value: RequestLabel; name: string; color: string }[] = [
  { value: "feature", name: "기능 요청", color: "bg-blue-500/15 text-blue-500 border-blue-500/30" },
  { value: "bug", name: "버그", color: "bg-red-500/15 text-red-500 border-red-500/30" },
  { value: "improvement", name: "개선", color: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
  { value: "new-game", name: "게임 추가", color: "bg-purple-500/15 text-purple-500 border-purple-500/30" },
];
import { RequestItem } from "./request-item";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { toast } from "sonner";

interface RequestBoardProps {
  requests: FeatureRequest[];
  onCreateRequest: (payload: CreateRequestPayload) => Promise<{ success: boolean; error?: string }>;
  onChangeStatus: (requestId: string, status: RequestStatus) => Promise<{ success: boolean; error?: string }>;
  onUpdateFields: (requestId: string, fields: Record<string, string | null>) => Promise<{ success: boolean; error?: string }>;
  onChangeLabelRequest: (requestId: string, label: RequestLabel) => Promise<{ success: boolean; error?: string }>;
  onDeleteRequest: (requestId: string) => Promise<{ success: boolean; error?: string }>;
  isAdmin: boolean;
}

const statusLabels: Record<RequestStatus, string> = {
  open: "재오픈",
  "in-progress": "진행",
  resolved: "완료",
  rejected: "거부",
  stopped: "중단",
};

export function RequestBoard({
  requests,
  onCreateRequest,
  onChangeStatus,
  onUpdateFields,
  onChangeLabelRequest,
  onDeleteRequest,
  isAdmin,
}: RequestBoardProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [label, setLabel] = useState<RequestLabel>("feature");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const handleChangeLabel = useCallback(
    async (requestId: string, label: RequestLabel) => {
      const result = await onChangeLabelRequest(requestId, label);
      if (!result.success) {
        toast.error(result.error ?? "라벨 변경에 실패했습니다");
      }
    },
    [onChangeLabelRequest],
  );

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

  const handleChangeStatus = useCallback(
    async (requestId: string, targetStatus: RequestStatus) => {
      const result = await onChangeStatus(requestId, targetStatus);
      if (!result.success) {
        toast.error(result.error ?? `${statusLabels[targetStatus]} 처리에 실패했습니다`);
      }
    },
    [onChangeStatus],
  );

  const handleUpdateFields = useCallback(
    async (requestId: string, fields: Record<string, string | null>) => {
      const result = await onUpdateFields(requestId, fields);
      if (!result.success) {
        toast.error(result.error ?? "수정에 실패했습니다");
      }
    },
    [onUpdateFields],
  );

  const grouped = useMemo(() => {
    const result: Record<RequestStatus, FeatureRequest[]> = {
      open: [], "in-progress": [], resolved: [], rejected: [], stopped: [],
    };
    for (const r of requests) result[r.status].push(r);

    const statusTimeKey: Record<RequestStatus, keyof FeatureRequest> = {
      open: "createdAt",
      "in-progress": "inProgressAt",
      resolved: "resolvedAt",
      rejected: "rejectedAt",
      stopped: "stoppedAt",
    };
    for (const status of Object.keys(result) as RequestStatus[]) {
      const key = statusTimeKey[status];
      result[status].sort((a, b) => ((b[key] as number) ?? 0) - ((a[key] as number) ?? 0));
    }

    return result;
  }, [requests]);

  const renderRequestItem = (request: FeatureRequest) => (
    <RequestItem
      key={request.id}
      request={request}
      isAdmin={isAdmin}
      onChangeStatus={handleChangeStatus}
      onChangeLabel={handleChangeLabel}
      onUpdateFields={handleUpdateFields}
      onDelete={setDeleteTarget}
    />
  );

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
      {grouped.open.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-muted-foreground mb-2">요청 ({grouped.open.length})</h3>
          <div className="space-y-2">{grouped.open.map(renderRequestItem)}</div>
        </section>
      )}

      {grouped["in-progress"].length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-muted-foreground mb-2">진행중 ({grouped["in-progress"].length})</h3>
          <div className="space-y-2">{grouped["in-progress"].map(renderRequestItem)}</div>
        </section>
      )}

      {grouped.resolved.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-muted-foreground mb-2">완료 ({grouped.resolved.length})</h3>
          <div className="space-y-2">{grouped.resolved.map(renderRequestItem)}</div>
        </section>
      )}

      {grouped.rejected.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-muted-foreground mb-2">거부 ({grouped.rejected.length})</h3>
          <div className="space-y-2">{grouped.rejected.map(renderRequestItem)}</div>
        </section>
      )}

      {grouped.stopped.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-muted-foreground mb-2">중단 ({grouped.stopped.length})</h3>
          <div className="space-y-2">{grouped.stopped.map(renderRequestItem)}</div>
        </section>
      )}

      {requests.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg">아직 요청사항이 없습니다</p>
          <p className="text-sm mt-1">첫 번째 요청을 등록해보세요!</p>
        </div>
      )}

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
