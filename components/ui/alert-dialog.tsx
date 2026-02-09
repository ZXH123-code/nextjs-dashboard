"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, Info, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export type AlertType = "error" | "warning" | "info" | "success";

interface AlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description: string;
  type?: AlertType;
  confirmText?: string;
  onConfirm?: () => void;
}

const alertConfig: Record<
  AlertType,
  { icon: typeof AlertCircle; bgColor: string; iconColor: string; defaultTitle: string }
> = {
  error: {
    icon: AlertCircle,
    bgColor: "bg-red-100",
    iconColor: "text-red-600",
    defaultTitle: "操作失败",
  },
  warning: {
    icon: AlertTriangle,
    bgColor: "bg-amber-100",
    iconColor: "text-amber-600",
    defaultTitle: "提示",
  },
  info: {
    icon: Info,
    bgColor: "bg-blue-100",
    iconColor: "text-blue-600",
    defaultTitle: "提示",
  },
  success: {
    icon: CheckCircle2,
    bgColor: "bg-emerald-100",
    iconColor: "text-emerald-600",
    defaultTitle: "操作成功",
  },
};

export function AlertDialog({
  open,
  onOpenChange,
  title,
  description,
  type = "info",
  confirmText = "知道了",
  onConfirm,
}: AlertDialogProps) {
  const config = alertConfig[type];
  const Icon = config.icon;

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                config.bgColor,
                config.iconColor
              )}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <DialogTitle>{title || config.defaultTitle}</DialogTitle>
              <DialogDescription className="mt-1">{description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogFooter className="sm:justify-end">
          <Button type="button" onClick={handleConfirm}>
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
