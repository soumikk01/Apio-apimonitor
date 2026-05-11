/**
 * Base email layout — minimal, Gmail-safe, no SVG, no logo icon.
 * Design: pure white card · soft grey bg · "Apio" wordmark only · clean footer.
 */
export function baseTemplate(content: string): string {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
  <meta name="color-scheme" content="light"/>
  <meta name="supported-color-schemes" content="light"/>
  <title>Apio</title>
  <style>
    :root { color-scheme: light !important; }
    body { margin:0;padding:0;background-color:#f4f4f5 !important; }
    @media (prefers-color-scheme: dark) {
      body { background-color:#f4f4f5 !important; }
      .outer { background-color:#f4f4f5 !important; }
    }
    [data-ogsc] body { background-color:#f4f4f5 !important; }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;" bgcolor="#f4f4f5">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
  class="outer" bgcolor="#f4f4f5"
  style="background-color:#f4f4f5;width:100%;padding:48px 16px;">
  <tr><td align="center" valign="top">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"
      style="width:100%;max-width:480px;">

      <!-- ── WORDMARK HEADER ─────────────────────────────────── -->
      <tr>
        <td align="center" style="padding-bottom:24px;">
          <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
                        font-size:20px;font-weight:800;color:#18181b;letter-spacing:-0.5px;">
            Apio
          </span>
        </td>
      </tr>

      <!-- ── WHITE CARD ─────────────────────────────── -->
      <tr>
        <td bgcolor="#ffffff"
          style="background-color:#ffffff;border-radius:16px;overflow:hidden;
                 box-shadow:0 1px 4px rgba(0,0,0,0.08),0 4px 24px rgba(0,0,0,0.05);">

          <!-- CONTENT AREA -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td bgcolor="#ffffff"
                style="background-color:#ffffff;padding:40px 40px 32px;">
                ${content}
              </td>
            </tr>
          </table>

          <!-- DIVIDER -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="padding:0 40px;">
                <div style="height:1px;background-color:#e4e4e7;font-size:0;line-height:0;">&nbsp;</div>
              </td>
            </tr>
          </table>

          <!-- FOOTER INSIDE CARD -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td align="center" bgcolor="#ffffff"
                style="background-color:#ffffff;border-radius:0 0 16px 16px;padding:24px 40px 28px;">
                <p style="margin:0 0 6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
                           font-size:12px;color:#a1a1aa;line-height:1.6;">
                  &copy; ${year} Apio &nbsp;&middot;&nbsp;
                  <a href="https://apio.one/privacy" style="color:#a1a1aa;text-decoration:underline;">Privacy</a>
                </p>
                <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
                           font-size:11px;color:#d4d4d8;line-height:1.6;">
                  You received this because an action was taken on your Apio account.
                </p>
              </td>
            </tr>
          </table>

        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

/** Dark pill CTA button — matches screenshot style */
export function ctaButton(text: string, url: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"
           style="margin:8px 0;">
      <tr>
        <td bgcolor="#18181b"
            style="background-color:#18181b;border-radius:10px;">
          <a href="${url}"
             style="display:inline-block;padding:14px 32px;color:#ffffff;
                    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
                    font-size:14px;font-weight:600;text-decoration:none;letter-spacing:0.1px;">
            ${text} &rarr;
          </a>
        </td>
      </tr>
    </table>`;
}

/** Muted note inside card — above the card footer divider */
export function footerNote(text: string): string {
  return `
    <p style="margin:24px 0 0;
              font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
              font-size:12px;color:#a1a1aa;line-height:1.7;">${text}</p>`;
}

/** Section divider inside card */
export function divider(): string {
  return `<div style="height:1px;background:#e4e4e7;margin:24px 0;font-size:0;line-height:0;">&nbsp;</div>`;
}
