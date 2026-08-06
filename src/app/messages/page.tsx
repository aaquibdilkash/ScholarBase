"use client";
import { useContext } from "react";
import { Menu } from "lucide-react";
import { MessagesLayoutContext } from "./messages-context";

export default function MessagesPage() {
  const context = useContext(MessagesLayoutContext);
  if (!context) {
    throw new Error("MessagesPage must be used within a MessagesLayout");
  }
  const { setMobileOpen } = context;

  return (
    <div className="h-full flex flex-col items-center justify-center">
      <div className="md:hidden mb-4">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-600 shadow-sm backdrop-blur-sm transition hover:bg-white dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-300"
          aria-label="Toggle conversation sidebar"
        >
          <Menu className="h-6 w-6" />
        </button>
      </div>
      <div className="text-center">
        <h2 className="text-xl font-semibold text-slate-500 dark:text-slate-400">
          Select a conversation
        </h2>
        <p className="mt-2 text-slate-400 dark:text-slate-500">
          Choose a conversation from the sidebar to start chatting.
        </p>
      </div>
    </div>
  );
}
