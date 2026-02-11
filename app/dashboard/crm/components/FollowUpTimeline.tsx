"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Loader2, ImageIcon, Plus, Trash2, MoreHorizontal, Pencil } from "lucide-react";
import { useAlert } from "@/hooks/use-alert";
import { useConfirm } from "@/hooks/use-confirm";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FollowUpTimelineSkeleton } from "@/app/ui/skeletons";
import { deleteFollowUpAction, updateFollowUpAction } from "@/app/lib/crm-actions";

export interface FollowUpImageItem {
  id: string;
  blobUrl: string;
  fileName: string;
  uploadedAt: string;
}

interface FollowUp {
  id: string;
  content: string;
  createdAt: string;
  updatedAt?: string | null;
  isSystemGenerated: boolean;
  transitionType?: string | null;
  followUpBy: { id: string; name: string };
  updatedBy?: { id: string; name: string } | null;
  contactPerson?: string | null;
  summary?: string | null;
  nextStep?: string | null;
  customerNeeds?: string | null;
  _count?: { images: number };
}

interface FollowUpTimelineProps {
  leadId?: string;
  opportunityId?: string;
  customerId?: string;
  currentUserRole?: string;
  currentUserId?: string;
  refreshKey?: number;
}

/**
 * 跟进时间线组件
 * 显示线索/商机/客户的完整跟进历史记录
 */
export function FollowUpTimeline({
  leadId,
  opportunityId,
  customerId,
  currentUserRole,
  currentUserId,
  refreshKey = 0,
}: FollowUpTimelineProps) {
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [ellipsis, setEllipsis] = useState(0);
  const [imagesByFollowUpId, setImagesByFollowUpId] = useState<Record<string, FollowUpImageItem[]>>({});
  const [loadingImagesForId, setLoadingImagesForId] = useState<string | null>(null);
  const [uploadingForId, setUploadingForId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0); // 0-100
  const [uploadTotal, setUploadTotal] = useState(0);
  const [imageCountOverrides, setImageCountOverrides] = useState<Record<string, number>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const uploadPseudoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const uploadCapRef = useRef(90); // 伪进度停在一个随机上限
  const [editingFollowUpId, setEditingFollowUpId] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    content: "",
    contactPerson: "",
    summary: "",
    nextStep: "",
    customerNeeds: "",
  });
  const { showAlert, AlertComponent } = useAlert();

  const clearPseudoProgress = useCallback(() => {
    if (uploadPseudoTimerRef.current) {
      clearInterval(uploadPseudoTimerRef.current);
      uploadPseudoTimerRef.current = null;
    }
    setUploadingForId(null);
    setUploadProgress(0);
    setUploadTotal(0);
  }, []);
  const { showConfirm, ConfirmComponent } = useConfirm();

  const imageCount = useCallback((fu: FollowUp) => imageCountOverrides[fu.id] ?? fu._count?.images ?? 0, [imageCountOverrides]);
  const canUploadOrDelete = useCallback(
    (fu: FollowUp) =>
      currentUserRole === "admin" || (currentUserId && fu.followUpBy.id === currentUserId),
    [currentUserRole, currentUserId]
  );

  useEffect(() => {
    if (!loading) return;
    const t = setInterval(() => setEllipsis((e) => (e + 1) % 3), 400);
    return () => clearInterval(t);
  }, [loading]);

  useEffect(() => {
    setLoading(true);
    async function fetchFollowUps() {
      try {
        const params = new URLSearchParams();
        if (leadId) params.set("leadId", leadId);
        if (opportunityId) params.set("opportunityId", opportunityId);
        if (customerId) params.set("customerId", customerId);

        const response = await fetch(`/api/crm/follow-ups/timeline?${params}`);
        if (!response.ok) throw new Error("获取跟进记录失败");

        const data = await response.json();
        setFollowUps(data);
        // 由父组件刷新（如刚提交新跟进）后展开全部，展示最新完整记录
        if (refreshKey > 0) setExpanded(true);
      } catch (error) {
        console.error("获取跟进记录失败:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchFollowUps();
  }, [leadId, opportunityId, customerId, refreshKey]);

  // 格式化日期时间
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  };

  // 使用 if(loading) 而非 Suspense：当前在 useEffect 里 fetch，是命令式、不“挂起”的；
  // Suspense 需要渲染阶段就能拿到 promise（如 use() 或支持 suspend 的请求库），适合服务端/流式场景。
  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
          <span>加载跟进记录{".".repeat(ellipsis + 1)}</span>
        </div>
        <FollowUpTimelineSkeleton />
      </div>
    );
  }

  if (followUps.length === 0) {
    return (
      <div className="py-4 text-center text-sm text-gray-500">
        暂无跟进记录
      </div>
    );
  }

  // 显示最近一条摘要
  const latestFollowUp = followUps[0];
  const displayFollowUps = expanded ? followUps : [latestFollowUp];

  return (
    <>
      <AlertComponent />
      <ConfirmComponent />
      <Dialog open={!!editingFollowUpId} onOpenChange={(open) => !open && setEditingFollowUpId(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>编辑跟进记录</DialogTitle>
            <DialogDescription>
              可修改描述与可选字段，修改后保存即可。状态变更记录不可删除，仅可编辑以修正或补充信息。
            </DialogDescription>
          </DialogHeader>
          {editingFollowUpId && (
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <label className="text-sm font-medium">跟进内容</label>
                <textarea
                  value={editForm.content}
                  onChange={(e) => setEditForm((p) => ({ ...p, content: e.target.value }))}
                  className="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="跟进描述"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-muted-foreground">沟通对象（选填）</label>
                <input
                  value={editForm.contactPerson}
                  onChange={(e) => setEditForm((p) => ({ ...p, contactPerson: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="沟通对象"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-muted-foreground">一句话进展（选填）</label>
                <input
                  value={editForm.summary}
                  onChange={(e) => setEditForm((p) => ({ ...p, summary: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="一句话进展"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-muted-foreground">下一步（选填）</label>
                <input
                  value={editForm.nextStep}
                  onChange={(e) => setEditForm((p) => ({ ...p, nextStep: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="下一步"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-muted-foreground">客户需求（选填）</label>
                <input
                  value={editForm.customerNeeds}
                  onChange={(e) => setEditForm((p) => ({ ...p, customerNeeds: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="客户需求"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingFollowUpId(null)} disabled={editSaving}>
              取消
            </Button>
            <Button
              disabled={editSaving}
              onClick={async () => {
                if (!editingFollowUpId) return;
                setEditSaving(true);
                const result = await updateFollowUpAction(editingFollowUpId, {
                  content: editForm.content,
                  contactPerson: editForm.contactPerson || undefined,
                  summary: editForm.summary || undefined,
                  nextStep: editForm.nextStep || undefined,
                  customerNeeds: editForm.customerNeeds || undefined,
                });
                setEditSaving(false);
                if (result?.error) {
                  showAlert(result.error, { type: "error", title: "保存失败" });
                  return;
                }
                setFollowUps((prev) =>
                  prev.map((f) =>
                    f.id === editingFollowUpId
                      ? {
                          ...f,
                          content: editForm.content,
                          contactPerson: editForm.contactPerson || null,
                          summary: editForm.summary || null,
                          nextStep: editForm.nextStep || null,
                          customerNeeds: editForm.customerNeeds || null,
                        }
                      : f
                  )
                );
                setEditingFollowUpId(null);
              }}
            >
              {editSaving ? "保存中…" : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="space-y-3 text-left">
        {displayFollowUps.map((followUp, index) => (
          <div
            key={followUp.id}
            className={`rounded-lg border p-3 ${followUp.isSystemGenerated
              ? "border-blue-200 bg-blue-50"
              : "border-gray-200 bg-white"
              }`}
          >
            {/* 头部：跟进人、时间、三点操作 */}
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-medium text-gray-900 truncate">
                  {followUp.followUpBy.name}
                </span>
                {followUp.isSystemGenerated && (
                  <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700 shrink-0">
                    状态变更
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-xs text-gray-500">
                  {formatDateTime(followUp.createdAt)}
                </span>
                {canUploadOrDelete(followUp) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        disabled={uploadingForId === followUp.id}
                        onSelect={() => fileInputRefs.current[followUp.id]?.click()}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        {uploadingForId === followUp.id ? "上传中…" : "补充图片"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => {
                          setEditForm({
                            content: followUp.content,
                            contactPerson: followUp.contactPerson ?? "",
                            summary: followUp.summary ?? "",
                            nextStep: followUp.nextStep ?? "",
                            customerNeeds: followUp.customerNeeds ?? "",
                          });
                          setEditingFollowUpId(followUp.id);
                        }}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        编辑
                      </DropdownMenuItem>
                      {!followUp.transitionType && (
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onSelect={() => {
                            showConfirm(
                              {
                                title: "确认删除跟进记录",
                                description: "确定要删除这条跟进记录吗？删除后不可恢复。",
                                confirmText: "删除",
                                cancelText: "取消",
                                variant: "destructive",
                              },
                              async () => {
                                const deleted = followUp;
                                setFollowUps((prev) => prev.filter((f) => f.id !== deleted.id));
                                const result = await deleteFollowUpAction(deleted.id);
                                if (result?.error) {
                                  setFollowUps((prev) => [...prev, deleted].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
                                  showAlert(result.error, { type: "error", title: "删除失败" });
                                }
                              }
                            );
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          删除
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>

            {/* 跟进内容 */}
            <div className="text-sm text-gray-700 whitespace-pre-wrap">
              {followUp.content}
            </div>

            {/* 可选字段 */}
            {(followUp.contactPerson ||
              followUp.summary ||
              followUp.nextStep ||
              followUp.customerNeeds) && (
                <div className="mt-2 space-y-1 border-t pt-2 text-xs text-gray-600">
                  {followUp.contactPerson && (
                    <div>
                      <span className="font-medium">沟通对象：</span>
                      {followUp.contactPerson}
                    </div>
                  )}
                  {followUp.summary && (
                    <div>
                      <span className="font-medium">一句话进展：</span>
                      {followUp.summary}
                    </div>
                  )}
                  {followUp.nextStep && (
                    <div>
                      <span className="font-medium">下一步：</span>
                      {followUp.nextStep}
                    </div>
                  )}
                  {followUp.customerNeeds && (
                    <div>
                      <span className="font-medium">客户需求：</span>
                      {followUp.customerNeeds}
                    </div>
                  )}
                </div>
              )}

            {/* 图片：按需加载 + 补上传 */}
            {(imageCount(followUp) > 0 ||
              imagesByFollowUpId[followUp.id]?.length ||
              canUploadOrDelete(followUp)) && (
                <div className="mt-2 flex flex-wrap items-center gap-2 border-t pt-2 text-xs">
                  {(imageCount(followUp) > 0 || imagesByFollowUpId[followUp.id]?.length) && (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800"
                      onClick={async () => {
                        if (followUp.id in imagesByFollowUpId) return;
                        setLoadingImagesForId(followUp.id);
                        try {
                          const res = await fetch(`/api/crm/follow-ups/${followUp.id}/images`);
                          if (!res.ok) throw new Error("获取失败");
                          const data = await res.json();
                          setImagesByFollowUpId((prev) => ({ ...prev, [followUp.id]: data.images ?? [] }));
                        } catch {
                          showAlert("加载图片失败", { type: "error", title: "错误" });
                        } finally {
                          setLoadingImagesForId(null);
                        }
                      }}
                      disabled={loadingImagesForId === followUp.id}
                    >
                      <ImageIcon className="h-3.5 w-3.5" />
                      {loadingImagesForId === followUp.id
                        ? "加载中..."
                        : `查看上传图片 (${imageCount(followUp)})`}
                    </button>
                  )}
                  {canUploadOrDelete(followUp) && (
                    <>
                      <input
                        ref={(el) => {
                          fileInputRefs.current[followUp.id] = el;
                        }}
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        multiple
                        className="sr-only"
                        aria-hidden
                        disabled={uploadingForId === followUp.id}
                        onChange={async (e) => {
                          const files = e.target.files;
                          if (!files?.length) return;
                          const fileList = Array.from(files);
                          const fid = followUp.id;
                          e.target.value = "";
                          setUploadingForId(fid);
                          setUploadTotal(fileList.length);
                          setUploadProgress(0);
                          uploadCapRef.current = 85 + Math.floor(Math.random() * 11); // 85～95 随机
                          if (uploadPseudoTimerRef.current) clearInterval(uploadPseudoTimerRef.current);
                          uploadPseudoTimerRef.current = setInterval(() => {
                            const cap = uploadCapRef.current;
                            setUploadProgress((p) => {
                              if (p >= cap) {
                                if (uploadPseudoTimerRef.current) {
                                  clearInterval(uploadPseudoTimerRef.current);
                                  uploadPseudoTimerRef.current = null;
                                }
                                return cap;
                              }
                              return p + 6;
                            });
                          }, 100);
                          try {
                            const createdList: FollowUpImageItem[] = [];
                            for (let i = 0; i < fileList.length; i++) {
                              const file = fileList[i];
                              const fd = new FormData();
                              fd.set("file", file);
                              const res = await fetch(`/api/crm/follow-ups/${fid}/images/upload`, {
                                method: "POST",
                                body: fd,
                              });
                              if (!res.ok) {
                                const d = await res.json().catch(() => ({}));
                                throw new Error(d.error ?? "上传失败");
                              }
                              const created = await res.json();
                              createdList.push(created);
                            }
                            if (uploadPseudoTimerRef.current) {
                              clearInterval(uploadPseudoTimerRef.current);
                              uploadPseudoTimerRef.current = null;
                            }
                            setUploadProgress(100);
                            setImageCountOverrides((prev) => {
                              const base = prev[fid] ?? followUp._count?.images ?? 0;
                              return { ...prev, [fid]: base + fileList.length };
                            });
                            setImagesByFollowUpId((prev) => {
                              if (!(fid in prev)) return prev;
                              return { ...prev, [fid]: [...(prev[fid] ?? []), ...createdList] };
                            });
                            setTimeout(clearPseudoProgress, 350);
                          } catch (err) {
                            if (uploadPseudoTimerRef.current) {
                              clearInterval(uploadPseudoTimerRef.current);
                              uploadPseudoTimerRef.current = null;
                            }
                            showAlert(err instanceof Error ? err.message : "上传失败", {
                              type: "error",
                              title: "上传失败",
                            });
                            clearPseudoProgress();
                          }
                        }}
                      />
                      {uploadingForId === followUp.id && uploadTotal > 0 && (
                        <div className="flex items-center gap-2 w-32 shrink-0">
                          <div className="w-[72px] shrink-0">
                            <Progress value={uploadProgress} max={100} className="h-2" />
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0 w-8">{uploadProgress}%</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

            {/* 已加载的图片列表（缩略图 + 删除） */}
            {imagesByFollowUpId[followUp.id]?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {imagesByFollowUpId[followUp.id].map((img) => (
                  <div
                    key={img.id}
                    className="relative inline-block rounded border border-gray-200 bg-gray-50"
                  >
                    <a
                      href={img.blobUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block overflow-hidden rounded"
                    >
                      <img
                        src={img.blobUrl}
                        alt={img.fileName}
                        className="h-20 w-20 object-cover"
                      />
                    </a>
                    {canUploadOrDelete(followUp) && (
                      <button
                        type="button"
                        className="absolute -right-1 -top-1 rounded-full bg-red-500 p-0.5 text-white hover:bg-red-600"
                        aria-label="删除图片"
                        onClick={() => {
                          const list = imagesByFollowUpId[followUp.id] ?? [];
                          const prevCount = imageCount(followUp);
                          showConfirm(
                            {
                              title: "确认删除",
                              description: "确定要删除这张图片吗？删除后无法恢复。",
                              confirmText: "删除",
                              cancelText: "取消",
                              variant: "destructive",
                            },
                            () => {
                              // 乐观删除：先从 UI 撤下
                              setImagesByFollowUpId((prev) => ({
                                ...prev,
                                [followUp.id]: (prev[followUp.id] ?? []).filter((i) => i.id !== img.id),
                              }));
                              setImageCountOverrides((prev) => ({
                                ...prev,
                                [followUp.id]: Math.max(0, prevCount - 1),
                              }));
                              // 后台执行删除，失败则回滚
                              fetch(`/api/crm/follow-ups/images/${img.id}`, { method: "DELETE" })
                                .then((res) => {
                                  if (!res.ok) throw new Error("删除失败");
                                })
                                .catch(() => {
                                  setImagesByFollowUpId((prev) => ({
                                    ...prev,
                                    [followUp.id]: [...(prev[followUp.id] ?? []), img],
                                  }));
                                  setImageCountOverrides((prev) => ({
                                    ...prev,
                                    [followUp.id]: prevCount,
                                  }));
                                  showAlert("删除图片失败，已恢复", { type: "error", title: "错误" });
                                });
                            }
                          );
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* 更新信息 */}
            {followUp.updatedAt && followUp.updatedBy && (
              <div className="mt-2 border-t pt-2 text-xs text-gray-500">
                由 {followUp.updatedBy.name} 于{" "}
                {formatDateTime(followUp.updatedAt)}{" "}
                编辑
              </div>
            )}
          </div>
        ))}

        {/* 展开/收起按钮 */}
        {followUps.length > 1 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            {expanded
              ? "收起"
              : `展开查看全部 ${followUps.length} 条跟进记录`}
          </button>
        )}
      </div>
    </>
  );
}
