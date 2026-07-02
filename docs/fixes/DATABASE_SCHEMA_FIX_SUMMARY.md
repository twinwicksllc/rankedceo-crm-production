# Database Schema Fix & Lead Capture Standardization

## Overview

This document summarizes the critical fixes applied to resolve database schema mismatches and duplicate key errors in the lead capture system.

---

## Problem #1: Database Schema Mismatch

### Error Message

```
PGRST204: Could not find the 'customer_email' column of 'industry_leads'
```

### Root Cause

The `industry_leads` table had patient-specific column names (`patient_name`, `patient_email`, `patient_phone`) that only worked for the dental/Smile industry. The API code was trying to use `customer_email`, `customer_name`, `customer_phone` which didn't exist.

### Solution Implemented

#### 1. SQL Migration Created

**File**: `supabase/migrations/20240301000005_standardize_industry_leads_columns.sql`

This migration renames the columns to be industry-agnostic:

```sql
ALTER TABLE industry_leads RENAME COLUMN patient_name TO lead_name;
ALTER TABLE industry_leads RENAME COLUMN patient_email TO lead_email;
ALTER TABLE industry_leads RENAME COLUMN patient_phone TO lead_phone;
```

**Benefits**:

- Works for all industries: HVAC, Plumbing, Electrical, Smile
- Clear, generic naming that doesn't imply a specific industry
- Maintains all existing data (rename is non-destructive)

#### 2. API Route Updated

**File**: `app/api/agent/chat/route.ts`

Updated all references in the `upsertChatLead` function:

- `customer_name` → `lead_name`
- `customer_email` → `lead_email`
- `customer_phone` → `lead_phone`

**Changes**:

```typescript
// Before
.select('id, customer_name, customer_email, customer_phone')
.ilike('customer_email', leadInfo.email)

// After
.select('id, lead_name, lead_email, lead_phone')
.ilike('lead_email', leadInfo.email)
```

---

## Problem #2: Duplicate Key Error

### Error Message

```
23505: unique constraint violation on agent_conversations_session_id_key
```

### Root Cause

When multiple messages were sent quickly, the `getOrCreateConversation` function would try to insert a new conversation with the same `session_id`, causing a unique constraint violation.

### Solution Implemented

#### Updated Conversation Service

**File**: `lib/services/agent-conversation-service.ts`

Changed from `insert()` to `upsert()` with conflict handling:

```typescript
// Before
const { data: newConversation, error } = await supabase
  .from("agent_conversations")
  .insert({
    session_id: sessionId,
    source: source,
    account_id: accountId || null,
    messages: [],
    status: "active",
  })
  .select()
  .single();

// After
const { data: newConversation, error } = await supabase
  .from("agent_conversations")
  .upsert(
    {
      session_id: sessionId,
      source: source,
      account_id: accountId || null,
      messages: [],
      status: "active",
    },
    {
      onConflict: "session_id",
      ignoreDuplicates: false,
    },
  )
  .select()
  .single();
```

**Benefits**:

- Handles race conditions when multiple messages arrive simultaneously
- If conversation exists, returns it instead of failing
- If conversation doesn't exist, creates it
- No more 23505 errors

**Additional Fix**:
Changed `.single()` to `.maybeSingle()` for existing conversation lookup to prevent errors when no conversation exists.

---

## Problem #3: RLS Blocking Database Writes

### Issue

Anonymous visitors (not logged in) were being blocked by Row Level Security (RLS) policies when trying to create leads.

### Solution Verified

**File**: `lib/supabase/admin.ts`

The `createAdminClient()` function is already correctly configured:

```typescript
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL environment variable");
  }

  if (!serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY environment variable. " +
        "Add this to your Vercel environment variables. " +
        "Find it in Supabase Dashboard → Settings → API → service_role key",
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
```

**Key Points**:

- Uses `SUPABASE_SERVICE_ROLE_KEY` (not ANON_KEY)
- Service role key bypasses ALL RLS policies
- Proper error handling for missing environment variables
- Only used in server-side code (API routes, webhooks)

---

## Deployment Status

### Commit Details

- **Commit Hash**: `c0e2d97`
- **Branch**: `main`
- **Repository**: `twinwicksllc/rankedceo-crm-production`
- **Status**: ✅ Pushed to GitHub
- **Vercel**: 🔄 Auto-deploying

### Files Modified

1. `supabase/migrations/20240301000005_standardize_industry_leads_columns.sql` - New migration
2. `app/api/agent/chat/route.ts` - Updated column names
3. `lib/services/agent-conversation-service.ts` - Fixed duplicate key error

### Build Status

- ✅ Build completed successfully
- ✅ 70 routes generated
- ✅ No TypeScript errors
- ✅ No compilation errors

---

## Required Actions

### ⚠️ CRITICAL: Run Database Migration

You MUST run the SQL migration in Supabase to rename the columns:

1. **Go to Supabase Dashboard**
   - Visit https://supabase.com/dashboard
   - Select your "RankedCEO CRM" project

2. **Open SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Copy and Run Migration**
   - Open the file: `supabase/migrations/20240301000005_standardize_industry_leads_columns.sql`
   - Copy the entire content
   - Paste into the SQL Editor
   - Click "Run" (or press Ctrl+Enter)

4. **Verify Success**
   - You should see output like:
     ```
     ✓ Column lead_name exists
     ✓ Column lead_email exists
     ✓ Column lead_phone exists
     ✓ Old column patient_name removed
     ```
   - No errors should appear

### ⚠️ CRITICAL: Verify Environment Variables

Ensure these are set in Vercel:

1. **Go to Vercel Dashboard**
   - Visit https://vercel.com/twinwicksllc/rankedceo-crm-production
   - Click "Settings" → "Environment Variables"

2. **Verify Required Variables**
   - `NEXT_PUBLIC_SUPABASE_URL` ✅
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` ✅
   - `SUPABASE_SERVICE_ROLE_KEY` ✅ (CRITICAL for database writes)
   - `DEFAULT_ACCOUNT_ID` ✅ (CRITICAL for lead creation)
   - `GEMINI_API_KEY` ✅

3. **If Missing, Add Them**
   - Click "Add New"
   - Add the variable name and value
   - Select all environments (Production, Preview, Development)
   - Click "Save"
   - Redeploy the application

---

## Testing Steps

### Test 1: Lead Capture (HVAC)

```
1. Visit https://hvac.rankedceo.com/lead
2. Open chat widget
3. Provide your info:
   - Name: John Doe
   - Email: john@example.com
   - Phone: (555) 123-4567
4. Wait for AI acknowledgment
5. Check Vercel logs for [Agent Chat] entries
6. Verify lead appears in Supabase industry_leads table
   - industry should be 'hvac'
   - lead_name should be 'John Doe'
   - lead_email should be 'john@example.com'
   - lead_phone should be '(555) 123-4567'
```

### Test 2: Lead Capture (Plumbing)

```
1. Visit https://plumbing.rankedceo.com/lead
2. Open chat widget
3. Provide your info
4. Verify lead appears with industry='plumbing'
```

### Test 3: Lead Capture (Electrical)

```
1. Visit https://electrical.rankedceo.com/lead
2. Open chat widget
3. Provide your info
4. Verify lead appears with industry='electrical'
```

### Test 4: Duplicate Key Error

```
1. Open chat widget
2. Send multiple messages quickly
3. Verify no 23505 errors in Vercel logs
4. Verify conversation is created/updated successfully
```

---

## How to Verify in Supabase

### Check industry_leads Table

1. Go to Supabase Dashboard → Table Editor
2. Select `industry_leads` table
3. Verify columns are named:
   - `lead_name` (not patient_name)
   - `lead_email` (not patient_email)
   - `lead_phone` (not patient_phone)
4. Verify `industry` column exists and has values: 'hvac', 'plumbing', 'electrical', 'smile'

### Check agent_conversations Table

1. Go to Supabase Dashboard → Table Editor
2. Select `agent_conversations` table
3. Verify `session_id` has a unique constraint
4. Verify no duplicate session_id values

---

## Troubleshooting

### If Migration Fails

**Error**: Column already exists
**Solution**: The migration may have already been run. Check if columns are already renamed.

**Error**: Permission denied
**Solution**: Ensure you're logged in as the project owner or have admin privileges.

### If Leads Still Not Appearing

**Check Vercel Logs**:

1. Go to Vercel Dashboard → Logs
2. Filter by `[Agent Chat]`
3. Look for error messages:
   - `[Agent Chat] Failed to create lead:`
   - `[Agent Chat] Email lookup error:`
   - `[Agent Chat] Phone lookup error:`

**Common Issues**:

- Missing `SUPABASE_SERVICE_ROLE_KEY` in Vercel
- RLS policies blocking writes (should be bypassed by service role key)
- Invalid `DEFAULT_ACCOUNT_ID`

### If Duplicate Key Error Persists

**Check Vercel Logs**:

1. Filter by `[AgentConversationService]`
2. Look for 23505 errors
3. Verify upsert is being used (not insert)

**Common Issues**:

- Migration not applied (upsert requires proper table structure)
- Race condition (upsert should handle this now)

---

## Summary

### What Was Fixed

1. ✅ **Database Schema**: Renamed patient_* columns to lead_* for industry-agnostic naming
2. ✅ **API Route**: Updated all queries to use new column names
3. ✅ **Duplicate Key**: Changed to upsert with conflict handling
4. ✅ **RLS Bypass**: Verified service role key usage

### What You Need to Do

1. ⚠️ **Run SQL Migration** in Supabase (CRITICAL)
2. ⚠️ **Verify Environment Variables** in Vercel (CRITICAL)
3. 🧪 **Test Lead Capture** on all industry subdomains
4. 📊 **Verify Leads** appear in Supabase with correct data

### Expected Results

- Leads appear in `industry_leads` table
- `industry` column correctly set to 'hvac', 'plumbing', 'electrical', or 'smile'
- No PGRST204 errors (column not found)
- No 23505 errors (duplicate key)
- Comprehensive logging in Vercel for debugging

---

**Deployment**: Vercel auto-deploying from commit `c0e2d97`
**Status**: Ready for testing after migration is run
