# Column Mapping Issue - Deals Table

## 🔍 Problem Discovered

Your deals table has **completely different column names** than what the application code expects!

### Your Actual Columns vs. Expected Columns

| Your Column Name | Expected Column Name | Purpose |
|-----------------|---------------------|---------|
| `owner_user_id` | `user_id` | User who owns the deal |
| `amount` | `value` | Deal value in dollars |
| `stage_id` | `stage` | Deal stage (as text, not ID) |
| `probability` | `win_probability` | Win probability (0-100%) |
| `close_date` | `expected_close_date` | Expected close date |
| ❌ Missing | `description` | Deal description |
| ❌ Missing | `assigned_to` | User assigned to deal |
| ❌ Missing | `created_by` | User who created deal |

## 📊 Your Complete Deals Table Structure

```
id                    uuid
account_id            uuid
contact_id            uuid
company_id            uuid
owner_user_id         uuid          ← App expects: user_id
title                 varchar
amount                numeric       ← App expects: value
currency              varchar
pipeline_id           uuid
stage_id              uuid          ← App expects: stage (text)
probability           integer       ← App expects: win_probability
close_date            date          ← App expects: expected_close_date
closed_at             timestamp
won                   boolean
lost_reason           text
commission_eligible   boolean
commission_split      jsonb
tags                  ARRAY
custom_fields         jsonb
created_at            timestamp
updated_at            timestamp
ai_win_probability    numeric
ai_confidence_score   numeric
ai_risk_factors       jsonb
```

## ✅ Solution: FINAL_COMPLETE_MIGRATION.sql

This migration file:

### 1. Adds Missing Columns
- `user_id` (UUID)
- `value` (DECIMAL)
- `stage` (VARCHAR)
- `win_probability` (INTEGER)
- `expected_close_date` (DATE)
- `description` (TEXT)
- `assigned_to` (UUID)
- `created_by` (UUID)

### 2. Syncs Data from Existing Columns
```sql
-- Copy existing data to new columns
UPDATE deals SET user_id = owner_user_id;
UPDATE deals SET value = amount;
UPDATE deals SET win_probability = probability;
UPDATE deals SET expected_close_date = close_date;
UPDATE deals SET assigned_to = owner_user_id;
UPDATE deals SET created_by = owner_user_id;

-- Map won/lost status to stage text
UPDATE deals SET stage = CASE 
    WHEN won = true THEN 'Won'
    WHEN won = false THEN 'Lost'
    ELSE 'Lead'
END;
```

### 3. Creates Commission Tracking
- Commission tables and triggers
- Auto-calculates commission when deal is won
- Uses the new `value` column

### 4. Adds Onboarding Features
- Onboarding fields in accounts table
- SECURITY DEFINER functions

## 🎯 Why This Approach?

**Option 1: Add new columns (CHOSEN)**
- ✅ Keeps all existing data intact
- ✅ Doesn't break existing functionality
- ✅ Syncs data automatically
- ✅ Safe and reversible

**Option 2: Rename columns (NOT CHOSEN)**
- ❌ Would break any existing code using old column names
- ❌ More risky
- ❌ Harder to rollback

## 📋 What Happens After Migration

### Your Deals Table Will Have BOTH Sets of Columns:

**Original Columns (still work):**
- `owner_user_id` ✅
- `amount` ✅
- `stage_id` ✅
- `probability` ✅
- `close_date` ✅

**New Columns (for app compatibility):**
- `user_id` ✅ (synced from owner_user_id)
- `value` ✅ (synced from amount)
- `stage` ✅ (mapped from won/lost status)
- `win_probability` ✅ (synced from probability)
- `expected_close_date` ✅ (synced from close_date)

### Commission Triggers Will Use:
- `stage` column (text: 'Won', 'Lost', etc.)
- `value` column (deal amount)
- `user_id` or `assigned_to` or `owner_user_id` (for commission assignment)

## 🧪 Testing After Migration

### 1. Verify Column Sync
```sql
-- Check that data was synced correctly
SELECT 
    id,
    title,
    owner_user_id,
    user_id,           -- Should match owner_user_id
    amount,
    value,             -- Should match amount
    stage_id,
    stage,             -- Should be 'Won', 'Lost', or 'Lead'
    probability,
    win_probability,   -- Should match probability
    close_date,
    expected_close_date -- Should match close_date
FROM deals 
LIMIT 5;
```

### 2. Test Commission Creation
```sql
-- Update a deal to Won
UPDATE deals 
SET stage = 'Won', value = 10000.00
WHERE id = 'some-deal-id';

-- Check if commission was created
SELECT * FROM commissions WHERE deal_id = 'some-deal-id';
```

### 3. Test in Application
1. Go to `/deals` - should load without errors
2. Create a new deal - should save correctly
3. Edit a deal - should update correctly
4. Mark a deal as "Won" - should create commission

## 🔄 Data Synchronization Strategy

The migration includes UPDATE statements that run once to sync data. After that:

**For New Deals:**
- Application will write to new columns (`user_id`, `value`, `stage`, etc.)
- You can optionally add triggers to keep old columns in sync

**For Existing Deals:**
- Data is already synced by the migration
- Both old and new columns have the same data

## 📝 Optional: Keep Columns in Sync

If you want to keep both sets of columns synchronized going forward, you can add triggers:

```sql
-- Trigger to sync user_id → owner_user_id
CREATE OR REPLACE FUNCTION sync_user_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.user_id IS NOT NULL THEN
        NEW.owner_user_id = NEW.user_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_user_id
    BEFORE INSERT OR UPDATE ON deals
    FOR EACH ROW
    EXECUTE FUNCTION sync_user_id();

-- Similar triggers for value ↔ amount, etc.
```

## ✅ Ready to Apply

**File to use:** `FINAL_COMPLETE_MIGRATION.sql`

This migration is specifically customized for your actual database schema and will:
1. Add missing columns
2. Sync existing data
3. Create commission tracking
4. Add onboarding features

All in one go! 🚀