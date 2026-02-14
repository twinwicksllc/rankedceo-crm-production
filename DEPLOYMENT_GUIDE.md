# RankedCEO CRM - Deployment Guide

## Overview
This guide walks you through deploying the RankedCEO CRM to production on Vercel with Supabase.

## Prerequisites

- [x] Vercel account
- [x] Supabase account with project created
- [x] GitHub repository access
- [x] SendGrid account (for email features)
- [x] Google reCAPTCHA v3 keys
- [x] Domain configured (crm.rankedceo.com)

## Step 1: Database Setup (Supabase)

### 1.1 Run All Migrations

Run these migrations in order in Supabase SQL Editor:

**Critical Migrations:**
1. `000001_create_users_and_accounts.sql` - Core tables
2. `000007_correct_link_auth_users.sql` - Auth linking
3. `ONBOARDING_COMPLETE_MIGRATION.sql` - Onboarding setup
4. `20240116000002_create_email_messages.sql` - Email capture
5. `20240116000003_create_forms.sql` - Form builder
6. `20240116000004_create_commissions.sql` - Commission tracking
7. All other migrations in `supabase/migrations/`

**How to run:**
1. Go to https://supabase.com/dashboard
2. Select your project
3. Click "SQL Editor" → "New Query"
4. Copy migration content
5. Paste and click "Run"
6. Verify "Success. No rows returned"

### 1.2 Verify Tables Created

Run this query to verify all tables exist:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

You should see 30+ tables.

### 1.3 Verify RLS Policies

Run this query to verify RLS is enabled:
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;
```

All tables should have `rowsecurity = true`.

## Step 2: Environment Variables

### 2.1 Get Supabase Credentials

From Supabase Dashboard → Settings → API:
- `NEXT_PUBLIC_SUPABASE_URL` - Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Anon/Public key

### 2.2 Get API Keys

**SendGrid:**
- Go to https://app.sendgrid.com/settings/api_keys
- Create new API key with "Full Access"
- Copy the key (shown only once)

**Gemini AI:**
- Go to https://makersuite.google.com/app/apikey
- Create API key
- Copy the key

**Perplexity AI:**
- Go to https://www.perplexity.ai/settings/api
- Create API key
- Copy the key

**reCAPTCHA v3:**
- Go to https://www.google.com/recaptcha/admin
- Create v3 site key
- Add domain: `crm.rankedceo.com`
- Copy Site Key and Secret Key

### 2.3 Set Environment Variables in Vercel

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add each variable:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_key
NEXT_PUBLIC_PERPLEXITY_API_KEY=your_perplexity_key
SENDGRID_API_KEY=your_sendgrid_key
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=your_site_key
RECAPTCHA_SECRET_KEY=your_secret_key
NEXT_PUBLIC_APP_URL=https://crm.rankedceo.com
```

3. Select "Production", "Preview", and "Development" for each
4. Click "Save"

## Step 3: Vercel Deployment

### 3.1 Connect Repository

1. Go to Vercel Dashboard
2. Click "Add New" → "Project"
3. Import `twinwicksllc/rankedceo-crm-production`
4. Configure:
   - Framework Preset: Next.js
   - Root Directory: `./` (default)
   - Build Command: `npm run build`
   - Output Directory: `.next`
   - Install Command: `npm install`

### 3.2 Configure Domain

1. In Vercel Project Settings → Domains
2. Add custom domain: `crm.rankedceo.com`
3. Follow DNS configuration instructions
4. Wait for DNS propagation (5-60 minutes)

### 3.3 Deploy

1. Click "Deploy"
2. Wait for build to complete (~2-3 minutes)
3. Verify deployment at https://crm.rankedceo.com

## Step 4: DNS Configuration

### 4.1 GoDaddy DNS Settings

**For Landing Page (rankedceo.com):**
- Type: A Record
- Name: @
- Value: [Your hosting IP]
- TTL: 600

**For CRM (crm.rankedceo.com):**
- Type: CNAME
- Name: crm
- Value: cname.vercel-dns.com
- TTL: 600

### 4.2 Verify DNS

```bash
# Check A record
dig rankedceo.com

# Check CNAME record
dig crm.rankedceo.com
```

## Step 5: Supabase Configuration

### 5.1 Auth Settings

1. Go to Supabase Dashboard → Authentication → URL Configuration
2. Set Site URL: `https://crm.rankedceo.com`
3. Add Redirect URLs:
   - `https://crm.rankedceo.com/auth/callback`
   - `https://crm.rankedceo.com/**`

### 5.2 Email Templates

1. Go to Authentication → Email Templates
2. Customize confirmation email
3. Customize password reset email
4. Set sender email

## Step 6: SendGrid Configuration

### 6.1 Verify Sender Email

1. Go to SendGrid → Settings → Sender Authentication
2. Verify your domain or single sender email
3. Complete verification process

### 6.2 Configure Webhooks (Optional)

1. Go to Settings → Mail Settings → Event Webhook
2. Add webhook URL: `https://crm.rankedceo.com/api/emails/inbound`
3. Select events to track

## Step 7: Testing

### 7.1 Smoke Tests

- [ ] Homepage loads
- [ ] Login page works
- [ ] Signup creates account
- [ ] Onboarding flow completes
- [ ] Dashboard displays
- [ ] All navigation links work

### 7.2 Feature Tests

- [ ] Create contact
- [ ] Create company
- [ ] Create deal
- [ ] Log activity
- [ ] Create campaign
- [ ] Build form
- [ ] View analytics
- [ ] Update settings

### 7.3 Browser Tests

- [ ] Chrome (desktop)
- [ ] Firefox (desktop)
- [ ] Safari (desktop)
- [ ] Edge (desktop)
- [ ] Chrome (mobile)
- [ ] Safari (mobile)

## Step 8: Monitoring Setup (Optional)

### 8.1 Error Tracking

**Sentry:**
```bash
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

### 8.2 Analytics

**Vercel Analytics:**
1. Go to Vercel Dashboard → Analytics
2. Enable Web Analytics
3. Add to `app/layout.tsx`

### 8.3 Uptime Monitoring

**Options:**
- UptimeRobot (free)
- Pingdom
- StatusCake

## Step 9: Backup Strategy

### 9.1 Database Backups

Supabase automatically backs up your database daily. To enable:
1. Go to Supabase Dashboard → Database → Backups
2. Verify automatic backups are enabled
3. Test restore process

### 9.2 Code Backups

- [x] Code in GitHub (automatic)
- [x] Vercel deployment history (automatic)

## Step 10: Post-Deployment

### 10.1 Create Test Account

1. Sign up at https://crm.rankedceo.com/signup
2. Complete onboarding
3. Test all features
4. Verify data isolation

### 10.2 Monitor Logs

**Vercel Logs:**
1. Go to Vercel Dashboard → Deployments → [Latest] → Logs
2. Monitor for errors
3. Check API response times

**Supabase Logs:**
1. Go to Supabase Dashboard → Logs
2. Monitor database queries
3. Check for slow queries

### 10.3 Performance Check

**Lighthouse Audit:**
1. Open Chrome DevTools
2. Go to Lighthouse tab
3. Run audit
4. Aim for:
   - Performance: 90+
   - Accessibility: 90+
   - Best Practices: 90+
   - SEO: 90+

## Troubleshooting

### Build Fails
- Check environment variables are set
- Verify all dependencies installed
- Check for TypeScript errors
- Review build logs

### Database Errors
- Verify migrations ran successfully
- Check RLS policies
- Verify user has account_id
- Check Supabase logs

### Authentication Issues
- Verify Supabase Auth settings
- Check redirect URLs
- Verify reCAPTCHA keys
- Check domain whitelist

### Email Not Sending
- Verify SendGrid API key
- Check sender verification
- Review SendGrid activity logs
- Check API rate limits

## Rollback Plan

If issues occur:

1. **Revert Vercel Deployment:**
   - Go to Vercel Dashboard → Deployments
   - Find previous working deployment
   - Click "..." → "Promote to Production"

2. **Revert Database Changes:**
   - Restore from Supabase backup
   - Or manually revert migrations

3. **Notify Users:**
   - Post status update
   - Communicate timeline
   - Provide workarounds

## Success Metrics

### Week 1
- [ ] 10+ user signups
- [ ] 0 critical bugs
- [ ] < 1 second API response time
- [ ] 99.9% uptime

### Month 1
- [ ] 50+ user signups
- [ ] 100+ contacts created
- [ ] 50+ deals created
- [ ] 10+ campaigns sent

## Support Resources

- **Documentation:** See `PHASE_*_COMPLETE.md` files
- **Migrations:** See `supabase/migrations/` directory
- **API Docs:** See `ANALYTICS_API_ROUTES_COMPLETE.md`
- **Security:** See `RLS_COMPLETE_COVERAGE.md`

---

**Deployment Status:** ✅ Ready for Production
**Last Updated:** February 2024
**Version:** 1.0.0