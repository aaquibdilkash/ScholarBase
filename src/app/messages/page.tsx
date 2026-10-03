"use client";

// ⚡ Desktop keeps the original empty state beside the conversation sidebar.
// On mobile, MessagesClientLayout renders the conversation list inline for this
// route (`lg:hidden`), so this block is hidden below `lg` to avoid showing both.
export default function MessagesPage() {
  return (
    <div className="hidden h-full flex-col items-center justify-center lg:flex">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-slate-500 dark:text-slate-400">
          Select a conversation
        </h2>
        <p className="mt-2 text-slate-400 dark:text-slate-500">
          Choose a conversation from the sidebar or create a new one to start chatting.
        </p>
      </div>
    </div>
  );
}
