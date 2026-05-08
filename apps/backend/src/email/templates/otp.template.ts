import { baseTemplate, footerNote } from './base.template';

export type OtpType = 'sign-in' | 'email-verification' | 'forget-password';

const OTP_COPY: Record<OtpType, { heading: string; sub: string }> = {
  'sign-in':            { heading: 'Your Sign-in verification Code',  sub: 'Use this code to complete your sign-in.' },
  'email-verification': { heading: 'Your Signup verification Code',   sub: 'Use this code to verify your Apio account.' },
  'forget-password':    { heading: 'Your Password Reset Code',        sub: 'Use this code to reset your password.' },
};

export function otpTemplate(otp: string, type: OtpType): string {
  const { heading, sub } = OTP_COPY[type];

  // Split OTP into individual digits for the spaced display
  const digits = otp.split('').map(d =>
    `<td style="padding:0 6px;">
       <span style="font-size:32px;font-weight:700;color:#1e1b4b;letter-spacing:0;">${d}</span>
     </td>`
  ).join('');

  const content = `
    <!-- Heading -->
    <h1 style="margin:0 0 20px;font-size:20px;font-weight:700;color:#1e1b4b;
               text-align:center;line-height:1.4;letter-spacing:-0.2px;">
      ${heading}
    </h1>

    <!-- OTP digits (spaced like reference) -->
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"
           style="margin:0 auto 16px;">
      <tr>${digits}</tr>
    </table>

    <p style="margin:0 0 24px;font-size:12px;color:#94a3b8;text-align:center;">
      Don't share this code to anyone!
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
              <td valign="top" style="padding-right:10px;font-size:16px;">⚠️</td>
              <td>
                <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#92400e;">
                  Was this request not made by you?
                </p>
                <p style="margin:0;font-size:12px;color:#b45309;line-height:1.6;">
                  If you did not initiate this request, you can safely
                  <strong>ignore this email</strong>.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;line-height:1.6;">
      This is an automated message. <strong style="color:#64748b;">Please do not reply.</strong>
    </p>

    ${footerNote(`Expires in <strong>5 minutes</strong>. ${sub}`)}
  `;

  return baseTemplate(content);
}
