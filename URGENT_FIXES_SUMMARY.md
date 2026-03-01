# URGENT FIXES: Column Names & Early Redirect

## Overview
This document summarizes the urgent fixes applied to resolve hardcoded column names and stop early redirects in the chat widget.

---

## Problem #1: Hardcoded Column Names

### Error
The API was still using `customer_email`, `customer_name`, `customer_phone` but the Supabase table was standardized to `lead_email`, `lead_name`, `lead_phone`.

### Root Cause
While the chat API route (`app/api/agent/chat/route.ts`) was updated, the industry-lead action file (`lib/actions/industry-lead.ts`) used by form submissions still had hardcoded `customer_*` column names.

### Solution Implemented

#### Updated lib/actions/industry-lead.ts

**Before:**
```typescript
.insert({
  account_id: accountId,
  auth_user_id: authUserId,
  industry: data.industry,
  customer_name: data.customer_name,
  customer_email: data.customer_email,
  customer_phone: data.customer_phone,
  // ...
})
```

**After:**
```typescript
.insert({
  account_id: accountId,
  auth_user_id: authUserId,
  industry: data.industry,
  lead_name: data.customer_name,
  lead_email: data.customer_email,
  lead_phone: data.customer_phone,
  // ...
})
```

**Also Updated:**
- Search query in `getIndustryLeads()`:
  ```typescript
  // Before
  `customer_name.ilike.%${filters.search}%,customer_email.ilike.%${filters.search}%,customer_phone.ilike.%${filters.search}%,city.ilike.%${filters.search}%`
  
  // After
  `lead_name.ilike.%${filters.search}%,lead_email.ilike.%${filters.search}%,lead_phone.ilike.%${filters.search}%,city.ilike.%${filters.search}%`
  ```

- Enhanced error logging:
  ```typescript
  console.error('[IndustryLead] Insert failed:', insertError.code, insertError.message)
  ```

---

## Problem #2: Early Redirect on Lead Capture

### Issue
The frontend was redirecting to Calendly immediately upon lead capture, without waiting for a "book a call" intent. Users couldn't ask questions (like "pricing") after providing their info.

### Root Cause
The chat widget had TWO redirect paths:
1. `triggerBooking=true` path (correct - only on explicit booking intent)
2. `calendlyUrl` presence path (incorrect - triggered whenever URL was present)

The second path was causing early redirects.

### Solution Implemented

#### Removed Second Redirect Path

**Before:**
```typescript
// Path 1: triggerBooking (correct)
if (data.triggerBooking && data.calendlyUrl && isOpen && wasOpenWhenSent) {
  setTimeout(() => {
    if (isOpen) {
      window.open(data.calendlyUrl!, '_blank')
    }
  }, 800)
  return
}

// Path 2: calendlyUrl presence (INCORRECT - causes early redirect)
if (data.calendlyUrl && isOpen && wasOpenWhenSent) {
  setTimeout(() => {
    if (isOpen) {
      window.open(data.calendlyUrl!, '_blank')
    }
  }, 800)
  return
}
```

**After:**
```typescript
// ONLY redirect when triggerBooking=true (explicit booking intent)
if (data.triggerBooking && data.calendlyUrl && isOpen && wasOpenWhenSent) {
  console.log('[Chat Widget] Triggering Calendly redirect:', {
    triggerBooking: data.triggerBooking,
    calendlyUrl: data.calendlyUrl,
    isOpen,
    wasOpenWhenSent,
  })
  
  setTimeout(() => {
    if (isOpen) {
      console.log('[Chat Widget] Opening Calendly:', data.calendlyUrl)
      window.open(data.calendlyUrl!, '_blank')
    }
  }, 800)
  return
}
```

**Added Logging:**
- Logs when redirect is triggered
- Logs all relevant state variables
- Logs when Calendly is opened

---

## Problem #3: Missing Debug Logging

### Issue
No logging to show the exact keys being sent to Supabase, making it hard to debug column name issues.

### Solution Implemented

#### Added Logging in API Route

**File**: `app/api/agent/chat/route.ts`

```typescript
const leadData = {
  account_id: accountId,
  industry,
  lead_name: leadInfo.name,
  lead_email: leadInfo.email || '',
  lead_phone: leadInfo.phone || '',
  urgency: 'scheduled',
  preferred_contact_method: leadInfo.email ? 'email' : 'phone',
  service_details: { source: 'chat_widget' },
  status: 'new',
}

console.log('[Agent Chat] Attempting upsert with:', leadData)
```

**Benefits**:
- Shows exact keys being sent to Supabase
- Helps verify correct column names are being used
- Easy to debug in Vercel logs

---

## Deployment Status

### Commit Details
- **Commit Hash**: `d98671f`
- **Branch**: `main`
- **Repository**: `twinwicksllc/rankedceo-crm-production`
- **Status**: ✅ Pushed to GitHub
- **Vercel**: 🔄 Auto-deploying

### Files Modified
1. `lib/actions/industry-lead.ts` - Updated column names and enhanced logging
2. `components/agent/chat-widget.tsx` - Fixed early redirect issue
3. `app/api/agent/chat/route.ts` - Added debug logging

### Build Status
- ✅ Build completed successfully
- ✅ 70 routes generated
- ✅ No TypeScript errors
- ✅ No compilation errors

---

## ⚠️ CRITICAL: Required Actions

### 1. Run Database Migration (MUST DO)

If you haven't already run the migration from the previous fix:

```
1. Go to https://supabase.com/dashboard
2. Select "RankedCEO CRM" project
3. Click "SQL Editor" → "New Query"
4. Copy content from: supabase/migrations/20240301000005_standardize_industry_leads_columns.sql
5. Paste and click "Run"
6. Verify success (should see ✓ Column lead_name exists, etc.)
```

### 2. Verify Environment Variables

Ensure these are set in Vercel:
- `SUPABASE_SERVICE_ROLE_KEY` ✅ (CRITICAL for database writes)
- `DEFAULT_ACCOUNT_ID` ✅ (CRITICAL for lead creation)
- `NEXT_PUBLIC_SUPABASE_URL` ✅
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` ✅
- `GEMINI_API_KEY` ✅

---

## Testing Steps

### Test 1: Lead Capture Without Redirect
```
1. Visit https://hvac.rankedceo.com/lead
2. Open chat widget
3. Provide your info:
   - Name: John Doe
   - Email: john@example.com
   - Phone: (555) 123-4567
4. Wait for AI acknowledgment
✅ Expected: AI says "Thanks John!" (NO redirect)
5. Ask a question: "What's your pricing?"
✅ Expected: AI answers pricing question (NO redirect)
```

### Test 2: Lead Capture With Booking Intent
```
1. Visit https://hvac.rankedceo.com/lead
2. Open chat widget
3. Provide your info
4. Wait for AI acknowledgment
5. Type: "I want to book a call"
✅ Expected: AI redirects to Calendly
```

### Test 3: Verify Database Record
```
1. After providing info in chat
2. Check Vercel logs for [Agent Chat] entries
3. Look for: [Agent Chat] Attempting upsert with:
4. Verify keys are: lead_name, lead_email, lead_phone
5. Check Supabase industry_leads table
✅ Expected: John Doe record with correct columns
```

---

## How to Verify in Vercel Logs

### Check Column Names
1. Go to Vercel Dashboard → Logs
2. Filter by `[Agent Chat]`
3. Look for:
   ```
   [Agent Chat] Attempting upsert with: {
     account_id: '...',
     industry: 'hvac',
     lead_name: 'John Doe',
     lead_email: 'john@example.com',
     lead_phone: '(555) 123-4567',
     ...
   }
   ```
4. ✅ Verify keys are `lead_name`, `lead_email`, `lead_phone` (NOT customer_*)

### Check Redirect Behavior
1. Filter by `[Chat Widget]`
2. Look for:
   ```
   [Chat Widget] Triggering Calendly redirect: {
     triggerBooking: true,
     calendlyUrl: '...',
     isOpen: true,
     wasOpenWhenSent: true
   }
   [Chat Widget] Opening Calendly: '...'
   ```
3. ✅ Only appears when user explicitly requests booking

---

## Expected Behavior

### Scenario 1: Provide Info Only
```
User: "My name is John Doe, email john@example.com, phone 555-123-4567"
AI: "Thanks John! I have your information. How can I help you today?"
✅ No redirect
✅ Lead saved to database
```

### Scenario 2: Ask Question After Info
```
User: "What's your pricing?"
AI: "Our pricing starts at $99 for basic service..."
✅ No redirect
✅ User can continue conversation
```

### Scenario 3: Request Booking
```
User: "I want to book a call"
AI: "Perfect, John! I'm opening our booking calendar for you now..."
✅ Redirects to Calendly
✅ Lead already saved from earlier
```

---

## Troubleshooting

### If Leads Still Not Appearing

**Check Vercel Logs**:
1. Filter by `[Agent Chat]`
2. Look for `[Agent Chat] Attempting upsert with:`
3. Verify keys are `lead_name`, `lead_email`, `lead_phone`
4. Look for error messages:
   - `[Agent Chat] Failed to create lead:`
   - `[Agent Chat] Email lookup error:`
   - `[Agent Chat] Phone lookup error:`

**Common Issues**:
- Migration not run (columns still named patient_*)
- Missing `SUPABASE_SERVICE_ROLE_KEY` in Vercel
- RLS policies blocking writes (should be bypassed by service role key)

### If Still Redirecting Early

**Check Vercel Logs**:
1. Filter by `[Chat Widget]`
2. Look for `[Chat Widget] Triggering Calendly redirect:`
3. Verify `triggerBooking: true` only appears on booking intent
4. Check if `triggerBooking: false` but redirect still happens

**Common Issues**:
- Old code cached in browser (hard refresh: Ctrl+Shift+R)
- Vercel deployment not complete (wait 1-2 minutes)
- Multiple redirect paths still exist (should only be one now)

---

## Summary

### What Was Fixed
1. ✅ **Column Names**: Updated all references to use `lead_name`, `lead_email`, `lead_phone`
2. ✅ **Early Redirect**: Removed second redirect path, only redirect on `triggerBooking=true`
3. ✅ **Debug Logging**: Added comprehensive logging for column names and redirect behavior

### What You Need to Do
1. ⚠️ **Run SQL Migration** in Supabase (if not already done)
2. ⚠️ **Verify Environment Variables** in Vercel
3. 🧪 **Test Lead Capture** without redirect
4. 🧪 **Test Booking Intent** with redirect
5. 📊 **Verify Database** records have correct column names

### Expected Results
- Leads appear in `industry_leads` table with `lead_name`, `lead_email`, `lead_phone`
- No redirect when user provides info
- Redirect only when user explicitly requests booking
- Comprehensive logging in Vercel for debugging

---

**Deployment**: Vercel auto-deploying from commit `d98671f`
**Status**: Ready for testing after migration is run