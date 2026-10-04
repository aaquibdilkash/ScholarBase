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
 * Authorization docs, those are authorized against the `realtime.messages` table
 * instead, and only for channels joined with `private: true`. A bare
 * `supabase.channel(topic)` is PUBLIC by default, so on a public channel the
 * message body broadcast by a participant is readable by anyone holding the anon
 * key who learns the topic id.
 *
 * Every Realtime channel in this app goes through here, so "private" is the
 * default rather than something a new feature can forget.
 *
 * ⚠️ WHY THIS AWAITS THE SESSION — READ BEFORE SIMPLIFYING IT
 *
 * `await supabase.realtime.setAuth()` with no argument is NOT enough, and the
 * difference between the two is invisible until it is catastrophic.
 *
 * Realtime evaluates the `realtime.messages` policies as the user in the access
 * token it holds. If the token is missing, it evaluates them as `anon`, and
 * `auth.uid()` is null, so `split_part(topic,':',2) = auth.uid()::text` is
 * false and the `else false` fallback denies the join. A denied channel does not
 * raise: it simply never reaches SUBSCRIBED and receives nothing. No console
 * error, no server log — the feature is just dead.
 *
 * That is not hypothetical. It silently killed the unread badge, which was
 * written to join `user:<id>` from `Sidebar`. Sidebar receives `user` as a
 * SERVER PROP (src/app/layout.tsx), so `user.id` is present on the very first
 * render — while supabase-js may still be restoring the session from cookies.
 * Every other subscriber in the app (`PresenceProvider`, the conversation page)
 * gates on `supabase.auth.getUser()` and therefore waited, which is exactly why
 * `presence:` and `conversation:` worked and the badge never did.
 *
 * So: resolve the session explicitly and hand Realtime the token. Passing the
 * token rather than relying on the implicit accessor is what removes the race.
 *
 * The topic prefix is part of the contract with
 * `supabase/realtime/broadcast-messages.sql`, which maps each prefix
 * (`conversation:`, `user:`, `presence:`) to a participant-scoped policy branch.
 * An unlisted prefix hits `else false` and is denied exactly as above, so
 * `test/realtime/channel-config.test.ts` asserts the two stay in step.
 */
export async function privateChannel(
  topic: string,
  config: RealtimeChannelOptions["config"] = {},
): Promise<RealtimeChannel> {
  const { data } = await supabase.auth.getSession();
  await supabase.realtime.setAuth(data.session?.access_token);

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
 * Topic carrying one user's unread-badge pings across ALL of their conversations.
 * One ping per recipient per message — the same mechanism as `conversation:`, so
 * it is authorized by the same kind of policy and has the same delivery.
 */
export const userTopic = (userId: string) => `user:${userId}`;

/** Topic carrying online status. */
export const PRESENCE_TOPIC = "presence:global";

/**
 * Creates the private channel SYNCHRONOUSLY.
 *
 * ⚠️ Prefer this over awaiting `privateChannel()` inside an effect.
 *
 * An effect that awaits before assigning its channel cannot clean up after
 * itself: React runs the cleanup while the await is still pending, the channel
 * arrives into an already-dead branch, and it is discarded without ever joining.
 * That failure is silent — the channel reports no status, no error is logged, and
 * the feature simply never receives anything. It is exactly what killed the
 * unread badge, which built its channel through the async path from an effect
 * gated on the server-rendered `user` prop.
 *
 * Creating the channel synchronously and subscribing inside `withRealtimeAuth`
 * keeps the two guarantees the effect needs:
 *   - the channel reference exists before cleanup runs, so teardown always works
 *   - the access token is set before `subscribe()`, so a private join is authorized
 *
 * Still pass the `cancelled` flag to `withRealtimeAuth`; it is what prevents a
 * late-arriving subscribe from reviving a torn-down channel.
 */
export function privateChannelSync(
  topic: string,
  config: RealtimeChannelOptions["config"] = {},
): RealtimeChannel {
  return supabase.channel(topic, {
    config: {
      private: true,
      broadcast: { self: false },
      ...config,
    },
  });
}

/**
 * Resolves the session and sets Realtime's access token, then runs `fn`.
 *
 * See `privateChannel` for why the token must be explicit: without it the
 * private channel is authorized as `anon`, `auth.uid()` is null, and the
 * `realtime.messages` policy's `else false` denies the join in silence.
 */
export async function withRealtimeAuth(fn: () => void): Promise<void> {
  const { data } = await supabase.auth.getSession();
  await supabase.realtime.setAuth(data.session?.access_token);
  fn();
}
