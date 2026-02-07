"use client";

import { useState } from "react";
import { restoreLeadAction, deleteLeadAction, cleanupOldDeletedLeadsAction } from "@/app/lib/crm-actions";
import { Button } from "@/components/ui/button";
import { Trash2, RotateCcw, AlertTriangle, Sparkles } from "lucide-react";
import { useAlert } from "@/hooks/use-alert";
import { useConfirm } from "@/hooks/use-confirm";

type DeletedLead = {
  id: string;
  customerName: string;
  city: string | null;
  status: string;
  deletedAt: Date | null;
  salesPerson: { id: string; name: string } | null;
  opportunity: { id: string; name: string; status: string } | null;
};

export function RecycleBinSection({ deletedLeads }: { deletedLeads: DeletedLead[] }) {
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
        window.location.reload();
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
      window.location.reload();
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
          window.location.reload();
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
      <div className="mt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
              <Trash2 className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">线索回收站</h2>
              <p className="text-sm text-muted-foreground">
                已删除的线索可在此恢复或彻底删除
              </p>
            </div>
          </div>
          {deletedLeads.length > 0 && (
            <div className="flex items-center gap-2">
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
          )}
        </div>

        <div className="rounded-lg border bg-card overflow-hidden">
          {deletedLeads.length === 0 ? (
            <div className="px-6 py-12 text-center text-muted-foreground">
              <Trash2 className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>回收站为空</p>
              <p className="text-xs mt-1">已删除的线索将出现在此处</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-6 py-4 text-left font-medium">客户名称</th>
                  <th className="px-6 py-4 text-left font-medium">城市</th>
                  <th className="px-6 py-4 text-left font-medium">状态</th>
                  <th className="px-6 py-4 text-left font-medium">销售人员</th>
                  <th className="px-6 py-4 text-left font-medium">删除时间</th>
                  <th className="px-6 py-4 text-left font-medium">关联状态</th>
                  <th className="px-6 py-4 text-left font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {deletedLeads.map((lead) => (
                  <tr key={lead.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-6 py-4 font-medium">{lead.customerName}</td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {lead.city || "-"}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex px-2 py-0.5 rounded text-xs bg-muted text-muted-foreground">
                        {lead.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {lead.salesPerson?.name || "未分配"}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground text-xs">
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
                    <td className="px-6 py-4">
                      {lead.opportunity ? (
                        <div className="flex items-center gap-1 text-xs">
                          <span className="text-amber-600">已转商机</span>
                          <span className="text-muted-foreground">
                            ({lead.opportunity.status})
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">未转化</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                          onClick={() => handleRestore(lead.id, lead.customerName)}
                          disabled={processing === lead.id}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          恢复
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
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
          )}
        </div>

        {deletedLeads.length > 0 && (
          <div className="mt-4 rounded-lg border bg-amber-500/10 border-amber-500/20 p-4 text-sm">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-amber-700 dark:text-amber-400">
                <p className="font-medium">删除说明</p>
                <ul className="mt-2 space-y-1 text-xs">
                  <li>• <strong>恢复</strong>：将线索恢复到线索列表，关联的商机和客户保持不变</li>
                  <li>• <strong>彻底删除</strong>：永久删除线索及其关联的商机、客户、跟进记录（不可恢复）</li>
                  <li>• <strong>自动清理</strong>：超过 90 天的已删除记录会被定期清理</li>
                  <li className="text-amber-600">• 已转为商机的线索被彻底删除后，商机和客户也会被删除，请谨慎操作</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
