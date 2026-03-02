# Frontend Redirect Debug - Complete

## Problem
The Chat Widget is not redirecting to Calendly even though the API is returning `triggerBooking: true`.

## Debugging Approach
Added comprehensive logging and an alert to identify exactly what's happening in the redirect logic.

## Changes Made

### 1. Added Full API Response Logging
```typescript
const data: EnrichedChatResponse = await res.json()
console.log('[Chat Widget] Full API response:', data)
console.log('[Chat Widget] triggerBooking type:', typeof data.triggerBooking)
console.log('[Chat Widget] triggerBooking value:', data.triggerBooking)
console.log('[Chat Widget] calendlyUrl value:', data.calendlyUrl)
```

### 2. Enhanced Redirect Logic with Alert
```typescript
if (data.triggerBooking && data.calendlyUrl) {
  console.log('[Chat Widget] ✅ TRIGGERING REDIRECT - All conditions met:', {
    triggerBooking: data.triggerBooking,
    triggerBookingType: typeof data.triggerBooking,
    calendlyUrl: data.calendlyUrl,
  })
  
  // Alert to prove this branch is being hit
  window.alert('Redirecting to Calendly...')
  
  // Redirect to Calendly in same tab after short delay so user sees the message
  setTimeout(() => {
    console.log('[Chat Widget] Executing redirect to:', data.calendlyUrl)
    window.location.href = data.calendlyUrl!
  }, 800)
  return
} else {
  console.log('[Chat Widget] ❌ NOT REDIRECTING - Conditions not met:', {
    triggerBooking: data.triggerBooking,
    triggerBookingType: typeof data.triggerBooking,
    calendlyUrl: data.calendlyUrl,
    hasTriggerBooking: !!data.triggerBooking,
    hasCalendlyUrl: !!data.calendlyUrl,
  })
}
```

## What to Look For When Testing

### Scenario 1: Redirect Should Work
**User Action:** Says "Book now" or "I'd like to book a call"

**Expected Console Logs:**
```
[Chat Widget] Full API response: { message: "...", triggerBooking: true, calendlyUrl: "https://...", ... }
[Chat Widget] triggerBooking type: boolean
[Chat Widget] triggerBooking value: true
[Chat Widget] calendlyUrl value: https://calendly.com/...
[Chat Widget] ✅ TRIGGERING REDIRECT - All conditions met: { triggerBooking: true, triggerBookingType: "boolean", calendlyUrl: "https://..." }
[Chat Widget] Executing redirect to: https://calendly.com/...
```

**Expected Behavior:**
- Alert popup: "Redirecting to Calendly..."
- Browser navigates to Calendly after 800ms

### Scenario 2: Redirect Should NOT Work
**User Action:** Provides info but doesn't request booking

**Expected Console Logs:**
```
[Chat Widget] Full API response: { message: "...", triggerBooking: false, calendlyUrl: null, ... }
[Chat Widget] triggerBooking type: boolean
[Chat Widget] triggerBooking value: false
[Chat Widget] calendlyUrl value: null
[Chat Widget] ❌ NOT REDIRECTING - Conditions not met: { triggerBooking: false, triggerBookingType: "boolean", calendlyUrl: null, hasTriggerBooking: false, hasCalendlyUrl: false }
```

**Expected Behavior:**
- No alert popup
- No redirect
- Conversation continues

## Possible Issues to Identify

### Issue 1: triggerBooking is a String
**Symptom:** `triggerBooking type: "string"` and `triggerBooking value: "true"`

**Problem:** The API is returning `"true"` (string) instead of `true` (boolean)

**Fix:** Update API to return boolean instead of string

### Issue 2: calendlyUrl is Missing
**Symptom:** `calendlyUrl value: null` or `undefined`

**Problem:** The API is not returning a Calendly URL

**Fix:** Check Calendly connection and event types in the API

### Issue 3: Alert Doesn't Appear
**Symptom:** No alert popup even when logs show conditions met

**Problem:** The redirect logic is not being executed

**Fix:** Check if there's a JavaScript error preventing execution

### Issue 4: Alert Appears But No Redirect
**Symptom:** Alert appears but browser doesn't navigate

**Problem:** `window.location.href` is being blocked or the URL is invalid

**Fix:** Check browser console for errors, verify Calendly URL is valid

## Testing Steps

1. **Open Browser Console**
   - Press F12 or right-click → Inspect
   - Go to Console tab
   - Filter by `[Chat Widget]` to see relevant logs

2. **Test Booking Intent**
   - Visit https://hvac.rankedceo.com/lead
   - Open chat widget
   - Provide contact info: "I'm John Doe, john@example.com"
   - Request booking: "I'd like to book a call"

3. **Check Console Logs**
   - Look for `[Chat Widget] Full API response`
   - Check `triggerBooking type` and `triggerBooking value`
   - Check `calendlyUrl value`
   - Look for ✅ or ❌ emoji to see which branch executed

4. **Check Alert**
   - If alert appears, the redirect logic is being hit
   - If alert doesn't appear, the conditions are not met

5. **Report Findings**
   - Share the console logs
   - Note whether alert appeared
   - Note whether redirect happened
   - Note any errors in console

## Commit
**Hash:** 890a01c
**Message:** debug: Add comprehensive logging and alert to debug redirect issue

## Deployment Status
- ✅ Committed to main branch
- ✅ Pushed to GitHub
- 🔄 Vercel auto-deploying (1-2 minutes)

## Next Steps

1. **Wait for Deployment** (1-2 minutes)
2. **Test the Chat Widget** with booking intent
3. **Check Console Logs** for the debugging output
4. **Share Findings** including:
   - Console logs showing triggerBooking type and value
   - Console logs showing calendlyUrl value
   - Whether alert appeared
   - Whether redirect happened
   - Any errors in console

## Based on Findings

### If triggerBooking is "true" (string):
Update API to return boolean:
```typescript
// In app/api/agent/chat/route.ts
triggerBooking: wantsBooking && hasEnoughInfo && !!calendlySchedulingUrl
// Ensure this evaluates to boolean, not string
```

### If calendlyUrl is null:
Check Calendly connection in API:
```typescript
// Verify calendlySchedulingUrl is being set correctly
console.log('[Agent Chat] Calendly scheduling URL:', calendlySchedulingUrl)
```

### If alert appears but no redirect:
Check for browser errors and verify URL is valid:
```typescript
// Try alternative redirect method
window.location.assign(data.calendlyUrl!)
// or
window.open(data.calendlyUrl!, '_self')
```

## Documentation
This debugging version will help identify exactly why the redirect isn't working. Once we identify the root cause, we can apply the appropriate fix.