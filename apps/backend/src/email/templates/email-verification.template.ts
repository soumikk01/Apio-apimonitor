import { baseTemplate, ctaButton, footerNote } from './base.template';

/**
 * Email sent when a user registers and needs to verify their email address.
 * @param verificationUrl - The full BetterAuth verification URL with token embedded.
 */
export function emailVerificationTemplate(verificationUrl: string): string {
  const content = `
    <!-- Heading -->
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1e1b4b;
               text-align:center;line-height:1.4;letter-spacing:-0.3px;">
      Verify Your Email
    </h1>
    <p style="margin:0 0 28px;font-size:14px;color:#6b7280;text-align:center;line-height:1.6;">
      You&rsquo;re almost there! Click the button below to activate your Apio account.
    </p>

    <!-- CTA Button (centered) -->
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"
           style="margin:0 auto 28px;">
      <tr>
        <td bgcolor="#6366f1"
            style="background-color:#6366f1;border-radius:12px;
                   box-shadow:0 4px 18px rgba(99,102,241,0.38);">
          <a href="${verificationUrl}"
             style="display:inline-block;padding:15px 40px;color:#ffffff;
                    font-size:15px;font-weight:700;text-decoration:none;
                    letter-spacing:0.1px;">
            Verify Email Address &rarr;
          </a>
        </td>
      </tr>
    </table>

    <!-- Fallback URL -->
    <p style="margin:0 0 24px;font-size:12px;color:#94a3b8;text-align:center;line-height:1.8;">
      Or copy and paste this link into your browser:<br/>
      <a href="${verificationUrl}"
         style="color:#6366f1;word-break:break-all;font-size:11px;">${verificationUrl}</a>
    </p>

    <!-- Warning box -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="margin-bottom:20px;">
      <tr>
        <td bgcolor="#fffbeb"
          style="background-color:#fffbeb;border:1px solid #fde68a;
                 border-radius:10px;padding:14px 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td valign="top" style="padding-right:10px;font-size:16px;">&#9888;&#65039;</td>
              <td>
                <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#92400e;">
                  Didn&rsquo;t create an Apio account?
                </p>
                <p style="margin:0;font-size:12px;color:#b45309;line-height:1.6;">
                  If you did not sign up, you can safely
                  <strong>ignore this email</strong>.
                  No account will be created.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;line-height:1.6;">
      This is an automated message.
      <strong style="color:#64748b;">Please do not reply.</strong>
    </p>

    ${footerNote('This link expires in <strong>24 hours</strong>. Verify your email to start monitoring your APIs.')}
  `;

  return baseTemplate(content);
}
