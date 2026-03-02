# Deployment Verification Guide

## Current Deployment Status

### Latest Commit
- **SHA**: `b64eb75090d84eec7cc63ede050e9c863f7895fe`
- **Message**: "feat: Add deployment timestamp to verify code execution in production"
- **Deployed**: 2026-03-02T02:46:33Z (approximately 2 minutes ago)

### What Changed
Added a timestamp log at line 300 in `app/api/agent/chat/route.ts`:
```typescript
console.error('[DEPLOYMENT-TIMESTAMP] Code executed at:', new Date().toISOString())
```

---

## Verification Steps

### Step 1: Test the Chat Widget
1. Visit: https://hvac.rankedceo.com/lead
2. Open the chat widget (bottom-right corner)
3. Type: "I am John Doe, john@example.com"
4. Wait for AI response

### Step 2: Check Vercel Logs
1. Go to Vercel dashboard
2. Select "rankedceo-crm-production" project
3. Click "Logs" tab
4. Filter by: `DEPLOYMENT-TIMESTAMP` or `EMERGENCY`

### Expected Logs

**If code is running correctly, you should see:**
```
[DEPLOYMENT-TIMESTAMP] Code executed at: 2026-03-02T02:50:00.000Z
[EMERGENCY] Name found via hard-coded fallback: John Doe
```

**If you only see the timestamp:**
- Code is running, but the name extraction logic isn't triggering
- This means the regex pattern isn't matching your input

**If you see neither:**
- Code is not executing (deployment/caching issue)
- Try hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)

---

## Code Locations

### Backend: app/api/agent/chat/route.ts

**Line 300 - Timestamp Log:**
```typescript
console.error('[DEPLOYMENT-TIMESTAMP] Code executed at:', new Date().toISOString())
```

**Lines 301-311 - Hard-Coded Fallback:**
```typescript
if (!updatedLeadInfo.name || updatedLeadInfo.name === 'Valued Lead') {
  const userMessagesText = updatedMessages
    .filter(m => m.role === 'user')
    .map(m => m.content)
    .join(' ')
  const nameMatch = userMessagesText.match(/I am ([A-Z][a-z]+ [A-Z][a-z]+)/)
  if (nameMatch && nameMatch[1]) {
    updatedLeadInfo.name = nameMatch[1]
    console.error('[EMERGENCY] Name found via hard-coded fallback:', updatedLeadInfo.name)
  }
}
```

### Frontend: components/agent/chat-widget.tsx

**Lines 178-190 - Redirect Logic:**
```typescript
const shouldBook = String(data.triggerBooking).toLowerCase() === 'true'
const hasShowBookingAction = data.action === 'show_booking' || (data.message || '').toLowerCase().includes('show_booking')

if ((shouldBook || hasShowBookingAction) && data.calendlyUrl) {
  console.error('[FINAL-CHECK] REDIRECT TRIGGERED')
  console.error('[FINAL-CHECK] Calendly URL:', data.calendlyUrl)
  console.error('[FINAL-CHECK] Trigger sources:', { shouldBook, hasShowBookingAction, action: data.action })
  
  window.location.assign(data.calendlyUrl)
  return
}
```

---

## Debugging Scenarios

### Scenario 1: No Logs Appear
**Possible Causes:**
- Vercel deployment still in progress
- Browser caching old JavaScript
- Testing wrong URL/domain

**Solutions:**
- Wait 2-3 minutes for deployment
- Hard refresh browser (Ctrl+Shift+R)
- Verify URL is correct: https://hvac.rankedceo.com/lead

### Scenario 2: Only Timestamp Appears
**Possible Causes:**
- Regex pattern not matching input
- Input format doesn't match pattern

**Solutions:**
- Try exact format: "I am John Doe"
- Pattern requires: "I am " + Capitalized First Name + Space + Capitalized Last Name
- Example matches: "I am John Doe", "I am Jane Smith"
- Example doesn't match: "I'm John Doe", "My name is John Doe", "john doe"

### Scenario 3: Both Logs Appear
**Status:** ✅ Code is working correctly
- The hard-coded fallback is executing
- Name extraction is working
- Proceed to test booking redirect

---

## Test Cases

### Test Case 1: Name Extraction
**Input:** "I am John Doe, john@example.com"
**Expected:**
- `[DEPLOYMENT-TIMESTAMP]` log appears
- `[EMERGENCY] Name found via hard-coded fallback: John Doe` log appears
- Lead saved in Supabase with `lead_name: "John Doe"`

### Test Case 2: Booking Redirect
**Input:** "I'd like to book a call"
**Expected:**
- `[FINAL-CHECK] REDIRECT TRIGGERED` log appears in browser console
- Browser redirects to Calendly URL
- No follow-up questions from AI

### Test Case 3: Partial Information
**Input:** "john@example.com"
**Expected:**
- Lead saved with `lead_name: "Valued Lead"`
- AI asks for name
- When name provided, lead updates with correct name

---

## Next Steps After Verification

### If Timestamp Appears:
1. ✅ Code is deployed and running
2. Test name extraction with exact format: "I am John Doe"
3. Check if `[EMERGENCY]` log appears
4. If not, adjust regex pattern

### If No Logs Appear:
1. Check Vercel deployment status
2. Verify environment variables
3. Check browser console for errors
4. Try different browser/incognito mode

### If Both Logs Appear:
1. ✅ Name extraction working
2. Test booking redirect
3. Verify lead saved in Supabase
4. Test complete user flow

---

## Contact Information

If you encounter issues, please provide:
1. Vercel logs (screenshot or copy)
2. Browser console logs
3. Exact input you typed
4. URL you're testing
5. Browser and version

This will help diagnose the issue quickly.