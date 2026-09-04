"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { InputHTMLAttributes } from "react";

export function PasswordInput({
  className,
  maxLength,
  value,
  onChange,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { maxLength?: number }) {
  const [show, setShow] = useState(false);
  const length = typeof value === "string" ? value.length : 0;

  return (
    <div className={className}>
      <div className="relative">
        <input
          {...props}
          type={show ? "text" : "password"}
          className="sb-input w-full pr-10"
          maxLength={maxLength}
          value={value}
          onChange={onChange}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? "Hide password" : "Show password"}
          title={show ? "Hide password" : "Show password"}
          className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        >
          {show ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
      {maxLength && (
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {length}/{maxLength} characters
        </div>
      )}
    </div>
  );
}
