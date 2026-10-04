# Realtime — messaging transport

Chat delivery is **Broadcast from Database** on **private** channels. This folder
owns the database half; `src/lib/realtime.ts` owns the client half.

| Concern | Where |
|---|---|
| Message → Realtime trigger, `realtime.messages` RLS | `broadcast-messages.sql` |
| Private channel factory, topic naming | `src/lib/realtime.ts` |

## Why not `postgres_changes`

Per Supabase's docs: *"Postgres Changes authorizes every event against each
subscriber. When you make a single change to a table with 100 subscribed users,
Realtime performs 100 authorization checks — one per user."*

The client used to subscribe to `Message` INSERT with **no filter** (`Sidebar.tsx`)
and `ConversationParticipant` UPDATE with **no filter** (`MessagesClientLayout.tsx`),
so every message in the database was authorized against, and pushed to, every
connected browser — then discarded in the client. Broadcast sends each change once
and fans it out.

## Topics

| Topic | Carries | Authorization |
|---|---|---|
| `conversation:<conversationId>` | messages (`INSERT`/`UPDATE`), typing, read receipts, block/unblock | participant of that conversation |
| `user:<userId>` | unread-badge / inbox ping | `auth.uid()` matches the topic |
| `presence:global` | online status | any authenticated user |

`conversationId` values are cuids, so they contain no `:` — the policies can split
the topic with `split_part(topic, ':', 2)`.

## Apply

1. Run `broadcast-messages.sql` in the **Supabase SQL Editor**.
2. Deploy the app. Channels are already `private: true` and no `postgres_changes`
   subscription remains, so messages arrive over Broadcast.
3. Verify (below).
4. Dashboard → **Realtime Settings** → disable **Allow public access**.
   *This is what enforces private channels.* Doing it before step 2, or while any
   channel is still public, breaks messaging.
5. Optional, once 3 and 4 are confirmed — both tables can now be dropped,
   because **no client code subscribes to Postgres Changes any more**:
   ```sql
   alter publication supabase_realtime drop table "Message", "ConversationParticipant";
   ```
   Message delivery is a trigger on `realtime.messages`, not WAL decoding of
   `Message`, so nothing breaks. This is the step that would expose a missed
   subscriber, which is why it comes last.

## Verify

Two accounts, and one outsider:

- **Delivery** — A sends in conversation X, B has it open: appears once, immediately.
  Same with B in another tab and the conversation *not* open (badge increments).
- **Fan-out** — Realtime Inspector shows **one** message event per recipient.
- **Edits and tombstones** — A edits and A deletes; both update B's thread live.
- **Still working** — typing indicator, read receipts, online dot, block/unblock,
  offline outbox retry.
- **Authorization (the point of the exercise)** — third account, browser console:
  ```js
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)  // signed in as C
  await sb.realtime.setAuth()
  sb.channel('conversation:<A-and-B-conversation-id>', { config: { private: true } })
    .on('broadcast', { event: 'INSERT' }, p => console.log('LEAK', p))
    .subscribe()
  ```
  C must see **nothing**. C must also see nothing on `user:<A-id>`.
- **Load** — no `tenant_events` disconnects under a burst (free tier: 100 msg/s).

## Rollback

The statements are in the commented block at the bottom of `broadcast-messages.sql`.
Re-enable "Allow public access" in the dashboard too.

## Related

`ConversationParticipant` needs its own SELECT policy for `authenticated`. The
`realtime.messages` policies do a membership lookup on it, that subquery is itself
RLS-filtered, and without the policy they deny everything **silently** — the channel
reports `SUBSCRIBED` and then receives nothing, which looks like latency rather
than an error. Section 3 of the SQL file handles this and explains why.
