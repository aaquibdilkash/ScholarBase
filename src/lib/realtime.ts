import { supabase } from "@/utils/supabase/client";
import type {
  RealtimeChannel,
  RealtimeChannelOptions,
} from "@supabase/supabase-js";

/**
 * Joins a PRIVATE Supabase Realtime channel.
 *
 * ⚡ WHY THIS HELPER EXISTS
 *
 * App-table RLS does NOT govern Broadcast or Presence. Per Supabase's Realtime
 * Authorization docs, those features are authorized against the `realtime.messages`
 * table instead — and only for channels the client joins with `private: true`.
 * A `supabase.channel(topic)` call is PUBLIC by default, so on a public channel the
 * message body broadcast by a participant is readable by anyone holding the anon
 * key who can guess or learn the topic name.
 *
 * Every Realtime channel in this app goes through here so that "private" is the
 * default rather than something a new feature can forget.
 *
 * `realtime.setAuth()` must resolve before the channel joins, because Realtime
 * evaluates those policies as the signed-in user (via their JWT), not as `anon`.
 * supabase-js also syncs the token on auth-state changes; calling it here makes the
 * ordering explicit at the join point rather than incidental.
 *
 * The topic naming is part of the contract with
 * `supabase/realtime/broadcast-messages.sql`, which maps each topic prefix
 * (`conversation:`, `user:`, `presence:`) to a participant-scoped RLS policy.
 * Adding a new prefix without a matching policy fails closed: the channel reports
 * SUBSCRIBED and then silently receives nothing.
 *
 * `broadcast.self: false` keeps a client from receiving back the broadcast it just
 * sent. Message delivery deliberately ignores this — a sender with a second tab open
 * is deduped by message id in `MessageList`, which is the same behaviour it had when
 * delivery went through Postgres Changes.
 */
export async function privateChannel(
  topic: string,
  config: RealtimeChannelOptions["config"] = {},
): Promise<RealtimeChannel> {
  await supabase.realtime.setAuth();

  return supabase.channel(topic, {
    config: {
      private: true,
      broadcast: { self: false },
      ...config,
    },
  });
}

/** Topic carrying a conversation's messages, typing, receipts and block state. */
export const conversationTopic = (conversationId: string) =>
  `conversation:${conversationId}`;

/**
 * Topic carrying a user's unread-badge pings for ALL of their conversations.
 * Replaces a former unfiltered `postgres_changes` subscription on the whole
 * `Message` table.
 */
export const userTopic = (userId: string) => `user:${userId}`;

/** Topic carrying online status. */
export const PRESENCE_TOPIC = "presence:global";
