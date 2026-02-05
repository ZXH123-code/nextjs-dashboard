"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { batchUpdateLeadSalesPersonAction } from "@/app/lib/crm-actions";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Mail, Loader2 } from "lucide-react";

type User = { id: string; name: string };

export function LeadsBulkAssignBar({
  selectedIds,
  onClear,
  users,
}: {
  selectedIds: string[];
  onClear: () => void;
  users: User[];
}) {
  const router = useRouter();
  const [salesPersonId, setSalesPersonId] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleAssign() {
    if (!salesPersonId) {
      setError("请选择销售人员");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const result = await batchUpdateLeadSalesPersonAction(
        selectedIds,
        salesPersonId,
        sendEmail
      );
      if (result.error) {
        setError(result.error);
      } else {
        onClear();
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 rounded-lg border bg-muted/80 p-3 backdrop-blur">
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
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={sendEmail}
          onChange={(e) => setSendEmail(e.target.checked)}
          className="h-4 w-4 rounded border-input"
        />
        <Mail className="h-4 w-4 text-muted-foreground" />
        发送邮件通知
      </label>
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
  );
}
