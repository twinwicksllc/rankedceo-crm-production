# Deals Table Fix - Missing Columns Issue

## Problem Summary
The commission migration failed with two errors:
1. **First error:** `column "stage" of relation "deals" does not exist`
2. **Second error:** `column "value" of relation "deals" does not exist`

## Root Cause
Your `deals` table is missing critical columns that the application code expects. The TypeScript interface defines these required fields:

```typescript
export interface Deal {
  id: string;
  created_at: string;
  updated_at: string;
  account_id: string;
  user_id: string;
  contact_id?: string | null;
  company_id?: string | null;
  pipeline_id?: string | null;
  title: string;
  description?: string | null;
  stage: 'Lead' | 'Qualified' | 'Proposal' | 'Negotiation' | 'Won' | 'Lost';  // ❌ MISSING
  value: number;  // ❌ MISSING
  win_probability: number;  // ❌ MISSING
  expected_close_date?: string | null;  // ❌ MISSING
}
```

## Missing Columns
The following columns are missing from your deals table:
- `stage` - Deal stage (Lead, Qualified, Proposal, Negotiation, Won, Lost)
- `value` - Deal value in dollars
- `win_probability` - Probability of winning (0-100%)
- `expected_close_date` - Expected close date
- `assigned_to` - User assigned to the deal
- `created_by` - User who created the deal
- `title` - Deal title
- `description` - Deal description

## Solution Files Created

### 1. **COMPLETE_MIGRATION_WITH_DEALS_FIX.sql** ⭐ (USE THIS ONE!)
This is the comprehensive solution that includes:
- **Step 0:** Fixes the deals table (adds all missing columns)
- **Step 1:** Commission tracking migration
- **Step 2:** Onboarding fields migration
- **Step 3:** Onboarding functions migration

### 2. **FIX_DEALS_TABLE_COMPLETE.sql** (Standalone)
If you only need to fix the deals table, use this file.

### 3. **CHECK_DEALS_COLUMNS.sql** (Diagnostic)
Run this to see what columns currently exist in your deals table.

## How to Apply the Fix

### Recommended Approach: Use the Complete Migration
```sql
-- In Supabase SQL Editor:
-- 1. Copy entire contents of COMPLETE_MIGRATION_WITH_DEALS_FIX.sql
-- 2. Paste into SQL Editor
-- 3. Click "Run"
-- 4. Wait for success message
```

This will:
1. ✅ Create deals table if it doesn't exist
2. ✅ Add all missing columns to deals table
3. ✅ Add proper indexes and constraints
4. ✅ Enable RLS policies
5. ✅ Create commission tracking tables
6. ✅ Add onboarding fields
7. ✅ Add onboarding functions

## What Gets Created/Fixed

### Deals Table Columns Added:
```sql
- stage VARCHAR(50) DEFAULT 'Lead'
- value DECIMAL(12,2) DEFAULT 0.00
- win_probability INTEGER DEFAULT 0 (0-100%)
- expected_close_date DATE
- assigned_to UUID (references users)
- created_by UUID (references users)
- title VARCHAR(255) NOT NULL
- description TEXT
```

### Constraints Added:
```sql
- Stage check constraint (valid values only)
- Win probability check (0-100 range)
- Foreign key references to users, contacts, companies, pipelines
```

### Indexes Created:
```sql
- idx_deals_account_id
- idx_deals_user_id
- idx_deals_contact_id
- idx_deals_company_id
- idx_deals_pipeline_id
- idx_deals_stage
- idx_deals_assigned_to
- idx_deals_created_at
- idx_deals_expected_close_date
```

### RLS Policies:
```sql
- Users can view account deals
- Users can manage account deals
```

## Testing After Migration

### 1. Verify Deals Table Structure
```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'deals'
ORDER BY ordinal_position;
```

You should see all columns including stage, value, win_probability, etc.

### 2. Test Creating a Deal
Go to `/deals/new` and create a test deal:
- Title: "Test Deal"
- Value: $10,000
- Stage: "Lead"
- Win Probability: 50%

### 3. Test Commission Auto-Creation
1. Edit the test deal
2. Change stage to "Won"
3. Save
4. Go to `/commissions`
5. You should see a new commission record (amount will be $0 if no commission rate is set)

### 4. Set Up Commission Rate (Optional)
```sql
-- Insert a test commission rate
INSERT INTO commission_rates (account_id, user_id, rate, is_active)
VALUES (
    'your-account-id',  -- Replace with your account ID
    'your-user-id',     -- Replace with your user ID
    10.00,              -- 10% commission rate
    true
);
```

Then mark another deal as "Won" to see commission calculated correctly.

## Expected Results

After applying the complete migration:
- ✅ Deals table has all required columns
- ✅ Deals page loads without errors
- ✅ Can create, edit, and delete deals
- ✅ Commission tracking works automatically
- ✅ Onboarding wizard works
- ✅ All RLS policies enforce multi-tenant security

## If You Still Have Issues

1. **Run the diagnostic query:**
   ```sql
   -- From CHECK_DEALS_COLUMNS.sql
   SELECT column_name, data_type 
   FROM information_schema.columns
   WHERE table_name = 'deals';
   ```

2. **Check for error messages:**
   - Look for any constraint violations
   - Check if foreign key references exist (users, contacts, companies, pipelines tables)

3. **Share the results:**
   - Copy the column list
   - Copy any error messages
   - I can help troubleshoot further

## Migration Order Matters!

The complete migration file runs in this specific order:
1. **First:** Fix deals table (adds missing columns)
2. **Then:** Create commission tables (depends on deals.stage and deals.value)
3. **Then:** Add onboarding fields
4. **Finally:** Add onboarding functions

This order ensures all dependencies are met.

---

**Status:** Ready to apply
**File to use:** COMPLETE_MIGRATION_WITH_DEALS_FIX.sql
**Estimated time:** 2-3 minutes to run