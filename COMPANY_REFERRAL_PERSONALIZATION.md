# Company Referral Personalization - Implementation Summary

**Date**: March 2026  
**Commit**: `594b463`  
**Branch**: `main`  
**Status**: ✅ Complete & Deployed

---

## Overview

This feature adds URL parameter support for company referrals, enabling personalized chat experiences when leads arrive from specific company referral links.

---

## How It Works

### URL Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `?company=` | Company name for personalized greeting | `?company=AcmeCorp` |
| `?ref=` | Referral source for tracking | `?ref=google-ads` |

### Example URLs

```
https://hvac.rankedceo.com/lead?company=AcmeCorp&ref=google-ads
https://plumbing.rankedceo.com/lead?company=HomeDepot&ref=partner
https://electrical.rankedceo.com/lead?company=BuildRight&ref=email-campaign
https://smile.rankedceo.com/assessment?company=DentalGroup&ref=facebook
```

---

## User Experience

### Without Company Parameter (Default)
```
Hi there! 👋 I'm here to help you with your HVAC needs. To get started, 
could you please share your name, phone number, and email address?
```

### With Company Parameter (?company=AcmeCorp)
```
Hi there! We're glad you're here from **AcmeCorp**! 👋 I'm here to help 
you with your HVAC needs. To get started, could you please share your 
name, phone number, and email address?
```

### Chat Header
- **Without company**: Shows "AI Assistant"
- **With company**: Shows "[CompanyName] Assistant" (e.g., "AcmeCorp Assistant")

---

## Files Modified

### Types & Validation
- **`lib/types/appointment.ts`**
  - Added `AgentConversationMetadata` interface
  - Added `metadata?: AgentConversationMetadata | null` to `AgentConversation`
  - Added `companyName?: string` and `referralSource?: string` to `AgentContext`
  - Added `companyName?: string` and `referralSource?: string` to `AgentChatRequest`

- **`lib/validations/appointment.ts`**
  - Added `companyName: z.string().max(200).optional()` to `agentChatSchema`
  - Added `referralSource: z.string().max(200).optional()` to `agentChatSchema`

### Services
- **`lib/services/agent-conversation-service.ts`**
  - Updated `getOrCreateConversation()` to accept optional `metadata` parameter
  - Stores referral metadata in `agent_conversations.metadata` JSONB column on creation
  - Added `updateMetadata()` method for merging metadata into existing conversations

- **`lib/services/ai-agent-service.ts`**
  - Updated `getGreetingMessage()` to accept `companyName` parameter
  - Generates personalized greeting with company name when provided

### API Route
- **`app/api/agent/chat/route.ts`**
  - Destructures `companyName` and `referralSource` from validated request body
  - Builds `referralMetadata` object and passes to `getOrCreateConversation()`
  - Adds `companyName` and `referralSource` to agent context
  - Falls back to stored metadata from existing conversation if not in current request

### Chat Widget
- **`components/agent/chat-widget.tsx`**
  - Added `companyName?: string` and `referralSource?: string` to `ChatWidgetProps`
  - Updated `loadStaticGreeting()` to include company name in greeting
  - Updated chat header to show "[CompanyName] Assistant" when company is set
  - Passes `companyName` and `referralSource` to API on every message send

### Lead Pages (all 4 updated)
- **`app/hvac/lead/page.tsx`** - Reads `?company=` and `?ref=` params
- **`app/plumbing/lead/page.tsx`** - Reads `?company=` and `?ref=` params
- **`app/electrical/lead/page.tsx`** - Reads `?company=` and `?ref=` params
- **`app/smile/assessment/page.tsx`** - Reads `?company=` and `?ref=` params

---

## Data Storage

Referral data is stored in the `agent_conversations.metadata` JSONB column:

```json
{
  "companyName": "AcmeCorp",
  "referralSource": "google-ads"
}
```

This column already existed in the database schema — **no migration required**.

---

## Querying Referral Data

To analyze referral performance in Supabase:

```sql
-- Count conversations by company referral
SELECT 
  metadata->>'companyName' AS company,
  metadata->>'referralSource' AS source,
  COUNT(*) AS total_conversations,
  COUNT(CASE WHEN status = 'booked' THEN 1 END) AS booked,
  ROUND(
    COUNT(CASE WHEN status = 'booked' THEN 1 END)::numeric / COUNT(*) * 100, 1
  ) AS booking_rate_pct
FROM agent_conversations
WHERE metadata->>'companyName' IS NOT NULL
GROUP BY 1, 2
ORDER BY total_conversations DESC;
```

---

## Build & Test Results

- ✅ TypeScript: `npx tsc --noEmit` — 0 errors
- ✅ Next.js Build: `npm run build` — successful, all pages compiled
- ✅ Git: Committed and pushed to `main` (commit `594b463`)
- ✅ Vercel: Auto-deploy triggered

---

## Future Enhancements (Optional)

1. **Company Logo Support** — Display company logo in chat header using a logo URL parameter (`?logo=https://...`)
2. **Company-Specific Quick Replies** — Different quick reply buttons per company
3. **Analytics Dashboard** — Add referral tracking charts to the CRM analytics page
4. **UTM Parameter Support** — Extend to capture `utm_source`, `utm_medium`, `utm_campaign`