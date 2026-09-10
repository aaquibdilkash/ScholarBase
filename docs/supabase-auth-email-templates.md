# Supabase Auth email templates

These six templates use inline styles only. Paste each complete block into the matching Supabase Auth template.

## 1. Confirm signup

```html
<div style="width:100%;max-width:600px;box-sizing:border-box;margin:0 auto;padding:4px;background:#e1e6ee;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="width:100%;box-sizing:border-box;background:#ffffff;border:1px solid #cbd5e1;border-top:4px solid #3b82f6;border-radius:12px;overflow:hidden;">
    <div style="padding:24px 16px 28px;background:#0f172a;text-align:center;">
      <table role="presentation" align="center" border="0" cellspacing="0" cellpadding="0"><tr>
        <td style="padding-right:8px;vertical-align:middle;"><div style="width:44px;height:44px;border:1px solid #334155;border-radius:13px;background:#020617;color:#ffffff;text-align:center;font-size:20px;font-weight:800;line-height:44px;letter-spacing:-1px;">S<span style="color:#3b82f6;">B</span></div></td>
        <td style="vertical-align:middle;"><div style="text-align:left;font-size:25px;font-weight:800;line-height:1.05;letter-spacing:-1.2px;color:#f1f5f9;">Scholar<span style="color:#60a5fa;">Base</span></div><div style="margin-top:4px;text-align:left;font-size:11px;line-height:1.2;color:#cbd5e1;">Research Community Platform</div></td>
      </tr></table>
      <h1 style="max-width:500px;margin:22px auto 0;font-size:25px;line-height:1.12;letter-spacing:-.4px;color:#f1f5f9;">One quiet workspace for the noisy academic life</h1>
      <p style="max-width:500px;margin:12px auto 0;font-size:16px;line-height:1.35;font-weight:600;color:#e2e8f0;">The academic hub for scholars, supervisors, surveys, and opportunities.</p>
    </div>
    <div style="padding:24px 20px 28px;">
      <h2 style="margin:0 0 18px;color:#0f172a;font-size:20px;line-height:1.3;">Verify your email address</h2>
      <p style="margin:0 0 20px;color:#475569;font-size:15px;line-height:1.6;">Welcome! We are thrilled to have you join our academic community. Please verify your email address to complete your registration and begin building your research profile.</p>
      <div style="text-align:center;margin:28px 0;"><a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#020617;color:#ffffff;padding:12px 20px;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;">Verify Email</a></div>
      <p style="margin:0;color:#64748b;font-size:14px;line-height:1.5;">If you didn't create an account with ScholarBase, you can safely ignore this email.</p>
    </div>
  </div>
  <div style="text-align:center;margin-top:16px;"><p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.5;">© 2026 ScholarBase. All rights reserved.</p></div>
</div>
```

## 2. Invite user

```html
<div style="width:100%;max-width:600px;box-sizing:border-box;margin:0 auto;padding:4px;background:#e1e6ee;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="width:100%;box-sizing:border-box;background:#ffffff;border:1px solid #cbd5e1;border-top:4px solid #3b82f6;border-radius:12px;overflow:hidden;">
    <div style="padding:24px 16px 28px;background:#0f172a;text-align:center;">
      <table role="presentation" align="center" border="0" cellspacing="0" cellpadding="0"><tr>
        <td style="padding-right:8px;vertical-align:middle;"><div style="width:44px;height:44px;border:1px solid #334155;border-radius:13px;background:#020617;color:#ffffff;text-align:center;font-size:20px;font-weight:800;line-height:44px;letter-spacing:-1px;">S<span style="color:#3b82f6;">B</span></div></td>
        <td style="vertical-align:middle;"><div style="text-align:left;font-size:25px;font-weight:800;line-height:1.05;letter-spacing:-1.2px;color:#f1f5f9;">Scholar<span style="color:#60a5fa;">Base</span></div><div style="margin-top:4px;text-align:left;font-size:11px;line-height:1.2;color:#cbd5e1;">Research Community Platform</div></td>
      </tr></table>
      <h1 style="max-width:500px;margin:22px auto 0;font-size:25px;line-height:1.12;letter-spacing:-.4px;color:#f1f5f9;">One quiet workspace for the noisy academic life</h1>
      <p style="max-width:500px;margin:12px auto 0;font-size:16px;line-height:1.35;font-weight:600;color:#e2e8f0;">The academic hub for scholars, supervisors, surveys, and opportunities.</p>
    </div>
    <div style="padding:24px 20px 28px;">
      <h2 style="margin:0 0 18px;color:#0f172a;font-size:20px;line-height:1.3;">Collaboration Invitation</h2>
      <p style="margin:0 0 20px;color:#475569;font-size:15px;line-height:1.6;">You have been invited to create an account on ScholarBase. Join the platform to collaborate, publish, and manage your academic research.</p>
      <div style="text-align:center;margin:28px 0;"><a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#020617;color:#ffffff;padding:12px 20px;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;">Accept Invitation</a></div>
      <p style="margin:0;color:#64748b;font-size:14px;line-height:1.5;">If you are not expecting this invitation, you can simply delete this email.</p>
    </div>
  </div>
  <div style="text-align:center;margin-top:16px;"><p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.5;">© 2026 ScholarBase. All rights reserved.</p></div>
</div>
```

## 3. Magic link or OTP

```html
<div style="width:100%;max-width:600px;box-sizing:border-box;margin:0 auto;padding:4px;background:#e1e6ee;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="width:100%;box-sizing:border-box;background:#ffffff;border:1px solid #cbd5e1;border-top:4px solid #3b82f6;border-radius:12px;overflow:hidden;">
    <div style="padding:24px 16px 28px;background:#0f172a;text-align:center;">
      <table role="presentation" align="center" border="0" cellspacing="0" cellpadding="0"><tr>
        <td style="padding-right:8px;vertical-align:middle;"><div style="width:44px;height:44px;border:1px solid #334155;border-radius:13px;background:#020617;color:#ffffff;text-align:center;font-size:20px;font-weight:800;line-height:44px;letter-spacing:-1px;">S<span style="color:#3b82f6;">B</span></div></td>
        <td style="vertical-align:middle;"><div style="text-align:left;font-size:25px;font-weight:800;line-height:1.05;letter-spacing:-1.2px;color:#f1f5f9;">Scholar<span style="color:#60a5fa;">Base</span></div><div style="margin-top:4px;text-align:left;font-size:11px;line-height:1.2;color:#cbd5e1;">Research Community Platform</div></td>
      </tr></table>
      <h1 style="max-width:500px;margin:22px auto 0;font-size:25px;line-height:1.12;letter-spacing:-.4px;color:#f1f5f9;">One quiet workspace for the noisy academic life</h1>
      <p style="max-width:500px;margin:12px auto 0;font-size:16px;line-height:1.35;font-weight:600;color:#e2e8f0;">The academic hub for scholars, supervisors, surveys, and opportunities.</p>
    </div>
    <div style="padding:24px 20px 28px;">
      <h2 style="margin:0 0 18px;color:#0f172a;font-size:20px;line-height:1.3;">Sign in to your account</h2>
      <p style="margin:0 0 20px;color:#475569;font-size:15px;line-height:1.6;">Click the button below to securely sign in to your ScholarBase dashboard. This link expires shortly and can only be used once.</p>
      <div style="text-align:center;margin:28px 0;"><a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#020617;color:#ffffff;padding:12px 20px;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;">Sign In to ScholarBase</a></div>
      <p style="margin:0;color:#64748b;font-size:14px;line-height:1.5;">If you did not request this link, please ignore this email to keep your account secure.</p>
    </div>
  </div>
  <div style="text-align:center;margin-top:16px;"><p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.5;">© 2026 ScholarBase. All rights reserved.</p></div>
</div>
```

## 4. Change email address

```html
<div style="width:100%;max-width:600px;box-sizing:border-box;margin:0 auto;padding:4px;background:#e1e6ee;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="width:100%;box-sizing:border-box;background:#ffffff;border:1px solid #cbd5e1;border-top:4px solid #3b82f6;border-radius:12px;overflow:hidden;">
    <div style="padding:24px 16px 28px;background:#0f172a;text-align:center;">
      <table role="presentation" align="center" border="0" cellspacing="0" cellpadding="0"><tr>
        <td style="padding-right:8px;vertical-align:middle;"><div style="width:44px;height:44px;border:1px solid #334155;border-radius:13px;background:#020617;color:#ffffff;text-align:center;font-size:20px;font-weight:800;line-height:44px;letter-spacing:-1px;">S<span style="color:#3b82f6;">B</span></div></td>
        <td style="vertical-align:middle;"><div style="text-align:left;font-size:25px;font-weight:800;line-height:1.05;letter-spacing:-1.2px;color:#f1f5f9;">Scholar<span style="color:#60a5fa;">Base</span></div><div style="margin-top:4px;text-align:left;font-size:11px;line-height:1.2;color:#cbd5e1;">Research Community Platform</div></td>
      </tr></table>
      <h1 style="max-width:500px;margin:22px auto 0;font-size:25px;line-height:1.12;letter-spacing:-.4px;color:#f1f5f9;">One quiet workspace for the noisy academic life</h1>
      <p style="max-width:500px;margin:12px auto 0;font-size:16px;line-height:1.35;font-weight:600;color:#e2e8f0;">The academic hub for scholars, supervisors, surveys, and opportunities.</p>
    </div>
    <div style="padding:24px 20px 28px;">
      <h2 style="margin:0 0 18px;color:#0f172a;font-size:20px;line-height:1.3;">Update your email address</h2>
      <p style="margin:0 0 20px;color:#475569;font-size:15px;line-height:1.6;">We received a request to update your primary account email to <strong>{{ .NewEmail }}</strong>. Please confirm this change by clicking the link below.</p>
      <div style="text-align:center;margin:28px 0;"><a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#020617;color:#ffffff;padding:12px 20px;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;">Confirm New Email</a></div>
      <p style="margin:0;color:#64748b;font-size:14px;line-height:1.5;">If you did not authorize this change, you can safely ignore this email and your current address will remain active.</p>
    </div>
  </div>
  <div style="text-align:center;margin-top:16px;"><p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.5;">© 2026 ScholarBase. All rights reserved.</p></div>
</div>
```

## 5. Reset password

```html
<div style="width:100%;max-width:600px;box-sizing:border-box;margin:0 auto;padding:4px;background:#e1e6ee;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="width:100%;box-sizing:border-box;background:#ffffff;border:1px solid #cbd5e1;border-top:4px solid #3b82f6;border-radius:12px;overflow:hidden;">
    <div style="padding:24px 16px 28px;background:#0f172a;text-align:center;">
      <table role="presentation" align="center" border="0" cellspacing="0" cellpadding="0"><tr>
        <td style="padding-right:8px;vertical-align:middle;"><div style="width:44px;height:44px;border:1px solid #334155;border-radius:13px;background:#020617;color:#ffffff;text-align:center;font-size:20px;font-weight:800;line-height:44px;letter-spacing:-1px;">S<span style="color:#3b82f6;">B</span></div></td>
        <td style="vertical-align:middle;"><div style="text-align:left;font-size:25px;font-weight:800;line-height:1.05;letter-spacing:-1.2px;color:#f1f5f9;">Scholar<span style="color:#60a5fa;">Base</span></div><div style="margin-top:4px;text-align:left;font-size:11px;line-height:1.2;color:#cbd5e1;">Research Community Platform</div></td>
      </tr></table>
      <h1 style="max-width:500px;margin:22px auto 0;font-size:25px;line-height:1.12;letter-spacing:-.4px;color:#f1f5f9;">One quiet workspace for the noisy academic life</h1>
      <p style="max-width:500px;margin:12px auto 0;font-size:16px;line-height:1.35;font-weight:600;color:#e2e8f0;">The academic hub for scholars, supervisors, surveys, and opportunities.</p>
    </div>
    <div style="padding:24px 20px 28px;">
      <h2 style="margin:0 0 18px;color:#0f172a;font-size:20px;line-height:1.3;">Password Reset Request</h2>
      <p style="margin:0 0 20px;color:#475569;font-size:15px;line-height:1.6;">We received a request to reset the password for your ScholarBase account. Follow the link below to choose a new password.</p>
      <div style="text-align:center;margin:28px 0;"><a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#020617;color:#ffffff;padding:12px 20px;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;">Reset Password</a></div>
      <p style="margin:0;color:#64748b;font-size:14px;line-height:1.5;">If you didn't request a password reset, you can safely ignore this email and your current password will remain unchanged.</p>
    </div>
  </div>
  <div style="text-align:center;margin-top:16px;"><p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.5;">© 2026 ScholarBase. All rights reserved.</p></div>
</div>
```

## 6. Reauthentication

```html
<div style="width:100%;max-width:600px;box-sizing:border-box;margin:0 auto;padding:4px;background:#e1e6ee;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="width:100%;box-sizing:border-box;background:#ffffff;border:1px solid #cbd5e1;border-top:4px solid #3b82f6;border-radius:12px;overflow:hidden;">
    <div style="padding:24px 16px 28px;background:#0f172a;text-align:center;">
      <table role="presentation" align="center" border="0" cellspacing="0" cellpadding="0"><tr>
        <td style="padding-right:8px;vertical-align:middle;"><div style="width:44px;height:44px;border:1px solid #334155;border-radius:13px;background:#020617;color:#ffffff;text-align:center;font-size:20px;font-weight:800;line-height:44px;letter-spacing:-1px;">S<span style="color:#3b82f6;">B</span></div></td>
        <td style="vertical-align:middle;"><div style="text-align:left;font-size:25px;font-weight:800;line-height:1.05;letter-spacing:-1.2px;color:#f1f5f9;">Scholar<span style="color:#60a5fa;">Base</span></div><div style="margin-top:4px;text-align:left;font-size:11px;line-height:1.2;color:#cbd5e1;">Research Community Platform</div></td>
      </tr></table>
      <h1 style="max-width:500px;margin:22px auto 0;font-size:25px;line-height:1.12;letter-spacing:-.4px;color:#f1f5f9;">One quiet workspace for the noisy academic life</h1>
      <p style="max-width:500px;margin:12px auto 0;font-size:16px;line-height:1.35;font-weight:600;color:#e2e8f0;">The academic hub for scholars, supervisors, surveys, and opportunities.</p>
    </div>
    <div style="padding:24px 20px 28px;">
      <h2 style="margin:0 0 18px;color:#0f172a;font-size:20px;line-height:1.3;">Action requires verification</h2>
      <p style="margin:0 0 20px;color:#475569;font-size:15px;line-height:1.6;">You are attempting to perform a sensitive operation on your account. Please use the verification code below to confirm your identity.</p>
      <div style="text-align:center;margin:28px 0;background:#f1f5f9;padding:18px;border-radius:6px;border:1px dashed #cbd5e1;"><span style="font-size:30px;font-weight:700;color:#0f172a;letter-spacing:4px;">{{ .Token }}</span></div>
      <p style="margin:0;color:#64748b;font-size:14px;line-height:1.5;">This code expires shortly. If you did not trigger this action, please review your account security settings.</p>
    </div>
  </div>
  <div style="text-align:center;margin-top:16px;"><p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.5;">© 2026 ScholarBase. All rights reserved.</p></div>
</div>
```
