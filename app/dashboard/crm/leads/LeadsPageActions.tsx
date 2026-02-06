"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createEmptyLeadAction, getPendingNotificationSummaryAction } from "@/app/lib/crm-actions";
import { useState, useEffect } from "react";
import { Mail } from "lucide-react";
import { PendingNotificationDialog } from "./PendingNotificationDialog";
import { PermissionDeniedDialog } from "../components/PermissionDeniedDialog";

export function LeadsPageActions({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [showNotificationDialog, setShowNotificationDialog] = useState(false);
  const [permissionDialog, setPermissionDialog] = useState<{
    open: boolean;
    title?: string;
    description?: string;
  }>({ open: false });

  // 加载待通知数量
  useEffect(() => {
    loadPendingCount();
  }, []);

  const loadPendingCount = async () => {
    try {
      const data = await getPendingNotificationSummaryAction();
      setPendingCount(data.salesPersons.length);
    } catch (error) {
      console.error("获取待通知数量失败:", error);
    }
  };

  const handleNewLead = async () => {
    if (!isAdmin) {
      setPermissionDialog({
        open: true,
        title: "暂无操作权限",
        description: "仅管理员可新建线索。如需添加线索，请联系管理员。",
      });
      return;
    }
    setCreating(true);
    try {
      const result = await createEmptyLeadAction();
      if (result?.error) {
        setPermissionDialog({
          open: true,
          title: "创建失败",
          description: result.error,
        });
      } else {
        router.refresh();
      }
    } finally {
      setCreating(false);
    }
  };

  const handleNotificationDialogClose = (open: boolean) => {
    setShowNotificationDialog(open);
    if (!open) {
      // 关闭后重新加载待通知数量
      loadPendingCount();
      router.refresh();
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        {/* 邮件通知按钮：仅 admin 可打开 */}
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            isAdmin
              ? setShowNotificationDialog(true)
              : setPermissionDialog({
                  open: true,
                  title: "暂无操作权限",
                  description: "仅管理员可发送邮件通知。如需使用，请联系管理员。",
                })
          }
          className="gap-1.5"
        >
          <Mail className="h-4 w-4" />
          邮件通知
          {isAdmin && pendingCount > 0 && (
            <span className="ml-1 rounded-full bg-red-500 px-1.5 py-0.5 text-xs text-white">
              {pendingCount}
            </span>
          )}
        </Button>

        <Button size="sm" onClick={() => void handleNewLead()} disabled={creating}>
          {creating ? "创建中…" : "新建线索"}
        </Button>
        {isAdmin ? (
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/crm/leads/import">批量导入</Link>
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setPermissionDialog({
                open: true,
                title: "暂无操作权限",
                description: "仅管理员可批量导入线索。如需使用，请联系管理员。",
              })
            }
          >
            批量导入
          </Button>
        )}
      </div>

      <PendingNotificationDialog
        open={showNotificationDialog}
        onOpenChange={handleNotificationDialogClose}
      />

      <PermissionDeniedDialog
        open={permissionDialog.open}
        onOpenChange={(open) => setPermissionDialog((p) => ({ ...p, open }))}
        title={permissionDialog.title}
        description={permissionDialog.description}
      />
    </>
  );
}
