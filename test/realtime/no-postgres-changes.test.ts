/**
 * Postgres Changes guard.
 *
 * Messaging moved from `postgres_changes` to Broadcast from Database
 * (`supabase/realtime/broadcast-messages.sql`). Two properties make this a real
 * constraint rather than a style preference:
 *
 *  COST. Per Supabase: "Postgres Changes authorizes every event against each
 *  subscriber. When you make a single change to a table with 100 subscribed
 *  users, Realtime performs 100 authorization checks - one per user." The app
 *  previously subscribed to `Message` INSERT with no filter and to
 *  `ConversationParticipant` UPDATE with no filter, so every write to those
 *  tables was authorized against, and pushed to, every connected browser.
 *
 *  SECURITY. `postgres_changes` is authorized against app-table RLS — which
 *  Prisma bypasses entirely (it connects as the Supabase `postgres` role), so
 *  those policies protect the Realtime edge only. Broadcast has its own,
 *  participant-scoped authorization, and it is the one this app now relies on.
 *
 * Reintroducing a `postgres_changes` subscription is not automatically wrong —
 * a narrowly filtered one on a small table is fine — but it needs to be a
 * deliberate decision with a filter, so this test names the two that would
 * reintroduce the table-wide fan-out.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

const sources = walk(SRC);

function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

describe("no table-wide Postgres Changes subscriptions", () => {
  it("has a meaningful source tree to scan", () => {
    expect(sources.length).toBeGreaterThan(100);
  });

  it("subscribes to Message exactly once, on a private RLS-scoped channel", () => {
    // The thread is Broadcast from Database on `conversation:<id>`. The unread
    // badge is the one remaining Postgres Changes subscription: it needs every
    // conversation the user is in, not just the one open, and the per-recipient
    // `user:<id>` Broadcast topic never delivered. Two earlier attempts at that
    // topic are recorded in the commit history; do not retry it blindly.
    //
    // Safety rests on two things, both asserted here:
    //   1. it is joined through `privateChannel`, so `private: true` and a
    //      dashboard "Allow public access" toggle cannot break it, and
    //   2. RLS policy "participants read their conversations" scopes delivery to
    //      the subscriber's own conversations, so it is not a table-wide fan-out.
    const subscribers = sources
      .filter((file) =>
        /table:\s*["']Message["']/.test(code(readFileSync(file, "utf8"))),
      )
      .map((file) => relative(ROOT, file));

    expect(subscribers).toEqual([
      join("src", "components", "layout", "Sidebar.tsx"),
    ]);

    const sidebar = code(
      readFileSync(join(ROOT, "src/components/layout/Sidebar.tsx"), "utf8"),
    );
    expect(sidebar).toContain("privateChannel(");
    expect(sidebar).not.toMatch(/supabase\s*\.\s*channel\s*\(/);

    const sql = readFileSync(
      join(ROOT, "supabase/realtime/broadcast-messages.sql"),
      "utf8",
    );
    expect(sql).toMatch(/create policy "participants read their conversations"/);
    expect(sql).toMatch(
      /"participants read their conversations"[\s\S]*?"conversationId" = "Message"\."conversationId"[\s\S]*?auth\.uid\(\)::text/,
    );
  });

  it("no longer subscribes to ConversationParticipant changes", () => {
    // Read state is carried by the `read-receipt` broadcast on the conversation
    // channel, and the inbox zeroes counts from the `conversation-read` window
    // event, so this listener was redundant as well as unfiltered.
    const offenders = sources
      .filter((file) =>
        /table:\s*["']ConversationParticipant["']/.test(
          code(readFileSync(file, "utf8")),
        ),
      )
      .map((file) => relative(ROOT, file));

    expect(offenders).toEqual([]);
  });

  it("has no unfiltered postgres_changes subscription", () => {
    // Any remaining postgres_changes must carry a `filter`, otherwise Realtime
    // authorizes and delivers every row of the table to every subscriber — except
    // the badge, which is safe because RLS scopes it (asserted above).
    const unfiltered = sources
      .flatMap((file) => {
        const body = code(readFileSync(file, "utf8"));
        if (!body.includes("postgres_changes")) return [];
        if (
          relative(ROOT, file) === join("src", "components", "layout", "Sidebar.tsx")
        ) {
          return []; // RLS-scoped badge, asserted above
        }
        return body.includes("filter:")
          ? []
          : [`${relative(ROOT, file)} (no filter)`];
      })
      .filter(Boolean);

    expect(unfiltered).toEqual([]);
  });

  it("keeps participant-scoped SELECT policies on the messaging tables", () => {
    // Defence in depth. Prisma connects as the Supabase `postgres` role, which
    // has BYPASSRLS, so these do not protect a single server action — they exist
    // so that nothing reaching these tables through PostgREST or the anon key is
    // ever wide open.
    const sql = readFileSync(
      join(ROOT, "supabase/realtime/broadcast-messages.sql"),
      "utf8",
    );
    for (const policy of [
      "participants read own membership",
      "participants read their conversations",
      "participants read their conversation",
    ]) {
      expect(sql).toContain(`create policy "${policy}"`);
    }
  });

  it("no longer re-fetches a received message over the wire", () => {
    // The trigger now sends the curated row (sender + replyTo), which is what
    // let this per-received-message server action — one serverless invocation
    // plus one DB round-trip — be deleted.
    const offenders = sources
      .filter((file) => /getMessageDetails/.test(code(readFileSync(file, "utf8"))))
      .map((file) => relative(ROOT, file));

    expect(offenders).toEqual([]);
  });

  it("delivers an incoming message on exactly one path", () => {
    // The conversation page owns the only `conversation:<id>` channel and hands
    // INSERT to MessageList's registerAppend. A second `event: "message"`
    // broadcast would re-duplicate what the database trigger already published.
    const page = readFileSync(
      join(SRC, "app/messages/[conversationId]/page.tsx"),
      "utf8",
    );

    expect(code(page)).toContain('{ event: "INSERT" }');
    expect(code(page)).toContain('{ event: "UPDATE" }');
    expect(code(page)).not.toMatch(/event:\s*["']message["']/);
  });
});
