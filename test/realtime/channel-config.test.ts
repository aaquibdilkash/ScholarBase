/**
 * Realtime channel guard.
 *
 * Every Supabase Realtime channel in this app must be joined through
 * `privateChannel()` (src/lib/realtime.ts). Two separate things break if one
 * isn't, and neither produces an error:
 *
 *  1. SECURITY. App-table RLS does not govern Broadcast or Presence. Supabase
 *     authorizes those against the `realtime.messages` table, and only for
 *     channels joined with `private: true`. A `supabase.channel(topic)` call is
 *     public by default, so the message bodies, typing state and read receipts
 *     broadcast on `conversation:<id>` are readable — and spoofable — by anyone
 *     holding the public anon key who learns the topic id.
 *
 *  2. CORRECTNESS. `privateChannel` awaits `realtime.setAuth()` before joining.
 *     Without it the policies are evaluated as `anon` and are denied, which
 *     fails CLOSED and silently: the channel reports SUBSCRIBED and then
 *     receives nothing, which looks like latency rather than a bug.
 *
 * This is a source scan rather than a runtime assertion because the failure mode
 * is "the config object is missing a key", which no amount of mocking would
 * catch — the real config only exists at the join call.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");
const REALTIME_HELPER = join(SRC, "lib/realtime.ts");
const SQL = join(ROOT, "supabase/realtime/broadcast-messages.sql");

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

const sources = walk(SRC);

/** Strip comments so prose about `supabase.channel(` cannot trip the scan. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

describe("Realtime channels are private", () => {
  it("has a meaningful source tree to scan", () => {
    expect(sources.length).toBeGreaterThan(100);
  });

  it("only joins Broadcast/Presence through the realtime helper", () => {
    // `src/lib/realtime.ts` is the single sanctioned join site for anything
    // authorized against `realtime.messages`. A direct `supabase.channel()` is
    // still correct for a Postgres Changes subscription, which is authorized by
    // app-table RLS instead and does not need `private: true`.
    //
    // The unread badge is the one direct subscriber (src/components/layout/Sidebar.tsx).
    // It must therefore never publish Broadcast or Presence on that channel —
    // that would be an unauthorized public topic.
    const offenders: string[] = [];

    for (const file of sources) {
      if (file === REALTIME_HELPER) continue;
      const body = code(readFileSync(file, "utf8"));
      if (!/supabase\s*\.\s*channel\s*\(/.test(body)) continue;

      const relativePath = relative(ROOT, file);
      const usesPostgresChanges = body.includes("postgres_changes");
      const usesBroadcastOrPresence =
        /type:\s*["']broadcast["']/.test(body) ||
        /\.\s*track\s*\(/.test(body) ||
        /presenceState\s*\(/.test(body);

      if (!usesPostgresChanges || usesBroadcastOrPresence) {
        offenders.push(
          `${relativePath} — join Broadcast/Presence via privateChannel(), ` +
            `or keep the channel to postgres_changes only.`,
        );
      }
    }

    expect(offenders).toEqual([]);
  });

  it("forces private + setAuth inside the helper", () => {
    const helper = readFileSync(REALTIME_HELPER, "utf8");

    // Without `private: true` the topic is world-readable.
    expect(helper).toMatch(/private:\s*true/);
    // Without setAuth the policies are evaluated as `anon` and deny everything.
    expect(helper).toMatch(/realtime\.setAuth\(/);
    // Defaults must not be overridable back to public by a caller.
    expect(helper).toMatch(/broadcast:\s*\{\s*self:\s*false\s*\}/);
  });

  it("names topics so they match the SQL authorization policy", () => {
    const helper = readFileSync(REALTIME_HELPER, "utf8");
    const sql = readFileSync(SQL, "utf8");

    // Each helper topic prefix must have a branch in the `case` expression, or
    // the policy's `else false` denies it and the topic silently receives nothing.
    for (const prefix of ["conversation", "presence"]) {
      expect(helper).toContain(`${prefix}:`);
      expect(sql).toMatch(new RegExp(`when '${prefix}'`));
    }

    // The trigger must publish to the same message topics the client joins.
    expect(sql).toContain("'conversation:' || NEW.\"conversationId\"");
  });

  it("documents the ConversationParticipant policy the realtime policy depends on", () => {
    const sql = readFileSync(SQL, "utf8");
    // The `realtime.messages` policies do a membership lookup on this table; that
    // subquery is itself RLS-filtered, and without this policy the whole
    // messaging feature fails closed with no error. See section 3 of the SQL.
    expect(sql).toMatch(/create policy "participants read own membership"/);
    expect(sql).toMatch(
      /"participants read own membership"[\s\S]*?"userId" = \(select auth\.uid\(\)::text\)/,
    );
  });

  it("gives every channel topic a matching authorization branch", () => {
    // THE BUG THIS EXISTS TO PREVENT.
    //
    // `realtime.messages` policies end in `else false`, so any topic prefix not
    // listed in the `case` is DENIED — and a denied private channel cannot join
    // at all. Nothing errors, the channel never reaches SUBSCRIBED, and the
    // feature is simply dead.
    //
    // That is what killed the unread badge: it once used `user:<id>`, then
    // `badge-messages:<id>`, and neither prefix was ever added to the SQL. Three
    // failed attempts, all of which looked identical from the browser.
    //
    // So: collect the topic prefixes the client actually joins and require a
    // branch for each.
    const sql = readFileSync(SQL, "utf8");
    const branches = new Set(
      [...sql.matchAll(/when '([^']+)'/g)].map((m) => m[1]),
    );

    const expected = new Set(["conversation", "user", "presence"]);

    for (const prefix of expected) {
      expect(branches).toContain(prefix);
      expect(sql).toContain(`${prefix}:`);
    }

    // And the reverse: no branch may exist for a topic nothing joins.
    for (const branch of branches) {
      expect(expected).toContain(branch);
    }

    // The client must not join a prefix the policy cannot see. Only topic-shaped
    // template literals count — `private: true` in the channel config is not one.
    const helper = readFileSync(REALTIME_HELPER, "utf8");
    const joined = new Set(
      [...helper.matchAll(/`([a-z][a-z-]*):(?:\$\{|global)/g)].map((m) => m[1]),
    );

    expect(joined.size).toBeGreaterThan(0);
    for (const prefix of joined) {
      expect(branches).toContain(prefix);
    }

    // The badge channel is built inline in Sidebar.tsx rather than in the helper.
    const sidebar = code(
      readFileSync(join(ROOT, "src/components/layout/Sidebar.tsx"), "utf8"),
    );
    for (const [, prefix] of sidebar.matchAll(/privateChannel\(`([a-z-]+):/g)) {
      expect(branches).toContain(prefix);
    }
  });

  it("casts auth.uid() to text everywhere it meets an id column", () => {
    // `auth.uid()` returns uuid, but `User.id` and `ConversationParticipant.userId`
    // are `String` (text) columns holding the Supabase auth id verbatim — see the
    // User model and src/lib/users.ts. Comparing them uncast is
    //   ERROR 42883: operator does not exist: text = uuid
    // which aborts the whole script. Every occurrence must keep the cast.
    const sql = code(readFileSync(SQL, "utf8")).replace(/--[^\n]*/g, "");

    const calls = [...sql.matchAll(/auth\.uid\(\)(\s*::\s*\w+)?/g)];
    expect(calls.length).toBeGreaterThanOrEqual(5);

    const uncasted = calls.filter(([, cast]) => !cast);
    expect(uncasted).toEqual([]);
  });
});
