// lib/waas/services/email-templates/admin.ts

import { wrapLayout } from './layout'
import type { NotificationTemplateData } from './types'

// ---------------------------------------------------------------------------
// Template: approval_received (admin notification)
// ---------------------------------------------------------------------------

export function approvalReceived(data: NotificationTemplateData): { subject: string; html: string } {
  const name         = data.businessName ?? 'A tenant'
  const tenantSlug   = data.tenantSlug ?? 'unknown'
  const variantLabel = data.variantLabel ?? `Variant ${data.variantIndex ?? '?'}`

  const subject = `[Action needed] ${name} approved ${variantLabel}`

  const content = `
    <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#0f172a;">
      Client approved — ready to deploy
    </h1>
    <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.6;">
      <strong>${name}</strong> has approved <strong>${variantLabel}</strong>
      and their site is ready for production deployment.
    </p>

    <table role="presentation" width="100%">
      <tr>
        <td style="background:#fafafa;border:1px solid #e2e8f0;border-radius:8px;padding:14px;">
          <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;">Tenant</p>
          <p style="margin:0;font-family:monospace;font-size:13px;color:#334155;">${tenantSlug}</p>
        </td>
      </tr>
    </table>

    <p style="margin:16px 0 0;font-size:13px;color:#475569;">
      Log in to the Command Center to review and deploy.
    </p>
  `

  return { subject, html: wrapLayout(content) }
}

// ---------------------------------------------------------------------------
// Template: client_first_edit (admin digest stub)
// ---------------------------------------------------------------------------

export function clientFirstEdit(data: NotificationTemplateData): { subject: string; html: string } {
  const name       = data.businessName ?? 'A tenant'
  const tenantSlug = data.tenantSlug ?? 'unknown'
  const editCount  = data.editCount ?? 1

  const subject = `[Activity] ${name} has started editing their site`

  const content = `
    <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#0f172a;">
      Client is editing their site
    </h1>
    <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.6;">
      <strong>${name}</strong> has made <strong>${editCount} edit${editCount === 1 ? '' : 's'}</strong>
      to their website. No action needed — just a heads up!
    </p>

    <table role="presentation" width="100%">
      <tr>
        <td style="background:#fafafa;border:1px solid #e2e8f0;border-radius:8px;padding:14px;">
          <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;">Tenant</p>
          <p style="margin:0;font-family:monospace;font-size:13px;color:#334155;">${tenantSlug}</p>
        </td>
      </tr>
    </table>
  `

  return { subject, html: wrapLayout(content) }
}

