// lib/waas/services/email-templates/types.ts

export interface NotificationTemplateData {
  businessName?: string;
  businessTrade?: string; // For abandonment emails
  auditScore?: number; // For abandonment emails
  auditGrade?: string; // For abandonment emails
  topOpportunities?: string[]; // For abandonment emails
  getStartedUrl?: string; // For abandonment emails
  variantIndex?: number;
  variantLabel?: string;
  domain?: string;
  domainStatus?: string;
  reviewUrl?: string;
  supportEmail?: string;
  adminNotes?: string;
  // For admin notifications
  tenantSlug?: string;
  editCount?: number;
  // Phase 8.3 — billing
  planLabel?: string; // e.g. 'Standard', 'Premium'
  planInterval?: string; // e.g. 'monthly', 'annual'
  planPrice?: string; // e.g. '$39/mo' or '$399/yr'
  portalUrl?: string; // Stripe Billing Portal URL
  oldPlanLabel?: string; // For plan_changed
  newPlanLabel?: string; // For plan_changed
  // Task 9 — audit report ready email
  auditUrl?: string; // Deep link to web audit report
  pdfUrl?: string; // Direct PDF download link
  targetDomain?: string; // e.g. 'example.com'
  requestorName?: string; // e.g. 'Jane Smith'
  nationalCompetitorNote?: string; // Caveat when tracked competitors aren't local
}
