-- =============================================================================
-- ScholarBase — Realtime Broadcast from Database (messaging)
-- =============================================================================
-- WHY THIS IS NOT A PRISMA MIGRATION
--   The `realtime` schema and `realtime.send()` only exist inside Supabase. The
--   CI integration job applies `prisma migrate deploy` to a plain Postgres 17
--   container, so putting this there would break the moment an integration test
--   lands. Supabase-only DDL lives in this folder and is run from the Supabase
--   SQL Editor, exactly like src/app/api/cron/update-trending/update-trending.md.
--
-- WHY THIS EXISTS (the "broadcasting everything" problem)
--   The client subscribed to `postgres_changes` on `Message` with NO filter
--   (Sidebar.tsx) and on `ConversationParticipant` with NO filter
--   (MessagesClientLayout.tsx). Per Supabase's own docs: "When you make a single
--   change to a table with 100 subscribed users, Realtime performs 100
--   authorization checks - one per user." Cost scaled with subscriber count, not
--   write rate, and every message in the database was pushed to every connected
--   browser just to be discarded client-side.
--
--   Broadcast from Database sends each change ONCE and fans it out, and moves
--   authorization to one place: RLS on `realtime.messages`, scoped to the
--   participants of the conversation that owns the topic.
--
-- TOPIC SCHEME
--   conversation:<conversationId>  messages (INSERT/UPDATE), typing,
--                                 read receipts, block/unblock
--   user:<userId>                 unread badge / inbox ping
--   presence:global               online status
--
-- All three are joined with `private: true` (src/lib/realtime.ts), so disabling
-- "Allow public access" in Realtime Settings is safe once the app is deployed.
--
-- ROLLBACK IS AT THE BOTTOM OF THIS FILE. See README.md for the cutover order.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Message -> Broadcast
-- -----------------------------------------------------------------------------
-- Uses `realtime.send(payload jsonb, event text, topic text, is_private boolean)`.
--
-- Two deliberate choices:
--   a) The payload is CURATED, not the raw row. The client used to call the
--      `getMessageDetails` server action on every received message just to fill in
--      `sender` and `replyTo`. Building it here removes one serverless invocation
--      and one DB round-trip per received message.
--   b) A per-recipient `user:<id>` ping carries the unread badge: one tiny row
--      per recipient instead of a table subscription every browser must be
--      authorized against on every message write.
create or replace function public.broadcast_new_message()
returns trigger
security definer
set search_path = public, pg_temp
language plpgsql
as $$
declare
  -- Required: PL/pgSQL needs the loop variable declared as a record to iterate
  -- `FOR ... IN <query>`. Omitting it fails at CREATE time with
  --   42601: loop variable of loop over rows must be a record variable
  recipient record;
begin
  perform realtime.send(
    jsonb_strip_nulls(jsonb_build_object(
      'id',             NEW.id,
      'conversationId', NEW."conversationId",
      'senderId',       NEW."senderId",
      'body',           NEW.body,
      -- Explicit ISO-8601 UTC. A bare timestamptz in jsonb renders as
      -- "2026-10-04 12:00:00+00", which is locale/parser dependent.
      'createdAt',      to_char(NEW."createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'editedAt',       case when NEW."editedAt" is null then null
                            else to_char(NEW."editedAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
                       end,
      'isDeleted',      coalesce(NEW."isDeleted", false),
      'replyToId',      NEW."replyToId",
      'sender',         (
                          select jsonb_build_object(
                                   'id', u.id, 'name', u.name,
                                   'handle', u.handle, 'avatarUrl', u."avatarUrl")
                          from "User" u where u.id = NEW."senderId"
                        ),
      'replyTo',        (
                          select jsonb_build_object(
                                   'id', m.id, 'body', m.body,
                                   'isDeleted', coalesce(m."isDeleted", false),
                                   'sender', jsonb_build_object(
                                             'id', su.id, 'name', su.name, 'handle', su.handle))
                          from "Message" m
                          join "User" su on su.id = m."senderId"
                          where m.id = NEW."replyToId"
                        )
    )),
    TG_OP,                                       -- 'INSERT' | 'UPDATE'
    'conversation:' || NEW."conversationId",
    true                                         -- private topic
  );

  -- Unread badge: one small ping per recipient, sender excluded. Same
  -- realtime.send() path and same private-topic authorization as the message
  -- above, just on the per-user topic that Sidebar subscribes to.
  for recipient in
    select cp."userId"
    from "ConversationParticipant" cp
    where cp."conversationId" = NEW."conversationId"
      and cp."userId" <> NEW."senderId"
  loop
    perform realtime.send(
      jsonb_build_object(
        'conversationId', NEW."conversationId",
        'id',             NEW.id,
        'senderId',       NEW."senderId",
        'senderName',     (select u.name from "User" u where u.id = NEW."senderId"),
        'body',           NEW.body,
        'createdAt',      to_char(NEW."createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      ),
      TG_OP, 'user:' || recipient."userId", true
    );
  end loop;

  return null;
end;
$$;

comment on function public.broadcast_new_message() is
  'Broadcasts Message inserts/updates to private per-conversation and per-recipient Realtime topics.';

drop trigger if exists broadcast_new_message_trigger on public."Message";

create trigger broadcast_new_message_trigger
after insert or update on public."Message"
for each row execute function public.broadcast_new_message();
-- No DELETE branch on purpose: messages are tombstoned (`isDeleted` -> UPDATE),
-- never hard-deleted.

-- -----------------------------------------------------------------------------
-- 2. Realtime Authorization
-- -----------------------------------------------------------------------------
-- App-table RLS does NOT govern Broadcast/Presence. Only channels joined with
-- `private: true` are checked, and only against `realtime.messages`.
--
-- Do NOT add `alter table realtime.messages enable row level security;` — RLS is
-- already on there and Postgres aborts the whole transaction with 42501 "must be
-- owner of table messages", skipping every later statement.
--
-- ⚠️ `auth.uid()::text` IS LOAD-BEARING, DO NOT DROP THE CAST.
-- `auth.uid()` returns uuid, but `User.id` and `ConversationParticipant.userId`
-- are `String` (text) columns that store the Supabase auth id verbatim
-- (`prisma.user.create({ data: { id: user.id } })` in src/lib/users.ts). Comparing
-- them uncast fails with:
--     ERROR 42883: operator does not exist: text = uuid
-- The cast also keeps the `(select ...)` wrapper that lets Postgres cache the
-- value per statement instead of re-evaluating it per row.
drop policy if exists "chat participants can read broadcasts" on realtime.messages;
drop policy if exists "chat participants can send broadcasts" on realtime.messages;

create policy "chat participants can read broadcasts"
on realtime.messages
for select
to authenticated
using (
  case split_part(realtime.topic(), ':', 1)
    when 'conversation' then exists (
      select 1 from public."ConversationParticipant" cp
      where cp."conversationId" = split_part(realtime.topic(), ':', 2)
        and cp."userId" = (select auth.uid()::text)
    )
    when 'user'     then split_part(realtime.topic(), ':', 2) = (select auth.uid()::text)
    when 'presence' then true
    else false
  end
);

create policy "chat participants can send broadcasts"
on realtime.messages
for insert
to authenticated
with check (
  case split_part(realtime.topic(), ':', 1)
    when 'conversation' then exists (
      select 1 from public."ConversationParticipant" cp
      where cp."conversationId" = split_part(realtime.topic(), ':', 2)
        and cp."userId" = (select auth.uid()::text)
    )
    when 'user'     then split_part(realtime.topic(), ':', 2) = (select auth.uid()::text)
    when 'presence' then true
    else false
  end
);

-- -----------------------------------------------------------------------------
-- 3. THE ONE THAT SILENTLY BREAKS EVERYTHING IF MISSED
-- -----------------------------------------------------------------------------
-- The policies above run as `authenticated` while Realtime evaluates them, so
-- their subquery on "ConversationParticipant" is ITSELF subject to that table's
-- RLS. If RLS is enabled there with no policy for the authenticated role, the
-- subquery returns zero rows, the policy denies everything, and Realtime
-- silently delivers NOTHING while still reporting SUBSCRIBED. That reads as
-- "messages take a while to arrive" rather than as an error.
--
-- This policy is a prerequisite of section 2, not an optimisation.
--
-- `(select auth.uid()::text)` is wrapped in a sub-select on purpose: Supabase caches it
-- per statement instead of re-evaluating it per row.
drop policy if exists "participants read own membership" on public."ConversationParticipant";

create policy "participants read own membership"
on public."ConversationParticipant"
for select
to authenticated
using ("userId" = (select auth.uid()::text));

-- -----------------------------------------------------------------------------
-- 4. Optional defence in depth
-- -----------------------------------------------------------------------------
-- Prisma connects as the Supabase `postgres` role, which has BYPASSRLS, so these
-- two policies do NOT protect a single server action. They exist so that if any
-- surface ever reaches the table through PostgREST or the anon key, it is still
-- participant-scoped rather than wide open. They cannot affect Prisma.
drop policy if exists "participants read their conversations" on public."Message";
drop policy if exists "participants read their conversation" on public."Conversation";

create policy "participants read their conversations"
on public."Message"
for select
to authenticated
using (
  exists (
    select 1 from public."ConversationParticipant" cp
    where cp."conversationId" = "Message"."conversationId"
      and cp."userId" = (select auth.uid()::text)
  )
);

create policy "participants read their conversation"
on public."Conversation"
for select
to authenticated
using (
  exists (
    select 1 from public."ConversationParticipant" cp
    where cp."conversationId" = "Conversation".id
      and cp."userId" = (select auth.uid()::text)
  )
);

-- =============================================================================
-- CUTOVER ORDER (see README.md — step 4 alone breaks messaging)
--   1. Run this whole file in the Supabase SQL Editor.
--   2. Deploy the app. All channels are joined `private: true`, messages arrive
--      over Broadcast, and no `postgres_changes` subscription is left in the
--      client.
--   3. Verify with two accounts.
--   4. Dashboard -> Realtime Settings -> disable "Allow public access".
--   5. Stop paying for Postgres Changes replication of tables nothing reads:
--        alter publication supabase_realtime drop table "Message", "ConversationParticipant";
-- =============================================================================

-- =============================================================================
-- ROLLBACK
-- =============================================================================
--   drop trigger if exists broadcast_new_message_trigger on public."Message";
--   drop function if exists public.broadcast_new_message();
--   drop policy if exists "chat participants can read broadcasts" on realtime.messages;
--   drop policy if exists "chat participants can send broadcasts" on realtime.messages;
--   alter publication supabase_realtime add table "Message", "ConversationParticipant";
--   -- and re-enable "Allow public access" in the dashboard.
