# Calendly URI Matching Fix Guide

## Problem
The `booked_by_user_id` field is NULL in appointments because the `calendly_user_uri` in the database doesn't exactly match the URI sent by Calendly in webhooks.

## Quick Diagnosis

### Step 1: Run Diagnostic Query
Run the SQL in `check_calendly_uris.sql` in Supabase SQL Editor.

### Step 2: Get Vercel Log URI
Check your latest Vercel webhook logs for:
```
[Calendly Webhook] Looking for connection with organizer URI: [COPY THIS]
```

### Step 3: Compare
Look for differences:
- **Trailing slashes**: `https://api.calendly.com/users/ABC123` vs `https://api.calendly.com/users/ABC123/`
- **Encoding**: Spaces or special characters
- **Protocol**: `http://` vs `https://`
- **Case sensitivity**: Usually not an issue for URIs

## Common Issues & Fixes

### Issue 1: Trailing Slash
**Database has:** `https://api.calendly.com/users/ABC123/`  
**Log shows:** `https://api.calendly.com/users/ABC123`

**Fix:**
```sql
UPDATE calendly_connections
SET calendly_user_uri = 'https://api.calendly.com/users/ABC123'
WHERE id = [your-connection-id];
```

### Issue 2: Missing Trailing Slash
**Database has:** `https://api.calendly.com/users/ABC123`  
**Log shows:** `https://api.calendly.com/users/ABC123/`

**Fix:**
```sql
UPDATE calendly_connections
SET calendly_user_uri = 'https://api.calendly.com/users/ABC123/'
WHERE id = [your-connection-id];
```

### Issue 3: Wrong User URI
If the database has a completely different URI, you may need to:
1. Get the correct URI from your Calendly account settings
2. Update the connection record
3. Or create a new connection

## After Fixing

### 1. Test the Fix
Create a new test booking in Calendly.

### 2. Check Vercel Logs
Look for:
```
[Calendly Webhook] Found exact match for account: [account-id]
```

### 3. Verify in Supabase
Check the new appointment:
```sql
SELECT 
  id,
  account_id,
  booked_by_user_id,
  invitee_email,
  created_at
FROM appointments
ORDER BY created_at DESC
LIMIT 1;
```

The `booked_by_user_id` should now have a value (not NULL).

## What the Code Does Now

The webhook tries to match URIs in this order:

1. **Exact match** - `calendly_user_uri === organizerUri`
2. **Normalized match** - Removes trailing slashes from both, then compares
3. **Fallback connection** - Uses most recent active connection
4. **DEFAULT_ACCOUNT_ID** - Uses default account (sets user_id to NULL)

If you want the `booked_by_user_id` to be populated, you need either:
- An exact or normalized URI match (Steps 1 or 2)
- A fallback connection (Step 3)

## Preventing Future Issues

### Option 1: Store Both Variants
Add a normalized URI column:
```sql
ALTER TABLE calendly_connections
ADD COLUMN calendly_user_uri_normalized TEXT;

UPDATE calendly_connections
SET calendly_user_uri_normalized = REGEXP_REPLACE(calendly_user_uri, '/$', '');

CREATE INDEX idx_calendly_connections_normalized 
ON calendly_connections(calendly_user_uri_normalized);
```

### Option 2: Update Connection Logic
When creating Calendly connections, always normalize URIs before storing:
```typescript
const normalizedUri = calendlyUserUri.replace(/\/$/, '')
```

## Need Help?

If you share:
1. The output from `check_calendly_uris.sql`
2. The exact URI from your Vercel logs

I can immediately provide the exact UPDATE query to fix your database record.