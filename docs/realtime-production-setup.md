# Production Supabase — Realtime messaging setup

Runbook for enabling the Broadcast-from-Database messaging transport on the
**production** Supabase project. Verified working on the dev project; the steps
are identical.

Everything below is in this repo:

| File | What it is |
|---|---|
| `supabase/realtime/broadcast-messages.sql` | the entire database half — trigger + RLS |
| `supabase/realtime/README.md` | design notes and the reasoning |
| `src/lib/realtime.ts` | the client half — `privateChannel()` + topic names |

The SQL file is **idempotent**: `create or replace function`, and `drop … if exists`
before every `create policy`. Re-running it over an existing install is safe.

---

## Step 1 — Run the SQL

**Supabase Dashboard → SQL Editor → New query.** Paste the entire contents of
`supabase/realtime/broadcast-messages.sql` and run it. Expect `Success`.

It creates:

- `broadcast_new_message()` — `AFTER INSERT OR UPDATE` trigger on `"Message"`,
  `SECURITY DEFINER`, that publishes to two private topics
- `"chat participants can read broadcasts"` / `"… can send broadcasts"` on
  `realtime.messages`
- `"participants read own membership"` on `"ConversationParticipant"`
- `"participants read their conversations"` / `"… their conversation"`
  (defence in depth only — Prisma has `BYPASSRLS`, so these do not protect a
  single server action)

> **Do not add `alter table realtime.messages enable row level security;`**
> RLS is already on there and the statement aborts the whole transaction with
> `42501 must be owner of table messages`, silently skipping every later
> statement. The file deliberately omits it.

> **`auth.uid()::text` is load-bearing.** `auth.uid()` returns `uuid` but
> `User.id` and `ConversationParticipant.userId` are `text` columns holding the
> Supabase auth id verbatim (`prisma.user.create({ data: { id: user.id } })` in
> `src/lib/users.ts`). Dropping the cast gives
> `ERROR 42883: operator does not exist: text = uuid`.

## Step 2 — Deploy the app

The client half must be live **before** Step 4. Until then the app still expects
public channels, and disabling public access will break messaging.

```bash
git push origin development    # verify here first
# then merge to main
git push origin main
```

## Step 3 — Verify (two accounts)

- **A** in the conversation, **B** on any other page (not `/messages/<id>`).
- A sends → **B**: message appears once in the thread, badge `+1`, toast with
  A's name. A's badge does not move.
- A edits, A deletes → B's thread updates live.
- Typing indicator, double-tick read receipts, online dot, block/unblock.
- Console on both: `Conversation realtime status: SUBSCRIBED`, no errors.

**Authorization check (third account C), browser console as C:**

```js
await sb.realtime.setAuth()
sb.channel('conversation:<A-and-B-conversation-id>', { config: { private: true } })
  .on('broadcast', { event: 'INSERT' }, p => console.log('LEAK', p))
  .subscribe()
```

C must receive **nothing**. Same for `user:<A-id>`.

## Step 4 — Enforce private channels

**Dashboard → Realtime → Settings → disable "Allow public access".**

This is the step that actually *enforces* the policies. It is safe only once
every channel is `private: true` — which `src/lib/realtime.ts` guarantees, and
which `test/realtime/channel-config.test.ts` enforces in CI. Before Step 2 is
live, this breaks messaging, because a public channel cannot join at all.

## Step 5 — Stop decoding WAL for tables nobody listens to (optional)

Only after Steps 3 and 4 are green:

```sql
alter publication supabase_realtime drop table "Message", "ConversationParticipant";
```

No client code subscribes to Postgres Changes any more — both the thread and the
unread badge are Broadcast from Database — so this is pure savings. It is also the
step that would expose a missed subscriber, hence last.

---

## Rollback

```sql
drop trigger if exists broadcast_new_message_trigger on public."Message";
drop function if exists public.broadcast_new_message();
drop policy if exists "chat participants can read broadcasts" on realtime.messages;
drop policy if exists "chat participants can send broadcasts" on realtime.messages;
alter publication supabase_realtime add table "Message", "ConversationParticipant";
```

Plus re-enable "Allow public access" in the dashboard.

## If messages arrive but the badge does not

The badge and the thread use the same mechanism now, so if the thread updates
live and the badge does not, the difference is **which component joins**, not
which transport.

`privateChannel()` in `src/lib/realtime.ts` resolves the session
(`supabase.auth.getSession()`) and hands Realtime the access token before joining.
That is load-bearing. `Sidebar` receives `user` as a **server prop**, so it renders
before supabase-js has restored the session from cookies; a private channel
joined without a token is authorized as `anon`, `auth.uid()` is null, and the
policy's `else false` denies the join — silently, with no console error and no
server log. `PresenceProvider` and the conversation page were unaffected because
they gate on `supabase.auth.getUser()` and therefore waited.

If the badge regresses again, check in this order:

1. `privateChannel()` still awaits `getSession()` before `setAuth()`.
2. The topic prefix the Sidebar joins has a `when '…'` branch in
   `broadcast-messages.sql` — an unlisted prefix is denied by `else false` and
   cannot join at all.
3. Browser console on the recipient: the Sidebar logs
   `Badge realtime status: <status>` for any non-`SUBSCRIBED` state.
