// lib/waas/services/email-templates/index.ts

import type { NotificationType } from "../notifications";
import type { NotificationTemplateData } from "./types";
import {
  siteReadyForReview,
  domainStatusUpdate,
  siteLive,
  aiEnhancementReady,
} from "./lifecycle";
import { approvalReceived, clientFirstEdit } from "./admin";
import { subscriptionActivated, paymentFailed, planChanged } from "./billing";
import {
  auditAbandonedStage1,
  auditAbandonedStage2,
  auditAbandonedStage3,
  auditAbandonedStage4,
} from "./abandonment";
import { auditReportReady } from "./audit";
import { onboardingStarted, accountCreated } from "./onboarding";

// ---------------------------------------------------------------------------
// Router: renderEmailTemplate
// ---------------------------------------------------------------------------

export function renderEmailTemplate(
  type: NotificationType,
  data: NotificationTemplateData,
): { subject: string; html: string } {
  switch (type) {
    case "site_ready_for_review":
      return siteReadyForReview(data);
    case "domain_status_update":
      return domainStatusUpdate(data);
    case "site_live":
      return siteLive(data);
    case "approval_received":
      return approvalReceived(data);
    case "client_first_edit":
      return clientFirstEdit(data);
    // Phase 8.3 — billing
    case "subscription_activated":
      return subscriptionActivated(data);
    case "payment_failed":
      return paymentFailed(data);
    case "plan_changed":
      return planChanged(data);
    // Task 4 — abandonment
    case "audit_abandoned_stage_1":
      return auditAbandonedStage1(data);
    case "audit_abandoned_stage_2":
      return auditAbandonedStage2(data);
    case "audit_abandoned_stage_3":
      return auditAbandonedStage3(data);
    case "audit_abandoned_stage_4":
      return auditAbandonedStage4(data);
    // Task 9 — audit report ready
    case "audit_report_ready":
      return auditReportReady(data);
    // Initiative 7 — Tier 2 AI enhancement completion
    case "ai_enhancement_ready":
      return aiEnhancementReady(data);
    // Task 10 — prospect → tenant conversion
    case "onboarding_started":
      return onboardingStarted(data);
    case "account_created":
      return accountCreated(data);
    default: {
      const _never: never = type;
      return {
        subject: "Notification",
        html: `<p>Unknown notification type: ${String(_never)}</p>`,
      };
    }
  }
}

// Barrel re-exports
export type { NotificationTemplateData } from "./types";
export { wrapLayout } from "./layout";
export {
  siteReadyForReview,
  domainStatusUpdate,
  siteLive,
  aiEnhancementReady,
} from "./lifecycle";
export { approvalReceived, clientFirstEdit } from "./admin";
export { subscriptionActivated, paymentFailed, planChanged } from "./billing";
export {
  auditAbandonedStage1,
  auditAbandonedStage2,
  auditAbandonedStage3,
  auditAbandonedStage4,
} from "./abandonment";
export { auditReportReady } from "./audit";
export { onboardingStarted, accountCreated } from "./onboarding";
