"use client";

import { useRef, useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const EMPTY_VALUE = "__empty__";

export interface FormSelectOption {
  value: string;
  label: string;
}

interface FormSelectProps {
  name: string;
  value: string;
  options: FormSelectOption[];
  placeholder?: string;
  /** 选择后自动提交表单 */
  submitOnChange?: boolean;
  /** 选择变化回调（用于联动逻辑） */
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  className?: string;
  /** 表格内联使用时的紧凑样式 */
  compact?: boolean;
}

export function FormSelect({
  name,
  value,
  options,
  placeholder = "请选择",
  submitOnChange = false,
  onValueChange,
  disabled,
  className,
  compact = false,
}: FormSelectProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [internalValue, setInternalValue] = useState(value);

  // 当父组件 value 变化时同步（如预设值、联动逻辑）
  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  const selectValue = internalValue === "" ? EMPTY_VALUE : internalValue;
  const selectOptions = options.map((opt) => ({
    value: opt.value === "" ? EMPTY_VALUE : opt.value,
    label: opt.label,
  }));

  const handleValueChange = (newValue: string) => {
    const formValue = newValue === EMPTY_VALUE ? "" : newValue;
    setInternalValue(formValue);
    onValueChange?.(formValue);
    if (submitOnChange) {
      const form = inputRef.current?.closest("form");
      form?.requestSubmit();
    }
  };

  return (
    <>
      <input type="hidden" name={name} ref={inputRef} value={internalValue} readOnly />
      <Select
        value={selectValue}
        onValueChange={handleValueChange}
        disabled={disabled}
      >
        <SelectTrigger
          className={cn(
            "min-w-[100px] cursor-pointer",
            compact && "h-8 text-xs",
            className
          )}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {selectOptions.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}
