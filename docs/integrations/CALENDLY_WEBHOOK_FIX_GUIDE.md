# Calendly Webhook Fix Guide

## Problem

Bookings from Calendly are failing to link to accounts because:

1. No matching Calendly connection found in the database
2. No DEFAULT_ACCOUNT_ID environment variable configured
3. URI matching issues (trailing slashes)

## Solution Steps

### Step 1: Verify Database Connection

1. Go to Supabase Dashboard → SQL Editor
2. Run this query to check your Calendly connections:

```sql
SELECT
  id,
  account_id,
  user_id,
  calendly_user_uri,
  calendly_org_uri,
  is_active,
  created_at
FROM calendly_connections
WHERE is_active = true;
```

3. Note the `calendly_user_uri` values - these should match what Calendly sends in webhooks

### Step 2: Get Your Account ID

1. In Supabase Dashboard, go to Table Editor → `accounts` table
2. Find your account (likely named "My Account" or similar)
3. Copy the `id` (UUID) - this is your DEFAULT_ACCOUNT_ID

Example: `123e4567-e89b-12d3-a456-426614174000`

### Step 3: Set DEFAULT_ACCOUNT_ID in Vercel

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add a new variable:
   - **Name**: `DEFAULT_ACCOUNT_ID`
   - **Value**: [Paste your account UUID from Step 2]
   - **Environment**: Production (and Preview if needed)
3. Save the variable
4. Redeploy your application (Vercel will prompt you)

### Step 4: Test the Webhook

1. Create a test booking in Calendly
2. Check Vercel logs for the webhook processing:
   - Look for `[Calendly Webhook]` log entries
   - Verify you see: "Using DEFAULT_ACCOUNT_ID from environment: [your-uuid]"
   - Confirm appointment was created successfully

### Step 5: Verify Appointment Creation

1. In Supabase Dashboard, go to Table Editor → `appointments` table
2. Check that new bookings appear with:
   - `account_id` = your DEFAULT_ACCOUNT_ID
   - `status` = 'scheduled'
   - `invitee_email` = the test email

## What Changed in the Code

### Improved URI Matching

- Now normalizes URIs by removing trailing slashes
- Tries exact match first, then normalized match
- Logs all available URIs for debugging

### Better Fallback Logic

1. First tries to match by `calendly_user_uri`
2. Falls back to most recent active connection
3. Finally uses `DEFAULT_ACCOUNT_ID` from environment
4. Only fails if no connection AND no DEFAULT_ACCOUNT_ID

### Enhanced Logging

- Shows organizer URI being searched
- Lists all available URIs in database
- Indicates which fallback method was used
- Warns if DEFAULT_ACCOUNT_ID is not set

## Troubleshooting

### Issue: Still seeing "No matching Calendly connection found"

**Check:**

1. Is `DEFAULT_ACCOUNT_ID` set in Vercel?
2. Did you redeploy after setting it?
3. Check Vercel logs - does it show the DEFAULT_ACCOUNT_ID value?

### Issue: Appointment created but wrong account

**Check:**

1. Verify the DEFAULT_ACCOUNT_ID UUID is correct
2. Check if there are multiple active connections
3. The code now prefers exact URI matches over fallbacks

### Issue: URI mismatch in logs

**Check:**

1. Compare the organizer URI in logs with database URIs
2. Look for trailing slashes or other formatting differences
3. The code now handles trailing slashes automatically

## Environment Variables Required

Make sure these are set in Vercel:

```bash
CALENDLY_WEBHOOK_SIGNING_KEY=[your Calendly webhook signing key]
DEFAULT_ACCOUNT_ID=[your account UUID]
```

## Next Steps

After this fix:

1. All Calendly bookings will be captured (never lost)
2. Bookings will link to your default account if no specific connection found
3. Better logging helps debug any future issues
4. URI matching is more robust

## Testing Checklist

- [ ] Verified calendly_connections table has active records
- [ ] Copied account UUID from accounts table
- [ ] Added DEFAULT_ACCOUNT_ID to Vercel environment variables
- [ ] Redeployed application
- [ ] Created test booking in Calendly
- [ ] Checked Vercel logs for successful processing
- [ ] Verified appointment created in Supabase
- [ ] Confirmed account_id matches DEFAULT_ACCOUNT_ID
