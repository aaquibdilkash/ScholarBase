/**
 * Shared, email-safe ScholarBase branding.
 *
 * Keep this as table markup with inline styles so it works consistently in
 * Gmail, Outlook, and other clients that do not support the site's CSS.
 */
export function renderScholarBaseBrandLockup(): string {
  return `
    <table role="presentation" align="center" border="0" cellspacing="0" cellpadding="0">
      <tr>
        <td valign="middle" style="padding-right:10px;">
          <div style="width:52px;height:52px;border:1px solid #334155;border-radius:15px;background:#020617;color:#ffffff;text-align:center;font-size:24px;font-weight:800;line-height:52px;letter-spacing:-1.5px;">S<span style="color:#3b82f6;">B</span></div>
        </td>
        <td valign="middle">
          <div style="text-align:left;font-size:30px;font-weight:800;line-height:1.05;letter-spacing:-1.5px;color:#f1f5f9;">Scholar<span style="color:#60a5fa;">Base</span></div>
          <div style="margin-top:5px;text-align:left;font-size:13px;line-height:1.2;color:#cbd5e1;">Research Community Platform</div>
        </td>
      </tr>
    </table>
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
    <h1 style="max-width:500px;margin:28px auto 0;font-size:30px;line-height:1.16;letter-spacing:-0.8px;color:#f1f5f9;">${headline}</h1>
    <p style="max-width:500px;margin:14px auto 0;font-size:18px;line-height:1.4;font-weight:600;color:#e2e8f0;">${subheadline}</p>
  `;
}

export function renderScholarBaseCompactHeader(subtitle = "ScholarBase") : string {
  return `
    <div style="padding:24px 32px;background:#0f172a;text-align:center;">
      ${renderScholarBaseBrandLockup()}
      <div style="margin-top:16px;font-size:13px;line-height:1.4;color:#cbd5e1;">${subtitle}</div>
    </div>
  `;
}
