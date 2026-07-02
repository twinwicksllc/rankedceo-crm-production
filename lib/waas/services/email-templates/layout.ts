// lib/waas/services/email-templates/layout.ts

export function wrapLayout(content: string, preview?: string): string {
  const supportEmail = "support@rankedceo.com";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>RankedCEO</title>
  ${preview ? `<span style="display:none;font-size:1px;color:#fff;max-height:0;max-width:0;overflow:hidden;">${preview}</span>` : ""}
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;">

          <!-- Header -->
          <tr>
            <td style="padding-bottom:24px;text-align:center;">
              <span style="font-size:20px;font-weight:800;color:#0f172a;letter-spacing:-0.5px;">
                Ranked<span style="color:#2563eb;">CEO</span>
              </span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;padding:32px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:20px;text-align:center;font-size:11px;color:#94a3b8;line-height:1.6;">
              Questions? Reply to this email or contact
              <a href="mailto:${supportEmail}" style="color:#2563eb;">${supportEmail}</a>
              <br />
              RankedCEO &middot; Twin-Wicks Digital Solutions
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
