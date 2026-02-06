"use client";

import { useState } from "react";
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
  X,
  Plus,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type FilterField = {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "select" | "multiSelect";
  options?: { value: string; label: string }[];
};

export type FilterCondition = {
  id: string;
  field: string;
  operator: string;
  value: string | string[];
};

type FilterDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fields: FilterField[];
  conditions: FilterCondition[];
  onApply: (conditions: FilterCondition[]) => void;
  onClear: () => void;
};

const OPERATORS: Record<string, { label: string; types: string[] }> = {
  equals: { label: "等于", types: ["text", "number", "date", "select"] },
  notEquals: { label: "不等于", types: ["text", "number", "date", "select"] },
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
  conditions: initialConditions,
  onApply,
  onClear,
}: FilterDialogProps) {
  const [conditions, setConditions] = useState<FilterCondition[]>(initialConditions);

  const addCondition = () => {
    const newCondition: FilterCondition = {
      id: Date.now().toString(),
      field: fields[0]?.key || "",
      operator: "equals",
      value: "",
    };
    setConditions([...conditions, newCondition]);
  };

  const removeCondition = (id: string) => {
    setConditions(conditions.filter((c) => c.id !== id));
  };

  const updateCondition = (id: string, updates: Partial<FilterCondition>) => {
    setConditions(
      conditions.map((c) => {
        if (c.id === id) {
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
        }
        return c;
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
    onApply(conditions);
    onOpenChange(false);
  };

  const handleClear = () => {
    setConditions([]);
    onClear();
    onOpenChange(false);
  };

  const getFieldType = (fieldKey: string) => {
    return fields.find((f) => f.key === fieldKey)?.type || "text";
  };

  const renderValueInput = (condition: FilterCondition) => {
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
              updateCondition(condition.id, { value: e.target.value })
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
              updateCondition(condition.id, { value: e.target.value })
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
              updateCondition(condition.id, { value: e.target.value })
            }
            className="h-8"
          />
        );
      case "select":
        return (
          <Select
            value={condition.value as string}
            onValueChange={(value) =>
              updateCondition(condition.id, { value })
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
      case "multiSelect":
        // 简化版多选，使用逗号分隔
        return (
          <Input
            value={Array.isArray(condition.value) ? condition.value.join(", ") : condition.value as string}
            onChange={(e) => {
              const values = e.target.value.split(",").map((v) => v.trim()).filter(Boolean);
              updateCondition(condition.id, { value: values });
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
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            筛选条件
          </DialogTitle>
          <DialogDescription>
            添加筛选条件来过滤数据，多个条件之间为"且"的关系
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {conditions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              暂无筛选条件，点击"添加条件"开始筛选
            </div>
          ) : (
            conditions.map((condition, index) => {
              const availableOperators = getAvailableOperators(condition.field);
              return (
                <div
                  key={condition.id}
                  className="flex items-start gap-2 p-3 border rounded-lg bg-muted/30"
                >
                  <div className="flex-1 grid grid-cols-12 gap-2 items-start">
                    {/* 字段选择 */}
                    <div className="col-span-3">
                      <Select
                        value={condition.field}
                        onValueChange={(value) =>
                          updateCondition(condition.id, { field: value })
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
                          updateCondition(condition.id, { operator: value })
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
                      {renderValueInput(condition)}
                    </div>

                    {/* 删除按钮 */}
                    <div className="col-span-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => removeCondition(condition.id)}
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

        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={addCondition}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            添加条件
          </Button>

          <div className="flex gap-2">
            {conditions.length > 0 && (
              <Button type="button" variant="outline" onClick={handleClear}>
                清除全部
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
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
