"use client";

import { useState, useCallback } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export interface ConfirmOptions {
  title?: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
}

export function useConfirm() {
  const [state, setState] = useState<{
    open: boolean;
    options: ConfirmOptions;
    onConfirm: () => void;
  }>({
    open: false,
    options: { description: "" },
    onConfirm: () => {},
  });

  const showConfirm = useCallback(
    (options: ConfirmOptions, onConfirm: () => void) => {
      setState({
        open: true,
        options,
        onConfirm,
      });
    },
    []
  );

  const hideConfirm = useCallback(() => {
    setState((prev) => ({ ...prev, open: false }));
  }, []);

  const handleConfirm = useCallback(() => {
    state.onConfirm();
  }, [state.onConfirm]);

  const ConfirmComponent = () => (
    <ConfirmDialog
      open={state.open}
      onOpenChange={hideConfirm}
      title={state.options.title}
      description={state.options.description}
      confirmText={state.options.confirmText}
      cancelText={state.options.cancelText}
      variant={state.options.variant}
      onConfirm={handleConfirm}
    />
  );

  return {
    showConfirm,
    hideConfirm,
    ConfirmComponent,
  };
}
