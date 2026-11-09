# Outreach deliverability

Cold outreach only works if the email lands in the inbox. Timing is a minor
signal; authentication, domain reputation, list quality, and complaint/bounce
handling decide it. This document covers what the app does and what has to be
configured outside it.

## What the app already sends

`sendScholarOutreachEmail` (`src/lib/email.ts`) sends as
`ScholarBase Updates <updates@scholarbase.app>` with:

- a plain-text part alongside the HTML,
- `List-Unsubscribe` + `List-Unsubscribe-Post: One-Click`,
- `List-ID`, `Precedence: bulk`, `Auto-Submitted: auto-generated`,
- `X-Auto-Response-Suppress`,
- no tracking pixels or click redirects,
- a signed unsubscribe link plus a `mailto:` fallback.

The postal address is appended to the footer server-side from a code constant in
`src/lib/email.ts` (`ScholarBase, New Delhi, India`, matching the address on the
Terms and Privacy pages). CAN-SPAM requires a physical postal address in every
commercial email, so update that constant if the legal address changes.

## Required provider setup

1. **Verify the sending domain in Resend** and publish the SPF and DKIM records
   it gives you. Sending from an unverified domain fails SPF/DKIM alignment.
2. **Publish DMARC.** Start with `p=none` and a reporting address, watch the
   reports, then move to `p=quarantine`:
   ```
   _dmarc.scholarbase.app.  TXT  "v=DMARC1; p=none; rua=mailto:dmarc@scholarbase.app"
   ```
3. **Consider a dedicated subdomain** (`updates.scholarbase.app` or
   `mail.scholarbase.app`) for outreach. It separates cold-outreach reputation
   from the root domain that sends password resets and account email. If you do
   this, change `OUTREACH_FROM_ADDRESS`/`OUTREACH_REPLY_TO` in
   `src/lib/email.ts` and verify the subdomain in Resend.
4. **Register with Google Postmaster Tools** for the sending domain so you can
   see spam rate and reputation instead of guessing.
5. **Add the webhook.** In Resend → Webhooks, add
   `https://scholarbase.app/api/webhooks/resend`, subscribe to
   `email.bounced` and `email.complained`, and put the signing secret in
   `RESEND_WEBHOOK_SECRET`. Without this the contact list never learns that an
   address is dead or that someone marked the mail as spam.

## The feedback loop

`POST /api/webhooks/resend` verifies the Svix signature (HMAC-SHA256,
`whsec_...` secret, 5-minute timestamp tolerance) and then:

| Event | Action |
|---|---|
| `email.bounced` with `bounce.type = "Permanent"` | `Outreach.status = BOUNCED` |
| `email.bounced` with any other type | logged only; provider retries |
| `email.complained` | upsert `OutreachEmailUnsubscribe`, `Outreach.status = UNSUBSCRIBED` |

A complaint is a permanent opt-out. Mailing someone who reported spam is the
fastest way to lose a domain.

## Warm-up ramp

A new domain that blasts its full list on day one gets throttled no matter how
the sends are spaced. Raise `DAILY_LIMIT` in `src/lib/outreach/sender.ts`
gradually and watch the bounce/complaint rate:

| Week | Daily cap |
|---|---|
| 1 | 10 |
| 2 | 20 |
| 3 | 35 |
| 4+ | 50 |

Keep the complaint rate under 0.1% and the bounce rate under 2%. If either
spikes, stop and clean the list before continuing.

## Per-domain pacing

`DOMAIN_DAILY_LIMIT` (currently `1`) stops a batch of addresses from the same
university looking like a blast. Combined with the probability roll, twenty
contacts at one institution spread across twenty days instead of one hour.

## List hygiene

- Unsubscribed addresses are never selectable in the admin panel and are
  excluded from the cron query.
- Existing members are skipped by exact email in both the manual and automated
  paths, so someone who signed up is not cold-emailed.
- Permanent bounces are removed from the PENDING pool automatically.
- Contacts have a 24-hour cooldown after import (`MIN_AGE_HOURS` in
  `src/lib/outreach/sender.ts`) so a large import does not trigger an immediate
  burst.
- Keep the `source` field populated. EU/UK recipients need a justifiable lawful
  basis; being able to say where each address came from matters if someone asks.

## Manual vs automated path

| Guard | Manual send | Cron |
|---|---|---|
| Opt-out list | yes | yes |
| Existing member | yes | yes |
| PENDING-only (Send mode) | yes | yes |
| 10-per-send cap | yes | n/a (1 per run) |
| 30/hour per admin limiter | yes | n/a |
| Sending window | no | yes |
| Probability roll | no | yes |
| Daily cap | no | yes |
| Per-domain cap | no | yes |
| Template rotation | shuffled per batch | rotating counter |

The admin deliberately bypasses the pacing guards: a human chose to send. It
still refuses anything that would harm deliverability irreversibly.

## Operational checklist

- [ ] Sending domain verified in Resend (SPF + DKIM)
- [ ] DMARC record published
- [ ] Postal address in `src/lib/email.ts` matches the legal address
- [ ] `RESEND_WEBHOOK_SECRET` set and webhook subscribed to bounce/complaint
- [ ] Coolify task scheduled only after `?dryRun=1` looks correct
- [ ] `DAILY_LIMIT` lowered to 10 for the first warm-up week
- [ ] Google Postmaster Tools registered
- [ ] Bounce/complaint rate reviewed weekly
