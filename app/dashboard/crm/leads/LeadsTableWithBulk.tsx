"use client";

import { useState } from "react";
import Link from "next/link";
import { LeadStatusSelect } from "./LeadStatusSelect";
import { LeadSalesPersonSelect } from "./LeadSalesPersonSelect";
import { DeleteLeadButton } from "./DeleteLeadButton";
import { LeadsBulkAssignBar } from "./LeadsBulkAssignBar";
import { Button } from "@/components/ui/button";
import { Plus, ExternalLink, Pencil } from "lucide-react";

type Lead = {
  id: string;
  customerName: string;
  nickname: string | null;
  city: string | null;
  industry: string | null;
  leadSource: string | null;
  createdAt: Date;
  status: string;
  salesPersonId: string | null;
  salesPerson: { id: string; name: string } | null;
  opportunity: { id: string; name: string } | null;
};

type User = { id: string; name: string };

export function LeadsTableWithBulk({
  leads,
  users,
  isAdmin,
}: {
  leads: Lead[];
  users: User[];
  isAdmin: boolean;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === leads.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(leads.map((l) => l.id)));
    }
  }

  const selectedArray = Array.from(selectedIds);

  return (
    <div className="space-y-3">
      {isAdmin && selectedArray.length > 0 && (
        <LeadsBulkAssignBar
          selectedIds={selectedArray}
          onClear={() => setSelectedIds(new Set())}
          users={users}
        />
      )}
      <div className="rounded-lg border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              {isAdmin && (
                <th className="w-10 px-2 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === leads.length && leads.length > 0}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-input"
                  />
                </th>
              )}
              <th className="px-4 py-3 font-medium">客户名称</th>
              <th className="px-4 py-3 font-medium">昵称</th>
              <th className="px-4 py-3 font-medium">城市</th>
              <th className="px-4 py-3 font-medium">行业</th>
              <th className="px-4 py-3 font-medium">线索来源</th>
              <th className="px-4 py-3 font-medium">创建日期</th>
              <th className="px-4 py-3 font-medium">销售人员</th>
              <th className="px-4 py-3 font-medium">状态</th>
              <th className="px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 ? (
              <tr>
                <td
                  colSpan={isAdmin ? 10 : 9}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  暂无数据，点击「新建线索」添加
                </td>
              </tr>
            ) : (
              leads.map((lead) => (
                <tr
                  key={lead.id}
                  className="border-b last:border-0 hover:bg-muted/30"
                >
                  {isAdmin && (
                    <td className="px-2 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(lead.id)}
                        onChange={() => toggleSelect(lead.id)}
                        className="h-4 w-4 rounded border-input"
                      />
                    </td>
                  )}
                  <td className="px-4 py-3">{lead.customerName}</td>
                  <td className="px-4 py-3">{lead.nickname ?? "-"}</td>
                  <td className="px-4 py-3">{lead.city ?? "-"}</td>
                  <td className="px-4 py-3">{lead.industry ?? "-"}</td>
                  <td className="px-4 py-3">{lead.leadSource ?? "-"}</td>
                  <td className="px-4 py-3">
                    {lead.createdAt.toLocaleDateString("zh-CN")}
                  </td>
                  <td className="px-4 py-3">
                    <LeadSalesPersonSelect
                      leadId={lead.id}
                      currentSalesPersonId={lead.salesPersonId}
                      users={users}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <LeadStatusSelect
                      leadId={lead.id}
                      currentStatus={lead.status}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {lead.status === "有意向" && !lead.opportunity && (
                        <Button asChild size="sm" variant="default" className="h-7 gap-1">
                          <Link
                            href={`/dashboard/crm/opportunities/new?leadId=${lead.id}`}
                            className="inline-flex items-center gap-1.5"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            新建商机
                          </Link>
                        </Button>
                      )}
                      {lead.opportunity && (
                        <Button asChild size="sm" variant="outline" className="h-7 gap-1">
                          <Link
                            href={`/dashboard/crm/opportunities?highlight=${lead.opportunity.id}`}
                            className="inline-flex items-center gap-1.5"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            查看商机
                          </Link>
                        </Button>
                      )}
                      {isAdmin && (
                        <>
                          <Button asChild size="sm" variant="ghost" className="h-7 gap-1">
                            <Link
                              href={`/dashboard/crm/leads/${lead.id}/edit`}
                              className="inline-flex items-center gap-1.5"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              编辑
                            </Link>
                          </Button>
                          {!lead.opportunity && (
                            <DeleteLeadButton
                              leadId={lead.id}
                              leadName={lead.customerName}
                            />
                          )}
                        </>
                      )}
                      {lead.status !== "有意向" &&
                        !lead.opportunity &&
                        !isAdmin && (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
