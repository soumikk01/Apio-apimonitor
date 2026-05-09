import { baseTemplate, ctaButton, footerNote, divider } from './base.template';

export function welcomeTemplate(name: string, dashUrl: string): string {
  const content = `
    <h1 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#1e1b4b;letter-spacing:-0.3px;">
      Welcome, ${name}!
    </h1>
    <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.6;">
      Your Apio account is ready. Start monitoring your APIs in real time.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           border="0" style="margin-bottom:24px;">
      ${row('📡', 'Real-time monitoring', 'Track every API request as it happens.')}
      ${row('🔔', 'Instant alerts', 'Get notified the moment something breaks.')}
      ${row('📊', 'Analytics', 'Understand trends across all your endpoints.')}
    </table>

    ${divider()}
    ${ctaButton('Go to Dashboard', dashUrl)}

    ${footerNote(
      'Questions? Reply to this email or visit ' +
        '<a href="https://apio.one" style="color:#6366f1;text-decoration:none;">apio.one</a>.',
    )}
  `;
  return baseTemplate(content);
}

function row(icon: string, title: string, desc: string): string {
  return `
    <tr>
      <td valign="top" style="padding:7px 0;width:28px;font-size:16px;">${icon}</td>
      <td valign="top" style="padding:7px 0 7px 10px;">
        <span style="display:block;font-size:13px;font-weight:600;color:#1e1b4b;margin-bottom:2px;">${title}</span>
        <span style="font-size:12px;color:#94a3b8;">${desc}</span>
      </td>
    </tr>`;
}
