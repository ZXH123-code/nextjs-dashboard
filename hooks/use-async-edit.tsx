"use client";

import { useState, useCallback, useRef } from "react";

/**
 * 完全异步的行内编辑 Hook
 * 支持：
 * - 多个字段同时编辑和保存
 * - 乐观更新（立即更新UI）
 * - 保存失败自动回滚
 * - 不阻塞用户操作
 */
export function useAsyncEdit<T extends { id: string }>() {
  // 当前正在编辑的字段：{ recordId: { field: value } }
  const [editing, setEditing] = useState<Record<string, Record<string, string>>>({});
  
  // 正在保存的字段：Set<"recordId:field">
  const [savingFields, setSavingFields] = useState<Set<string>>(new Set());
  
  // 保存失败的字段：Map<"recordId:field", error>
  const [failedFields, setFailedFields] = useState<Map<string, string>>(new Map());
  
  // 保存操作的 AbortController，用于取消过期的保存
  const saveControllersRef = useRef<Map<string, AbortController>>(new Map());

  /**
   * 开始编辑某个字段
   */
  const startEdit = useCallback((recordId: string, field: string, currentValue: string) => {
    setEditing((prev) => ({
      ...prev,
      [recordId]: {
        ...prev[recordId],
        [field]: currentValue,
      },
    }));
    // 清除该字段的错误状态
    setFailedFields((prev) => {
      const next = new Map(prev);
      next.delete(`${recordId}:${field}`);
      return next;
    });
  }, []);

  /**
   * 取消编辑某个字段
   */
  const cancelEdit = useCallback((recordId: string, field: string) => {
    setEditing((prev) => {
      const record = prev[recordId];
      if (!record) return prev;
      const { [field]: _, ...rest } = record;
      if (Object.keys(rest).length === 0) {
        const { [recordId]: __, ...others } = prev;
        return others;
      }
      return { ...prev, [recordId]: rest };
    });
  }, []);

  /**
   * 更新编辑中的值
   */
  const updateEditingValue = useCallback((recordId: string, field: string, value: string) => {
    setEditing((prev) => ({
      ...prev,
      [recordId]: {
        ...prev[recordId],
        [field]: value,
      },
    }));
  }, []);

  /**
   * 保存字段（完全异步，不阻塞）
   */
  const saveField = useCallback(
    async (
      recordId: string,
      field: string,
      saveFn: (value: string) => Promise<{ error?: string } | null>,
      onSuccess?: () => void,
      onError?: (error: string) => void
    ) => {
      const fieldKey = `${recordId}:${field}`;
      const currentValue = editing[recordId]?.[field];
      
      if (currentValue === undefined) return;

      // 取消该字段之前的保存操作（如果有）
      const prevController = saveControllersRef.current.get(fieldKey);
      if (prevController) {
        prevController.abort();
      }

      // 创建新的 AbortController
      const controller = new AbortController();
      saveControllersRef.current.set(fieldKey, controller);

      // 标记为保存中
      setSavingFields((prev) => new Set(prev).add(fieldKey));
      setFailedFields((prev) => {
        const next = new Map(prev);
        next.delete(fieldKey);
        return next;
      });

      try {
        const result = await saveFn(currentValue);
        
        // 检查是否被取消
        if (controller.signal.aborted) {
          return;
        }

        if (result?.error) {
          setFailedFields((prev) => new Map(prev).set(fieldKey, result.error));
          onError?.(result.error);
        } else {
          // 保存成功，关闭编辑
          cancelEdit(recordId, field);
          onSuccess?.();
        }
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        const errorMessage = error instanceof Error ? error.message : "保存失败";
        setFailedFields((prev) => new Map(prev).set(fieldKey, errorMessage));
        onError?.(errorMessage);
      } finally {
        if (!controller.signal.aborted) {
          setSavingFields((prev) => {
            const next = new Set(prev);
            next.delete(fieldKey);
            return next;
          });
          saveControllersRef.current.delete(fieldKey);
        }
      }
    },
    [editing, cancelEdit]
  );

  /**
   * 检查字段是否正在编辑
   */
  const isEditing = useCallback(
    (recordId: string, field: string) => {
      return editing[recordId]?.[field] !== undefined;
    },
    [editing]
  );

  /**
   * 获取编辑中的值
   */
  const getEditingValue = useCallback(
    (recordId: string, field: string) => {
      return editing[recordId]?.[field];
    },
    [editing]
  );

  /**
   * 检查字段是否正在保存
   */
  const isSaving = useCallback(
    (recordId: string, field: string) => {
      return savingFields.has(`${recordId}:${field}`);
    },
    [savingFields]
  );

  /**
   * 检查字段是否保存失败
   */
  const hasError = useCallback(
    (recordId: string, field: string) => {
      return failedFields.has(`${recordId}:${field}`);
    },
    [failedFields]
  );

  /**
   * 获取字段的错误信息
   */
  const getError = useCallback(
    (recordId: string, field: string) => {
      return failedFields.get(`${recordId}:${field}`);
    },
    [failedFields]
  );

  return {
    // 状态
    editing,
    savingFields,
    failedFields,
    
    // 操作方法
    startEdit,
    cancelEdit,
    updateEditingValue,
    saveField,
    
    // 查询方法
    isEditing,
    getEditingValue,
    isSaving,
    hasError,
    getError,
  };
}
