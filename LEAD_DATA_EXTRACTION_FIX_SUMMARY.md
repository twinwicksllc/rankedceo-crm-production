# Lead Data Extraction & Redirect Visibility Fix - Complete

## Problem
1. Lead records were being created with NULL values for email and name
2. Redirect logic wasn't visible in basic log captures

## Root Causes

### Issue 1: Extraction Logic Not Capturing Data
The `extractLeadInfo()` function was failing to capture email and name from user messages, but we couldn't see why because there was no logging of the extraction results.

### Issue 2: Console Logs Not Visible
The redirect logic was using `console.log()` which might not show up in basic log captures, making it hard to debug.

## Solutions Applied

### 1. Added Detailed Extraction Logging
```typescript
// Extract lead info from full conversation (including current turn)
const extracted = extractLeadInfo(updatedMessages)

console.log('[Agent Chat] Extraction results:', {
  extracted,
  contextLeadInfo: context.leadInfo,
  conversationLead: {
    name: conversation?.lead_name,
    email: conversation?.lead_email,
    phone: conversation?.lead_phone,
  },
})

const updatedLeadInfo = {
  name: context.leadInfo?.name || extracted.name || conversation?.lead_name || undefined,
  email: context.leadInfo?.email || extracted.email || conversation?.lead_email || undefined,
  phone: context.leadInfo?.phone || extracted.phone || conversation?.lead_phone || undefined,
}

console.log('[Agent Chat] Post-extraction check:', {
  leadInfo: updatedLeadInfo,
})
```

**What This Shows:**
- What the extraction function found
- What was already in context
- What was in the conversation
- The final merged lead info

### 2. Changed Default Name
```typescript
// Before
lead_name: leadInfo.name || 'Unknown'

// After
lead_name: leadInfo.name || 'Valued Lead'
```

**Why:** "Valued Lead" is more professional than "Unknown" when a name isn't captured.

### 3. Changed Frontend Logs to console.error
```typescript
// Before
console.log('[Chat Widget] ✅ TRIGGERING REDIRECT - All conditions met:', {...})
console.log('[Chat Widget] ❌ NOT REDIRECTING - Conditions not met:', {...})

// After
console.error('[Chat Widget] ✅ TRIGGERING REDIRECT - All conditions met:', {...})
console.error('[Chat Widget] ❌ NOT REDIRECTING - Conditions not met:', {...})
```

**Why:** `console.error()` is more visible in log captures and won't be filtered out.

## What to Look For When Testing

### Check Vercel Logs for Extraction Results

**Expected Output When Extraction Works:**
```json
{
  "extracted": {
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "555-123-4567"
  },
  "contextLeadInfo": {},
  "conversationLead": {
    "name": null,
    "email": null,
    "phone": null
  }
}
```

**Expected Output When Extraction Fails:**
```json
{
  "extracted": {
    "name": undefined,
    "email": undefined,
    "phone": undefined
  },
  "contextLeadInfo": {},
  "conversationLead": {
    "name": null,
    "email": null,
    "phone": null
  }
}
```

### Check Post-Extraction Check

**Expected Output When Data is Captured:**
```json
{
  "leadInfo": {
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "555-123-4567"
  }
}
```

**Expected Output When Data is Missing:**
```json
{
  "leadInfo": {
    "name": undefined,
    "email": undefined,
    "phone": undefined
  }
}
```

### Check Browser Console for Redirect Logs

**Expected When Redirect Should Work:**
```
[Chat Widget] Full API response: { triggerBooking: true, calendlyUrl: "https://...", ... }
[Chat Widget] triggerBooking type: boolean
[Chat Widget] triggerBooking value: true
[Chat Widget] calendlyUrl value: https://calendly.com/...
[Chat Widget] ✅ TRIGGERING REDIRECT - All conditions met: { triggerBooking: true, triggerBookingType: "boolean", calendlyUrl: "https://..." }
Alert: Redirecting to Calendly...
[Chat Widget] Executing redirect to: https://calendly.com/...
```

**Expected When Redirect Should NOT Work:**
```
[Chat Widget] Full API response: { triggerBooking: false, calendlyUrl: null, ... }
[Chat Widget] triggerBooking type: boolean
[Chat Widget] triggerBooking value: false
[Chat Widget] calendlyUrl value: null
[Chat Widget] ❌ NOT REDIRECTING - Conditions not met: { triggerBooking: false, triggerBookingType: "boolean", calendlyUrl: null, hasTriggerBooking: false, hasCalendlyUrl: false }
```

## Testing Steps

1. **Wait for Deployment** (1-2 minutes)

2. **Test Lead Capture:**
   - Visit https://hvac.rankedceo.com/lead
   - Open chat widget
   - Type: "I'm John Doe, john@example.com, 555-123-4567"

3. **Check Vercel Logs:**
   - Look for `[Agent Chat] Extraction results`
   - Verify `extracted` has the correct values
   - Verify `leadInfo` in post-extraction check has values

4. **Check Supabase:**
   - Go to industry_leads table
   - Find the new record
   - Verify lead_name, lead_email, lead_phone are NOT NULL

5. **Test Redirect:**
   - After providing info, type: "I'd like to book a call"
   - Check browser console for redirect logs
   - Verify alert appears
   - Verify redirect happens

## Possible Issues to Identify

### Issue 1: Extraction Returns All Undefined
**Symptom:** `extracted: { name: undefined, email: undefined, phone: undefined }`

**Possible Causes:**
- Regex patterns not matching user input
- User input format not expected
- Messages array not being passed correctly

**Next Steps:**
- Check the actual user message text in logs
- Verify regex patterns match the input format
- Test with different input formats

### Issue 2: Email Captured But Name Not
**Symptom:** `extracted: { name: undefined, email: "john@example.com", phone: undefined }`

**Possible Causes:**
- Name regex patterns too restrictive
- User didn't provide name in expected format
- Name extraction logic has bugs

**Next Steps:**
- Check user message text
- Test with different name formats ("I'm John", "My name is John", "John here")
- Simplify name extraction logic

### Issue 3: Lead Created with Empty Strings
**Symptom:** Supabase shows `lead_email: ""` or `lead_phone: ""`

**Possible Causes:**
- Extraction returned empty strings instead of undefined
- Logic is passing empty strings through

**Next Steps:**
- Check extraction results in logs
- Verify empty string handling in upsert logic

### Issue 4: Redirect Still Not Working
**Symptom:** Alert appears but no redirect

**Possible Causes:**
- Calendly URL is invalid
- Browser blocking redirect
- JavaScript error

**Next Steps:**
- Check browser console for errors
- Verify Calendly URL is valid
- Try alternative redirect methods

## Commit
**Hash:** ce80049
**Message:** fix: Improve lead data extraction and redirect visibility

## Deployment Status
- ✅ Committed to main branch
- ✅ Pushed to GitHub
- 🔄 Vercel auto-deploying (1-2 minutes)

## Next Steps

1. **Wait for Deployment** (1-2 minutes)
2. **Test Lead Capture** with real data
3. **Check Vercel Logs** for extraction results
4. **Check Supabase** for lead record
5. **Test Redirect** functionality
6. **Share Findings** including:
   - Extraction results from logs
   - Post-extraction check results
   - Supabase record data
   - Browser console logs
   - Whether redirect worked

## Documentation
This fix adds comprehensive logging to identify exactly why lead data extraction is failing. Once we see the extraction results in the logs, we'll know exactly what needs to be fixed in the extraction logic.