import React from "react";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { formatTimeAgo } from "@/utils/time-ago";
import { Check, CheckCheck, Clock } from "lucide-react";
import type { SentMessage } from "./MessageInputForm";

interface MessageItemProps {
  message: SentMessage;
  currentUserId: string;
  otherParticipantLastReadAt: Date;
}

export const MessageItem = React.memo(
  function MessageItem({
    message,
    currentUserId,
    otherParticipantLastReadAt,
  }: MessageItemProps) {
    const isMine = message.senderId === currentUserId;
    const isRead = new Date(message.createdAt) <= otherParticipantLastReadAt;

    return (
      <div
        className={`flex items-start gap-3 ${isMine ? "flex-row-reverse" : ""}`}
      >
        <div
          className={`h-8 w-8 shrink-0 rounded-full bg-slate-200 ${isMine ? "hidden" : ""}`}
        >
          {message.sender.avatarUrl ? (
            <UserAvatar
              src={message.sender.avatarUrl}
              name={message.sender.name}
              imageClassName="rounded-full"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-500">
              {message.sender.name?.charAt(0).toUpperCase() || "@"}
            </div>
          )}
        </div>
        <div
          className={`max-w-[75%] rounded-lg px-4 py-2 ${
            isMine
              ? "bg-blue-500 text-white"
              : "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-200"
          } ${message.status === "sending" ? "opacity-70" : ""}`}
        >
          <p className="text-sm break-words whitespace-pre-wrap">{message.body}</p>
          <div className="mt-1 flex items-center justify-end gap-1.5">
            <p
              suppressHydrationWarning
              className={`text-[10px] ${
                isMine ? "text-blue-100" : "text-slate-400 dark:text-slate-500"
              }`}
            >
              {formatTimeAgo(message.createdAt)}
            </p>
            {isMine && (
              <div className="flex items-center text-blue-100">
                {message.status === "sending" ? (
                  <Clock className="h-[14px] w-[14px] opacity-70" />
                ) : isRead ? (
                  <CheckCheck className="h-[14px] w-[14px] text-blue-200" />
                ) : (
                  <Check className="h-[14px] w-[14px] opacity-70" />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  },
  // Custom comparator: only re-render if key props change
  (prevProps, nextProps) => {
    return (
      prevProps.message.id === nextProps.message.id &&
      prevProps.message.status === nextProps.message.status &&
      prevProps.otherParticipantLastReadAt.getTime() ===
        nextProps.otherParticipantLastReadAt.getTime()
    );
  },
);
