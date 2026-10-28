"use client";

import { useEffect, useLayoutEffect, useState, useRef, useCallback } from "react";
import {
  getMoreMessages,
  editMessage,
  deleteMessage,
  sendMessage,
} from "@/app/actions/messages";
import { MessageItem } from "./MessageItem";
import { applyMessageUpdate } from "./thread-update";
import {
  appendMessage,
  isPendingMessageDelivered,
  prependOlderMessages,
} from "./thread-reconcile";
import { useToast } from "@/components/ui/Toast";
import type { User } from "@supabase/supabase-js";
import type { SentMessage } from "./MessageInputForm";
import {
  getOutboxForConversation,
  removePendingMessage,
  updatePendingMessageStatus,
} from "@/utils/message-outbox";
import { type MessageFailureCode } from "@/app/actions/messages";
import { MESSAGE_THREAD_PAGE_SIZE } from "@/constants/messages";

/**
 * Shape of a message row as delivered by the Realtime Broadcast from Database
 * trigger (`supabase/realtime/broadcast-messages.sql`). The trigger sends the
 * curated payload, so this is already the full `SentMessage` — which is what
 * let the old `getMessageDetails` server-action round-trip be deleted.
 */
type MessageRow = {
  id: string;
  conversationId?: string;
  conversation_id?: string;
  body: string;
  senderId?: string;
  /** The trigger always emits an ISO-8601 string; widened so a `SentMessage`
   *  (whose server-action round-trip yields a `Date`) also satisfies this. */
  createdAt: Date | string;
  editedAt?: Date | string | null;
  isDeleted?: boolean | null;
  replyToId?: string | null;
  sender?: {
    id: string;
    name: string | null;
    handle: string | null;
    avatarUrl: string | null;
  };
};

export function MessageList(props: MessageListProps) {
  // A thread belongs to exactly one conversation, but the page component is
  // reused when the route moves from /messages/A to /messages/B. Without a key
  // the state below (messages, pagination cursor, scroll anchoring) survived the
  // switch and the previous conversation stayed on screen until a hard refresh.
  // Keying the stateful body resets all of it, including the outbox hydration,
  // for the conversation actually being opened.
  return <MessageThread key={props.conversationId} {...props} />;
}

type MessageListProps = {
  conversationId: string;
  initialMessages: SentMessage[];
  user: User | null;
  otherParticipantLastReadAt: Date;
  registerAppend?: (
    fn: (message: SentMessage, replacesId?: string) => void,
  ) => void;
  registerAddFailed?: (fn: (message: SentMessage) => void) => void;
  /**
   * Merges a server snapshot of the newest rows into the thread.
   *
   * Broadcast is fire-and-forget: anything sent while the channel was
   * disconnected is never replayed, so after a Realtime reconnect the thread
   * stayed stale until a refresh. Returning `true` means at least one row was
   * missing and was appended, so the page can mark it read.
   */
  registerSyncLatest?: (fn: (rows: SentMessage[]) => boolean) => void;
  /**
   * Receives an edit / tombstone broadcast for a message already in the thread.
   *
   * This component no longer owns a Realtime channel of its own: the conversation
   * page holds the single `conversation:<id>` channel and forwards both the
   * INSERT and the UPDATE event here, so a message is delivered once rather than
   * by three overlapping subscriptions.
   */
  registerUpdate?: (fn: (message: MessageRow) => void) => void;
  onMessageRejected?: (code: MessageFailureCode) => void;
  /** Marks a message as the active reply target in the composer. */
  onSetReplyingTo?: (message: SentMessage) => void;
  /**
   * False while the conversation is blocked in either direction or the viewer
   * is frozen: edit and delete are rejected server-side, so the menu must not
   * offer them.
   */
  canManageMessages?: boolean;
};

function MessageThread({
  conversationId,
  initialMessages,
  user,
  otherParticipantLastReadAt,
  registerAppend,
  registerAddFailed,
  registerUpdate,
  registerSyncLatest,
  onMessageRejected,
  onSetReplyingTo,
  canManageMessages = true,
}: MessageListProps) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<SentMessage[]>(() =>
    [...initialMessages].reverse(),
  );
  const [hasMore, setHasMore] = useState(
    initialMessages.length === MESSAGE_THREAD_PAGE_SIZE,
  );
  const [isLoadingMore, setIsLoadingMore] = useState(false);

   const observerTarget = useRef<HTMLDivElement | null>(null);
   const containerRef = useRef<HTMLDivElement | null>(null);
   const messagesEndRef = useRef<HTMLDivElement | null>(null);
   const sentinelWasVisibleRef = useRef(false);
   const userId = user?.id;

    const getScrollContainer = useCallback(() => {
      const container = containerRef.current;
      if (!container) return null;
      let el: HTMLElement | null = container.parentElement;
      while (el) {
        const style = getComputedStyle(el);
        if (
          style.overflowY === "auto" ||
          style.overflowY === "scroll" ||
          style.overflow === "auto" ||
          style.overflow === "scroll"
        ) {
          return el;
        }
        el = el.parentElement;
      }
      return null;
    }, []);

   const initialRenderRef = useRef(true);
   const previousMessageCount = useRef(initialMessages.length);
   const currentMessagesRef = useRef<SentMessage[]>([]);
   // Whether the NEXT messages update is a prepend of older history rather than
   // an append. This used to be inferred from
   // `messages.length > previousMessageCount`, which is true for BOTH a prepend
   // and a newly arrived message — so an incoming message took the prepend
   // branch and ran `scrollTop = heightDiff`, scrolling up by the height of the
   // new bubble instead of down to it. loadMore() now sets the flag explicitly.
   const pendingPrependRef = useRef(false);
   const prependedScrollHeightRef = useRef<number | null>(null);
   // Synchronous twin of `isLoadingMore`: two intersection callbacks can run in
   // the same tick, before React re-renders, and both would fetch the same page.
   const isLoadingMoreRef = useRef(false);

   useEffect(() => {
     currentMessagesRef.current = messages;
   }, [messages]);

   useLayoutEffect(() => {
     const scrollContainer = getScrollContainer();

     if (initialRenderRef.current) {
       if (scrollContainer) {
         scrollContainer.scrollTop = scrollContainer.scrollHeight;
       }
       initialRenderRef.current = false;
       return;
     }

     if (!scrollContainer) {
       previousMessageCount.current = messages.length;
       return;
     }

     if (pendingPrependRef.current) {
       // Older history was prepended above the viewport. Anchor the reader to
       // the same message by compensating for the height added above them.
       pendingPrependRef.current = false;
       const oldScrollHeight = prependedScrollHeightRef.current;
       prependedScrollHeightRef.current = null;
       if (oldScrollHeight !== null) {
         scrollContainer.scrollTop +=
           scrollContainer.scrollHeight - oldScrollHeight;
       }
       previousMessageCount.current = messages.length;
       return;
     }

     if (messages.length > previousMessageCount.current) {
       // A message was appended — sent by us, or received from the other
       // participant. Bring it into view instead of leaving it off-screen.
       scrollContainer.scrollTop = scrollContainer.scrollHeight;
     }

     previousMessageCount.current = messages.length;
   }, [messages, getScrollContainer]);

    const loadMore = useCallback(async () => {
      if (isLoadingMoreRef.current || isLoadingMore || !hasMore || messages.length === 0)
        return;
      isLoadingMoreRef.current = true;
      setIsLoadingMore(true);

      const scrollContainer = getScrollContainer();
      if (scrollContainer) {
        prependedScrollHeightRef.current = scrollContainer.scrollHeight;
        pendingPrependRef.current = true;
      }

      try {
        const cursor = messages[0].id;
        const olderMessages = await getMoreMessages(conversationId, cursor);
        if (olderMessages.length < MESSAGE_THREAD_PAGE_SIZE) setHasMore(false);

        setMessages((prev) => {
          const formattedOlder = [...olderMessages].reverse() as SentMessage[];
          const next = prependOlderMessages(prev, formattedOlder);
          if (next === prev) {
            // Everything in the page was already rendered: drop the pending
            // prepend marker so the next append is not mistaken for history.
            pendingPrependRef.current = false;
            prependedScrollHeightRef.current = null;
          }
          return next;
        });
      } catch (error) {
        pendingPrependRef.current = false;
        prependedScrollHeightRef.current = null;
        console.error("Failed to load more messages", error);
      } finally {
        isLoadingMoreRef.current = false;
        setIsLoadingMore(false);
      }
    }, [isLoadingMore, hasMore, messages, conversationId, getScrollContainer]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const isVisible = entries[0].isIntersecting;
        if (isVisible && !sentinelWasVisibleRef.current) {
          void loadMore();
        }
        sentinelWasVisibleRef.current = isVisible;
      },
      { threshold: 1.0 },
    );
    if (observerTarget.current) observer.observe(observerTarget.current);
    return () => observer.disconnect();
  }, [loadMore]);

  useEffect(() => {
    if (registerAppend) {
      registerAppend((message: SentMessage, replacesId?: string) => {
        setMessages((current) => appendMessage(current, message, replacesId));
      });
    }
  }, [registerAppend]);

  useEffect(() => {
    if (registerAddFailed) {
      registerAddFailed((message: SentMessage) => {
        setMessages((current) => {
          // Update the existing optimistic bubble (matched by temp id) to
          // failed, or append if it is not present yet.
          const index = current.findIndex((m) => m.id === message.id);
          if (index >= 0) {
            const next = [...current];
            next[index] = message;
            return next;
          }
          return [...current, message];
        });
      });
    }
  }, [registerAddFailed]);

  // ⚡ RECONNECT CATCH-UP: merges the newest server rows after a Realtime
  // reconnect (Broadcast does not replay what was missed while offline). Rows
  // already rendered are ignored unless they were edited or tombstoned while we
  // were away, so this is idempotent and also repairs missed UPDATEs.
  useEffect(() => {
    if (!registerSyncLatest) return;

    registerSyncLatest((rows: SentMessage[]) => {
      const rendered = new Map(
        currentMessagesRef.current.map((message) => [message.id, message]),
      );
      const time = (value: Date | string | null | undefined) =>
        value ? new Date(value).getTime() : 0;

      const missing: SentMessage[] = [];
      const changed: SentMessage[] = [];

      for (const row of rows) {
        const existing = rendered.get(row.id);
        if (!existing) {
          missing.push(row);
          continue;
        }
        if (
          time(existing.editedAt) !== time(row.editedAt) ||
          Boolean(existing.isDeleted) !== Boolean(row.isDeleted)
        ) {
          changed.push(row);
        }
      }

      if (missing.length === 0 && changed.length === 0) return false;

      setMessages((current) => {
        let next = current;
        for (const row of changed) next = applyMessageUpdate(next, row);
        for (const row of missing) next = appendMessage(next, row);
        return next;
      });
      return true;
    });
  }, [registerSyncLatest]);

  // ⚡ EDITS + TOMBSTONES: the conversation page forwards the Realtime
  // `UPDATE` broadcast here. A deleted message renders as a tombstone with an
  // empty body, every bubble quoting it flips its preview, and an edited body
  // refreshes the quotes too — same behaviour the removed `postgres_changes`
  // UPDATE listener had, minus the channel.
  useEffect(() => {
    if (!registerUpdate) return;

    registerUpdate((row: MessageRow) => {
      setMessages((current) => applyMessageUpdate(current, row));
    });
  }, [registerUpdate]);

  // ⚡ ISSUE 4: Offline outbox — retry a pending/failed message.
  const retryMessage = useCallback(
    async (message: SentMessage) => {
      setMessages((current) =>
        current.map((m) =>
          m.id === message.id ? { ...m, status: "sending" } : m,
        ),
      );

      try {
        const formData = new FormData();
        formData.append("body", message.body);
        if (message.replyToId) formData.append("replyToId", message.replyToId);
        const result = await sendMessage(conversationId, formData);
        if (result && "success" in result && result.success === false) {
          removePendingMessage(conversationId, message.id);
          setMessages((current) =>
            current.map((m) =>
              m.id === message.id
                ? { ...m, status: "failed", retryable: false }
                : m,
            ),
          );
          onMessageRejected?.(result.code);
          toast(result.error, "error");
          return;
        }

        // Confirmed by the server → safe to drop from the local outbox.
        removePendingMessage(conversationId, message.id);

        const created = result as SentMessage;
        setMessages((current) =>
          current.map((m) =>
            m.id === message.id ? { ...created, status: "sent" as const } : m,
          ),
        );
      } catch {
        updatePendingMessageStatus(conversationId, message.id, "FAILED");
        setMessages((current) =>
          current.map((m) =>
            m.id === message.id ? { ...m, status: "failed" } : m,
          ),
        );
        toast("Still offline — message will be retried.", "error");
      }
    },
    [conversationId, onMessageRejected, toast],
  );

  // ⚡ ISSUE 4: Rehydrate pending/failed messages after a refresh while
  // offline, and auto-flush the queue when connectivity returns.
  useEffect(() => {
    if (!user) return;

    // A queued entry can be stale even though its send succeeded: the row
    // committed but the Server Action response never arrived (reload, dropped
    // connection, navigated away). Retrying it would insert the same text a
    // second time. Anything already in the loaded thread is dropped from the
    // outbox instead of being hydrated next to its confirmed copy.
    const outbox = getOutboxForConversation(conversationId).filter(
      (pending) => {
        if (
          isPendingMessageDelivered(pending, currentMessagesRef.current)
        ) {
          removePendingMessage(conversationId, pending.id);
          return false;
        }
        return true;
      },
    );

    // A send this tab is still awaiting must not be retried by the `online`
    // listener; that would post the same message twice.
    const inFlightIds = new Set(
      currentMessagesRef.current
        .filter((message) => message.status === "sending")
        .map((message) => message.id),
    );

    if (outbox.length > 0) {
      const hydrated: SentMessage[] = outbox.map((pending) => {
        // Restore the quoted snapshot so the bubble renders the quote header.
        const quoted = pending.replyToId
          ? currentMessagesRef.current.find((m) => m.id === pending.replyToId)
          : undefined;
        return {
          id: pending.id,
          body: pending.body,
          createdAt: pending.createdAt,
          senderId: pending.senderId,
          conversationId: pending.conversationId,
          status: pending.status === "PENDING" ? "sending" : "failed",
          replyToId: pending.replyToId,
          sender: {
            id: pending.senderId,
            name: pending.senderName,
            handle: pending.senderHandle,
            avatarUrl: pending.senderAvatarUrl,
          },
          replyTo: quoted
            ? {
                id: quoted.id,
                body: quoted.body,
                isDeleted: quoted.isDeleted ?? false,
                sender: {
                  id: quoted.sender.id,
                  name: quoted.sender.name,
                  handle: quoted.sender.handle,
                },
              }
            : null,
        };
      });
      setMessages((current) => {
        const existing = new Set(current.map((m) => m.id));
        return [...current, ...hydrated.filter((m) => !existing.has(m.id))];
      });

      // Anything still PENDING never reached the server — retry it now. Entries
      // already in flight in this tab are left to their own request.
      outbox
        .filter((p) => p.status === "PENDING" && !inFlightIds.has(p.id))
        .forEach((p) =>
          retryMessage({ ...hydrated.find((h) => h.id === p.id)! }),
        );
    }

    const handleOnline = () => {
      const queue = getOutboxForConversation(conversationId);
      queue
        .filter((pending) => !inFlightIds.has(pending.id))
        .forEach((pending) => {
          retryMessage({
            id: pending.id,
            body: pending.body,
            createdAt: pending.createdAt,
            senderId: pending.senderId,
            conversationId: pending.conversationId,
            status: "failed",
            replyToId: pending.replyToId,
            sender: {
              id: pending.senderId,
              name: pending.senderName,
              handle: pending.senderHandle,
              avatarUrl: pending.senderAvatarUrl,
            },
          });
        });
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, user?.id]);

  // ⚡ ISSUE 6: Optimistic edit/delete handlers.
  const handleEdit = useCallback(
    async (messageId: string, newBody: string) => {
      const previous = messages.find((m) => m.id === messageId);
      // Optimistic UI: update instantly, reconcile with the server result.
      setMessages((current) =>
        current.map((m) =>
          m.id === messageId
            ? { ...m, body: newBody, editedAt: new Date() }
            : m,
        ),
      );
      const result = await editMessage(messageId, newBody);
      if (result && "error" in result) {
        if (previous) {
          setMessages((current) =>
            current.map((m) => (m.id === messageId ? previous : m)),
          );
        }
        toast(result.error ?? "Could not edit the message.", "error");
        return false;
      }
      return true;
    },
    [messages, toast],
  );

  const handleDelete = useCallback(
    async (messageId: string) => {
      const previous = messages.find((m) => m.id === messageId);
      // Optimistic UI: tombstone instantly.
      setMessages((current) =>
        current.map((m) =>
          m.id === messageId ? { ...m, isDeleted: true, body: "" } : m,
        ),
      );
      const result = await deleteMessage(messageId);
      if (result && "error" in result) {
        // A rejected delete must not leave the tombstone on screen until the
        // next refresh silently reverts it.
        if (previous) {
          setMessages((current) =>
            current.map((m) => (m.id === messageId ? previous : m)),
          );
        }
        toast(result.error ?? "Could not delete the message.", "error");
        return false;
      }
      return true;
    },
    [messages, toast],
  );

  if (!user || !userId) return null;

  return (
    <div
      ref={containerRef}
      className="space-y-4 h-full overflow-y-auto px-0.5 sm:px-1.5"
    >
      {hasMore && (
        <div
          ref={observerTarget}
          className="flex h-8 w-full items-center justify-center"
        >
          {isLoadingMore ? (
            <span className="text-xs text-slate-400">
              Loading older messages...
            </span>
          ) : (
            <span className="text-xs text-slate-500">
              Scroll up to load older messages
            </span>
          )}
        </div>
      )}

      {messages.map((message) => (
        <MessageItem
          key={message.id}
          message={message}
          currentUserId={userId}
          otherParticipantLastReadAt={otherParticipantLastReadAt}
          onEdit={handleEdit}
          onDelete={handleDelete}
          canManage={canManageMessages}
          onRetry={retryMessage}
          onSetReplyingTo={onSetReplyingTo}
        />
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
}
