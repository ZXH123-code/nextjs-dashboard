"use client";

import { useState } from "react";
import { restoreLeadAction, deleteLeadAction, cleanupOldDeletedLeadsAction } from "@/app/lib/crm-actions";
import { Button } from "@/components/ui/button";
import { Trash2, RotateCcw, AlertTriangle, Sparkles } from "lucide-react";
import { useAlert } from "@/hooks/use-alert";
import { useConfirm } from "@/hooks/use-confirm";
import { useRouter } from "next/navigation";

type DeletedLead = {
  id: string;
  customerName: string;
  city: string | null;
  status: string;
  deletedAt: Date | null;
  assignees: { userId: string; user: { id: string; name: string } }[];
  opportunity: { id: string; name: string; status: string } | null;
};

export function RecycleBinSection({ deletedLeads }: { deletedLeads: DeletedLead[] }) {
  const router = useRouter();
  const [processing, setProcessing] = useState<string | null>(null);
  const [cleaning, setCleaning] = useState(false);
  const { showAlert, AlertComponent } = useAlert();
  const { showConfirm, ConfirmComponent } = useConfirm();

  const doRestore = async (leadId: string, leadName: string) => {
    setProcessing(leadId);
    try {
      const formData = new FormData();
      formData.append("leadId", leadId);
      const result = await restoreLeadAction(formData);

      if (result?.error) {
        showAlert(result.error, { type: "error", title: "恢复失败" });
      } else {
        showAlert("线索已恢复", { type: "success", title: "恢复成功" });
        router.refresh();
      }
    } catch (error) {
      showAlert("恢复失败，请稍后重试", { type: "error", title: "恢复失败" });
    } finally {
      setProcessing(null);
    }
  };

  const handleRestore = (leadId: string, leadName: string) => {
    showConfirm(
      {
        title: "恢复线索",
        description: `确定要恢复线索「${leadName}」吗？`,
        confirmText: "确定恢复",
      },
      () => doRestore(leadId, leadName)
    );
  };

  const doPermanentDelete = async (leadId: string) => {
    setProcessing(leadId);
    try {
      const formData = new FormData();
      formData.append("leadId", leadId);
      await deleteLeadAction(formData);

      showAlert("线索已彻底删除", { type: "success", title: "删除成功" });
      router.refresh();
    } catch (error) {
      showAlert("删除失败，请稍后重试", { type: "error", title: "删除失败" });
    } finally {
      setProcessing(null);
    }
  };

  const handlePermanentDelete = (leadId: string, leadName: string, hasOpportunity: boolean) => {
    const description = hasOpportunity
      ? `确定要彻底删除线索「${leadName}」吗？\n\n该线索已转为商机，彻底删除后商机和客户也会被删除，且此操作不可恢复！`
      : `确定要彻底删除线索「${leadName}」吗？\n\n此操作不可恢复！`;

    showConfirm(
      {
        title: "彻底删除",
        description,
        confirmText: "彻底删除",
        variant: "destructive",
      },
      () => doPermanentDelete(leadId)
    );
  };

  const doCleanup = async (days: number) => {
    setCleaning(true);
    try {
      const result = await cleanupOldDeletedLeadsAction(days);

      if ("error" in result) {
        showAlert(result.error, { type: "error", title: "清理失败" });
      } else {
        showAlert(result.message || "清理完成", {
          type: "success",
          title: "清理成功"
        });
        if (result.count > 0) {
          router.refresh();
        }
      }
    } catch (error) {
      showAlert("清理失败，请稍后重试", { type: "error", title: "清理失败" });
    } finally {
      setCleaning(false);
    }
  };

  const handleCleanup = (days: number) => {
    showConfirm(
      {
        title: "清理已删除记录",
        description: `确定要清理超过 ${days} 天的已删除记录吗？\n\n此操作不可恢复！`,
        confirmText: "确定清理",
        variant: "destructive",
      },
      () => doCleanup(days)
    );
  };

  const getDaysAgo = (date: Date | null) => {
    if (!date) return "";
    const now = new Date();
    const diff = Math.floor((now.getTime() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0) return "今天";
    if (diff === 1) return "昨天";
    return `${diff} 天前`;
  };

  return (
    <>
      <AlertComponent />
      <ConfirmComponent />
      <div className="rounded-lg border bg-card overflow-hidden">
        {deletedLeads.length === 0 ? (
          <div className="px-6 py-16 text-center text-muted-foreground">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <Trash2 className="h-7 w-7 opacity-50" />
            </div>
            <p className="font-medium text-foreground">回收站为空</p>
            <p className="mt-1 text-sm">已删除的线索将出现在此处，可恢复或彻底删除</p>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-4 border-b bg-muted/30 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                共 <span className="font-medium text-foreground">{deletedLeads.length}</span> 条已删除线索
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCleanup(90)}
                disabled={cleaning}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {cleaning ? "清理中..." : "清理 90 天前的记录"}
              </Button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-6 py-3 text-left font-medium">客户名称</th>
                  <th className="px-6 py-3 text-left font-medium">城市</th>
                  <th className="px-6 py-3 text-left font-medium">状态</th>
                  <th className="px-6 py-3 text-left font-medium">负责人</th>
                  <th className="px-6 py-3 text-left font-medium">删除时间</th>
                  <th className="px-6 py-3 text-left font-medium">关联状态</th>
                  <th className="px-6 py-3 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {deletedLeads.map((lead) => (
                  <tr key={lead.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-6 py-3 font-medium">{lead.customerName}</td>
                    <td className="px-6 py-3 text-muted-foreground">{lead.city || "-"}</td>
                    <td className="px-6 py-3">
                      <span className="inline-flex px-2 py-0.5 rounded text-xs bg-muted text-muted-foreground">
                        {lead.status}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-muted-foreground">
                      {lead.assignees?.length
                        ? lead.assignees.map((a) => a.user?.name ?? "").filter(Boolean).join(", ")
                        : "未分配"}
                    </td>
                    <td className="px-6 py-3 text-muted-foreground text-xs">
                      {lead.deletedAt ? (
                        <>
                          {new Date(lead.deletedAt).toLocaleDateString("zh-CN")}
                          <span className="ml-2 text-amber-600">
                            ({getDaysAgo(lead.deletedAt)})
                          </span>
                        </>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-6 py-3">
                      {lead.opportunity ? (
                        <span className="text-xs text-amber-600">已转商机</span>
                      ) : (
                        <span className="text-muted-foreground text-xs">未转化</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1.5 text-primary hover:bg-primary/10 hover:text-primary"
                          onClick={() => handleRestore(lead.id, lead.customerName)}
                          disabled={processing === lead.id}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          恢复
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() =>
                            handlePermanentDelete(lead.id, lead.customerName, !!lead.opportunity)
                          }
                          disabled={processing === lead.id}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          彻底删除
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t bg-muted/20 px-6 py-4">
              <div className="flex items-start gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="text-muted-foreground">
                  <p className="font-medium text-foreground">说明</p>
                  <ul className="mt-1.5 space-y-1 text-xs">
                    <li>· <strong>恢复</strong>：将线索恢复到线索列表，关联的商机、客户不变</li>
                    <li>· <strong>彻底删除</strong>：永久删除线索及关联商机、客户（不可恢复）</li>
                  </ul>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
