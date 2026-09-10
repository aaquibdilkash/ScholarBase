/**
 * Shared, email-safe ScholarBase branding.
 *
 * Keep this as table markup with inline styles so it works consistently in
 * Gmail, Outlook, and other clients that do not support the site's CSS.
 */
export function renderScholarBaseBrandLockup(): string {
  return `
    <table class="sb-brand-lockup" role="presentation" align="center" border="0" cellspacing="0" cellpadding="0">
      <tr>
        <td valign="middle" style="padding-right:10px;">
          <div class="sb-brand-icon" style="width:52px;height:52px;border:1px solid #334155;border-radius:15px;background:#020617;color:#ffffff;text-align:center;font-size:24px;font-weight:800;line-height:52px;letter-spacing:-1.5px;">S<span style="color:#3b82f6;">B</span></div>
        </td>
        <td valign="middle">
          <div class="sb-brand-wordmark" style="text-align:left;font-size:30px;font-weight:800;line-height:1.05;letter-spacing:-1.5px;color:#f1f5f9;">Scholar<span style="color:#60a5fa;">Base</span></div>
          <div class="sb-brand-subtitle" style="margin-top:5px;text-align:left;font-size:13px;line-height:1.2;color:#cbd5e1;">Research Community Platform</div>
        </td>
      </tr>
    </table>
  `;
}

export function renderScholarBaseResponsiveStyles(): string {
  return `
    <style>
      @media screen and (max-width: 480px) {
        .sb-email-shell { padding: 4px !important; }
        .sb-email-body { padding: 4px !important; }
        .sb-email-card { border-radius: 12px !important; }
        .sb-email-hero { padding: 24px 16px 26px !important; }
        .sb-email-header { padding: 24px 16px !important; }
        .sb-email-panel { padding: 24px 20px !important; }
        .sb-email-content { padding: 24px 20px !important; }
        .sb-email-copy { font-size: 15px !important; line-height: 1.6 !important; }
        .sb-email-button { padding: 12px 20px !important; }
        .sb-email-cta { padding: 12px 20px !important; }
        .sb-email-footer { margin-top: 16px !important; padding: 16px 20px !important; }
        .sb-brand-icon { width: 44px !important; height: 44px !important; font-size: 20px !important; line-height: 44px !important; border-radius: 13px !important; }
        .sb-brand-wordmark { font-size: 25px !important; letter-spacing: -1.2px !important; }
        .sb-brand-subtitle { margin-top: 4px !important; font-size: 11px !important; }
        .sb-hero-heading { margin-top: 22px !important; font-size: 25px !important; line-height: 1.12 !important; letter-spacing: -0.4px !important; }
        .sb-hero-subheading { margin-top: 12px !important; font-size: 16px !important; line-height: 1.35 !important; }
        .sb-digest-shell { padding: 4px !important; }
        .sb-digest-header { padding: 20px 12px !important; }
        .sb-digest-greeting { padding-bottom: 14px !important; }
        .sb-digest-module { margin-bottom: 14px !important; }
        .sb-digest-module-content { padding: 0 12px !important; }
      }
    </style>
  `;
}

export function renderScholarBaseHero({
  headline,
  subheadline = "The academic hub for scholars, supervisors, surveys, and opportunities.",
}: {
  headline: string;
  subheadline?: string;
}): string {
  return `
    ${renderScholarBaseBrandLockup()}
    <h1 class="sb-hero-heading" style="max-width:500px;margin:28px auto 0;font-size:30px;line-height:1.16;letter-spacing:-0.8px;color:#f1f5f9;">${headline}</h1>
    <p class="sb-hero-subheading" style="max-width:500px;margin:14px auto 0;font-size:18px;line-height:1.4;font-weight:600;color:#e2e8f0;">${subheadline}</p>
  `;
}

export function renderScholarBaseCompactHeader(subtitle = "ScholarBase") : string {
  return `
    <div class="sb-email-header" style="padding:24px 32px;background:#0f172a;text-align:center;">
      ${renderScholarBaseBrandLockup()}
      <div style="margin-top:16px;font-size:13px;line-height:1.4;color:#cbd5e1;">${subtitle}</div>
    </div>
  `;
}
