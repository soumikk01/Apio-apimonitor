import { baseTemplate, footerNote } from './base.template';

export type OtpType = 'sign-in' | 'email-verification' | 'forget-password';

const OTP_COPY: Record<
  OtpType,
  { heading: string; sub: string; expiry: string }
> = {
  'sign-in': {
    heading: 'Your sign-in code',
    sub: 'Use this code to complete your sign-in.',
    expiry: '5 minutes',
  },
  'email-verification': {
    heading: 'Your verification code',
    sub: 'Use this code to verify your Apio account.',
    expiry: '5 minutes',
  },
  'forget-password': {
    heading: 'Your password reset code',
    sub: 'Use this code to reset your password.',
    expiry: '5 minutes',
  },
};

export function otpTemplate(otp: string, type: OtpType): string {
  const { heading, sub, expiry } = OTP_COPY[type];

  // Each digit as a spaced cell
  const digits = otp
    .split('')
    .map(
      (d) =>
        `<td style="padding:0 5px;">
           <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
                        font-size:36px;font-weight:700;color:#18181b;letter-spacing:0;line-height:1;">${d}</span>
         </td>`,
    )
    .join('');

  const content = `
    <!-- Heading -->
    <h1 style="margin:0 0 8px;
               font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
               font-size:22px;font-weight:700;color:#18181b;
               line-height:1.3;letter-spacing:-0.3px;">
      ${heading}
    </h1>
    <p style="margin:0 0 28px;
              font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
              font-size:14px;color:#71717a;line-height:1.6;">
      ${sub}
    </p>

    <!-- OTP digits -->
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"
           style="margin:0 0 8px;">
      <tr>${digits}</tr>
    </table>

    <p style="margin:0 0 28px;
              font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
              font-size:12px;color:#a1a1aa;line-height:1.6;">
      Do not share this code with anyone.
    </p>

    ${footerNote(`Expires in <strong style="color:#52525b;">${expiry}</strong>. If you did not request this, you can safely ignore this email.`)}
  `;

  return baseTemplate(content);
}
