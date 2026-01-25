# reCAPTCHA Enterprise Integration Guide

## Overview
This CRM has been integrated with Google Cloud reCAPTCHA Enterprise for advanced bot protection and risk analysis.

## What Changed

### 1. New Dependencies
- Added `@google-cloud/recaptcha-enterprise` package to `package.json`

### 2. New Files Created

#### `lib/services/recaptcha-service.ts`
Service class that handles reCAPTCHA Enterprise verification:
- `createAssessment()` - Creates risk assessment for a token
- `verifyToken()` - Verifies token against minimum score threshold (default: 0.5)

#### `app/api/auth/verify-recaptcha/route.ts`
API endpoint for server-side token verification:
- Receives token and action from client
- Returns verification result with risk score

#### Updated `app/(auth)/signup/page.tsx`
- Loads reCAPTCHA Enterprise script dynamically
- Executes reCAPTCHA on form submission
- Verifies token with server before creating account
- Shows error if verification fails

## Environment Variables Required

Add these to your Vercel environment variables:

```bash
# Google Cloud reCAPTCHA Enterprise
RECAPTCHA_PROJECT_ID=gen-lang-client-0876272421
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=6LeaeFUsAAAAAKr8KyPJu0B5njqb3Ha_bqeUrWQ6
```

### Important Notes:
- `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` - Public key, used in browser
- `RECAPTCHA_PROJECT_ID` - Google Cloud project ID, used on server
- No need for `RECAPTCHA_SECRET_KEY` with Enterprise version

## How It Works

### 1. User Signs Up
```typescript
// On form submit
const token = await grecaptcha.enterprise.execute(SITE_KEY, { action: 'signup' })
```

### 2. Server Verification
```typescript
// API endpoint verifies token
const score = await recaptchaService.createAssessment({ token, action: 'signup' })

// Score ranges from 0.0 (likely bot) to 1.0 (likely human)
if (score >= 0.5) {
  // Allow signup
}
```

### 3. Risk Score Interpretation
- **0.0 - 0.3**: High risk (likely bot)
- **0.3 - 0.7**: Medium risk (needs review)
- **0.7 - 1.0**: Low risk (likely legitimate)

## Testing

### Local Development
1. Set environment variables in `.env.local`:
   ```bash
   RECAPTCHA_PROJECT_ID=gen-lang-client-0876272421
   NEXT_PUBLIC_RECAPTCHA_SITE_KEY=6LeaeFUsAAAAAKr8KyPJu0B5njqb3Ha_bqeUrWQ6
   ```

2. Run development server:
   ```bash
   npm run dev
   ```

3. Navigate to `/signup` and test the form

### Production (Vercel)
1. Add environment variables in Vercel dashboard
2. Deploy to production
3. Test at `crm.rankedceo.com/signup`

## Google Cloud Setup Checklist

- [x] Google Cloud Project created: `gen-lang-client-0876272421`
- [x] reCAPTCHA Enterprise API enabled
- [x] Site key obtained: `6LeaeFUsAAAAAKr8KyPJu0B5njqb3Ha_bqeUrWQ6`
- [x] Domain registered: `crm.rankedceo.com` (needs to be added in Google Cloud Console)
- [ ] Update domain in Google Cloud Console to include `crm.rankedceo.com`

## Next Steps

### 1. Update Domain in Google Cloud Console
Go to Google Cloud Console and add `crm.rankedceo.com` to your reCAPTCHA Enterprise setup:
1. Navigate to Security > reCAPTCHA Enterprise
2. Edit your site configuration
3. Add `crm.rankedceo.com` to authorized domains

### 2. Deploy to Vercel
```bash
# Push to repository
git add .
git commit -m "Integrate reCAPTCHA Enterprise"
git push origin main

# Deploy will happen automatically via Vercel integration
```

### 3. Configure Environment Variables in Vercel
Add these to your Vercel project settings:
- `RECAPTCHA_PROJECT_ID=gen-lang-client-0876272421`
- `NEXT_PUBLIC_RECAPTCHA_SITE_KEY=6LeaeFUsAAAAAKr8KyPJu0B5njqb3Ha_bqeUrWQ6`

### 4. Configure Domain in Vercel
1. Add `crm.rankedceo.com` to Vercel project
2. Update DNS records:
   ```
   Type: CNAME
   Name: crm
   Value: cname.vercel-dns.com
   ```

### 5. Test Production
1. Visit `crm.rankedceo.com/signup`
2. Test signup flow with reCAPTCHA verification
3. Check browser console for any errors
4. Monitor server logs for reCAPTCHA scores

## Troubleshooting

### Issue: "reCAPTCHA not loaded"
**Solution:** Check that `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` is set in environment variables

### Issue: "reCAPTCHA verification failed"
**Solution:** 
- Check that `RECAPTCHA_PROJECT_ID` is set
- Verify domain is registered in Google Cloud Console
- Check browser console for detailed error messages

### Issue: Score is always low
**Solution:** 
- Verify site key is correct
- Check if domain is authorized in Google Cloud Console
- Review Google Cloud logs for detailed assessment information

## Advantages of reCAPTCHA Enterprise

1. **Better Fraud Detection** - Machine learning models analyze user behavior
2. **Risk Scoring** - Get detailed risk scores (0.0-1.0) instead of pass/fail
3. **Adaptive Challenge** - No visible checkbox for legitimate users
4. **Detailed Analytics** - Access to assessment reports in Google Cloud Console
5. **Custom Actions** - Track different actions (signup, login, etc.) separately

## Migration from Standard reCAPTCHA

If you were using standard reCAPTCHA v2 before:

| Standard v2 | Enterprise |
|-------------|------------|
| Site Key + Secret Key | Project ID + Site Key |
| Simple verify API | Risk assessment API |
| Pass/Fail result | Score (0.0-1.0) |
| Visible checkbox | Invisible (adaptive) |
| Limited analytics | Detailed risk analysis |

## Security Notes

- reCAPTCHA Enterprise tokens are one-time use
- Tokens expire after 2 minutes
- Always verify tokens on the server
- Never expose Project ID to client-side code
- Use appropriate score thresholds for your use case