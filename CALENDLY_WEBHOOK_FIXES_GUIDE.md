# Calendly Webhook Fixes - Testing & Debugging Guide

## Issues Fixed

### 1. Cancellation Not Updating Database ✅
**Problem:** Appointments weren't being marked as cancelled when cancelled in Calendly.

**Fix Applied:**
- Added detailed logging to track the cancellation process
- Check if appointment exists before attempting to cancel
- Log appointment details (id, current_status, calendly_invitee_uri)
- Better error messages for debugging

### 2. Invitee Notes Not Captured ✅
**Problem:** User notes/questions from Calendly booking form weren't being saved to the database.

**Fix Applied:**
- Capture `questions_and_answers` from Calendly webhook payload
- Format questions and answers into readable notes
- Store notes in the `description` field of the appointment
- Add logging to track notes capture

---

## Testing the Fixes

### Test 1: Cancellation Flow

1. **Create a test booking**
   - Book an appointment through your Calendly link
   - Verify it appears in the CRM appointments tab with status "scheduled"

2. **Cancel the booking**
   - Go to Calendly and cancel the appointment
   - Wait 1-2 minutes for webhook to process

3. **Check Vercel logs**
   - Go to Vercel Dashboard → Your Project → Logs
   - Look for these log entries:
     ```
     [Calendly Webhook] Processing event type: invitee.canceled
     [Calendly Webhook] Cancelling appointment for invitee: [URI]
     [Calendly Webhook] Found appointment: { id: ..., current_status: 'scheduled', ... }
     [Calendly Webhook] ✅ Appointment cancelled successfully for invitee: [URI]
     ```

4. **Verify in Supabase**
   - Go to Supabase Dashboard → Table Editor → `appointments`
   - Find the appointment by `calendly_invitee_uri`
   - Check that `status` is now `'cancelled'`

5. **Verify in CRM**
   - Refresh the CRM appointments tab
   - The appointment should now appear in "Past Appointments" section
   - Status should show as "Cancelled"

### Test 2: Notes Capture

1. **Create a booking with notes**
   - Book an appointment through Calendly
   - Fill in any questions/notes fields on the booking form
   - Example: "What would you like to discuss?" → "I need help with my HVAC system"

2. **Check Vercel logs**
   - Look for:
     ```
     [Calendly Webhook] Notes captured: Yes
     ```

3. **Verify in Supabase**
   - Go to Supabase Dashboard → Table Editor → `appointments`
   - Find the new appointment
   - Check the `description` field
   - It should contain the formatted notes:
     ```
     What would you like to discuss?: I need help with my HVAC system
     ```

4. **Verify in CRM**
   - Click on the appointment in the CRM
   - The notes should be visible in the appointment details

---

## Debugging Cancellation Issues

### If Cancellation Still Doesn't Work

#### Step 1: Check Vercel Logs
Look for these log patterns:

**Success:**
```
[Calendly Webhook] Found appointment: { id: 'xxx', current_status: 'scheduled', ... }
[Calendly Webhook] ✅ Appointment cancelled successfully
```

**Appointment Not Found:**
```
[Calendly Webhook] ⚠️ No appointment found with calendly_invitee_uri: [URI]
```
**Solution:** The appointment was never created or has a different `calendly_invitee_uri`. Check the database.

**Update Failed:**
```
[Calendly Webhook] ❌ Failed to cancel appointment: [error details]
```
**Solution:** Check the error message for database permission issues or RLS policy problems.

#### Step 2: Verify Webhook is Receiving Events
1. Go to Calendly Dashboard → Integrations → Webhooks
2. Check if your webhook is active
3. Look at webhook delivery logs
4. Verify `invitee.canceled` events are being sent

#### Step 3: Check Database Directly
Run this query in Supabase SQL Editor:

```sql
SELECT 
  id,
  status,
  calendly_invitee_uri,
  calendly_event_uri,
  created_at,
  updated_at
FROM appointments
WHERE calendly_invitee_uri = '[URI_FROM_LOGS]'
ORDER BY created_at DESC;
```

Check:
- Does the appointment exist?
- What is the current `status`?
- What is the `updated_at` timestamp?

#### Step 4: Test Webhook Manually
Use a tool like Postman or curl to test the webhook:

```bash
curl -X POST https://your-app.com/api/calendly/webhook \
  -H "Content-Type: application/json" \
  -H "Calendly-Webhook-Signature: t=1234567890,v1=YOUR_SIGNATURE" \
  -d '{
    "event": "invitee.canceled",
    "payload": {
      "uri": "https://api.calendly.com/scheduled_events/ABC123/invitees/XYZ789"
    }
  }'
```

---

## Debugging Notes Capture Issues

### If Notes Aren't Appearing

#### Step 1: Check Vercel Logs
Look for:
```
[Calendly Webhook] Notes captured: Yes
```

If it says "No", then Calendly isn't sending questions/answers.

#### Step 2: Verify Calendly Event Type
Check the full webhook payload in Vercel logs:

```json
{
  "event": "invitee.created",
  "payload": {
    "questions_and_answers": [
      {
        "question": "What would you like to discuss?",
        "answer": "I need help with my HVAC system"
      }
    ]
  }
}
```

If `questions_and_answers` is missing or empty, Calendly isn't sending it.

#### Step 3: Check Calendly Event Type Settings
1. Go to Calendly Dashboard → Event Types
2. Edit your event type
3. Check "Questions" section
4. Ensure questions are enabled and required

#### Step 4: Verify Database Schema
Run this query:

```sql
SELECT 
  id,
  description,
  calendly_invitee_uri
FROM appointments
WHERE calendly_invitee_uri = '[URI_FROM_LOGS]';
```

Check if `description` is NULL or has the notes.

---

## Common Issues & Solutions

### Issue: Cancellation updates but CRM doesn't show it
**Cause:** Browser cache or page not refreshed
**Solution:** Hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R)

### Issue: Notes appear in database but not in CRM UI
**Cause:** UI component not displaying `description` field
**Solution:** Check the appointment detail page component

### Issue: Webhook not receiving events
**Cause:** Webhook URL incorrect or webhook disabled in Calendly
**Solution:** 
1. Verify webhook URL in Calendly matches your Vercel deployment
2. Check webhook is enabled in Calendly
3. Test webhook delivery in Calendly dashboard

### Issue: RLS policies blocking updates
**Cause:** Row Level Security policies preventing status updates
**Solution:** Check RLS policies on `appointments` table allow UPDATE operations

---

## Monitoring & Alerts

### Key Metrics to Monitor
1. **Cancellation success rate** - Should be close to 100%
2. **Notes capture rate** - Should match your Calendly question configuration
3. **Webhook processing time** - Should be under 5 seconds

### Setting Up Alerts
Consider setting up alerts for:
- Failed webhook processing
- Missing appointments (invitee.created but no database record)
- Cancellation failures

---

## Next Steps

1. **Run the database migration** (if not already done):
   - `supabase/migrations/20240301000001_normalize_calendly_uris.sql`

2. **Test both flows** using the testing guide above

3. **Monitor Vercel logs** for the first few cancellations and bookings

4. **Report any issues** with the log output for debugging

---

## Summary

✅ **Cancellation:** Enhanced logging and verification to ensure appointments are properly cancelled
✅ **Notes:** Capture and store invitee questions/answers from Calendly booking form
✅ **Debugging:** Comprehensive logging for troubleshooting both issues

The fixes are deployed and ready for testing. Follow the testing guide above to verify everything works correctly.