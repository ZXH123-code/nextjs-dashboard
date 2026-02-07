"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface ComboboxOption {
  value: string;
  label: string;
}

interface ComboboxProps {
  value: string;
  options: ComboboxOption[];
  onChange: (value: string) => void;
  onBlur?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  allowCustom?: boolean; // 是否允许自定义输入
}

export function Combobox({
  value,
  options,
  onChange,
  onBlur,
  onKeyDown,
  placeholder = "选择或输入...",
  disabled = false,
  className,
  allowCustom = true,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState(value);
  const [dropdownRect, setDropdownRect] = React.useState<{ top: number; left: number; width: number } | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // 同步外部 value 变化
  React.useEffect(() => {
    setInputValue(value);
  }, [value]);

  // 打开时根据输入框位置计算下拉框位置（用于 Portal，fixed 相对视口）
  React.useEffect(() => {
    if (open && inputRef.current && typeof document !== "undefined") {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownRect({
        top: rect.bottom,
        left: rect.left,
        width: Math.max(rect.width, 160),
      });
    } else {
      setDropdownRect(null);
    }
  }, [open]);

  // 过滤选项（根据输入值）
  const filteredOptions = React.useMemo(() => {
    if (!inputValue.trim()) return options;
    const lowerInput = inputValue.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(lowerInput) ||
        opt.value.toLowerCase().includes(lowerInput)
    );
  }, [inputValue, options]);

  // 有选项或允许自定义时都显示下拉（空输入时显示全部选项）
  const showDropdown = open && (filteredOptions.length > 0 || (allowCustom && inputValue.trim() !== ""));

  // 处理输入变化
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setOpen(true);
    if (allowCustom) {
      onChange(newValue); // 实时更新（允许自定义）
    }
  };

  // 选择选项
  const handleSelectOption = (optionValue: string) => {
    setInputValue(optionValue);
    onChange(optionValue);
    setOpen(false);
    inputRef.current?.blur();
  };

  // 处理焦点
  const handleFocus = () => {
    setOpen(true);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    // 延迟关闭，以便点击选项时能触发
    setTimeout(() => {
      if (!containerRef.current?.contains(document.activeElement)) {
        setOpen(false);
        onBlur?.();
      }
    }, 200);
  };

  // 键盘导航
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
    onKeyDown?.(e);
  };

  const dropdownContent = showDropdown && dropdownRect && typeof document !== "undefined" && (
    <div
      className="fixed z-[100] max-h-60 overflow-auto rounded-md border bg-popover shadow-md"
      style={{
        top: dropdownRect.top + 4,
        left: dropdownRect.left,
        width: dropdownRect.width,
      }}
    >
      <div className="p-1">
        {filteredOptions.map((option) => {
          const isSelected = value === option.value;
          return (
            <div
              key={option.value}
              role="option"
              aria-selected={isSelected}
              className={cn(
                "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                isSelected && "bg-accent text-accent-foreground"
              )}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelectOption(option.value)}
            >
              <Check
                className={cn(
                  "mr-2 h-4 w-4 shrink-0",
                  isSelected ? "opacity-100" : "opacity-0"
                )}
              />
              {option.label}
            </div>
          );
        })}
        {allowCustom && inputValue.trim() && !filteredOptions.some(opt => opt.value === inputValue) && (
          <div
            role="option"
            className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground border-t border-border mt-1 pt-1"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleSelectOption(inputValue)}
          >
            <span className="text-muted-foreground text-xs mr-2">+</span>
            使用自定义值: &quot;{inputValue}&quot;
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div ref={containerRef} className={cn("relative inline-block min-w-0", className?.includes("w-") ? "" : "w-full")}>
      <div className="relative">
        <Input
          ref={inputRef}
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={cn("pr-8 h-8", className)}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute right-0 top-0 h-8 px-2 py-0 hover:bg-transparent"
          onClick={() => {
            setOpen(!open);
            inputRef.current?.focus();
          }}
          disabled={disabled}
        >
          <ChevronsUpDown className="h-4 w-4 opacity-50" />
        </Button>
      </div>

      {typeof document !== "undefined" && dropdownContent && createPortal(dropdownContent, document.body)}
    </div>
  );
}
