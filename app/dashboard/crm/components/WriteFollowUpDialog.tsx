"use client";

import { useState } from "react";
import { useAlert } from "@/hooks/use-alert";

interface WriteFollowUpDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: {
    content: string;
    contactPerson?: string;
    summary?: string;
    nextStep?: string;
    customerNeeds?: string;
  }) => void;
  recordType: "线索" | "商机" | "客户";
  recordName: string;
  isSubmitting?: boolean;
}

/**
 * 手动写跟进对话框组件
 * 用于销售人员主动添加跟进记录（不关联状态变更）
 */
export function WriteFollowUpDialog({
  isOpen,
  onClose,
  onConfirm,
  recordType,
  recordName,
  isSubmitting = false,
}: WriteFollowUpDialogProps) {
  const [formData, setFormData] = useState({
    content: "",
    contactPerson: "",
    summary: "",
    nextStep: "",
    customerNeeds: "",
  });
  const { showAlert, AlertComponent } = useAlert();

  const handleConfirm = () => {
    if (!formData.content.trim()) {
      showAlert("请填写跟进内容", { type: "warning", title: "提示" });
      return;
    }
    onConfirm(formData);
  };

  const handleCancel = () => {
    // 重置表单
    setFormData({
      content: "",
      contactPerson: "",
      summary: "",
      nextStep: "",
      customerNeeds: "",
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <AlertComponent />
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-xl font-semibold text-gray-900">
          写跟进 - {recordType}「{recordName}」
        </h2>

        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              跟进内容 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              rows={4}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="请输入本次跟进的详细内容..."
              disabled={isSubmitting}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                沟通对象
              </label>
              <input
                type="text"
                value={formData.contactPerson}
                onChange={(e) =>
                  setFormData({ ...formData, contactPerson: e.target.value })
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="例如：张经理"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                一句话进展
              </label>
              <input
                type="text"
                value={formData.summary}
                onChange={(e) =>
                  setFormData({ ...formData, summary: e.target.value })
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="例如：客户表示有兴趣"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              下一步计划
            </label>
            <textarea
              value={formData.nextStep}
              onChange={(e) =>
                setFormData({ ...formData, nextStep: e.target.value })
              }
              rows={2}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="例如：下周一发送产品方案"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              客户需求
            </label>
            <textarea
              value={formData.customerNeeds}
              onChange={(e) =>
                setFormData({ ...formData, customerNeeds: e.target.value })
              }
              rows={2}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="例如：需要支持自定义配置"
              disabled={isSubmitting}
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isSubmitting}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? "提交中..." : "确认添加"}
          </button>
        </div>
      </div>
    </div>
    </>
  );
}
