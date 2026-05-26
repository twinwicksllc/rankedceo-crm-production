// =============================================================================
// lib/waas/services/email-templates.ts
//
// Email template rendering service using Handlebars-style templating.
// Provides subject and HTML for all notification types.
//
// Each template receives context data and renders with proper fallbacks.
// Templates are designed to be responsive, brand-consistent, and conversion-focused.
// =============================================================================

import type { NotificationType } from './notifications'

// ---------------------------------------------------------------------------
// Template Data Types
// ---------------------------------------------------------------------------

export interface NotificationTemplateData {
  // Common fields
  businessName?:      string
  businessTrade?:     string
  auditScore?:        number
  auditGrade?:        string

  // Site ready for review
  variantCount?:      number
  reviewTokenUrl?:    string

  // Domain status update
  domain?:            string
  domainStatus?:      string

  // Site live
  liveUrl?:           string
  siteTitle?:         string

  // Abandonment emails
  auditId?:           string
  abandonmentStage?:  'stage_1' | 'stage_2' | 'stage_3' | 'stage_4'  // 1h, 24h, 48h, 72h
  topOpportunities?:  string[]
  getStartedUrl?:     string

  // Generic fallback
  [key: string]: unknown
}

// ---------------------------------------------------------------------------
// Template Rendering Engine
// ---------------------------------------------------------------------------

function interpolateTemplate(template: string, data: NotificationTemplateData): string {
  let result = template

  // Simple Handlebars-like interpolation: {{variable}}
  Object.entries(data).forEach(([key, value]) => {
    const placeholder = new RegExp(`{{${key}}}`, 'g')
    if (value === null || value === undefined) {
      result = result.replace(placeholder, '')
    } else if (typeof value === 'string' || typeof value === 'number') {
      result = result.replace(placeholder, String(value))
    } else if (Array.isArray(value)) {
      // For arrays, render as comma-separated or list
      const joined = value.join(', ')
      result = result.replace(placeholder, joined)
    }
  })

  return result
}

// ---------------------------------------------------------------------------
// Email Templates
// ---------------------------------------------------------------------------

const TEMPLATES: Record<NotificationType, (data: NotificationTemplateData) => { subject: string; html: string }> = {
  // -----------
  // Abandonment Emails (Task 4)
  // -----------

  site_ready_for_review: (data) => ({
    subject: `Your ${data.businessName || 'site'} designs are ready for review`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Design Review Ready</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1>Your designs are ready! 🎨</h1>
            <p>Hi {{businessName}},</p>
            <p>We've generated {{variantCount}} design variants for your {{businessTrade || 'business'}} website. Review them now and let us know your preferences.</p>
            <p><a href="{{reviewTokenUrl}}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Review Designs →</a></p>
            <p>Best,<br>The RankedCEO Team</p>
          </div>
        </body>
      </html>
    `,
  }),

  domain_status_update: (data) => ({
    subject: `Domain status update for {{domain}}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Domain Update</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1>Domain Status: {{domainStatus}}</h1>
            <p>Hi {{businessName}},</p>
            <p>Your domain <strong>{{domain}}</strong> status has changed to <strong>{{domainStatus}}</strong>.</p>
            <p>If you need any assistance, please reply to this email or contact support.</p>
            <p>Best,<br>The RankedCEO Team</p>
          </div>
        </body>
      </html>
    `,
  }),

  site_live: (data) => ({
    subject: `🎉 {{businessName}}'s website is now live!`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Site Live</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1>Your website is live! 🌐</h1>
            <p>Hi {{businessName}},</p>
            <p>Congratulations! Your new website is now live at <a href="{{liveUrl}}" style="color: #2563eb; text-decoration: none;"><strong>{{liveUrl}}</strong></a></p>
            <p>Share it with your customers and monitor your SEO performance in real-time.</p>
            <p><a href="{{liveUrl}}" style="display: inline-block; padding: 12px 24px; background: #10b981; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Visit Your Site →</a></p>
            <p>Best,<br>The RankedCEO Team</p>
          </div>
        </body>
      </html>
    `,
  }),

  approval_received: (data) => ({
    subject: `Client approved a design variant`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Approval Received</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1>Design approved! ✓</h1>
            <p>Client for {{businessName}} has approved a design variant. Next steps available in your dashboard.</p>
          </div>
        </body>
      </html>
    `,
  }),

  client_first_edit: (data) => ({
    subject: `{{businessName}} made their first edit`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Client Edit</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1>Your client is actively editing 📝</h1>
            <p>{{businessName}} just made their first edit to the site. Check your dashboard for details.</p>
          </div>
        </body>
      </html>
    `,
  }),

  subscription_activated: (data) => ({
    subject: `Payment confirmed for {{businessName}}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Subscription Active</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1>Payment confirmed ✓</h1>
            <p>Your subscription is now active. Welcome to RankedCEO!</p>
          </div>
        </body>
      </html>
    `,
  }),

  payment_failed: (data) => ({
    subject: `Payment failed for {{businessName}} — action required`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Payment Failed</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1>⚠️ Payment failed</h1>
            <p>We tried to process your payment but it failed. Please update your payment method in your account.</p>
          </div>
        </body>
      </html>
    `,
  }),

  plan_changed: (data) => ({
    subject: `Your {{businessName}} plan has been updated`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Plan Changed</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1>Your plan has been updated</h1>
            <p>Your {{businessName}} subscription plan has been modified. Review the changes in your account.</p>
          </div>
        </body>
      </html>
    `,
  }),

  // -----------
  // Abandonment Emails (Task 4)
  // -----------

  audit_abandoned_stage_1: (data) => ({
    subject: `Just checking in — here's what {{businessName}} is missing 🔍`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Audit Follow-up</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1>Hi {{businessName}},</h1>
            <p>We loved your audit results. Your SEO grade: <strong style="font-size: 24px;">{{auditGrade}}</strong></p>
            <p><strong>Top opportunity:</strong> {{topOpportunities}}</p>
            <p>Fixing just this one issue could put you ahead of most of your competitors. Ready to get started?</p>
            <p><a href="{{getStartedUrl}}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Get Started Building →</a></p>
            <p>—<br>The RankedCEO Team</p>
          </div>
        </body>
      </html>
    `,
  }),

  audit_abandoned_stage_2: (data) => ({
    subject: `Your {{businessTrade || 'business'}} could be ranking right now ⏰`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Audit Follow-up</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1>24 hours later...</h1>
            <p>Your competitors aren't waiting. Every day without a proper online presence is lost opportunity.</p>
            <p><strong>Here's what you discovered:</strong></p>
            <ul>
              <li>📊 Overall Score: <strong>{{auditScore}}/100</strong></li>
              <li>🎯 {{topOpportunities}}</li>
            </ul>
            <p>RankedCEO builds beautiful, high-converting websites in days—not months. Your prospects are searching right now.</p>
            <p><a href="{{getStartedUrl}}" style="display: inline-block; padding: 12px 24px; background: #dc2626; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Start Building Today →</a></p>
            <p>—<br>The RankedCEO Team</p>
          </div>
        </body>
      </html>
    `,
  }),

  audit_abandoned_stage_3: (data) => ({
    subject: `See how {{businessTrade || 'businesses'}} like yours are using RankedCEO 🚀`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Audit Follow-up</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1>48 hours — and your competition keeps growing</h1>
            <p>{{businessName}}, your audit shows real opportunity. Hundreds of {{businessTrade || 'businesses'}} are already using RankedCEO to:</p>
            <ul>
              <li>✓ Get ranking in Google within days</li>
              <li>✓ Generate qualified leads automatically</li>
              <li>✓ Stay ahead of local competitors</li>
            </ul>
            <p><strong>Limited-time offer:</strong> Get priority setup if you start today.</p>
            <p><a href="{{getStartedUrl}}" style="display: inline-block; padding: 12px 24px; background: #059669; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Claim Your Spot →</a></p>
            <p>—<br>The RankedCEO Team</p>
          </div>
        </body>
      </html>
    `,
  }),

  audit_abandoned_stage_4: (data) => ({
    subject: `⏳ Last chance: Complete your {{businessName}} website (audit expires soon)`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Final Audit Follow-up</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1>This is your last message 👋</h1>
            <p>{{businessName}}, your audit is expiring in a few days. After that, you'll lose access to your detailed insights.</p>
            <p><strong>Your audit revealed:</strong></p>
            <ul>
              <li>🎯 {{topOpportunities}}</li>
              <li>📈 Grade: {{auditGrade}}</li>
            </ul>
            <p>Don't let this opportunity disappear. Your new website takes just a few steps to build.</p>
            <p><a href="{{getStartedUrl}}" style="display: inline-block; padding: 12px 24px; background: #991b1b; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Build Now — Limited Time →</a></p>
            <p style="font-size: 12px; color: #666;">Your audit report expires in 72 hours.</p>
            <p>—<br>The RankedCEO Team</p>
          </div>
        </body>
      </html>
    `,
  }),
}

// ---------------------------------------------------------------------------
// Public API: Render Template
// ---------------------------------------------------------------------------

export function renderEmailTemplate(
  type: NotificationType,
  data: NotificationTemplateData,
): { subject: string; html: string } {
  const renderer = TEMPLATES[type]

  if (!renderer) {
    console.warn(`[email-templates] Unknown notification type: ${type}`)
    return {
      subject: 'Notification from RankedCEO',
      html: '<p>You have a notification from RankedCEO.</p>',
    }
  }

  try {
    return renderer(data)
  } catch (err) {
    console.error(`[email-templates] Error rendering ${type}:`, err)
    return {
      subject: 'Notification from RankedCEO',
      html: '<p>You have a notification from RankedCEO.</p>',
    }
  }
}
