// lib/waas/services/email-templates/index.ts

import type { NotificationType } from '../notifications'
import type { NotificationTemplateData } from './types'
import { siteReadyForReview, domainStatusUpdate, siteLive } from './lifecycle'
import { approvalReceived, clientFirstEdit } from './admin'
import { subscriptionActivated, paymentFailed, planChanged } from './billing'

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

// Barrel re-exports
export type { NotificationTemplateData } from './types'
export { wrapLayout } from './layout'
export { siteReadyForReview, domainStatusUpdate, siteLive } from './lifecycle'
export { approvalReceived, clientFirstEdit } from './admin'
export { subscriptionActivated, paymentFailed, planChanged } from './billing'
