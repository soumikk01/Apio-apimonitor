import { baseTemplate, ctaButton, footerNote } from './base.template';

/**
 * Sent during pre-registration — user must click to actually create their account.
 * No hexagon logo, minimal style matching screenshot.
 */
export function pendingVerificationTemplate(
  name: string,
  verifyUrl: string,
): string {
  const content = `
    <!-- Heading -->
    <h1 style="margin:0 0 8px;
               font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
               font-size:22px;font-weight:700;color:#18181b;
               line-height:1.3;letter-spacing:-0.3px;">
      Verify your Apio account
    </h1>
    <p style="margin:0 0 28px;
              font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
              font-size:14px;color:#71717a;line-height:1.6;">
      Hi ${name}, click the button below to create your account.
    </p>

    <!-- CTA Button -->
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"
           style="margin:0 0 28px;">
      <tr>
        <td bgcolor="#18181b"
            style="background-color:#18181b;border-radius:10px;">
          <a href="${verifyUrl}"
             style="display:inline-block;padding:14px 32px;color:#ffffff;
                    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
                    font-size:14px;font-weight:600;text-decoration:none;letter-spacing:0.1px;">
            Create my account &rarr;
          </a>
        </td>
      </tr>
    </table>

    ${footerNote('If you did not request this, ignore this email. This link expires in <strong style="color:#52525b;">5 minutes</strong>. Your account is NOT created until you click it.')}
  `;

  return baseTemplate(content);
}
