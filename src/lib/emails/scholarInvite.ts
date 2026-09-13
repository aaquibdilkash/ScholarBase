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
