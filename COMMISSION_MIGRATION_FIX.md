# Commission Migration Fix - Stage Column Issue

## Problem
When running the commission tracking migration, you encountered this error:
```
ERROR: 42703: column "stage" of relation "deals" does not exist
```

## Root Cause
The `deals` table in your Supabase database is missing the `stage` column that the commission triggers depend on. The application code expects this column to exist with values like 'Won', 'Lost', 'Lead', etc.

## Solution Applied
I've updated the migration files to:

1. **Check if stage column exists** before creating triggers
2. **Add the stage column** if it's missing
3. **Make stage comparison case-insensitive** (handles 'won', 'Won', 'WON')
4. **Add fallback for user_id** (checks assigned_to, user_id, created_by)

## Files Updated

### 1. CRITICAL_MIGRATIONS_CONSOLIDATED.sql (FIXED)
This is the main file you should use. It now includes:
- Automatic detection and creation of stage column
- Check constraint for valid stage values
- Case-insensitive stage matching in triggers

### 2. FIX_COMMISSIONS_MIGRATION.sql (Standalone)
A standalone version of just the commission migration with the fix applied.

### 3. DIAGNOSE_DEALS_TABLE.sql (Diagnostic)
Run this first if you want to see the current state of your deals table.

## How to Apply the Fix

### Option 1: Use the Fixed Consolidated File (Recommended)
```sql
-- In Supabase SQL Editor, run:
-- Copy and paste entire contents of CRITICAL_MIGRATIONS_CONSOLIDATED.sql
```

### Option 2: Run Just the Commission Fix
```sql
-- In Supabase SQL Editor, run:
-- Copy and paste entire contents of FIX_COMMISSIONS_MIGRATION.sql
```

## What the Fix Does

### Step 1: Adds Stage Column (if missing)
```sql
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'deals' AND column_name = 'stage'
    ) THEN
        ALTER TABLE deals ADD COLUMN stage VARCHAR(50) DEFAULT 'Lead';
        ALTER TABLE deals ADD CONSTRAINT deals_stage_check 
        CHECK (stage IN ('Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost', 
                         'lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'));
    END IF;
END $$;
```

### Step 2: Case-Insensitive Stage Matching
The trigger now uses `LOWER(NEW.stage) = 'won'` instead of `NEW.stage = 'won'`, so it works with:
- 'Won' (capitalized)
- 'won' (lowercase)
- 'WON' (uppercase)

### Step 3: Flexible User ID Lookup
```sql
v_user_id := COALESCE(NEW.assigned_to, NEW.user_id, NEW.created_by);
```
This checks multiple possible columns for the user who should receive the commission.

## Testing After Migration

1. **Create a test deal:**
   - Go to /deals/new
   - Create a deal with a value (e.g., $10,000)
   - Set stage to 'Lead'

2. **Mark it as Won:**
   - Edit the deal
   - Change stage to 'Won'
   - Save

3. **Check commission was created:**
   - Go to /commissions
   - You should see a new commission record
   - Amount should be calculated based on commission rate

4. **Verify commission rate:**
   - If no commission rate exists, commission will be $0.00
   - Set up commission rates at /commissions (if that page exists)
   - Or manually insert a rate:
   ```sql
   INSERT INTO commission_rates (account_id, user_id, rate, is_active)
   VALUES ('your-account-id', 'your-user-id', 10.00, true);
   ```

## Expected Results

After applying the fix:
- ✅ Migration runs without errors
- ✅ Stage column exists in deals table
- ✅ Commission triggers work correctly
- ✅ Commissions auto-create when deals are won
- ✅ Case-insensitive stage matching works
- ✅ /commissions page loads without errors

## If You Still Have Issues

Run the diagnostic query to check your deals table structure:
```sql
-- From DIAGNOSE_DEALS_TABLE.sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'deals'
ORDER BY ordinal_position;
```

Share the results and I can help further troubleshoot.

---

**Status:** Fixed and ready to apply
**Files to use:** CRITICAL_MIGRATIONS_CONSOLIDATED.sql (includes all 3 migrations with fix)