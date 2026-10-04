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

  it("has exactly one postgres_changes subscription, and it is RLS-scoped", () => {
    // The unread badge is the one deliberate exception. It stays on
    // `postgres_changes` because the Sidebar's effect keys on a `user` object prop
    // whose identity changes on every root-layout render (src/app/layout.tsx), so
    // a channel joined from there cannot be relied on to stay subscribed.
    //
    // It is safe because RLS policy "participants read their conversations" on
    // "Message" restricts delivery to the subscriber's own conversations, and
    // because that policy is installed by the same SQL file. Without it this
    // subscription would push every message in the database to every browser.
    const subscribers = sources
      .filter((file) => /table:\s*["']Message["']/.test(code(readFileSync(file, "utf8"))))
      .map((file) => relative(ROOT, file));

    expect(subscribers).toEqual([join("src", "components", "layout", "Sidebar.tsx")]);

    const sql = readFileSync(join(ROOT, "supabase/realtime/broadcast-messages.sql"), "utf8");
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

  it("has no other unfiltered postgres_changes subscription", () => {
    const unfiltered = sources
      .flatMap((file) => {
        const body = code(readFileSync(file, "utf8"));
        if (!body.includes("postgres_changes")) return [];
        if (relative(ROOT, file) === join("src", "components", "layout", "Sidebar.tsx")) {
          return []; // the RLS-scoped badge, asserted above
        }
        return body.includes("filter:") ? [] : [`${relative(ROOT, file)} (no filter)`];
      })
      .filter(Boolean);

    expect(unfiltered).toEqual([]);
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
