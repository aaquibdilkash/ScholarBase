"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import type { ToastOptions, Toast, ToastContextValue, ToastVariant } from "@/types/context";

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback(
    (options: ToastOptions | string, variant?: string) => {
      const normalized: ToastOptions =
        typeof options === "string"
          ? { title: options, variant: variant === "error" ? "destructive" : "default" }
          : options;
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const resolvedVariant: ToastVariant = (normalized.variant as ToastVariant) ?? "default";
      setToasts((prev) => [
        ...prev,
        { id, title: normalized.title ?? "", description: normalized.description, variant: resolvedVariant },
      ]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 2200);
    },
    [],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}

      {/* Toast container – fixed top-center, widened on laptop so text fits in 1-2 lines */}
      <div className="fixed top-6 left-1/2 z-9999 flex flex-col gap-2 pointer-events-none -translate-x-1/2 w-[calc(100%-2rem)] sm:w-[520px] lg:w-[600px] sm:max-w-[520px] lg:max-w-[600px] items-center">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto w-full animate-in slide-in-from-top-4 fade-in rounded-2xl border px-5 py-3.5 text-sm font-medium shadow-[0_12px_32px_rgba(15,23,42,0.15)] backdrop-blur-xl dark:shadow-black/30 ${
              t.variant === "destructive"
                ? "border-red-200/70 bg-red-50 text-red-900 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-100"
                : "border-slate-200/70 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
            }`}
          >
            <div className="flex items-start gap-2.5 text-left">
              {t.variant === "destructive" ? (
                <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500 dark:text-red-300" />
              ) : (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-500 dark:text-green-300" />
              )}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold leading-snug">{t.title}</div>
                {t.description && (
                  <p className="mt-0.5 text-[13px] font-normal leading-snug opacity-80">{t.description}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
