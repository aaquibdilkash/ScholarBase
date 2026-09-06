"use client";

import React, { useEffect, useRef, useState } from "react";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { useTimeAgo } from "@/utils/use-time-ago";
import {
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
  MoreVertical,
  Pencil,
  Trash2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import { MAX_MESSAGE_BODY } from "@/lib/constants";
import type { SentMessage } from "./MessageInputForm";

interface MessageItemProps {
  message: SentMessage;
  currentUserId: string;
  otherParticipantLastReadAt: Date;
  onEdit?: (messageId: string, newBody: string) => Promise<boolean>;
  onDelete?: (messageId: string) => Promise<boolean>;
  onRetry?: (message: SentMessage) => void;
}

export const MessageItem = React.memo(
  function MessageItem({
    message,
    currentUserId,
    otherParticipantLastReadAt,
    onEdit,
    onDelete,
    onRetry,
  }: MessageItemProps) {
    const isMine = message.senderId === currentUserId;
    const isRead = new Date(message.createdAt) <= otherParticipantLastReadAt;
    const isDeleted = Boolean(message.isDeleted);
    const timeLabel = useTimeAgo(message.createdAt);

    const [menuOpen, setMenuOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editBody, setEditBody] = useState(message.body);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const editInputRef = useRef<HTMLTextAreaElement | null>(null);
    const actionBarRef = useRef<HTMLDivElement | null>(null);

    // Close the kebab menu when clicking anywhere outside of it.
    useEffect(() => {
      if (!menuOpen) return;
      const closeOnOutside = (e: MouseEvent) => {
        if (!actionBarRef.current?.contains(e.target as Node)) {
          setMenuOpen(false);
        }
      };
      document.addEventListener("mousedown", closeOnOutside);
      return () => document.removeEventListener("mousedown", closeOnOutside);
    }, [menuOpen]);

    useEffect(() => {
      if (isEditing) {
        editInputRef.current?.focus();
        editInputRef.current?.setSelectionRange(
          editInputRef.current.value.length,
          editInputRef.current.value.length,
        );
      }
    }, [isEditing]);

    const startEdit = () => {
      setMenuOpen(false);
      setEditBody(message.body);
      setIsEditing(true);
    };

    const cancelEdit = () => {
      setIsEditing(false);
      setEditBody(message.body);
    };

    const saveEdit = async () => {
      const trimmed = editBody.trim();
      if (!trimmed || !onEdit || isSaving) return;
      setIsSaving(true);
      const ok = await onEdit(message.id, trimmed);
      setIsSaving(false);
      if (ok) setIsEditing(false);
    };

    const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cancelEdit();
      } else if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        saveEdit();
      }
    };

    const requestDelete = () => {
      setMenuOpen(false);
      if (!onDelete) return;
      setIsDeleteOpen(true);
    };

    const handleDelete = async () => {
      if (!onDelete || isDeleting) return;
      setIsDeleting(true);
      await onDelete(message.id);
      setIsDeleting(false);
      setIsDeleteOpen(false);
    };

    // ⚡ TOMBSTONE (Issue 6): Deleted messages render as muted, italicized
    // text with all reactions/actions disabled.
    if (isDeleted) {
      return (
        <div className={`flex items-start gap-3 ${isMine ? "flex-row-reverse" : ""}`}>
          <div
            className={`h-8 w-8 shrink-0 rounded-full bg-slate-200 ${isMine ? "hidden" : ""}`}
          >
            {message.sender?.avatarUrl ? (
              <UserAvatar
                src={message.sender.avatarUrl}
                name={message.sender.name}
                imageClassName="rounded-full"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-500">
                {message.sender?.name?.charAt(0).toUpperCase() || "@"}
              </div>
            )}
          </div>
          <div className="max-w-[75%] rounded-lg border border-dashed border-slate-200 px-4 py-2 dark:border-slate-700">
            <p className="text-sm italic text-slate-400 dark:text-slate-500">
              This message was deleted
            </p>
            <div className="mt-1 flex items-center justify-end gap-1.5">
              <p
                suppressHydrationWarning
                className="text-[10px] text-slate-400 dark:text-slate-500"
              >
                {timeLabel}
              </p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        className={`group flex items-start gap-3 ${isMine ? "flex-row-reverse" : ""}`}
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
        <div className="flex max-w-[75%] items-center gap-1">
          {isEditing && isMine ? (
            // ⚡ Native themed inline edit form (replaces the bubble entirely)
            <div className="w-72 rounded-2xl border border-slate-200 bg-white p-3 shadow-lg sm:w-96 dark:border-slate-700 dark:bg-slate-900">
              <label
                htmlFor={`edit-message-${message.id}`}
                className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Edit message
              </label>
              <textarea
                ref={editInputRef}
                id={`edit-message-${message.id}`}
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                onKeyDown={handleEditKeyDown}
                rows={Math.min(5, editBody.split("\n").length + 1)}
                maxLength={MAX_MESSAGE_BODY}
                disabled={isSaving}
                aria-label="Edit message"
                className="sb-input w-full resize-none rounded-xl px-3 py-2 text-sm"
              />
              <div className="mt-2.5 flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                  {editBody.length}/{MAX_MESSAGE_BODY}
                  <span className="ml-2 hidden sm:inline">
                    Enter to save · Esc to cancel
                  </span>
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={cancelEdit}
                    disabled={isSaving}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={saveEdit}
                    disabled={isSaving || !editBody.trim()}
                  >
                    {isSaving ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving...
                      </span>
                    ) : (
                      "Save"
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div
              className={`rounded-lg px-4 py-2 ${
                isMine
                  ? "bg-blue-500 text-white"
                  : "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-200"
              } ${message.status === "sending" ? "opacity-70" : ""}`}
            >
              <>
                <p className="text-sm break-words whitespace-pre-wrap">
                  {message.body}
                </p>
                <div className="mt-1 flex items-center justify-end gap-1.5">
                  {message.editedAt && (
                    <span
                      className={`text-[10px] italic ${isMine ? "text-blue-100" : "text-slate-400 dark:text-slate-500"}`}
                    >
                      (edited)
                    </span>
                  )}
                  <p
                    suppressHydrationWarning
                    className={`text-[10px] ${
                      isMine
                        ? "text-blue-100"
                        : "text-slate-400 dark:text-slate-500"
                    }`}
                  >
                    {timeLabel}
                  </p>
                  {isMine && (
                    <div className="flex items-center text-blue-100">
                      {message.status === "sending" ? (
                        <Clock className="h-[14px] w-[14px] opacity-70" />
                      ) : message.status === "failed" ? (
                        <AlertCircle className="h-[14px] w-[14px] text-red-600 dark:text-red-400" />
                      ) : isRead ? (
                        <CheckCheck className="h-[14px] w-[14px] text-blue-200" />
                      ) : (
                        <Check className="h-[14px] w-[14px] opacity-70" />
                      )}
                    </div>
                  )}
                </div>
              </>
            </div>
          )}

          {/* ⚡ ISSUE 6: Message action bar (kebab) on owned, delivered messages.
              DB-loaded messages have no `status` field — only optimistic
              realtime ones are marked "sent" — so treat undefined as sent. */}
          {isMine &&
            (message.status === "sent" || !message.status) &&
            !isEditing && (
            <div
              ref={actionBarRef}
              className="relative self-center opacity-100 transition-opacity"
            >
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                aria-label="Message actions"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:opacity-100 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-8 z-20 w-36 origin-top-right rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
                >
                  <button
                    type="button"
                    onClick={startEdit}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={requestDelete}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ⚡ ISSUE 4: Retry affordance for failed sends */}
          {isMine && message.status === "failed" && onRetry && (
            <button
              type="button"
              onClick={() => onRetry(message)}
              className="self-center rounded-full border border-red-200 px-2.5 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10"
            >
              Retry
            </button>
          )}
        </div>

        {/* ⚡ Shared app-wide confirmation modal for delete */}
        <ConfirmationModal
          isOpen={isDeleteOpen}
          onClose={() => setIsDeleteOpen(false)}
          onConfirm={handleDelete}
          title="Delete message?"
          message="This message will be deleted for everyone in this conversation. This cannot be undone."
          isConfirming={isDeleting}
          confirmLabel="Delete"
          confirmingLabel="Deleting..."
        />
      </div>
    );
  },
  // Custom comparator: re-render only when relevant fields change
  (prevProps, nextProps) => {
    return (
      prevProps.message.id === nextProps.message.id &&
      prevProps.message.status === nextProps.message.status &&
      prevProps.message.body === nextProps.message.body &&
      prevProps.message.editedAt === nextProps.message.editedAt &&
      prevProps.message.isDeleted === nextProps.message.isDeleted &&
      prevProps.otherParticipantLastReadAt.getTime() ===
        nextProps.otherParticipantLastReadAt.getTime() &&
      prevProps.onEdit === nextProps.onEdit &&
      prevProps.onDelete === nextProps.onDelete &&
      prevProps.onRetry === nextProps.onRetry
    );
  },
);
