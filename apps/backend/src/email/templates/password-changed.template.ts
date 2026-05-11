import { baseTemplate, footerNote } from './base.template';

export interface PasswordChangedContext {
  name: string;
  email: string;
  changedAt: Date;
  location: string; // "Mumbai, India" or "Unknown location"
  ip: string; // "103.x.x.x" or "unknown"
  device: string; // browser/OS hint
}

/**
 * Security notification sent immediately after a successful password reset.
 * Includes the time, approximate location and device so the user can spot abuse.
 */
export function passwordChangedTemplate(ctx: PasswordChangedContext): string {
  // Format: "Sunday, 11 May 2026 at 12:37 AM IST"
  const formatted = ctx.changedAt.toLocaleString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });

  const content = `
    <!-- Shield icon row -->
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"
           style="margin:0 0 20px;">
      <tr>
        <td>
          <div style="width:48px;height:48px;border-radius:12px;
                      background-color:#f4f4f5;
                      display:inline-block;text-align:center;line-height:48px;
                      font-size:22px;">
            🔐
          </div>
        </td>
      </tr>
    </table>

    <!-- Heading -->
    <h1 style="margin:0 0 6px;
               font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
               font-size:22px;font-weight:700;color:#18181b;
               line-height:1.3;letter-spacing:-0.3px;">
      Your password was changed
    </h1>
    <p style="margin:0 0 24px;
              font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
              font-size:14px;color:#71717a;line-height:1.6;">
      Hi ${ctx.name}, the password for your Apio account was successfully updated.
    </p>

    <!-- Detail card -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="margin-bottom:24px;border:1px solid #e4e4e7;border-radius:12px;overflow:hidden;">
      ${row('📅', 'Date &amp; Time', formatted)}
      ${rowDivider()}
      ${row('📍', 'Approximate Location', ctx.location)}
      ${rowDivider()}
      ${row('🌐', 'IP Address', ctx.ip)}
      ${rowDivider()}
      ${row('💻', 'Device', ctx.device)}
    </table>

    <!-- Warning block -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="margin-bottom:4px;background-color:#fef2f2;border:1px solid #fecaca;border-radius:10px;">
      <tr>
        <td style="padding:16px 18px;">
          <p style="margin:0 0 4px;
                    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
                    font-size:13px;font-weight:700;color:#991b1b;">
            Wasn&apos;t you?
          </p>
          <p style="margin:0;
                    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
                    font-size:13px;color:#b91c1c;line-height:1.6;">
            If you did not make this change, your account may be compromised.
            Change your password immediately and contact support at
            <a href="mailto:support@apio.one" style="color:#b91c1c;">support@apio.one</a>.
          </p>
        </td>
      </tr>
    </table>

    ${footerNote('This is an automated security notification from Apio. Please do not reply to this email.')}
  `;

  return baseTemplate(content);
}

function row(icon: string, label: string, value: string): string {
  return `
    <tr>
      <td style="padding:14px 18px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="width:28px;font-size:16px;vertical-align:middle;">${icon}</td>
            <td style="vertical-align:middle;padding-left:10px;">
              <span style="display:block;
                           font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
                           font-size:11px;font-weight:600;color:#a1a1aa;
                           text-transform:uppercase;letter-spacing:0.06em;margin-bottom:2px;">
                ${label}
              </span>
              <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
                           font-size:13px;font-weight:500;color:#18181b;">
                ${value}
              </span>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

function rowDivider(): string {
  return `<tr><td style="height:1px;background-color:#e4e4e7;font-size:0;line-height:0;">&nbsp;</td></tr>`;
}
