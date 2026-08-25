// src/lib/emails/generateDigestHtml.ts
// Zero-dependency HTML email generator. No @react-email — returns raw HTML
// with inline CSS only (required for maximum email-client compatibility).

export type DigestNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  createdAt: Date;
  link: string | null;
};

export type DigestModuleGroup = {
  moduleLabel: string;
  icon: string;
  notifications: DigestNotification[];
};

const COLORS = {
  background: "#f1f5f9", // slate-100
  card: "#ffffff",
  border: "#e2e8f0", // slate-200
  text: "#0f172a", // slate-900
  muted: "#64748b", // slate-500
  primary: "#2563eb", // blue-600
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function renderNotificationItem(notification: DigestNotification): string {
  const content = `
    <div style="font-size:14px;font-weight:600;color:${COLORS.text};line-height:1.4;">
      ${escapeHtml(notification.title)}
    </div>
    <div style="font-size:13px;color:${COLORS.muted};line-height:1.5;margin-top:2px;">
      ${escapeHtml(notification.body)}
    </div>
    <div style="font-size:11px;color:#94a3b8;margin-top:4px;">
      ${escapeHtml(formatRelativeTime(notification.createdAt))}
    </div>
  `;

  if (notification.link) {
    return `
      <a href="${escapeHtml(notification.link)}"
         style="display:block;padding:12px 16px;border-bottom:1px solid ${COLORS.border};text-decoration:none;"
      >${content}</a>
    `;
  }

  return `
    <div style="padding:12px 16px;border-bottom:1px solid ${COLORS.border};">${content}</div>
  `;
}

function renderModuleSection(group: DigestModuleGroup): string {
  const items = group.notifications.map(renderNotificationItem).join("");

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="background:${COLORS.card};border:1px solid ${COLORS.border};border-radius:8px;margin-bottom:20px;">
      <tr>
        <td style="padding:12px 16px;background:#f8fafc;border-bottom:1px solid ${COLORS.border};border-radius:8px 8px 0 0;">
          <span style="font-size:15px;font-weight:700;color:${COLORS.text};">
            ${group.icon} ${escapeHtml(group.moduleLabel)}
          </span>
          <span style="float:right;font-size:12px;color:${COLORS.muted};">
            ${group.notifications.length} update${group.notifications.length === 1 ? "" : "s"}
          </span>
        </td>
      </tr>
      <tr>
        <td style="padding:0;">${items}</td>
      </tr>
    </table>
  `;
}

/**
 * Builds the full digest email body.
 * @param userName - Recipient display name (or fallback).
 * @param groups - Notifications grouped by module, ready to render.
 * @param preferenceLinks - One-click preference links rendered in the footer.
 */
export function generateDigestHtml(
  userName: string,
  groups: DigestModuleGroup[],
  preferenceLinks: { weeklyUrl: string; neverUrl: string; siteUrl: string }
): string {
  const sections =
    groups.length > 0
      ? groups.map(renderModuleSection).join("")
      : `<p style="font-size:14px;color:${COLORS.muted};">No new activity to show.</p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${COLORS.background};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.background};">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr><td style="padding:24px 0;text-align:center;">
          <span style="font-size:22px;font-weight:800;color:${COLORS.primary};">ScholarBase</span>
          <div style="font-size:13px;color:${COLORS.muted};margin-top:4px;">Your academic notification digest</div>
        </td></tr>

        <!-- Greeting -->
        <tr><td style="padding:0 0 16px 0;">
          <div style="font-size:18px;font-weight:700;color:${COLORS.text};">
            Hello ${escapeHtml(userName || "Scholar")} 👋
          </div>
          <div style="font-size:14px;color:${COLORS.muted};margin-top:4px;">
            Here's what happened while you were away:
          </div>
        </td></tr>

        <!-- Module Sections -->
        <tr><td>${sections}</td></tr>

        <!-- Footer -->
        <tr><td style="padding:16px 0 8px 0;border-top:1px solid ${COLORS.border};text-align:center;">
          <a href="${escapeHtml(preferenceLinks.siteUrl)}"
             style="display:inline-block;background:${COLORS.primary};color:#ffffff;font-size:14px;font-weight:600;
                    padding:10px 24px;border-radius:6px;text-decoration:none;">
            Open ScholarBase
          </a>
        </td></tr>
        <tr><td style="padding:8px 0 24px 0;text-align:center;">
          <div style="font-size:12px;color:${COLORS.muted};">
            Too many emails?
            <a href="${escapeHtml(preferenceLinks.weeklyUrl)}" style="color:${COLORS.primary};text-decoration:underline;">Switch to weekly</a>
            &nbsp;·&nbsp;
            <a href="${escapeHtml(preferenceLinks.neverUrl)}" style="color:${COLORS.primary};text-decoration:underline;">Unsubscribe from digests</a>
          </div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

