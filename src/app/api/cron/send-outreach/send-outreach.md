# `GET /api/cron/send-outreach`

Sends at most a few cold outreach emails per invocation, at a randomized pace,
to contacts that have never been contacted and have not opted out.

Protected by `verifyCronSecret()` (Bearer `CRON_SECRET`), exactly like the other
cron routes.

## Schedule it in Coolify

Every 20 minutes:

```bash
*/20 * * * *
```

Command (inline — `curl` is already in the runtime image):

```bash
curl -fsS --retry 2 --retry-delay 5 --max-time 60 \
  -H "Authorization: Bearer $CRON_SECRET" \
  "https://scholarbase.app/api/cron/send-outreach?limit=1"
```

The route randomizes timing through a probability roll, so the task command
stays a plain `curl`.

## Why the time is random

A long-running task that `sleep`s for hours holds a container slot, can overlap
the next run, and dies on redeploy. Instead the task is short and frequent:

1. it runs every 20 minutes;
2. inside the sending window it rolls the send probability (`0.4`, a constant in
   `src/lib/outreach/sender.ts`);
3. if the roll passes it picks **one** eligible contact and sends.

The gap between emails is therefore geometric (human-looking) with a 20-minute
floor, and no email is ever scheduled to a visible fixed minute.

## Eligibility

A candidate must satisfy every rule:

| Rule | Why |
|---|---|
| `status = PENDING` | Already-contacted/bounced/opted-out rows are never picked |
| `sendCount = 0` | Never contact an address twice from the automated path |
| `userId IS NULL` | A contact linked to an account is not cold outreach |
| `createdAt <= now - 24h` | A fresh import is not mailed immediately |
| email absent from `OutreachEmailUnsubscribe` | Opt-out always wins |
| email not in `User` | Existing members must not receive cold email |
| domain not already used today | 1 per university per day by default |

Candidates are fetched oldest-first (`orderBy createdAt asc`), which the
existing `[status, createdAt]` index covers. The list is shuffled in memory;
`ORDER BY random()` is never used.

## Guards

- **To pause outreach, pause or delete the Coolify task.** There is no env kill
  switch to forget about.
- Redis lock `cron:outreach:lock` (`SET NX PX 120000`) prevents overlapping runs
  from double-sending.
- Daily counter `cron:outreach:sent:{YYYY-MM-DD}` enforces the daily cap (`20`).
- Domain counter `cron:outreach:domain:{domain}:{YYYY-MM-DD}` enforces one email
  per recipient domain per day.
- Template rotation counter `cron:outreach:rotation:{YYYY-MM-DD}` walks the
  ten-variant library so consecutive sends never repeat copy.
- Redis unavailable → the run skips (writes fail closed, matching the app-wide
  policy). It never sends unguarded.

## Verify before enabling

```bash
curl -fsS \
  -H "Authorization: Bearer $CRON_SECRET" \
  "https://scholarbase.app/api/cron/send-outreach?dryRun=1"
```

`dryRun=1` ignores the probability roll and mutations, and reports the contact
that *would* be emailed:

```json
{
  "success": true,
  "sent": 0,
  "dryRun": true,
  "pending": 12,
  "dailySent": 0,
  "reason": "would_send",
  "contactId": "cm...",
  "template": "A note from ScholarBase"
}
```

Once it reports the contact you expect, create the Coolify schedule. To pause
outreach later, pause the task — the schedule is the only trigger.

`limit` is capped at 3 server-side; `1` is the intended production value.

## Response

```json
{
  "success": true,
  "sent": 1,
  "dryRun": false,
  "pending": 11,
  "dailySent": 4,
  "contactId": "cm...",
  "template": "ScholarBase for doctoral researchers"
}
```

A skipped run returns `sent: 0` plus a `reason`: `outside_window`,
`probability_skip`, `redis_unavailable`, `locked`, `daily_limit_reached`,
`no_candidates`, `domain_capped`, or `no_eligible_contact`. A provider failure
returns HTTP 500 with `reason: "send_failed"` and leaves the contact `PENDING`.

## Configuration

Sending policy is **code, not environment**. The values live at the top of
`src/lib/outreach/sender.ts`:

| Constant | Value | Notes |
|---|---|---|
| `DAILY_LIMIT` | `20` | Shared with Resend's daily quota |
| `SEND_PROBABILITY` | `0.4` | ~17 sends/day at 42 runs/day |
| `WINDOW_START_UTC` | `7` | Sending window, UTC |
| `WINDOW_END_UTC` | `21` | Exclusive |
| `MIN_AGE_HOURS` | `24` | Import cooldown |
| `DOMAIN_DAILY_LIMIT` | `1` | Per recipient domain |

Change a constant and redeploy when the policy changes. There are no
`OUTREACH_*` tuning variables to set in Coolify.

Only these values come from the environment:

| Variable | Where | Notes |
|---|---|---|
| `CRON_SECRET` | app + Coolify task | Bearer token for the route |
| `RESEND_WEBHOOK_SECRET` | app | Svix signing secret (`whsec_...`) |

The postal address is a code constant in `src/lib/email.ts`.

See `docs/outreach-deliverability.md` for the full deliverability setup.
