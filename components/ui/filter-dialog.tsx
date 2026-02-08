"use client";

import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Filter,
  Plus,
  Trash2,
  GripVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type FilterField = {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "select" | "multiSelect" | "boolean";
  options?: { value: string; label: string }[];
};

export type FilterCondition = {
  id: string;
  field: string;
  operator: string;
  value: string | string[];
};

// 条件组：组内是"且"关系
export type FilterGroup = {
  id: string;
  conditions: FilterCondition[];
};

type FilterDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fields: FilterField[];
  conditions: FilterCondition[]; // 兼容旧版单组
  groups?: FilterGroup[]; // 新版多组（支持"或"逻辑）
  onApply: (conditions: FilterCondition[], groups?: FilterGroup[]) => void;
  onClear: () => void;
};

const OPERATORS: Record<string, { label: string; types: string[] }> = {
  equals: { label: "等于", types: ["text", "number", "date", "select", "boolean"] },
  notEquals: { label: "不等于", types: ["text", "number", "date", "select", "boolean"] },
  contains: { label: "包含", types: ["text"] },
  notContains: { label: "不包含", types: ["text"] },
  startsWith: { label: "开头是", types: ["text"] },
  endsWith: { label: "结尾是", types: ["text"] },
  greaterThan: { label: "大于", types: ["number", "date"] },
  greaterThanOrEqual: { label: "大于等于", types: ["number", "date"] },
  lessThan: { label: "小于", types: ["number", "date"] },
  lessThanOrEqual: { label: "小于等于", types: ["number", "date"] },
  isEmpty: { label: "为空", types: ["text", "number", "date", "select"] },
  isNotEmpty: { label: "不为空", types: ["text", "number", "date", "select"] },
  in: { label: "属于", types: ["select", "multiSelect"] },
  notIn: { label: "不属于", types: ["select", "multiSelect"] },
};

export function FilterDialog({
  open,
  onOpenChange,
  fields,
  conditions: initialConditions = [],
  groups: initialGroups,
  onApply,
  onClear,
}: FilterDialogProps) {
  // 使用组模式：如果传入了 groups 则用组，否则将旧版 conditions 转换为单组
  const [groups, setGroups] = useState<FilterGroup[]>(() => {
    if (initialGroups && initialGroups.length > 0) {
      return initialGroups;
    }
    if (initialConditions.length > 0) {
      return [{ id: Date.now().toString(), conditions: initialConditions }];
    }
    return [{ id: Date.now().toString(), conditions: [] }];
  });

  // 拖动：弹窗位置（null 表示使用默认居中）
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ startX: 0, startY: 0, startLeft: 0, startTop: 0 });

  // 打开时取当前弹窗位置，关闭时重置
  useEffect(() => {
    if (open) {
      const id = setTimeout(() => {
        if (contentRef.current) {
          const rect = contentRef.current.getBoundingClientRect();
          setPosition({ x: rect.left, y: rect.top });
        }
      }, 0);
      return () => clearTimeout(id);
    } else {
      setPosition(null);
    }
  }, [open]);

  // 全局监听拖动
  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      setPosition({
        x: dragStartRef.current.startLeft + e.clientX - dragStartRef.current.startX,
        y: dragStartRef.current.startTop + e.clientY - dragStartRef.current.startY,
      });
    };
    const onUp = () => setIsDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isDragging]);

  const handleDragStart = (e: React.MouseEvent) => {
    if (e.button !== 0 || !position) return;
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startLeft: position.x,
      startTop: position.y,
    };
  };

  const addGroup = () => {
    const newGroup: FilterGroup = {
      id: Date.now().toString(),
      conditions: [],
    };
    setGroups([...groups, newGroup]);
  };

  const removeGroup = (groupId: string) => {
    if (groups.length === 1) {
      // 至少保留一组，清空条件即可
      setGroups([{ id: Date.now().toString(), conditions: [] }]);
    } else {
      setGroups(groups.filter((g) => g.id !== groupId));
    }
  };

  const addConditionToGroup = (groupId: string) => {
    const newCondition: FilterCondition = {
      id: Date.now().toString(),
      field: fields[0]?.key || "",
      operator: "equals",
      value: "",
    };
    setGroups(
      groups.map((g) =>
        g.id === groupId ? { ...g, conditions: [...g.conditions, newCondition] } : g
      )
    );
  };

  const removeConditionFromGroup = (groupId: string, conditionId: string) => {
    setGroups(
      groups.map((g) =>
        g.id === groupId
          ? { ...g, conditions: g.conditions.filter((c) => c.id !== conditionId) }
          : g
      )
    );
  };

  const updateConditionInGroup = (
    groupId: string,
    conditionId: string,
    updates: Partial<FilterCondition>
  ) => {
    setGroups(
      groups.map((g) => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          conditions: g.conditions.map((c) => {
            if (c.id !== conditionId) return c;
            const updated = { ...c, ...updates };
            // 如果操作符改变，可能需要重置值
            if (updates.operator && updates.operator !== c.operator) {
              const field = fields.find((f) => f.key === updated.field);
              if (field?.type === "multiSelect") {
                updated.value = [];
              } else {
                updated.value = "";
              }
            }
            // 如果字段改变，重置操作符和值
            if (updates.field && updates.field !== c.field) {
              const field = fields.find((f) => f.key === updates.field);
              updated.operator = "equals";
              if (field?.type === "multiSelect") {
                updated.value = [];
              } else {
                updated.value = "";
              }
            }
            return updated;
          }),
        };
      })
    );
  };

  const getAvailableOperators = (fieldKey: string) => {
    const field = fields.find((f) => f.key === fieldKey);
    if (!field) return [];
    return Object.entries(OPERATORS).filter(([_, op]) =>
      op.types.includes(field.type)
    );
  };

  const handleApply = () => {
    // 过滤掉空组
    const validGroups = groups.filter((g) => g.conditions.length > 0);
    // 为了兼容旧版，如果只有一组，也传递 conditions
    const flatConditions = validGroups.length === 1 ? validGroups[0].conditions : [];
    onApply(flatConditions, validGroups);
    onOpenChange(false);
  };

  const handleClear = () => {
    setGroups([{ id: Date.now().toString(), conditions: [] }]);
    onClear();
    onOpenChange(false);
  };

  const getFieldType = (fieldKey: string) => {
    return fields.find((f) => f.key === fieldKey)?.type || "text";
  };

  const totalConditions = groups.reduce((sum, g) => sum + g.conditions.length, 0);

  const renderValueInput = (groupId: string, condition: FilterCondition) => {
    const field = fields.find((f) => f.key === condition.field);
    if (!field) return null;

    const operator = OPERATORS[condition.operator];
    if (operator?.label === "为空" || operator?.label === "不为空") {
      return null; // 不需要输入值
    }

    switch (field.type) {
      case "text":
        return (
          <Input
            value={condition.value as string}
            onChange={(e) =>
              updateConditionInGroup(groupId, condition.id, { value: e.target.value })
            }
            placeholder="输入值"
            className="h-8"
          />
        );
      case "number":
        return (
          <Input
            type="number"
            value={condition.value as string}
            onChange={(e) =>
              updateConditionInGroup(groupId, condition.id, { value: e.target.value })
            }
            placeholder="输入数字"
            className="h-8"
          />
        );
      case "date":
        return (
          <Input
            type="date"
            value={condition.value as string}
            onChange={(e) =>
              updateConditionInGroup(groupId, condition.id, { value: e.target.value })
            }
            className="h-8"
          />
        );
      case "select":
        return (
          <Select
            value={condition.value as string}
            onValueChange={(value) =>
              updateConditionInGroup(groupId, condition.id, { value })
            }
          >
            <SelectTrigger className="h-8">
              <SelectValue placeholder="选择值" />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case "boolean":
        return (
          <Select
            value={condition.value as string}
            onValueChange={(value) =>
              updateConditionInGroup(groupId, condition.id, { value })
            }
          >
            <SelectTrigger className="h-8">
              <SelectValue placeholder="选择值" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">是</SelectItem>
              <SelectItem value="false">否</SelectItem>
            </SelectContent>
          </Select>
        );
      case "multiSelect":
        // 简化版多选，使用逗号分隔
        return (
          <Input
            value={Array.isArray(condition.value) ? condition.value.join(", ") : condition.value as string}
            onChange={(e) => {
              const values = e.target.value.split(",").map((v) => v.trim()).filter(Boolean);
              updateConditionInGroup(groupId, condition.id, { value: values });
            }}
            placeholder="输入多个值，用逗号分隔"
            className="h-8"
          />
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={contentRef}
        className="sm:max-w-3xl max-h-[85vh] overflow-y-auto select-none data-[state=closed]:duration-0 data-[state=closed]:animate-none"
        overlayClassName="data-[state=closed]:duration-0 data-[state=closed]:animate-none"
        style={
          position
            ? {
                left: `${position.x}px`,
                top: `${position.y}px`,
                transform: "none",
              }
            : undefined
        }
      >
        <DialogHeader
          onMouseDown={handleDragStart}
          className={cn(
            "cursor-grab active:cursor-grabbing rounded-t-lg -mx-6 -mt-6 px-6 pt-6 pb-1 border-b border-transparent hover:border-border/50",
            isDragging && "cursor-grabbing"
          )}
        >
          <DialogTitle className="flex items-center gap-2 pointer-events-none">
            <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
            <Filter className="h-5 w-5" />
            高级筛选
          </DialogTitle>
          <DialogDescription className="pointer-events-none">
            每个条件组内为"且"关系，多个条件组之间为"或"关系（可拖动标题移动弹窗）
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {groups.map((group, groupIndex) => (
            <div key={group.id} className="space-y-2">
              {/* 条件组标题 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">
                    条件组 {groupIndex + 1}
                  </span>
                  {group.conditions.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      ({group.conditions.length} 个条件)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => addConditionToGroup(group.id)}
                    className="h-7 text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    添加条件
                  </Button>
                  {groups.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => removeGroup(group.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>

              {/* 条件列表 */}
              <div className="space-y-2 pl-3 border-l-2 border-primary/20">
                {group.conditions.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground text-xs">
                    点击"添加条件"开始
                  </div>
                ) : (
                  group.conditions.map((condition, condIndex) => {
                    const availableOperators = getAvailableOperators(condition.field);
                    return (
                      <div key={condition.id} className="flex items-start gap-2">
                        {/* 左侧固定宽度：首行留空，其余行显示"且"，保证下方内容对齐 */}
                        <div className="w-10 shrink-0 flex items-center min-h-[2.5rem]">
                          {condIndex > 0 && (
                            <span className="inline-flex items-center h-8 px-2 mt-2.5 bg-primary/10 text-primary text-xs font-medium rounded">
                              且
                            </span>
                          )}
                        </div>

                        <div className="flex-1 min-w-0 grid grid-cols-12 gap-2 items-start p-2 border rounded-lg bg-background">
                          {/* 字段选择 */}
                          <div className="col-span-3">
                            <Select
                              value={condition.field}
                              onValueChange={(value) =>
                                updateConditionInGroup(group.id, condition.id, {
                                  field: value,
                                })
                              }
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {fields.map((field) => (
                                  <SelectItem key={field.key} value={field.key}>
                                    {field.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* 操作符选择 */}
                          <div className="col-span-3">
                            <Select
                              value={condition.operator}
                              onValueChange={(value) =>
                                updateConditionInGroup(group.id, condition.id, {
                                  operator: value,
                                })
                              }
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {availableOperators.map(([key, op]) => (
                                  <SelectItem key={key} value={key}>
                                    {op.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* 值输入 */}
                          <div className="col-span-5">
                            {renderValueInput(group.id, condition)}
                          </div>

                          {/* 删除按钮 */}
                          <div className="col-span-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() =>
                                removeConditionFromGroup(group.id, condition.id)
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* "或"分隔线 */}
              {groupIndex < groups.length - 1 && (
                <div className="flex items-center gap-2 py-2">
                  <div className="flex-1 border-t border-dashed" />
                  <div className="px-3 py-1 bg-orange-500/10 text-orange-600 text-xs font-medium rounded">
                    或
                  </div>
                  <div className="flex-1 border-t border-dashed" />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-2 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={addGroup}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            添加条件组（或）
          </Button>

          <div className="flex gap-2">
            {totalConditions > 0 && (
              <Button type="button" variant="outline" onClick={handleClear}>
                清除全部
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              取消
            </Button>
            <Button type="button" onClick={handleApply}>
              应用筛选
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
