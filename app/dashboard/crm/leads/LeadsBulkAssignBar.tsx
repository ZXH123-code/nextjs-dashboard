"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { batchUpdateLeadSalesPersonWithFollowUpAction } from "@/app/lib/crm-actions";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Mail } from "lucide-react";

type User = { id: string; name: string };

export function LeadsBulkAssignBar({
  selectedIds,
  onClear,
  users,
  onAssignSuccess,
}: {
  selectedIds: string[];
  onClear: () => void;
  users: User[];
  onAssignSuccess?: (
    salesPersonMap: Record<string, { name: string; email: string; leadIds: string[]; leadNames: string[] }>,
    newSalesPersonId: string
  ) => void;
}) {
  const router = useRouter();
  const [salesPersonId, setSalesPersonId] = useState("");
  const [followUpContent, setFollowUpContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleAssign() {
    if (!salesPersonId) {
      setError("请选择销售人员");
      return;
    }
    if (!followUpContent.trim()) {
      setError("请填写跟进说明");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const result = await batchUpdateLeadSalesPersonWithFollowUpAction(
        selectedIds,
        salesPersonId,
        followUpContent
      );
      if (result.error) {
        setError(result.error);
      } else if (result.salesPersonMap) {
        router.refresh();
        setSalesPersonId("");
        setFollowUpContent("");
        onAssignSuccess?.(result.salesPersonMap, salesPersonId);
        onClear();
      }
    } finally {
      setLoading(false);
    }
  }

  // 自动生成默认跟进说明
  const selectedSalesPerson = users.find((u) => u.id === salesPersonId);
  if (salesPersonId && !followUpContent && selectedSalesPerson) {
    setFollowUpContent(`批量线索已分配给 ${selectedSalesPerson.name}`);
  }

  return (
    <div className="sticky top-0 z-10 space-y-2 rounded-lg border bg-muted/80 p-3 backdrop-blur">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium">已选 {selectedIds.length} 条线索</span>
          <Select value={salesPersonId} onValueChange={setSalesPersonId}>
            <SelectTrigger className="h-8 w-[160px]">
              <SelectValue placeholder="选择销售人员" />
            </SelectTrigger>
            <SelectContent>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <textarea
            value={followUpContent}
            onChange={(e) => setFollowUpContent(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="请输入首次跟进说明（必填）..."
          />
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleAssign} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "批量指定"
            )}
          </Button>
          <Button size="sm" variant="ghost" onClick={onClear}>
            取消
          </Button>
          {error && <span className="text-sm text-destructive">{error}</span>}
        </div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Mail className="h-3.5 w-3.5" />
        指定成功后会弹出「发送邮件通知」窗口，可选择通知对象
      </p>
    </div>
  );
}
