# Calendly URI Normalization - Systemic Fix

## Problem
The URI matching between Calendly webhooks and the database was fragile and would break for new users due to inconsistent trailing slash formatting.

## Solution: Systemic Normalization

We've implemented a three-part fix to ensure URIs always match:

### 1. OAuth Callback Normalization
**File:** `app/api/calendly/callback/route.ts`

When saving Calendly connection data, we now normalize URIs before storing:

```typescript
// Normalize URIs by trimming trailing slashes
const normalizedUserUri = calendlyUser.uri.replace(/\/$/, '')
const normalizedOrgUri = calendlyUser.organization?.replace(/\/$/, '') || null

await appointmentService.saveCalendlyConnection({
  calendly_user_uri: normalizedUserUri,
  calendly_organization_uri: normalizedOrgUri,
  // ... other fields
})
```

**Impact:** All new connections will be stored without trailing slashes.

### 2. Webhook Normalization
**File:** `app/api/calendly/webhook/route.ts`

When receiving webhook events, we normalize the organizer URI before querying:

```typescript
// Normalize URI by removing trailing slash
const normalizedUri = organizerUri.replace(/\/$/, '')

// Direct normalized match (since we normalize on save now)
const normalizedMatch = connection.find(c => c.calendly_user_uri === normalizedUri)
```

**Impact:** Webhook matching works reliably regardless of how Calendly formats URIs.

### 3. Database Migration
**File:** `supabase/migrations/20240301000001_normalize_calendly_uris.sql`

One-time migration to normalize all existing records:

```sql
UPDATE public.calendly_connections
SET 
  calendly_user_uri = REGEXP_REPLACE(calendly_user_uri, '/$', ''),
  updated_at = NOW()
WHERE calendly_user_uri LIKE '%/';
```

**Impact:** All existing connections are normalized, ensuring immediate fix.

## How It Works

### Before (Fragile)
```
Database: https://api.calendly.com/users/ABC123/
Webhook:  https://api.calendly.com/users/ABC123
Result:   ❌ No match - booked_by_user_id = NULL
```

### After (Robust)
```
Database: https://api.calendly.com/users/ABC123 (normalized on save)
Webhook:  https://api.calendly.com/users/ABC123 (normalized on receive)
Result:   ✅ Match - booked_by_user_id populated
```

## Implementation Steps

### Step 1: Run Database Migration
1. Go to Supabase Dashboard → SQL Editor
2. Copy content of `supabase/migrations/20240301000001_normalize_calendly_uris.sql`
3. Paste and run
4. Verify output shows "✅ Calendly URI normalization complete"

### Step 2: Deploy Code Changes
The code changes are already committed and will be deployed automatically.

### Step 3: Test
1. Create a new test booking in Calendly
2. Check Vercel logs for: "Found normalized match for account: [account-id]"
3. Verify `booked_by_user_id` is populated in Supabase

## Benefits

### ✅ Reliability
- URIs always match regardless of Calendly's formatting
- No more NULL `booked_by_user_id` values
- Consistent behavior across all users

### ✅ Maintainability
- Single source of truth for URI format (no trailing slashes)
- No need for complex matching logic
- Easy to debug and verify

### ✅ Future-Proof
- Works for new users automatically
- No manual URI fixes needed
- Scales to multiple Calendly accounts

## Technical Details

### Normalization Pattern
```typescript
const normalizedUri = uri.replace(/\/$/, '')
```

This regex:
- Matches a trailing slash (`/$`)
- Replaces it with empty string
- Only affects the last character
- Safe for URIs without trailing slashes

### Database Query
```sql
REGEXP_REPLACE(column, '/$', '')
```

This PostgreSQL function:
- Uses regex to find trailing slash
- Removes it from the string
- Only affects rows with trailing slashes
- Preserves all other data

## Verification

After running the migration, verify with this query:

```sql
SELECT 
  id,
  calendly_user_uri,
  CASE 
    WHEN calendly_user_uri LIKE '%/' THEN 'ERROR'
    ELSE 'OK'
  END as status
FROM calendly_connections;
```

All records should show "OK" status.

## Rollback Plan

If needed, you can rollback by:
1. Restoring from database backup
2. Reverting code changes
3. Manually fixing individual URIs

However, this fix is backward compatible and safe to apply.

## Related Files

- `app/api/calendly/callback/route.ts` - OAuth callback with normalization
- `app/api/calendly/webhook/route.ts` - Webhook handler with normalization
- `supabase/migrations/20240301000001_normalize_calendly_uris.sql` - Database migration
- `check_calendly_uris.sql` - Diagnostic query (updated)

## Summary

This systemic fix ensures that:
1. **New connections** are stored with normalized URIs
2. **Webhook events** are normalized before matching
3. **Existing connections** are normalized via migration
4. **All users** benefit from reliable URI matching

The "Address" we store and the "Address" we receive will always match, regardless of how Calendly formats them.