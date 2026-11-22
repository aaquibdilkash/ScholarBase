export interface ScholarInviteEmailProps {
  scholarName: string;
  subject: string;
  greeting: string;
  headline: string;
  body: string;
  ctaLabel: string;
  inviteUrl: string;
  senderName: string;
  senderRole: string;
  footerText: string;
  unsubscribeUrl?: string;
}

export type OutreachVariant = Pick<
  ScholarInviteEmailProps,
  "subject" | "greeting" | "headline" | "body" | "ctaLabel" | "footerText"
>;

export type OutreachVariantField = keyof OutreachVariant;

export const SCHOLAR_OUTREACH_VARIANTS: OutreachVariant[] = [
  {
    subject: "A quick note about ScholarBase",
    greeting: "Hello",
    headline: "A research community for scholars",
    body: "I'm writing to introduce ScholarBase, an academic community we're building for doctoral researchers and faculty.\n\nIt brings together research surveys, academic discussions, and practical resources in one place. We are opening it gradually and thought it may be relevant to your work.",
    ctaLabel: "ScholarBase",
    footerText:
      "If you would prefer not to receive further notes from ScholarBase, simply reply or use the unsubscribe option in your email app.",
  },
  {
    subject: "ScholarBase for researchers",
    greeting: "Hi",
    headline: "A focused space for academic work",
    body: "I'm reaching out from ScholarBase, a research community we're shaping for doctoral researchers, faculty, and academic teams.\n\nThe platform brings together scholar-focused surveys, research discussions, and useful academic resources. If that sounds relevant, you can take a look.",
    ctaLabel: "Open ScholarBase",
    footerText:
      "If these notes are not useful for you, reply anytime or use the unsubscribe option in your email app.",
  },
  {
    subject: "Question about PhD research workflows",
    greeting: "Greetings",
    headline: "Could ScholarBase be useful to you?",
    body: "I'm writing from ScholarBase, where we're building a focused space for scholars to share research surveys, discuss academic experiences, and discover useful resources. If this is relevant to your department or research circle, you're welcome to visit and see whether it fits.",
    ctaLabel: "Visit ScholarBase",
    footerText:
      "If you would rather not receive another ScholarBase note, you can reply or use the unsubscribe option in your email app and we will not send further outreach.",
  },
  {
    subject: "A small academic community for researchers",
    greeting: "Hello",
    headline: "A small academic community for researchers",
    body: "I wanted to share ScholarBase with you. We're building it as a calm academic community for doctoral researchers and faculty, with research surveys, discussions, and academic resources in one place. We're introducing it gradually as we build the first group of useful conversations.",
    ctaLabel: "Take a look",
    footerText:
      "If you do not want further ScholarBase outreach, reply to this email or use the unsubscribe option in your email app.",
  },
  {
    subject: "A quick ScholarBase introduction",
    greeting: "Hi",
    headline: "A research space with surveys and discussions",
    body: "I'm reaching out to share ScholarBase, a community for people working through research, doctoral study, teaching, and academic collaboration. The goal is to keep research surveys, academic discussions, and useful resources easier to find in one place.",
    ctaLabel: "View ScholarBase",
    footerText:
      "If ScholarBase outreach is not relevant for you, reply anytime or use the unsubscribe option in your email app.",
  },
  {
    subject: "ScholarBase and academic research communities",
    greeting: "Hello",
    headline: "A focused research community",
    body: "I'm writing from ScholarBase. We're creating a focused academic community for doctoral researchers, faculty, and scholars who want a useful place to share research needs and resources. We're introducing it gradually to researchers who may find the discussions and resources useful.",
    ctaLabel: "ScholarBase link",
    footerText:
      "If you would prefer not to receive ScholarBase outreach, reply anytime or use the unsubscribe option in your email app.",
  },
  {
    subject: "Could ScholarBase be useful to your scholars?",
    greeting: "Greetings",
    headline: "A platform for sharing academic work",
    body: "I'm reaching out to introduce ScholarBase, a platform for scholars to share research surveys, exchange academic experiences, and discover resources that may help with research work. We're inviting doctoral researchers and faculty gradually, especially where the platform may be useful to a department, lab, or research group.",
    ctaLabel: "Open the site",
    footerText:
      "If this is not relevant, you can reply or use the unsubscribe option in your email app and we will not send further outreach.",
  },
  {
    subject: "A research community called ScholarBase",
    greeting: "Hi",
    headline: "ScholarBase for research communities",
    body: "I'm writing to introduce ScholarBase, an academic community for doctoral researchers and faculty. We are bringing together research surveys, academic discussions, and research resources so scholars have a focused place to connect around their work.",
    ctaLabel: "Visit the site",
    footerText:
      "If you would rather not receive notes like this, reply to this email or use the unsubscribe option in your email app.",
  },
  {
    subject: "A small note from ScholarBase",
    greeting: "Hello",
    headline: "ScholarBase for researchers",
    body: "I'm sharing ScholarBase with a small number of scholars as we continue building the community. It is designed for academic research workflows: sharing surveys, discussing research experiences, finding tools, and learning from other scholars.",
    ctaLabel: "Explore ScholarBase",
    footerText:
      "If you do not want further ScholarBase emails, reply or use the unsubscribe option in your email app.",
  },
  {
    subject: "For researchers and PhD scholars",
    greeting: "Greetings",
    headline: "A brief introduction to ScholarBase",
    body: "I'm reaching out from ScholarBase, a community we're building for researchers, PhD scholars, and faculty. The platform includes scholar-focused surveys, research discussions, academic resources, and spaces to share experiences that are often hard to find in one place.",
    ctaLabel: "See ScholarBase",
    footerText:
      "If this note is not useful for you, reply anytime or use the unsubscribe option in your email app.",
  },
];

export const DEFAULT_SCHOLAR_OUTREACH_VARIANT = SCHOLAR_OUTREACH_VARIANTS[0]!;

const LEGACY_TEMPLATE_VALUES = {
  subject: ["Only For Scholars: A Transparent Introduction to ScholarBase"],
  greeting: [],
  headline: ["A Quiet Workspace for the Noisy Academic Life"],
  body: [
    "We're writing to introduce ScholarBase, an academic community we're building for doctoral researchers and faculty.\n\nIt includes research surveys designed specifically for scholars, spaces to discuss research and supervisor experiences, and a growing collection of research tools and academic resources. If that sounds relevant to your work, you're welcome to take a look.",
  ],
  ctaLabel: [],
  footerText: [
    "If you would prefer not to receive further notes, simply reply and let us know.",
  ],
} satisfies Record<keyof OutreachVariant, string[]>;

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    };

    return entities[character];
  });
}

function humanizeOutreachCopy(value: string): string {
  return value
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/\b100%\b/g, "fully");
}

function formatBody(value: string): string {
  return escapeHtml(humanizeOutreachCopy(value)).replace(/\r?\n/g, "<br />");
}

function normalizeFooter(value: string): string {
  const trimmed = value.trim();
  const rightsText = "(c) 2026 ScholarBase. All rights reserved.";

  if (!trimmed) return rightsText;
  if (trimmed.toLowerCase().includes("all rights reserved")) return trimmed;

  return `${trimmed}\n\n${rightsText}`;
}

function pickVariant(key: string, offset = 0): OutreachVariant {
  let hash = 0;

  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) >>> 0;
  }

  const variantIndex =
    (hash + Math.max(0, Math.trunc(offset))) % SCHOLAR_OUTREACH_VARIANTS.length;

  return (
    SCHOLAR_OUTREACH_VARIANTS[variantIndex] ??
    DEFAULT_SCHOLAR_OUTREACH_VARIANT
  );
}

/**
 * Deterministic template choice for a recipient. The same email + offset always
 * yields the same variant, so a contact gets a stable copy while `offset`
 * (typically `sendCount`) rotates it on a resend.
 */
export function pickScholarOutreachVariant(
  key: string,
  offset = 0,
): OutreachVariant {
  return pickVariant(key, offset);
}

function shuffleVariants(random: () => number): OutreachVariant[] {
  const pool = [...SCHOLAR_OUTREACH_VARIANTS];

  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [pool[index], pool[swap]] = [pool[swap]!, pool[index]!];
  }

  return pool;
}

/**
 * Give a batch of recipients a shuffled, non-repeating set of templates.
 *
 * A per-recipient random pick still collides: 10 templates for 10 recipients
 * produces roughly 3-4 duplicates. Shuffling the pool instead means every
 * recipient in the batch gets different copy until the library is exhausted,
 * then the pool is reshuffled (with the round boundary swapped away from a
 * repeat).
 */
export function assignOutreachVariants(
  count: number,
  random: () => number = Math.random,
): OutreachVariant[] {
  const assignments: OutreachVariant[] = [];
  let pool: OutreachVariant[] = [];

  for (let index = 0; index < Math.max(0, Math.trunc(count)); index += 1) {
    if (pool.length === 0) {
      pool = shuffleVariants(random);
      const previous = assignments[assignments.length - 1];

      if (previous && pool.length > 1 && pool[0] === previous) {
        [pool[0], pool[1]] = [pool[1]!, pool[0]!];
      }
    }

    const variant = pool.shift();
    if (variant) assignments.push(variant);
  }

  return assignments;
}

function normalizeForTemplateMatch(value: string): string {
  return value
    .trim()
    .replace(/\r\n/g, "\n")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"');
}

function shouldRotateTemplateField(
  field: keyof OutreachVariant,
  value: string,
): boolean {
  const normalized = normalizeForTemplateMatch(value);
  if (!normalized) return true;

  const knownTemplateValues = [
    ...SCHOLAR_OUTREACH_VARIANTS.map((variant) => variant[field]),
    ...LEGACY_TEMPLATE_VALUES[field],
  ];

  return knownTemplateValues
    .map(normalizeForTemplateMatch)
    .includes(normalized);
}

export function getNextScholarOutreachVariant(
  currentSubject: string,
): OutreachVariant {
  const normalizedSubject = normalizeForTemplateMatch(currentSubject);
  const currentIndex = SCHOLAR_OUTREACH_VARIANTS.findIndex(
    (variant) => normalizeForTemplateMatch(variant.subject) === normalizedSubject,
  );
  const nextIndex =
    currentIndex >= 0
      ? (currentIndex + 1) % SCHOLAR_OUTREACH_VARIANTS.length
      : Math.floor(Math.random() * SCHOLAR_OUTREACH_VARIANTS.length);

  return SCHOLAR_OUTREACH_VARIANTS[nextIndex] ?? DEFAULT_SCHOLAR_OUTREACH_VARIANT;
}

export function getNextScholarOutreachFieldValue(
  field: OutreachVariantField,
  currentValue: string,
): string {
  const normalizedValue = normalizeForTemplateMatch(currentValue);
  const currentIndex = SCHOLAR_OUTREACH_VARIANTS.findIndex(
    (variant) => normalizeForTemplateMatch(variant[field]) === normalizedValue,
  );
  const nextIndex =
    currentIndex >= 0
      ? (currentIndex + 1) % SCHOLAR_OUTREACH_VARIANTS.length
      : Math.floor(Math.random() * SCHOLAR_OUTREACH_VARIANTS.length);

  return (
    SCHOLAR_OUTREACH_VARIANTS[nextIndex]?.[field] ??
    DEFAULT_SCHOLAR_OUTREACH_VARIANT[field]
  );
}

export function applyScholarOutreachVariant<T extends OutreachVariant>(
  values: T,
  key: string,
): T {
  const variant = pickVariant(key);

  return {
    ...values,
    subject: shouldRotateTemplateField("subject", values.subject)
      ? variant.subject
      : values.subject,
    greeting: shouldRotateTemplateField("greeting", values.greeting)
      ? variant.greeting
      : values.greeting,
    headline: shouldRotateTemplateField("headline", values.headline)
      ? variant.headline
      : values.headline,
    body: shouldRotateTemplateField("body", values.body)
      ? variant.body
      : values.body,
    ctaLabel: shouldRotateTemplateField("ctaLabel", values.ctaLabel)
      ? variant.ctaLabel
      : values.ctaLabel,
    footerText: shouldRotateTemplateField("footerText", values.footerText)
      ? variant.footerText
      : values.footerText,
  };
}

export const SCHOLAR_INVITE_CONTEXT_LINES: string[] = [
  "ScholarBase is currently opening registrations gradually, so we are sharing it directly with a small number of researchers.",
  "We are opening ScholarBase gradually while we improve the community and its research resources.",
  "Registrations are currently invite only while we continue working on the first version of the community.",
  "We are introducing ScholarBase carefully to researchers who may find the discussions and resources useful.",
];

export function getNextScholarInviteContextLine(
  current?: string,
): string {
  const normalized = current?.trim();
  if (!normalized) return SCHOLAR_INVITE_CONTEXT_LINES[0];

  const currentIndex = SCHOLAR_INVITE_CONTEXT_LINES.findIndex(
    (line) => line === normalized,
  );

  const nextIndex =
    currentIndex >= 0
      ? (currentIndex + 1) % SCHOLAR_INVITE_CONTEXT_LINES.length
      : Math.floor(Math.random() * SCHOLAR_INVITE_CONTEXT_LINES.length);

  return SCHOLAR_INVITE_CONTEXT_LINES[nextIndex] ?? SCHOLAR_INVITE_CONTEXT_LINES[0];
}

export function getScholarInvitationContextLine(
  inviteContext?: string,
): string {
  const trimmed = inviteContext?.trim();
  if (trimmed) return trimmed;

  return SCHOLAR_INVITE_CONTEXT_LINES[0];
}

export function buildScholarOutreachBody({
  body,
  inviteContext,
}: {
  body: string;
  inviteContext?: string;
}): string {
  const contextLine = getScholarInvitationContextLine(inviteContext);
  return `${humanizeOutreachCopy(body.trim())}\n\n${humanizeOutreachCopy(contextLine)}`;
}

export function generateScholarInvitePlainText({
  scholarName,
  greeting,
  headline,
  body,
  ctaLabel,
  inviteUrl,
  senderName,
  senderRole,
  footerText,
  unsubscribeUrl,
}: ScholarInviteEmailProps): string {
  const displayName = scholarName.trim() || "Scholar";
  const normalizedFooter = normalizeFooter(footerText);
  const unsubscribeLine = unsubscribeUrl
    ? `\n\nUnsubscribe: ${unsubscribeUrl}`
    : "";

  return `${humanizeOutreachCopy(greeting)} ${displayName},

${humanizeOutreachCopy(headline)}

${humanizeOutreachCopy(body)}

${humanizeOutreachCopy(ctaLabel)}: ${inviteUrl}

Best regards,

${senderName}
${senderRole}
updates@scholarbase.app

${humanizeOutreachCopy(normalizedFooter)}${unsubscribeLine}`;
}

export function generateScholarInviteHtml({
  scholarName,
  subject,
  greeting,
  headline,
  body,
  ctaLabel,
  inviteUrl,
  senderName,
  senderRole,
  footerText,
  unsubscribeUrl,
}: ScholarInviteEmailProps): string {
  const displayName = scholarName.trim() || "Scholar";
  const safeSubject = escapeHtml(humanizeOutreachCopy(subject));
  const safeName = escapeHtml(displayName);
  const safeGreeting = escapeHtml(humanizeOutreachCopy(greeting));
  const safeHeadline = escapeHtml(humanizeOutreachCopy(headline));
  const safeBody = formatBody(body);
  const safeCtaLabel = escapeHtml(humanizeOutreachCopy(ctaLabel));
  const safeInviteUrl = escapeHtml(inviteUrl);
  const safeSenderName = escapeHtml(senderName);
  const safeSenderRole = escapeHtml(senderRole);
  const safeFooterText = formatBody(humanizeOutreachCopy(normalizeFooter(footerText)));
  const safeUnsubscribeUrl = unsubscribeUrl ? escapeHtml(unsubscribeUrl) : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <title>${safeSubject}</title>
  </head>
  <body style="margin:0;padding:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#111827;line-height:1.6;">
    <div style="max-width:640px;margin:0 auto;padding:24px 20px;font-size:15px;">
      <p style="margin:0 0 16px;">${safeGreeting} ${safeName},</p>
      <p style="margin:0 0 16px;"><strong>${safeHeadline}</strong></p>
      <div style="margin:0 0 18px;">${safeBody}</div>
      <p style="margin:0 0 18px;">${safeCtaLabel}: <a href="${safeInviteUrl}" target="_blank" rel="noreferrer" style="color:#1d4ed8;overflow-wrap:anywhere;word-break:break-word;">${safeInviteUrl}</a></p>
      <p style="margin:0 0 2px;">Best regards,</p>
      <p style="margin:0;">${safeSenderName}</p>
      <p style="margin:0 0 24px;">${safeSenderRole}<br /><a href="mailto:updates@scholarbase.app" style="color:#1d4ed8;text-decoration:none;">updates@scholarbase.app</a></p>
      <p style="margin:0;border-top:1px solid #e5e7eb;padding-top:14px;font-size:12px;color:#6b7280;">${safeFooterText}</p>
      ${safeUnsubscribeUrl ? `<p style="margin:8px 0 0;font-size:12px;color:#6b7280;"><a href="${safeUnsubscribeUrl}" target="_blank" rel="noreferrer" style="color:#6b7280;text-decoration:underline;">Unsubscribe from ScholarBase outreach</a></p>` : ""}
    </div>
  </body>
</html>`;
}
