"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "./button";
import { Loader2 } from "lucide-react";

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  isConfirming: boolean;
  confirmLabel?: string;
  confirmVariant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  confirmingLabel?: string;
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  isConfirming,
  confirmLabel = "Delete",
  confirmVariant = "destructive",
  confirmingLabel = "Deleting...",
}: ConfirmationModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[900] flex items-center justify-center bg-black bg-opacity-50"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md p-6 bg-white rounded-lg shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-bold">{title}</h2>
          <p>{message}</p>
          <div className="flex justify-end gap-4 mt-4">
            <Button onClick={onClose} variant="outline" disabled={isConfirming}>
              Cancel
            </Button>
            <Button onClick={onConfirm} variant={confirmVariant} disabled={isConfirming}>
              {isConfirming ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="animate-spin h-4 w-4" />
                  {confirmingLabel}
                </span>
              ) : (
                confirmLabel
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
