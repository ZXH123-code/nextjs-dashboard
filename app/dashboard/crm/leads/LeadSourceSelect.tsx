"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const LEAD_SOURCE_OPTIONS = [
  "线上",
  "线下",
  "协会介绍",
  "政府部门介绍",
  "客户推荐",
  "电商渠道",
];

const CUSTOM_VALUE = "__custom__";
const EMPTY_VALUE = "__empty__";

export function LeadSourceSelect({
  value,
  onSelect,
  onRequestCustomInput,
  disabled = false,
}: {
  value: string;
  onSelect: (value: string) => void;
  onRequestCustomInput: () => void;
  disabled?: boolean;
}) {
  const selectValue = value || EMPTY_VALUE;
  // 选项列表：6 个预设 + 若当前值为自定义则加入 + “自定义...”
  const options = [...LEAD_SOURCE_OPTIONS];
  if (value && !options.includes(value)) {
    options.push(value);
  }

  const handleValueChange = (newValue: string) => {
    if (newValue === CUSTOM_VALUE) {
      onRequestCustomInput();
      return;
    }
    onSelect(newValue === EMPTY_VALUE ? "" : newValue);
  };

  return (
    <Select
      value={selectValue}
      onValueChange={handleValueChange}
      disabled={disabled}
    >
      <SelectTrigger
        className={cn(
          "h-8 min-w-[60px]  text-xs border border-input bg-transparent"
        )}
      >
        <SelectValue placeholder="请选择" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={EMPTY_VALUE}>请选择</SelectItem>
        {options.map((opt) => (
          <SelectItem key={opt} value={opt}>
            {opt}
          </SelectItem>
        ))}
        <SelectItem value={CUSTOM_VALUE}>自定义...</SelectItem>
      </SelectContent>
    </Select>
  );
}
