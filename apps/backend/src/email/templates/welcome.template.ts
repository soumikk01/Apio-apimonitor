import { baseTemplate, ctaButton, footerNote, divider } from './base.template';

export function welcomeTemplate(name: string, dashUrl: string): string {
  const content = `
    <h1 style="margin:0 0 8px;
               font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
               font-size:22px;font-weight:700;color:#18181b;letter-spacing:-0.3px;">
      Welcome to Apio, ${name}!
    </h1>
    <p style="margin:0 0 28px;
              font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
              font-size:14px;color:#71717a;line-height:1.6;">
      Your account is ready. Start monitoring your APIs in real time.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           border="0" style="margin-bottom:28px;">
      ${row('Real-time monitoring', 'Track every API request as it happens.')}
      ${row('Instant alerts', 'Get notified the moment something breaks.')}
      ${row('Analytics', 'Understand trends across all your endpoints.')}
    </table>

    ${divider()}
    ${ctaButton('Go to Dashboard', dashUrl)}

    ${footerNote(
      'Questions? Visit <a href="https://apio.one" style="color:#52525b;text-decoration:underline;">apio.one</a>.',
    )}
  `;
  return baseTemplate(content);
}

function row(title: string, desc: string): string {
  return `
    <tr>
      <td valign="top" style="padding:8px 0;">
        <span style="display:block;
                     font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
                     font-size:13px;font-weight:600;color:#18181b;margin-bottom:2px;">${title}</span>
        <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
                     font-size:12px;color:#a1a1aa;">${desc}</span>
      </td>
    </tr>`;
}
