"use client";

import { useState, useCallback } from "react";
import { AlertDialog } from "@/components/ui/alert-dialog";
import type { AlertType } from "@/components/ui/alert-dialog";

interface AlertOptions {
  title?: string;
  type?: AlertType;
  confirmText?: string;
  onConfirm?: () => void;
}

export function useAlert() {
  const [alertState, setAlertState] = useState<{
    open: boolean;
    message: string;
    options: AlertOptions;
  }>({
    open: false,
    message: "",
    options: {},
  });

  const showAlert = useCallback((message: string, options?: AlertOptions) => {
    setAlertState({
      open: true,
      message,
      options: options || {},
    });
  }, []);

  const hideAlert = useCallback(() => {
    setAlertState((prev) => ({ ...prev, open: false }));
  }, []);

  const AlertComponent = () => (
    <AlertDialog
      open={alertState.open}
      onOpenChange={hideAlert}
      description={alertState.message}
      title={alertState.options.title}
      type={alertState.options.type}
      confirmText={alertState.options.confirmText}
      onConfirm={alertState.options.onConfirm}
    />
  );

  return {
    showAlert,
    hideAlert,
    AlertComponent,
  };
}
