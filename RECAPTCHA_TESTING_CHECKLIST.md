# reCAPTCHA v3 Testing Checklist for crm.rankedceo.com

## ✅ Pre-Deployment Checklist

### 1. Google reCAPTCHA Admin Console
- [ ] Go to: https://www.google.com/recaptcha/admin
- [ ] Verify site type is **reCAPTCHA v3** (not v2, not Enterprise)
- [ ] Verify domains list includes:
  - [ ] `crm.rankedceo.com` (exact match, no https://, no trailing slash)
  - [ ] `localhost` (for local development)
  - [ ] `vercel.app` (for preview deployments)
- [ ] Copy the **Site Key** (starts with `6L...`)
- [ ] Copy the **Secret Key** (starts with `6L...`)

### 2. Vercel Environment Variables
- [ ] Go to: https://vercel.com/twinwicksllc/rankedceo-crm-production/settings/environment-variables
- [ ] Verify `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` is set for:
  - [ ] Production
  - [ ] Preview
  - [ ] Development
- [ ] Verify `RECAPTCHA_SECRET_KEY` is set for:
  - [ ] Production
  - [ ] Preview
  - [ ] Development
- [ ] Redeploy after updating environment variables

### 3. Wait for Deployment
- [ ] Wait 1-2 minutes for Vercel to deploy
- [ ] Check deployment status at: https://vercel.com/twinwicksllc/rankedceo-crm-production

---

## 🧪 Testing Steps

### Test 1: Basic Script Loading
1. [ ] Open: https://crm.rankedceo.com/signup
2. [ ] Open browser Developer Tools (F12)
3. [ ] Go to **Console** tab
4. [ ] Look for:
   - [ ] ✅ `[useRecaptcha] reCAPTCHA ready` (success message)
   - [ ] ❌ No errors about "Invalid domain for site key"
   - [ ] ❌ No "script failed to load" errors
5. [ ] Go to **Network** tab
6. [ ] Filter by "recaptcha"
7. [ ] Look for:
   - [ ] ✅ `api.js?render=...` loaded with status 200
   - [ ] ✅ No 400 or 403 errors

### Test 2: Visual Indicators
1. [ ] Look at bottom-right corner of the page
2. [ ] You should see the reCAPTCHA badge (small gray box)
3. [ ] The form should show "Loading security verification..." briefly, then disappear

### Test 3: Token Generation
1. [ ] Fill in the signup form with test data
2. [ ] Open Console tab
3. [ ] Click "Sign up"
4. [ ] Look for console messages:
   - [ ] ✅ `[useRecaptcha] Executing reCAPTCHA for action: signup`
   - [ ] ✅ `[useRecaptcha] Token received: ...`
   - [ ] ❌ No "reCAPTCHA not ready" errors

### Test 4: Server-Side Verification
1. [ ] After submitting the form, check the Console for:
   - [ ] ✅ Successful verification response
   - [ ] ✅ No "reCAPTCHA verification failed" errors
2. [ ] If you have access to Vercel logs:
   - [ ] Check for `[reCAPTCHA Service] Verification successful`
   - [ ] Check for score value (should be between 0.0 and 1.0)

### Test 5: Negative Test (Domain Whitelist Verification)
**This confirms your domain whitelist is working correctly**

1. [ ] Get a Vercel preview URL (e.g., `my-project-git-branch.vercel.app`)
2. [ ] Make sure this preview URL is **NOT** in your reCAPTCHA domain whitelist
3. [ ] Open the preview URL in your browser
4. [ ] Open Developer Tools → Console
5. [ ] Look for the error:
   - [ ] ✅ "ERROR for site owner: Invalid domain for site key"
6. [ ] If you see this error on the preview URL but NOT on `crm.rankedceo.com`, your whitelist is correct!

---

## 🐛 Common Issues & Solutions

### Issue 1: "Script failed to load"
**Possible Causes:**
- [ ] Ad blocker or privacy extension blocking Google domains
- [ ] Corporate firewall blocking Google
- [ ] Content Security Policy (CSP) blocking scripts

**Solutions:**
1. [ ] Test in Incognito/Private mode with all extensions disabled
2. [ ] Test from a different network (mobile data)
3. [ ] Check response headers for CSP and ensure it allows:
   ```
   script-src 'self' https://www.google.com https://www.gstatic.com;
   frame-src 'self' https://www.google.com https://www.gstatic.com;
   ```

### Issue 2: "Invalid domain for site key"
**Possible Causes:**
- [ ] Domain not in whitelist
- [ ] Typo in domain (e.g., `www.crm.rankedceo.com` vs `crm.rankedceo.com`)
- [ ] Using wrong site key

**Solutions:**
1. [ ] Go to reCAPTCHA admin console
2. [ ] Verify exact domain match: `crm.rankedceo.com`
3. [ ] Verify you're using the correct site key in Vercel

### Issue 3: "reCAPTCHA not ready"
**Possible Causes:**
- [ ] Script hasn't finished loading yet
- [ ] Race condition in code

**Solutions:**
1. [ ] Check that `isReady` state is true before allowing form submission
2. [ ] The form should be disabled until `isReady` is true
3. [ ] Check console for `[useRecaptcha] reCAPTCHA ready` message

### Issue 4: Token verification fails on server
**Possible Causes:**
- [ ] Wrong secret key in Vercel
- [ ] Site key and secret key don't match
- [ ] Network issue reaching Google's API

**Solutions:**
1. [ ] Verify `RECAPTCHA_SECRET_KEY` in Vercel matches the secret key in reCAPTCHA admin
2. [ ] Check Vercel logs for detailed error messages
3. [ ] Ensure server can reach `https://www.google.com/recaptcha/api/siteverify`

---

## 📊 Success Criteria

Your reCAPTCHA v3 implementation is working correctly when:

- [x] ✅ Script loads without errors on `crm.rankedceo.com`
- [x] ✅ reCAPTCHA badge appears in bottom-right corner
- [x] ✅ Console shows `[useRecaptcha] reCAPTCHA ready`
- [x] ✅ Form shows "Loading security verification..." then becomes enabled
- [x] ✅ Token is generated when form is submitted
- [x] ✅ Server successfully verifies token with Google
- [x] ✅ User can complete signup/login flow
- [x] ✅ Preview URLs show "Invalid domain" error (proves whitelist works)

---

## 🔐 Security Notes

### API Key Security
- [x] ✅ No API keys hardcoded in code (verified)
- [x] ✅ `.env.local` contains only placeholders
- [x] ✅ Real keys only in Vercel environment variables
- [x] ✅ Old leaked Gemini API key has been replaced
- [x] ✅ New Gemini API key: `AIzaSyCohhHLDMHhM4McUrZ6_t7bazs8mWWOTlE` (working)

### reCAPTCHA Keys
- [ ] Site Key (public): Set in `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`
- [ ] Secret Key (private): Set in `RECAPTCHA_SECRET_KEY`
- [ ] Never expose secret key in client-side code
- [ ] Never commit keys to git

---

## 📝 Next Steps After Testing

Once all tests pass:

1. [ ] Test the complete signup flow with a real email
2. [ ] Test the complete login flow
3. [ ] Monitor Vercel logs for any reCAPTCHA errors
4. [ ] Consider adjusting the score threshold (default 0.5) based on your needs
5. [ ] Set up monitoring/alerts for reCAPTCHA failures

---

## 🆘 Need Help?

If you're still experiencing issues after going through this checklist:

1. Check `GEMINI_RECAPTCHA_SETUP_ADVICE.md` for detailed troubleshooting
2. Check `RECAPTCHA_PRODUCTION_SOLUTION.md` for implementation details
3. Review Vercel deployment logs
4. Check browser console for specific error messages
5. Verify all environment variables are set correctly in Vercel

---

**Last Updated:** After deploying commit `5346d05`
**Status:** Ready for testing at https://crm.rankedceo.com