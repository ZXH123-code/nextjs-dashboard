"use client";

import { useState, useEffect } from "react";
import { useAlert } from "@/hooks/use-alert";

interface StatusChangeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (content: string) => void;
  title: string;
  defaultContent: string; // 默认的状态变更文本
  isSubmitting?: boolean;
}

/**
 * 状态变更对话框组件
 * 用于线索/商机/客户状态变更时，要求填写跟进补充说明
 */
export function StatusChangeDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  defaultContent,
  isSubmitting = false,
}: StatusChangeDialogProps) {
  const [content, setContent] = useState(defaultContent);
  const { showAlert, AlertComponent } = useAlert();

  // 当 defaultContent 变化时，更新 content（处理不同状态变更）
  useEffect(() => {
    if (isOpen) {
      setContent(defaultContent);
    }
  }, [defaultContent, isOpen]);

  const handleConfirm = () => {
    if (!content.trim()) {
      showAlert("请填写跟进补充说明", { type: "warning", title: "提示" });
      return;
    }
    onConfirm(content);
  };

  const handleCancel = () => {
    setContent(defaultContent); // 重置为默认内容
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <AlertComponent />
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-xl font-semibold text-gray-900">{title}</h2>

        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            跟进补充说明
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="请输入跟进补充说明..."
            disabled={isSubmitting}
          />
          <p className="mt-1 text-xs text-gray-500">
            提示：可以保留默认的状态变更记录，也可以追加更多详细说明
          </p>
        </div>

        <div className="flex justify-end gap-3">
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
            {isSubmitting ? "提交中..." : "确认"}
          </button>
        </div>
      </div>
    </div>
    </>
  );
}
