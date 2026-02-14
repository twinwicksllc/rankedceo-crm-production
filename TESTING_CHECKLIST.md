# Post-Migration Testing Checklist

## ✅ Database Verification (Run in Supabase SQL Editor)

### 1. Run the Verification Query
Execute `POST_MIGRATION_VERIFICATION.sql` and verify:
- ✅ All 8 new columns exist in deals table
- ✅ Commission tables (commission_rates, commissions) exist
- ✅ RLS is enabled on commission tables
- ✅ Commission triggers exist on deals table
- ✅ Onboarding fields exist in accounts table

### 2. Verify Data Sync
Check that existing deals have data in the new columns:
```sql
SELECT 
    id,
    title,
    owner_user_id,
    user_id,           -- Should match owner_user_id
    amount,
    value,             -- Should match amount
    stage
FROM deals 
LIMIT 5;
```

---

## 🧪 Application Testing

### Test 1: Deals Page
1. Go to https://crm.rankedceo.com/deals
2. ✅ Page loads without errors
3. ✅ See list of existing deals
4. ✅ Statistics show correctly (total value, won deals, etc.)

### Test 2: Create New Deal
1. Click "New Deal" button
2. Fill in the form:
   - Title: "Test Deal #1"
   - Value: $15,000
   - Stage: "Lead"
   - Win Probability: 50%
   - Expected Close Date: [select a date]
3. Click Save
4. ✅ Deal appears in the list
5. ✅ All fields display correctly

### Test 3: Edit Existing Deal
1. Click on any existing deal
2. Change the stage to "Qualified"
3. Click Save
4. ✅ Changes save successfully
5. ✅ Deal updates in the list

### Test 4: Commission Auto-Creation
1. Edit a deal (or create a new one)
2. Change stage to "Won"
3. Click Save
4. Go to https://crm.rankedceo.com/commissions
5. ✅ New commission record appears
   - Deal value should be set
   - Amount might be $0.00 if no commission rate is set (this is expected)

### Test 5: Set Up Commission Rate
Run this in Supabase SQL Editor:
```sql
-- First, get your user_id and account_id
SELECT id as user_id, account_id 
FROM users 
WHERE email = 'your-email@example.com';

-- Replace with your actual IDs
INSERT INTO commission_rates (account_id, user_id, rate, is_active)
VALUES (
    'your-account-id',   -- Replace with actual account_id
    'your-user-id',      -- Replace with actual user_id
    10.00,               -- 10% commission rate
    true
);
```

Then:
1. Create another deal or use an existing one
2. Change stage to "Won" (if not already)
3. Go to /commissions
4. ✅ Commission amount is calculated correctly (deal_value * rate / 100)

### Test 6: Update Commission Rate
1. Update a deal's value (e.g., from $15,000 to $20,000)
2. Make sure stage is "Won"
3. Go to /commissions
4. ✅ Commission amount updates automatically

### Test 7: Onboarding Wizard
1. Create a new test account (or use an existing account with onboarding_completed = false)
2. Go to https://crm.rankedceo.com/onboarding
3. Complete Step 1: Welcome
4. Complete Step 2: Company Info
5. Complete Step 3: Preferences
6. Complete Step 4: Team Setup
7. Complete Step 5: Finish
8. ✅ Redirects to dashboard
9. ✅ Dashboard shows your name and data

### Test 8: Onboarding Functions
Run this in Supabase SQL Editor to verify onboarding was updated:
```sql
SELECT 
    name,
    onboarding_completed,
    onboarding_step,
    onboarding_skipped,
    onboarding_completed_at
FROM accounts
WHERE id = 'your-account-id';
```

### Test 9: Skip Onboarding
1. Create a new test account
2. Go to /onboarding
3. Click "Skip for now"
4. ✅ Redirects to dashboard
5. ✅ onboarding_skipped = true in database

---

## 🔍 Troubleshooting

### If Deals Page Shows Errors
1. Check browser console for JavaScript errors
2. Check Supabase logs for database errors
3. Verify RLS policies are working:
```sql
SELECT * FROM deals LIMIT 1;
-- Should only show deals for your account
```

### If Commissions Don't Auto-Create
1. Verify trigger exists:
```sql
SELECT trigger_name FROM information_schema.triggers 
WHERE event_object_table = 'deals';
```
2. Check if commission was created:
```sql
SELECT * FROM commissions ORDER BY created_at DESC LIMIT 5;
```
3. Check trigger function logs in Supabase logs

### If Commission Amount is $0
This is expected if no commission rate is set. Set up a commission rate:
```sql
INSERT INTO commission_rates (account_id, user_id, rate, is_active)
VALUES ('your-account-id', 'your-user-id', 10.00, true);
```

### If Onboarding Fails
1. Check if functions exist:
```sql
SELECT routine_name FROM information_schema.routines 
WHERE routine_name IN ('complete_onboarding', 'update_onboarding_step');
```
2. Check accounts table for onboarding fields:
```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'accounts' AND column_name LIKE '%onboarding%';
```

---

## 📊 Expected Results

### Deals Page
- ✅ Loads without 500 errors
- ✅ Shows all existing deals with correct data
- ✅ Can create, edit, and delete deals
- ✅ Filters work (by stage, pipeline, search)

### Commissions Page
- ✅ Loads without errors
- ✅ Shows commission records
- ✅ Auto-creates commissions when deals are won
- ✅ Calculates amounts correctly when commission rate is set

### Onboarding Wizard
- ✅ Loads for new accounts
- ✅ Completes all 5 steps successfully
- ✅ Saves company information
- ✅ Updates account onboarding status

### Database
- ✅ All new columns exist in deals table
- ✅ Data is synced between old and new columns
- ✅ Commission tables exist with RLS
- ✅ Triggers fire correctly
- ✅ Onboarding functions work

---

## 🎯 Success Criteria

You'll know everything is working when:

1. ✅ All database verification queries pass
2. ✅ Deals page shows all deals correctly
3. ✅ Can create new deals with all fields
4. ✅ Commissions auto-create when deals are won
5. ✅ Commission amounts calculate correctly (when rate is set)
6. ✅ Onboarding wizard completes successfully
7. ✅ Dashboard loads without errors
8. ✅ No 500 errors in any pages

---

## 📞 Need Help?

If you encounter any issues:
1. Run the verification query and share results
2. Check browser console for errors
3. Check Supabase logs for database errors
4. Share screenshots of any error pages

---

**Status:** Ready to test
**Estimated time:** 15-30 minutes
**Priority:** High - Verify everything works before proceeding