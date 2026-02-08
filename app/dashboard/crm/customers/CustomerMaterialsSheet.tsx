"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Upload, FileText, Trash2, Download } from "lucide-react";
import { cn } from "@/lib/utils";

const shimmer =
  "before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/60 before:to-transparent";

/** 资料列表加载骨架 */
function MaterialsListSkeleton() {
  return (
    <ul className="flex-1 overflow-y-auto space-y-1 rounded-md border bg-muted/20 sheet-scroll">
      {[1, 2, 3, 4].map((i) => (
        <li
          key={i}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 border-b last:border-b-0",
            "relative overflow-hidden",
            shimmer
          )}
        >
          <div className="h-5 w-5 shrink-0 rounded bg-muted" />
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="h-4 w-3/4 max-w-[200px] rounded bg-muted" />
            <div className="h-3 w-1/2 max-w-[140px] rounded bg-muted/80" />
          </div>
          <div className="h-8 w-16 shrink-0 rounded bg-muted/80" />
        </li>
      ))}
    </ul>
  );
}

/** 客户资料项（与 API 返回一致，uploadedAt 可为 ISO 字符串或 Date） */
export type CustomerMaterialItem = {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType?: string;
  blobUrl?: string;
  uploadedAt: Date | string;
  uploadedByName?: string;
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType?: string) {
  if (!mimeType) return <FileText className="h-5 w-5 text-muted-foreground shrink-0" />;
  if (mimeType.startsWith("image/")) return <FileText className="h-5 w-5 text-blue-500 shrink-0" />;
  if (mimeType.includes("pdf")) return <FileText className="h-5 w-5 text-red-500 shrink-0" />;
  return <FileText className="h-5 w-5 text-muted-foreground shrink-0" />;
}

function parseUploadedAt(at: Date | string): Date {
  return typeof at === "string" ? new Date(at) : at;
}

interface CustomerMaterialsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  customerName: string;
}

/**
 * 客户资料抽屉：上传到 Vercel Blob + 资料列表
 * 上传用 XMLHttpRequest 而非 fetch：fetch 不暴露上传进度，XHR 的 xhr.upload.onprogress 可拿到已发送字节，用于进度条。
 */
export function CustomerMaterialsSheet({
  open,
  onOpenChange,
  customerId,
  customerName,
}: CustomerMaterialsSheetProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadCurrent, setUploadCurrent] = useState(0);
  const [uploadTotal, setUploadTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [items, setItems] = useState<CustomerMaterialItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  /** 带水印下载生成中，显示「请稍候」提示 */
  const [preparingWatermark, setPreparingWatermark] = useState<{ fileName: string } | null>(null);
  /** 句末省略号点数 1→2→3→1 循环 */
  const [waitingDots, setWaitingDots] = useState(1);

  useEffect(() => {
    if (!preparingWatermark) return;
    const t = setInterval(() => {
      setWaitingDots((d) => (d >= 3 ? 1 : d + 1));
    }, 400);
    return () => clearInterval(t);
  }, [preparingWatermark]);

  const fetchList = useCallback(async () => {
    if (!customerId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/crm/customers/${customerId}/materials`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "加载失败");
      }
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载客户资料失败");
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    if (open && customerId) fetchList();
    if (!open) setItems([]);
  }, [open, customerId, fetchList]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const uploadFile = useCallback(
    (file: File, onProgress?: (percent: number) => void): Promise<CustomerMaterialItem> => {
      return new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append("file", file);
        const xhr = new XMLHttpRequest();
        const url = `/api/crm/customers/${customerId}/materials/upload`;

        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable && e.total > 0) {
            const percent = Math.round((e.loaded / e.total) * 100);
            onProgress?.(percent);
          }
        });
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText) as CustomerMaterialItem;
              resolve(data);
            } catch {
              reject(new Error("解析响应失败"));
            }
          } else {
            try {
              const data = JSON.parse(xhr.responseText) as { error?: string };
              reject(new Error(data.error || "上传失败"));
            } catch {
              reject(new Error(`上传失败 (${xhr.status})`));
            }
          }
        });
        xhr.addEventListener("error", () => reject(new Error("网络错误")));
        xhr.addEventListener("abort", () => reject(new Error("已取消")));

        xhr.open("POST", url);
        xhr.send(formData);
      });
    },
    [customerId]
  );

  /** 多文件顺序上传，总进度 = (已完成数 + 当前文件进度) / 总文件数 */
  const uploadFiles = useCallback(
    async (
      fileList: File[],
      onOverallProgress: (percent: number, currentIndex: number, total: number) => void
    ): Promise<CustomerMaterialItem[]> => {
      const total = fileList.length;
      const results: CustomerMaterialItem[] = [];
      for (let i = 0; i < total; i++) {
        const item = await uploadFile(fileList[i], (p) => {
          const overall = Math.round(((i * 100 + p) / (total * 100)) * 100);
          onOverallProgress(overall, i + 1, total);
        });
        results.push(item);
      }
      return results;
    },
    [uploadFile]
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const fileList = e.dataTransfer?.files;
      if (!fileList?.length) return;
      const files = Array.from(fileList);
      setIsUploading(true);
      setUploadProgress(0);
      setUploadTotal(files.length);
      setUploadCurrent(0);
      setError(null);
      try {
        const newItems = await uploadFiles(files, (percent, current, total) => {
          setUploadProgress(percent);
          setUploadCurrent(current);
          setUploadTotal(total);
        });
        setItems((prev) => [...newItems, ...prev]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "上传失败");
      } finally {
        setIsUploading(false);
        setUploadProgress(0);
        setUploadCurrent(0);
        setUploadTotal(0);
      }
    },
    [uploadFiles]
  );

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const fileList = e.target.files;
      if (!fileList?.length) return;
      const files = Array.from(fileList);
      setIsUploading(true);
      setUploadProgress(0);
      setUploadTotal(files.length);
      setUploadCurrent(0);
      setError(null);
      try {
        const newItems = await uploadFiles(files, (percent, current, total) => {
          setUploadProgress(percent);
          setUploadCurrent(current);
          setUploadTotal(total);
        });
        setItems((prev) => [...newItems, ...prev]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "上传失败");
      } finally {
        setIsUploading(false);
        setUploadProgress(0);
        setUploadCurrent(0);
        setUploadTotal(0);
      }
      e.target.value = "";
    },
    [uploadFiles]
  );

  const handleRemove = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/crm/customers/materials/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "删除失败");
      }
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "删除失败");
    }
  }, []);

  const handleDownload = useCallback((item: CustomerMaterialItem) => {
    const url = item.blobUrl;
    if (!url) return;
    const downloadUrl = url.includes("?") ? `${url}&download=1` : `${url}?download=1`;
    window.open(downloadUrl, "_blank", "noopener,noreferrer");
  }, []);

  const handleWatermarkDownload = useCallback(
    async (item: CustomerMaterialItem) => {
      setError(null);
      setPreparingWatermark({ fileName: item.fileName });
      try {
        const res = await fetch(`/api/crm/customers/materials/${item.id}/download?watermark=1`);
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(text || "生成带水印文件失败");
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = item.fileName;
        a.click();
        URL.revokeObjectURL(url);
      } catch (e) {
        setError(e instanceof Error ? e.message : "带水印下载失败");
      } finally {
        setPreparingWatermark(null);
      }
    },
    []
  );

  const supportsWatermark = (mimeType?: string) =>
    !!mimeType && (mimeType.startsWith("image/") || mimeType.includes("pdf"));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex flex-col overflow-hidden w-full max-w-lg sm:max-w-lg"
      >
        <SheetHeader className="shrink-0 border-b pb-3 text-left">
          <SheetTitle>客户资料 · {customerName}</SheetTitle>
        </SheetHeader>

        <div className="flex-1 flex flex-col min-h-0 mt-4 gap-4 overflow-hidden">
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
              {error}
            </div>
          )}
          {preparingWatermark && (
            <div className="rounded-md border bg-primary/5 px-3 py-2.5 text-sm text-foreground">
              正在生成带水印文件「{preparingWatermark.fileName}」，请稍候{".".repeat(waitingDots)}
            </div>
          )}
          {/* 上传区 */}
          <label
            className={cn(
              "flex flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors cursor-pointer min-h-[120px] px-4 py-6",
              isDragging
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30",
              (isUploading || isLoading) && "pointer-events-none opacity-70"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              type="file"
              className="sr-only"
              multiple
              onChange={handleFileSelect}
              disabled={isUploading}
            />
            {isUploading ? (
              <div className="flex flex-col items-center gap-2.5 w-full max-w-[280px]">
                <span className="text-sm text-muted-foreground text-center">
                  {uploadTotal > 1
                    ? `上传中… 第 ${uploadCurrent}/${uploadTotal} 个${uploadProgress > 0 ? ` · ${uploadProgress}%` : ""}`
                    : uploadProgress > 0
                      ? `上传中… ${uploadProgress}%`
                      : "上传中…"}
                </span>
                <Progress value={uploadProgress} max={100} className="w-full" />
              </div>
            ) : (
              <>
                <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                <span className="text-sm text-muted-foreground text-center">
                  点击或拖拽文件到此处上传
                </span>
                <span className="text-xs text-muted-foreground/80 mt-1">
                  支持多选，PDF、图片、Word 等，单文件建议 10MB 以内（Vercel Blob）
                </span>
              </>
            )}
          </label>

          {/* 资料列表 */}
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="text-sm font-medium text-foreground mb-2">已上传资料</div>
            {isLoading ? (
              <MaterialsListSkeleton />
            ) : (
            <ul className="flex-1 overflow-y-auto space-y-1 rounded-md border bg-muted/20 sheet-scroll">
              {items.length === 0 ? (
                <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                  暂无资料，请在上方上传
                </li>
              ) : (
                items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 px-3 py-2.5 border-b last:border-b-0 hover:bg-muted/40 transition-colors"
                  >
                    {getFileIcon(item.mimeType)}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{item.fileName}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatFileSize(item.fileSize)}
                        {" · "}
                        {parseUploadedAt(item.uploadedAt).toLocaleString("zh-CN")}
                        {item.uploadedByName && ` · ${item.uploadedByName}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="下载（可选带水印）"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleDownload(item)}>
                            直接下载
                          </DropdownMenuItem>
                          {supportsWatermark(item.mimeType) && (
                            <DropdownMenuItem
                              onClick={() => handleWatermarkDownload(item)}
                              disabled={!!preparingWatermark}
                            >
                              带水印下载
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleRemove(item.id)}
                        title="删除"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))
              )}
            </ul>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
