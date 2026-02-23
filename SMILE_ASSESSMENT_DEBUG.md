# Smile Assessment Debugging Guide

## Current Status
✅ Table exists
✅ account_id column exists
✅ Pool Account exists

## Next Debugging Steps

### 1. Check Server Logs for Specific Error

When you submit the form, check the server logs for the detailed error message. The updated code now logs:
```typescript
console.error('[Smile Assessment] Submission failed:', {
  code: insertError.code,
  message: insertError.message,
  details: insertError.details,
  hint: insertError.hint,
});
```

**Look for this in your Vercel logs or browser console.**

### 2. Common Error Codes

If you see an error code, here's what it means:

**42P01** - Table not found
→ Run the migration again

**23503** - Foreign key violation (account_id doesn't exist)
→ The account_id being used doesn't exist in accounts table

**23502** - NOT NULL violation
→ A required field is missing

**42601** - Syntax error in SQL
→ There's an issue with the insert query

**23505** - Unique constraint violation
→ Duplicate data

### 3. Check What Data Is Being Sent

Open browser DevTools (F12) → Network tab → Submit form → Look at the request payload

**Check if these fields are being sent:**
- patient_name ✓ (required)
- patient_email ✓ (required)
- patient_phone ✓ (required)
- patient_dob ✓ (required)
- dentist_name ✓ (required)
- last_dental_visit ✓ (required)
- dental_insurance ✓ (boolean)
- insurance_provider ✓ (optional)
- current_concerns ✓ (optional)
- pain_sensitivity ✓ (optional)
- smile_goals ✓ (array)
- desired_outcome ✓ (optional)
- medical_conditions ✓ (array)
- medications ✓ (optional)
- allergies ✓ (optional)

### 4. Verify Pool Account is Accessible

Run this query in Supabase:
```sql
SELECT id, name, slug, status 
FROM accounts 
WHERE id = '00000000-0000-4000-a000-000000000004';
```

Expected result:
- id: 00000000-0000-4000-a000-000000000004
- name: Smile Pool Account
- slug: smile-pool
- status: active

### 5. Test Direct Insert in Supabase

Try inserting a test record directly in Supabase SQL Editor:

```sql
INSERT INTO smile_assessments (
  account_id,
  auth_user_id,
  patient_name,
  patient_email,
  patient_phone,
  patient_dob,
  dentist_name,
  last_dental_visit,
  dental_insurance,
  insurance_provider,
  current_concerns,
  pain_sensitivity,
  smile_goals,
  desired_outcome,
  medical_conditions,
  medications,
  allergies,
  status
) VALUES (
  '00000000-0000-4000-a000-000000000004',
  '00000000-0000-4000-a000-000000000004',
  'Test Patient',
  'test@example.com',
  '555-1234',
  '1990-01-01',
  'Dr. Test',
  '2023-01-01',
  true,
  'Test Insurance',
  'Test concerns',
  'Low',
  ARRAY['whitening', 'straightening'],
  'Better smile',
  ARRAY[]::TEXT[],
  'None',
  'None',
  'pending'
);
```

**If this works:** The database is fine, issue is in the app code
**If this fails:** There's a database schema issue

### 6. Check RLS Policies

Run this to verify policies are correct:
```sql
SELECT policyname, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'smile_assessments'
ORDER BY cmd;
```

Expected policies:
1. `Users can view account assessments` - SELECT
2. `Users can update account assessments` - UPDATE
3. `Users can delete account assessments` - DELETE
4. `Users can insert account assessments` - INSERT
5. `Allow public insert for patient assessments` - INSERT

### 7. Check the Assessment Form Component

Verify the form is sending all required fields. Check `components/smile/assessment-form.tsx`:

```typescript
// Make sure these are in the form:
- patient_name (required)
- patient_email (required)
- patient_phone (required)
- patient_dob (required)
- dentist_name (required)
- last_dental_visit (required)
- dental_insurance (required)
```

### 8. Check the Form Submission Handler

The form should be calling the server action with all fields. Check if any fields are missing.

## Quick Fix Checklist

- [ ] Check browser console for specific error code
- [ ] Check Vercel logs for detailed error
- [ ] Verify all form fields are being submitted
- [ ] Test direct insert in Supabase SQL Editor
- [ ] Verify RLS policies are active
- [ ] Check if Pool Account has correct status

## Most Likely Issues

1. **Missing required field** - Check the form data being sent
2. **Type mismatch** - Ensure dates are properly formatted
3. **Array fields** - Check smile_goals and medical_conditions are arrays
4. **Account_id issue** - Verify the account_id being used exists

## Next Steps

**Please provide:**
1. The exact error code from browser console or Vercel logs
2. The form data being sent (from Network tab)
3. Whether the direct insert in Supabase worked

This will help me pinpoint the exact issue!