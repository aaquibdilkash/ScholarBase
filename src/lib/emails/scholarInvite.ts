import {
  renderScholarBaseHero,
  renderScholarBaseResponsiveStyles,
} from "@/lib/emails/brand";

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

  return `At the moment, we’re inviting only PhD scholars ${target}.`;
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

  return `${greeting} ${displayName},

${headline}

${body}

${ctaLabel}: ${inviteUrl}

Best regards,

${senderName}
${senderRole}
connect@scholarbase.app

${footerText}`;
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
  const safeFooterText = escapeHtml(footerText);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <title>${safeSubject}</title>
    ${renderScholarBaseResponsiveStyles()}
  </head>
  <body class="sb-email-body" style="margin:0;padding:24px;background:#e1e6ee;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1c2330;line-height:1.6;">
    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
      <tr>
        <td align="center">
          <table class="sb-email-card" role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #cbd5e1;border-top:4px solid #3b82f6;border-radius:16px;overflow:hidden;">
            <tr>
              <td class="sb-email-hero" style="padding:34px 32px 36px;background:#0f172a;text-align:center;">
                ${renderScholarBaseHero({ headline: safeHeadline })}
              </td>
            </tr>
            <tr>
              <td class="sb-email-content" style="padding:34px 40px 38px;">
                <p style="margin:0 0 18px;font-size:16px;color:#334155;">${safeGreeting} <strong>${safeName}</strong>,</p>
                <div class="sb-email-copy" style="margin:0 0 28px;font-size:16px;line-height:1.75;color:#475569;">${safeBody}</div>
                <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin:0 auto 28px;">
                  <tr>
            <td style="border-radius:7px;background:#020617;">
                      <a class="sb-email-cta" href="${safeInviteUrl}" target="_blank" rel="noreferrer" style="display:inline-block;padding:13px 28px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;">${safeCtaLabel}</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0;font-size:12px;color:#5b6577;text-align:center;">You can also visit <a href="${safeInviteUrl}" style="color:#2563eb;word-break:break-all;">${safeInviteUrl}</a>.</p>
                <hr style="border:0;border-top:1px solid #eef0f4;margin:30px 0 20px;" />
                <p style="margin:0;font-size:15px;font-weight:600;color:#334155;">${safeSenderName}</p>
                <p style="margin:3px 0 0;font-size:13px;color:#64748b;">${safeSenderRole} · <a href="mailto:connect@scholarbase.app" style="color:#64748b;text-decoration:none;">connect@scholarbase.app</a></p>
              </td>
            </tr>
            <tr>
              <td class="sb-email-footer" style="padding:18px 32px;background:#f3f5f8;text-align:center;font-size:11px;color:#5b6577;">${safeFooterText}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
