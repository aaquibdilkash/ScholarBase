"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { DownloadCloud, Loader2, Wifi } from "lucide-react";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { SHIELD_MODEL_CONSENT_TIP } from "@/constants/tooltips";

interface ModelDownloadModalProps {
  isOpen: boolean;
  progress: number;
  isDownloading: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ModelDownloadModal({
  isOpen,
  progress,
  isDownloading,
  onClose,
  onConfirm,
}: ModelDownloadModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-modal flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={() => {
        if (!isDownloading) onClose();
      }}
    >
      <div
        className="relative mx-6 w-full max-w-md rounded-lg bg-white p-6 shadow-lg sm:mx-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600/10 text-blue-600">
              <DownloadCloud className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-xl font-bold">Load Local Neural Engine</h2>
              <p className="flex items-center gap-1.5 text-xs text-slate-500">
                Zero-knowledge in-browser inference
                <InfoTooltip message={SHIELD_MODEL_CONSENT_TIP} />
              </p>
            </div>
          </div>

          <p className="text-sm text-slate-600">
            Your paper <strong>never leaves your device</strong>. Neural
            weights (~130 MB ONNX) download once to browser cache.
          </p>

          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-600">
            <Wifi className="h-4 w-4 shrink-0 text-blue-600" />
            <span>
              Use Wi-Fi. Cached permanently. Needs internet for first download.
            </span>
          </div>

          {isDownloading ? (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-500">
                <span>Downloading weights...</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : null}

          <div className="mt-4 flex justify-end gap-4">
            <Button
              onClick={onClose}
              variant="outline"
              disabled={isDownloading}
            >
              Cancel
            </Button>
            {/* Sign-in style: solid slate-950 pill (matches LoginForm sb-button-primary) */}
            <button
              type="button"
              onClick={onConfirm}
              disabled={isDownloading}
              className="sb-button-primary min-w-44 disabled:opacity-50"
            >
              {isDownloading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Downloading...
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <DownloadCloud className="h-4 w-4" />
                  Download & Initialize
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
