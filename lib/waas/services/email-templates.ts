// =============================================================================
// lib/waas/services/email-templates.ts
//
// HTML email templates for tenant lifecycle notifications.
//
// Templates are intentionally plain HTML (no React Email dependency) so they
// work in all email clients including Gmail, Outlook, Apple Mail.
//
// All templates use a consistent layout with:
//   - RankedCEO branding header
//   - Content area with business-specific copy
//   - Footer with unsubscribe/support link
//
// Phase 6.4
// =============================================================================

import type { NotificationType } from './notifications'

// ---------------------------------------------------------------------------
// Template data types
// ---------------------------------------------------------------------------

export interface NotificationTemplateData {
  businessName?:  string
  variantIndex?:  number
  variantLabel?:  string
  domain?:        string
  domainStatus?:  string
  reviewUrl?:     string
  supportEmail?:  string
  adminNotes?:    string
  // For admin notifications
  tenantSlug?:    string
  editCount?:     number
  // Phase 8.3 — billing
  planLabel?:     string        // e.g. 'Standard', 'Premium'
  planInterval?:  string        // e.g. 'monthly', 'annual'
  planPrice?:     string        // e.g. '$39/mo' or '$399/yr'
  portalUrl?:     string        // Stripe Billing Portal URL
  oldPlanLabel?:  string        // For plan_changed
  newPlanLabel?:  string        // For plan_changed
}

// ---------------------------------------------------------------------------
// Layout wrapper
// ---------------------------------------------------------------------------

function wrapLayout(content: string, preview?: string): string {
  const supportEmail = 'support@rankedceo.com'

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>RankedCEO</title>
  ${preview ? `<span style="display:none;font-size:1px;color:#fff;max-height:0;max-width:0;overflow:hidden;">${preview}</span>` : ''}
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
              RankedCEO &middot; Powered by AdvantagePoint
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ---------------------------------------------------------------------------
// Template: site_ready_for_review
// ---------------------------------------------------------------------------

function siteReadyForReview(data: NotificationTemplateData): { subject: string; html: string } {
  const name       = data.businessName ?? 'Your business'
  const reviewUrl  = data.reviewUrl ?? '#'

  const subject = `Your ${name} website designs are ready to review 🎨`

  const content = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">
      Your designs are ready! 🎨
    </h1>
    <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.6;">
      Hi there, great news — we've created <strong>3 website designs</strong>
      for <strong>${name}</strong>. Log in to review them, pick your favourite,
      and make any final edits before we go live.
    </p>

    <table role="presentation" width="100%">
      <tr>
        <td style="background:#f1f5f9;border-radius:10px;padding:16px 20px;margin-bottom:20px;">
          <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">
            What to do next
          </p>
          <ol style="margin:0;padding-left:18px;font-size:13px;color:#475569;line-height:1.8;">
            <li>View your 3 website designs</li>
            <li>Pick the design you like best</li>
            <li>Customise text, images, and colours</li>
            <li>Click <strong>Approve &amp; Publish</strong></li>
          </ol>
        </td>
      </tr>
    </table>

    <div style="margin-top:24px;text-align:center;">
      <a href="${reviewUrl}"
         style="display:inline-block;background:#2563eb;color:#ffffff;font-size:14px;font-weight:600;
                text-decoration:none;padding:12px 28px;border-radius:8px;">
        Review My Designs →
      </a>
    </div>

    <p style="margin:20px 0 0;font-size:12px;color:#94a3b8;text-align:center;">
      This link is unique to you — don't share it with others.
    </p>
  `

  return { subject, html: wrapLayout(content, 'Your 3 website designs are ready — click to review and approve.') }
}

// ---------------------------------------------------------------------------
// Template: domain_status_update
// ---------------------------------------------------------------------------

function domainStatusUpdate(data: NotificationTemplateData): { subject: string; html: string } {
  const domain       = data.domain ?? 'your domain'
  const domainStatus = data.domainStatus ?? 'under review'
  const adminNotes   = data.adminNotes

  const subject = `Update on your domain: ${domain}`

  const statusDescriptions: Record<string, string> = {
    under_review:  'Our team is currently reviewing your domain request.',
    provisioning:  'We\'re provisioning your domain — this usually takes 24–48 hours.',
    live:          'Your domain is live and connected to your website!',
    rejected:      'Unfortunately, we weren\'t able to fulfil this domain request.',
  }

  const description = statusDescriptions[domainStatus] ?? 'There\'s an update on your domain request.'

  const content = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">
      Domain update: <span style="font-family:monospace;">${domain}</span>
    </h1>
    <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.6;">
      ${description}
    </p>

    ${adminNotes ? `
    <table role="presentation" width="100%">
      <tr>
        <td style="background:#f8fafc;border-left:3px solid #2563eb;padding:12px 16px;border-radius:0 8px 8px 0;">
          <p style="margin:0;font-size:13px;color:#334155;font-style:italic;">${adminNotes}</p>
        </td>
      </tr>
    </table>
    ` : ''}

    <p style="margin:20px 0 0;font-size:13px;color:#475569;">
      Questions? Reply to this email and we'll be happy to help.
    </p>
  `

  return { subject, html: wrapLayout(content) }
}

// ---------------------------------------------------------------------------
// Template: site_live
// ---------------------------------------------------------------------------

function siteLive(data: NotificationTemplateData): { subject: string; html: string } {
  const name   = data.businessName ?? 'Your business'
  const domain = data.domain

  const subject = `🎉 Your ${name} website is live!`

  const content = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">
      🎉 Your website is live!
    </h1>
    <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.6;">
      Congratulations — <strong>${name}</strong> is now live and ready for customers!
    </p>

    ${domain ? `
    <table role="presentation" width="100%">
      <tr>
        <td style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:16px 20px;text-align:center;">
          <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#16a34a;text-transform:uppercase;">
            Your website
          </p>
          <a href="https://${domain}"
             style="font-size:17px;font-weight:700;color:#15803d;text-decoration:none;font-family:monospace;">
            ${domain}
          </a>
        </td>
      </tr>
    </table>
    ` : ''}

    <p style="margin:20px 0 0;font-size:13px;color:#475569;line-height:1.6;">
      Share your new website with your customers, add it to your Google Business
      Profile, and start getting more enquiries online.
    </p>
  `

  return { subject, html: wrapLayout(content, `${name} is now live — see your new website!`) }
}

// ---------------------------------------------------------------------------
// Template: approval_received (admin notification)
// ---------------------------------------------------------------------------

function approvalReceived(data: NotificationTemplateData): { subject: string; html: string } {
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

function clientFirstEdit(data: NotificationTemplateData): { subject: string; html: string } {
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

// ---------------------------------------------------------------------------
// Template: subscription_activated  (Phase 8.3)
// ---------------------------------------------------------------------------

function subscriptionActivated(data: NotificationTemplateData): { subject: string; html: string } {
  const name       = data.businessName ?? 'Your business'
  const planLabel  = data.planLabel ?? 'your plan'
  const interval   = data.planInterval ?? ''
  const price      = data.planPrice ?? ''
  const portalUrl  = data.portalUrl ?? '#'

  const subject = `✅ Your ${planLabel} plan is now active — welcome aboard!`

  const content = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">
      Payment confirmed ✅
    </h1>
    <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.6;">
      Thank you! Your <strong>${planLabel}</strong> subscription for
      <strong>${name}</strong> is now active${interval ? ` on ${interval} billing` : ''}.
      ${price ? `You'll be billed <strong>${price}</strong>.` : ''}
    </p>

    <table role="presentation" width="100%">
      <tr>
        <td style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:16px 20px;">
          <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#16a34a;text-transform:uppercase;letter-spacing:0.5px;">
            Your active plan
          </p>
          <p style="margin:0;font-size:18px;font-weight:700;color:#15803d;">${planLabel}</p>
          ${interval ? `<p style="margin:4px 0 0;font-size:13px;color:#166534;">${interval} billing${price ? ` · ${price}` : ''}</p>` : ''}
        </td>
      </tr>
    </table>

    <p style="margin:20px 0 8px;font-size:13px;color:#475569;line-height:1.6;">
      You can manage your subscription, update your payment method, or view invoices at any time from your portal.
    </p>

    <div style="margin-top:16px;text-align:center;">
      <a href="${portalUrl}"
         style="display:inline-block;background:#2563eb;color:#ffffff;font-size:14px;font-weight:600;
                text-decoration:none;padding:12px 28px;border-radius:8px;">
        Manage Billing →
      </a>
    </div>
  `

  return { subject, html: wrapLayout(content, `Your ${planLabel} plan is active — all features are now unlocked.`) }
}

// ---------------------------------------------------------------------------
// Template: payment_failed  (Phase 8.3)
// ---------------------------------------------------------------------------

function paymentFailed(data: NotificationTemplateData): { subject: string; html: string } {
  const name      = data.businessName ?? 'Your business'
  const planLabel = data.planLabel ?? 'your plan'
  const portalUrl = data.portalUrl ?? '#'

  const subject = `⚠️ Payment issue with your ${planLabel} plan — action required`

  const content = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">
      Payment failed ⚠️
    </h1>
    <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.6;">
      We were unable to process your payment for the <strong>${planLabel}</strong> plan
      on <strong>${name}</strong>. Please update your payment method as soon as possible
      to avoid any interruption to your service.
    </p>

    <table role="presentation" width="100%">
      <tr>
        <td style="background:#fef2f2;border:1px solid #fca5a5;border-radius:10px;padding:16px 20px;">
          <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#dc2626;text-transform:uppercase;letter-spacing:0.5px;">
            Action required
          </p>
          <p style="margin:0;font-size:14px;color:#991b1b;line-height:1.6;">
            Update your payment method to keep your <strong>${planLabel}</strong> plan active.
            If payment isn't resolved within a few days, your plan may be downgraded.
          </p>
        </td>
      </tr>
    </table>

    <div style="margin-top:24px;text-align:center;">
      <a href="${portalUrl}"
         style="display:inline-block;background:#dc2626;color:#ffffff;font-size:14px;font-weight:600;
                text-decoration:none;padding:12px 28px;border-radius:8px;">
        Update Payment Method →
      </a>
    </div>

    <p style="margin:20px 0 0;font-size:12px;color:#94a3b8;text-align:center;">
      Need help? Reply to this email or contact support@rankedceo.com
    </p>
  `

  return { subject, html: wrapLayout(content, `Action needed: payment failed for your ${planLabel} plan.`) }
}

// ---------------------------------------------------------------------------
// Template: plan_changed  (Phase 8.3)
// ---------------------------------------------------------------------------

function planChanged(data: NotificationTemplateData): { subject: string; html: string } {
  const name        = data.businessName ?? 'Your business'
  const oldPlan     = data.oldPlanLabel ?? 'your previous plan'
  const newPlan     = data.newPlanLabel ?? 'your new plan'
  const interval    = data.planInterval ?? ''
  const price       = data.planPrice ?? ''
  const portalUrl   = data.portalUrl ?? '#'

  // Determine direction
  const planOrder: Record<string, number> = { hosting: 0, hosting_only: 1, standard: 2, premium: 3 }
  const oldRank = planOrder[oldPlan.toLowerCase()] ?? 0
  const newRank = planOrder[newPlan.toLowerCase()] ?? 0
  const isUpgrade = newRank >= oldRank

  const emoji   = isUpgrade ? '🚀' : '📝'
  const verb    = isUpgrade ? 'upgraded' : 'updated'
  const subject = `${emoji} Your plan has been ${verb} to ${newPlan}`

  const accentColor = isUpgrade ? '#2563eb' : '#64748b'
  const bgColor     = isUpgrade ? '#eff6ff' : '#f8fafc'
  const borderColor = isUpgrade ? '#93c5fd' : '#e2e8f0'
  const textColor   = isUpgrade ? '#1d4ed8' : '#334155'

  const content = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">
      Your plan has been ${verb} ${emoji}
    </h1>
    <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.6;">
      The plan for <strong>${name}</strong> has changed from
      <strong>${oldPlan}</strong> to <strong>${newPlan}</strong>.
      ${interval ? `You are now on ${interval} billing.` : ''}
    </p>

    <table role="presentation" width="100%">
      <tr>
        <td style="background:${bgColor};border:1px solid ${borderColor};border-radius:10px;padding:16px 20px;">
          <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:${accentColor};text-transform:uppercase;letter-spacing:0.5px;">
            Your new plan
          </p>
          <p style="margin:0;font-size:18px;font-weight:700;color:${textColor};">${newPlan}</p>
          ${interval ? `<p style="margin:4px 0 0;font-size:13px;color:${textColor};">${interval} billing${price ? ` · ${price}` : ''}</p>` : ''}
        </td>
      </tr>
    </table>

    <p style="margin:20px 0 8px;font-size:13px;color:#475569;line-height:1.6;">
      Your new plan features are effective immediately. View your invoices or manage
      your subscription in the billing portal.
    </p>

    <div style="margin-top:16px;text-align:center;">
      <a href="${portalUrl}"
         style="display:inline-block;background:${accentColor};color:#ffffff;font-size:14px;font-weight:600;
                text-decoration:none;padding:12px 28px;border-radius:8px;">
        View Billing Details →
      </a>
    </div>
  `

  return { subject, html: wrapLayout(content) }
}

// ---------------------------------------------------------------------------
// Router: renderEmailTemplate
// ---------------------------------------------------------------------------

export function renderEmailTemplate(
  type: NotificationType,
  data: NotificationTemplateData,
): { subject: string; html: string } {
  switch (type) {
    case 'site_ready_for_review':  return siteReadyForReview(data)
    case 'domain_status_update':   return domainStatusUpdate(data)
    case 'site_live':              return siteLive(data)
    case 'approval_received':      return approvalReceived(data)
    case 'client_first_edit':      return clientFirstEdit(data)
    // Phase 8.3 — billing
    case 'subscription_activated': return subscriptionActivated(data)
    case 'payment_failed':         return paymentFailed(data)
    case 'plan_changed':           return planChanged(data)
    default: {
      const _never: never = type
      return { subject: 'Notification', html: `<p>Unknown notification type: ${String(_never)}</p>` }
    }
  }
}
