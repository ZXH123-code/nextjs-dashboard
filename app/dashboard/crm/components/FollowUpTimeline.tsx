"use client";

import { useEffect, useState } from "react";
import { useAlert } from "@/hooks/use-alert";

interface FollowUp {
  id: string;
  content: string;
  createdAt: string;
  updatedAt?: string | null;
  isSystemGenerated: boolean;
  followUpBy: { id: string; name: string };
  updatedBy?: { id: string; name: string } | null;
  contactPerson?: string | null;
  summary?: string | null;
  nextStep?: string | null;
  customerNeeds?: string | null;
}

interface FollowUpTimelineProps {
  leadId?: string;
  opportunityId?: string;
  customerId?: string;
  currentUserRole?: string; // 用于判断是否显示编辑/删除按钮
  /** 父组件提交新跟进后递增，用于触发重新拉取并展示全部记录 */
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
  refreshKey = 0,
}: FollowUpTimelineProps) {
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const { showAlert, AlertComponent } = useAlert();

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

  if (loading) {
    return (
      <div className="py-4 text-center text-sm text-gray-500">
        加载中...
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
      <div className="space-y-3">
      {displayFollowUps.map((followUp, index) => (
        <div
          key={followUp.id}
          className={`rounded-lg border p-3 ${
            followUp.isSystemGenerated
              ? "border-blue-200 bg-blue-50"
              : "border-gray-200 bg-white"
          }`}
        >
          {/* 头部：跟进人和时间 */}
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900">
                {followUp.followUpBy.name}
              </span>
              {followUp.isSystemGenerated && (
                <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                  状态变更
                </span>
              )}
            </div>
            <span className="text-xs text-gray-500">
              {formatDateTime(followUp.createdAt)}
            </span>
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

          {/* 更新信息 */}
          {followUp.updatedAt && followUp.updatedBy && (
            <div className="mt-2 border-t pt-2 text-xs text-gray-500">
              由 {followUp.updatedBy.name} 于{" "}
              {formatDateTime(followUp.updatedAt)}{" "}
              编辑
            </div>
          )}

          {/* 管理员操作按钮 */}
          {currentUserRole === "admin" && (
            <div className="mt-2 flex gap-2 border-t pt-2">
              <button
                className="text-xs text-blue-600 hover:text-blue-800"
                onClick={() => {
                  // TODO: 实现编辑功能
                  showAlert("编辑功能待实现", { type: "info", title: "提示" });
                }}
              >
                编辑
              </button>
              <button
                className="text-xs text-red-600 hover:text-red-800"
                onClick={async () => {
                  // TODO: 实现删除功能
                  showAlert("删除功能待实现", { type: "info", title: "提示" });
                }}
              >
                删除
              </button>
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
