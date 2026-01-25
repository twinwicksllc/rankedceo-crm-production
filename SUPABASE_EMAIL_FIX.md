# Supabase Email Confirmation URL Fix

## Problem
After signing up, users receive an email confirmation link that points to `http://localhost:3000` instead of the production domain `https://crm.rankedceo.com`. This causes the confirmation link to fail.

## Root Cause
The `NEXT_PUBLIC_APP_URL` environment variable was set to `https://rankedceo.com` instead of `https://crm.rankedceo.com`.

Supabase uses `NEXT_PUBLIC_APP_URL` to generate email confirmation links and other redirect URLs.

## Solution

### 1. Update Environment Variable in Vercel

**Go to Vercel:**
1. Navigate to: https://vercel.com/twinwicksllc/rankedceo-crm-production/settings/environment-variables
2. Find or create: `NEXT_PUBLIC_APP_URL`
3. Set the value to: `https://crm.rankedceo.com`
4. Make sure it's set for:
   - Production
   - Preview
   - Development

### 2. Update Local Environment Files

**Files Updated:**
- `.env.production` - Changed from `https://rankedceo.com` to `https://crm.rankedceo.com`
- `.env.example` - Added production URL reference

### 3. Redeploy Application

After updating the environment variable in Vercel:
1. Go to: https://vercel.com/twinwicksllc/rankedceo-crm-production
2. Click "Redeploy" or push a new commit
3. Wait for deployment to complete (1-2 minutes)

### 4. Verify the Fix

**To test:**
1. Try to sign up with a new email address
2. Check your email inbox
3. Click the confirmation link
4. Verify it redirects to `https://crm.rankedceo.com` instead of localhost
5. Confirm email verification works

## Why This Happens

Supabase Auth automatically:
- Reads `NEXT_PUBLIC_APP_URL` from environment variables
- Uses it as the base URL for:
  - Email confirmation links
  - Password reset links
  - Magic link redirects
  - OAuth redirects

If this variable is incorrect, all email-based authentication flows will fail.

## Additional Supabase Configuration

For complete email authentication setup, also verify:

### Supabase Project Settings

1. Go to your Supabase project: https://supabase.com/dashboard/project/YOUR_PROJECT_ID
2. Navigate to: **Authentication** → **URL Configuration**
3. Set:
   - **Site URL**: `https://crm.rankedceo.com`
   - **Redirect URLs**: 
     ```
     https://crm.rankedceo.com/auth/callback
     https://crm.rankedceo.com/**
     ```
4. Click **Save**

### Email Templates (Optional)

You can customize email templates in Supabase:
1. Navigate to: **Authentication** → **Email Templates**
2. Customize:
   - Confirm signup
   - Reset password
   - Magic link
   - Change email address

Make sure to use the `{{ .SiteURL }}` variable in templates to respect the `NEXT_PUBLIC_APP_URL` setting.

## Testing Checklist

After deploying the fix:

- [ ] Sign up with a new email address
- [ ] Receive confirmation email
- [ ] Click confirmation link
- [ ] Verify redirect to `https://crm.rankedceo.com`
- [ ] Confirm email is verified
- [ ] Can successfully log in
- [ ] Test password reset flow (if implemented)
- [ ] Test magic link flow (if implemented)

## Troubleshooting

### Issue: Email still points to localhost after update

**Solution:**
- Ensure you redeployed after updating the environment variable
- Clear browser cache
- Try in Incognito/Private mode
- Check Vercel deployment logs to confirm the new environment variable was used

### Issue: Email points to wrong domain

**Solution:**
- Double-check `NEXT_PUBLIC_APP_URL` in Vercel
- Verify no typos in the URL
- Check Supabase Auth settings for Site URL
- Ensure the domain is correctly whitelisted in Supabase

### Issue: Confirmation link works but doesn't verify email

**Solution:**
- Check Supabase logs for errors
- Verify Supabase Auth is enabled
- Check email settings in Supabase dashboard
- Ensure email provider is configured (SMTP or Supabase default)

## References

- Supabase Auth Docs: https://supabase.com/docs/guides/auth
- Environment Variables in Next.js: https://nextjs.org/docs/basic-features/environment-variables
- Vercel Environment Variables: https://vercel.com/docs/concepts/projects/environment-variables