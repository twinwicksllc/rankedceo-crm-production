// lib/waas/services/email-templates/abandonment.ts
//
// Abandonment email sequences for prospects who viewed audit but didn't convert
// Progressive 1h, 24h, 48h, 72h sequence with increasing urgency

import type { NotificationTemplateData } from './types'
import { wrapLayout } from './layout'

export function auditAbandonedStage1(data: NotificationTemplateData): { subject: string; html: string } {
  const businessName = data.businessName ?? 'Your Business'
  const topOpportunity = data.topOpportunities?.[0] ?? 'Improve site structure'
  const auditScore = data.auditScore ?? 0
  const getStartedUrl = data.getStartedUrl ?? '#'

  const subject = `Just checking in — here's what ${businessName} is missing 🔍`

  const content = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">
      Hi there,
    </h1>
    <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.6;">
      You just completed your SEO audit for <strong>${businessName}</strong>. We noticed you haven't started your website yet — so we're sharing your top opportunity:
    </p>
    
    <div style="background:#f5f5f5;padding:20px;border-radius:8px;margin:20px 0;">
      <h3 style="margin:0 0 10px 0;font-size:16px;font-weight:600;color:#0f172a;">${topOpportunity}</h3>
      <p style="margin:0;font-size:14px;color:#666;">Score: <strong>${auditScore}/100</strong></p>
    </div>

    <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.6;">Your audit gives you a clear roadmap. The next step takes just 5 minutes.</p>

    <div style="margin-top:24px;text-align:center;">
      <a href="${getStartedUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:8px;">
        Start Building →
      </a>
    </div>

    <p style="margin:20px 0 0;font-size:12px;color:#94a3b8;text-align:center;">Your audit report and this opportunity will remain valid for 7 days.</p>
  `

  return {
    subject,
    html: wrapLayout(content),
  }
}

export function auditAbandonedStage2(data: NotificationTemplateData): { subject: string; html: string } {
  const businessTrade = data.businessTrade ?? 'Your Business'
  const topOpportunities = data.topOpportunities ?? ['Improve site structure']
  const getStartedUrl = data.getStartedUrl ?? '#'

  const subject = `Your ${businessTrade} could be ranking right now ⏰`

  const content = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">
      24 hours later...
    </h1>
    <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.6;">
      Your competitors aren't waiting. Every day without a professional online presence is a lost opportunity to attract local clients.
    </p>
    
    <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:15px;margin:20px 0;border-radius:4px;">
      <strong>Why this matters:</strong> 76% of consumers use Google to find local services. Without a website, you're invisible to them.
    </div>

    <p style="margin:0 0 15px;font-size:15px;color:#475569;line-height:1.6;">Your audit revealed <strong>${topOpportunities.length} opportunit${topOpportunities.length === 1 ? 'y' : 'ies'}</strong> that could immediately boost your visibility:</p>
    <ul style="margin:0 0 20px;padding-left:20px;color:#475569;font-size:15px;line-height:1.8;">
      ${topOpportunities.slice(0, 2).map((opp: string) => `<li>${opp}</li>`).join('')}
    </ul>

    <div style="margin-top:24px;text-align:center;">
      <a href="${getStartedUrl}" style="display:inline-block;background:#dc2626;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:8px;">
        Start Your Website Today →
      </a>
    </div>

    <p style="margin:20px 0 0;font-size:12px;color:#94a3b8;text-align:center;">⏳ Your audit report is valid for <strong>6 more days</strong>.</p>
  `

  return {
    subject,
    html: wrapLayout(content),
  }
}

export function auditAbandonedStage3(data: NotificationTemplateData): { subject: string; html: string } {
  const businessTrade = data.businessTrade ?? 'Your Business'
  const getStartedUrl = data.getStartedUrl ?? '#'

  const subject = `See how ${businessTrade} like yours are ranking 🚀`

  const content = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">
      48 hours — time to act
    </h1>
    
    <div style="background:#ecfdf5;border-left:4px solid #10b981;padding:15px;margin:20px 0;border-radius:4px;">
      <strong style="color:#059669;">✓ Join 1,000+ local ${businessTrade}</strong> who used RankedCEO to build their online presence and attract more clients.
    </div>

    <p style="margin:0 0 15px;font-size:15px;color:#475569;line-height:1.6;">In just 2-3 days with a professional website, these businesses reported:</p>
    <ul style="margin:0 0 20px;padding-left:20px;color:#475569;font-size:15px;line-height:1.8;">
      <li>📞 <strong>3x more calls</strong> from local customers</li>
      <li>🔍 <strong>First page Google rankings</strong> within 30 days</li>
      <li>💼 <strong>Professional online presence</strong> that instills trust</li>
    </ul>

    <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.6;"><strong>Your advantage:</strong> You already have your SEO audit complete. You know exactly what to optimize. The only thing standing between you and more clients is 30 minutes.</p>

    <div style="margin-top:24px;text-align:center;">
      <a href="${getStartedUrl}" style="display:inline-block;background:#059669;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:8px;">
        Build Your Website Now →
      </a>
    </div>

    <p style="margin:20px 0 0;font-size:12px;color:#94a3b8;text-align:center;">📅 <strong>Limited Time:</strong> Your audit expires in 4 days. Claim your results while fresh.</p>
  `

  return {
    subject,
    html: wrapLayout(content),
  }
}

export function auditAbandonedStage4(data: NotificationTemplateData): { subject: string; html: string } {
  const businessTrade = data.businessTrade ?? 'Your Business'
  const topOpportunitiesCount = data.topOpportunities?.length ?? 1
  const getStartedUrl = data.getStartedUrl ?? '#'

  const subject = `⏳ Last chance: Your ${businessTrade} website (audit expires soon)`

  const content = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#991b1b;">
      Last Call
    </h1>
    
    <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.8;">
      Your SEO audit expires <strong>in 3 days</strong>. After that, you'll need to run a new audit from scratch to regain access to all your optimization opportunities.
    </p>

    <div style="background:#fee2e2;border:2px solid #dc2626;padding:20px;margin:20px 0;border-radius:6px;text-align:center;">
      <h3 style="margin:0 0 10px 0;color:#991b1b;">Don't let this opportunity pass by.</h3>
      <p style="margin:10px 0;color:#7f1d1d;font-size:15px;">Your competitors are already ranking. Start your website in the next few minutes.</p>
    </div>

    <p style="margin:0 0 15px;font-size:15px;color:#475569;line-height:1.6;">Here's what you'll unlock:</p>
    <ul style="margin:0 0 20px;padding-left:20px;color:#475569;font-size:15px;line-height:1.8;">
      <li>✅ Professional website live in 24-48 hours</li>
      <li>✅ SEO optimized from day one</li>
      <li>✅ All ${topOpportunitiesCount} opportunit${topOpportunitiesCount === 1 ? 'y' : 'ies'} from your audit automatically applied</li>
      <li>✅ Ready to start attracting local clients</li>
    </ul>

    <div style="margin-top:24px;text-align:center;">
      <a href="${getStartedUrl}" style="display:inline-block;background:#991b1b;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:8px;">
        Create Website Now →
      </a>
    </div>

    <hr style="margin:30px 0;border:none;border-top:1px solid #e5e7eb;">
    <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
      Your audit report is no longer available after 3 days. This is your last opportunity to start building.
    </p>
  `

  return {
    subject,
    html: wrapLayout(content),
  }
}
