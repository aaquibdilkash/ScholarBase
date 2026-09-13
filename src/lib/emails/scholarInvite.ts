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
}

export type OutreachVariant = Pick<
  ScholarInviteEmailProps,
  "subject" | "greeting" | "headline" | "body" | "ctaLabel" | "footerText"
>;

export type OutreachVariantField = keyof OutreachVariant;

export const SCHOLAR_OUTREACH_VARIANTS: OutreachVariant[] = [
  {
    subject: "A note from ScholarBase",
    greeting: "Hello",
    headline: "I wanted to introduce ScholarBase",
    body: "I'm writing to introduce ScholarBase, an academic community we're building for doctoral researchers and faculty.\n\nIt includes research surveys designed specifically for scholars, spaces to discuss research and supervisor experiences, and a growing collection of research tools and academic resources. If that sounds relevant to your work, you're welcome to take a look.",
    ctaLabel: "ScholarBase",
    footerText:
      "If you would prefer not to receive further notes from ScholarBase, simply reply or use the unsubscribe option in your email app.",
  },
  {
    subject: "ScholarBase for doctoral researchers",
    greeting: "Hi",
    headline: "A quick introduction to ScholarBase",
    body: "I'm reaching out from ScholarBase, a research community we're shaping for doctoral researchers, faculty, and academic teams.\n\nThe platform brings together scholar-focused surveys, research discussions, supervisor experiences, and useful academic resources. If it feels relevant to your work, I'd be glad for you to have a look.",
    ctaLabel: "Open ScholarBase",
    footerText:
      "If these notes are not useful for you, reply anytime or use the unsubscribe option in your email app.",
  },
  {
    subject: "Question about PhD research workflows",
    greeting: "Greetings",
    headline: "Would ScholarBase be useful for your research community?",
    body: "I'm writing from ScholarBase, where we're building a focused space for scholars to share research surveys, discuss academic experiences, and discover research tools and resources.\n\nWe're introducing it carefully to doctoral researchers and faculty first. If this is relevant to your department or research circle, you're welcome to visit and see whether it fits.",
    ctaLabel: "Visit ScholarBase",
    footerText:
      "If you would rather not receive another ScholarBase note, you can reply or use the unsubscribe option in your email app.",
  },
  {
    subject: "A small academic community for researchers",
    greeting: "Hello",
    headline: "Sharing ScholarBase with a few scholars",
    body: "I wanted to share ScholarBase with you. We're building it as a calm academic community for doctoral researchers and faculty.\n\nIt has research surveys, discussions, supervisor experiences, and academic resources in one place. We're inviting scholars gradually so the community can grow with the right people and useful conversations.",
    ctaLabel: "Take a look",
    footerText:
      "If you do not want further ScholarBase outreach, reply to this email or use the unsubscribe option in your email app.",
  },
  {
    subject: "A quick ScholarBase introduction",
    greeting: "Hi",
    headline: "Introducing a space built around academic work",
    body: "I'm reaching out to share ScholarBase, a community we're building for people working through research, doctoral study, teaching, and academic collaboration.\n\nThe goal is to keep research surveys, academic discussions, supervisor experiences, and useful resources easier to find in one place. If that sounds relevant, you're welcome to take a look.",
    ctaLabel: "View ScholarBase",
    footerText:
      "If ScholarBase outreach is not relevant for you, reply to this email or use the unsubscribe option in your email app.",
  },
  {
    subject: "ScholarBase and academic research communities",
    greeting: "Hello",
    headline: "A short note about ScholarBase",
    body: "I'm writing from ScholarBase. We're creating a focused academic community for doctoral researchers, faculty, and scholars who want a more useful place to share research needs and resources.\n\nRight now, we're introducing it gradually to researchers who may find surveys, discussions, supervisor experiences, and academic tools useful.",
    ctaLabel: "ScholarBase link",
    footerText:
      "If you would prefer not to receive ScholarBase outreach, reply anytime or use the unsubscribe option in your email app.",
  },
  {
    subject: "Could ScholarBase be useful to your scholars?",
    greeting: "Greetings",
    headline: "A research-focused community we are building",
    body: "I'm reaching out to introduce ScholarBase, a platform for scholars to share research surveys, exchange academic experiences, and discover resources that may help with research work.\n\nWe're inviting doctoral researchers and faculty in a careful way, especially where the platform may be useful to a department, lab, or research group.",
    ctaLabel: "Open the site",
    footerText:
      "If this is not relevant, you can reply or use the unsubscribe option in your email app and we will not send further outreach.",
  },
  {
    subject: "A research community called ScholarBase",
    greeting: "Hi",
    headline: "I thought ScholarBase might be relevant",
    body: "I'm writing to introduce ScholarBase, an academic community for doctoral researchers and faculty.\n\nWe are bringing together research surveys, academic discussions, supervisor experiences, and research resources so scholars have a focused place to connect around their work. If it feels useful, please feel free to visit.",
    ctaLabel: "Visit the site",
    footerText:
      "If you would rather not receive notes like this, reply to this email or use the unsubscribe option in your email app.",
  },
  {
    subject: "A small note from ScholarBase",
    greeting: "Hello",
    headline: "ScholarBase is open for researchers",
    body: "I'm sharing ScholarBase with a small number of scholars as we continue building the community.\n\nIt is designed for academic research workflows: sharing surveys, discussing research experiences, finding tools, and learning from other scholars. If this is relevant to your work, you're welcome to explore it.",
    ctaLabel: "Explore ScholarBase",
    footerText:
      "If you do not want further ScholarBase emails, reply or use the unsubscribe option in your email app.",
  },
  {
    subject: "For researchers and PhD scholars",
    greeting: "Greetings",
    headline: "A brief introduction to ScholarBase",
    body: "I'm reaching out from ScholarBase, a community we're building for researchers, PhD scholars, and faculty.\n\nThe platform includes scholar-focused surveys, research discussions, academic resources, and spaces to share experiences that are often hard to find in one place. If it seems useful, you can have a look here.",
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

function formatBody(value: string): string {
  return escapeHtml(value).replace(/\r?\n/g, "<br />");
}

function normalizeFooter(value: string): string {
  const trimmed = value.trim();
  const rightsText = "(c) 2026 ScholarBase. All rights reserved.";

  if (!trimmed) return rightsText;
  if (trimmed.toLowerCase().includes("all rights reserved")) return trimmed;

  return `${trimmed}\n\n${rightsText}`;
}

function pickVariant(key: string): OutreachVariant {
  let hash = 0;

  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) >>> 0;
  }

  return (
    SCHOLAR_OUTREACH_VARIANTS[hash % SCHOLAR_OUTREACH_VARIANTS.length] ??
    DEFAULT_SCHOLAR_OUTREACH_VARIANT
  );
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

export function getScholarInvitationContextLine({
  university,
  department,
}: {
  university?: string;
  department?: string;
}): string {
  const cleanUniversity = university?.trim();
  const cleanDepartment = department?.trim();

  if (!cleanUniversity && !cleanDepartment) return "";

  const target = cleanUniversity && cleanDepartment
    ? `from the ${cleanDepartment} at ${cleanUniversity}`
    : cleanUniversity
      ? `from ${cleanUniversity}`
      : `in ${cleanDepartment}`;

  return `At the moment, we're inviting only PhD scholars ${target}.`;
}

export function buildScholarOutreachBody({
  body,
  university,
  department,
}: {
  body: string;
  university?: string;
  department?: string;
}): string {
  const contextLine = getScholarInvitationContextLine({ university, department });
  return contextLine ? `${body.trim()}\n\n${contextLine}` : body.trim();
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
}: ScholarInviteEmailProps): string {
  const displayName = scholarName.trim() || "Scholar";
  const normalizedFooter = normalizeFooter(footerText);

  return `${greeting} ${displayName},

${headline}

${body}

${ctaLabel}: ${inviteUrl}

Best regards,

${senderName}
${senderRole}
invitations@scholarbase.app

${normalizedFooter}`;
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
}: ScholarInviteEmailProps): string {
  const displayName = scholarName.trim() || "Scholar";
  const safeSubject = escapeHtml(subject);
  const safeName = escapeHtml(displayName);
  const safeGreeting = escapeHtml(greeting);
  const safeHeadline = escapeHtml(headline);
  const safeBody = formatBody(body);
  const safeCtaLabel = escapeHtml(ctaLabel);
  const safeInviteUrl = escapeHtml(inviteUrl);
  const safeSenderName = escapeHtml(senderName);
  const safeSenderRole = escapeHtml(senderRole);
  const safeFooterText = formatBody(normalizeFooter(footerText));

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
      <p style="margin:0 0 18px;">${safeCtaLabel}: <a href="${safeInviteUrl}" target="_blank" rel="noreferrer" style="color:#1d4ed8;word-break:break-all;">${safeInviteUrl}</a></p>
      <p style="margin:0 0 2px;">Best regards,</p>
      <p style="margin:0;">${safeSenderName}</p>
      <p style="margin:0 0 24px;">${safeSenderRole}<br /><a href="mailto:invitations@scholarbase.app" style="color:#1d4ed8;text-decoration:none;">invitations@scholarbase.app</a></p>
      <p style="margin:0;border-top:1px solid #e5e7eb;padding-top:14px;font-size:12px;color:#6b7280;">${safeFooterText}</p>
    </div>
  </body>
</html>`;
}
