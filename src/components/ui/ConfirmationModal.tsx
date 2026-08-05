"use client";

import { Button } from "./button";

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  isConfirming: boolean;
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  isConfirming,
}: ConfirmationModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
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
            <Button onClick={onConfirm} variant="destructive" disabled={isConfirming}>
              {isConfirming ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
