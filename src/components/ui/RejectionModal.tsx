"use client";

import { useState } from "react";
import { Button } from "./button";
import { InfoTooltip } from "@/components/ui/InfoTooltip";

interface RejectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
  title: string;
  message: string;
  isConfirming: boolean;
}

export function RejectionModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  isConfirming,
}: RejectionModalProps) {
  const [reason, setReason] = useState("");

  const handleClose = () => {
    if (isConfirming) return;
    setReason("");
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  const handleConfirm = async () => {
    await onConfirm(reason);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onClick={handleClose}
    >
      <div
        className="relative w-full max-w-md p-6 bg-white rounded-lg shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-bold">{title}</h2>
          <p>{message}</p>
           <textarea
             value={reason}
             onChange={(e) => setReason(e.target.value)}
             placeholder="Enter rejection reason"
             className="w-full p-2 border rounded"
             aria-label="Rejection reason"
           />
           <span className="text-xs text-slate-500 inline-flex items-center gap-1">
             <InfoTooltip message="Provide a clear reason for rejection. This will be visible to the content author." />
           </span>
          <div className="flex justify-end gap-4 mt-4">
            <Button
              onClick={handleClose}
              variant="outline"
              disabled={isConfirming}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              variant="destructive"
              disabled={isConfirming}
            >
              {isConfirming ? "Rejecting..." : "Reject"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
