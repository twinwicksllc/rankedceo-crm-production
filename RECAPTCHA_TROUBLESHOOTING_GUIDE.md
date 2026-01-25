# reCAPTCHA Troubleshooting Guide - Finding Error Details

## Quick Reference - Where to Find Errors

### 1. Browser Console (Fastest)
**What it shows:** Client-side errors, token generation issues
**How to access:** F12 → Console tab
**What to look for:** `[Signup]` or `[Login]` prefixed logs

### 2. Browser Network Tab
**What it shows:** API responses, status codes, error messages
**How to access:** F12 → Network tab
**What to look for:** `/api/auth/verify-recaptcha` request

### 3. Vercel Function Logs
**What it shows:** Server-side errors, verification failures
**How to access:** Vercel Dashboard → Deployments → Latest → Functions
**What to look for:** `[reCAPTCHA]` prefixed logs

### 4. Google reCAPTCHA Admin
**What it shows:** Key status, verification statistics, error codes
**How to access:** https://www.google.com/recaptcha/admin
**What to look for:** Error codes, success rate

---

## Step-by-Step Troubleshooting

### Step 1: Check Browser Console (Client-Side)

**What to do:**
1. Open `https://crm.rankedceo.com/signup`
2. Press F12 to open DevTools
3. Go to **Console** tab
4. Fill out the signup form
5. Click "Create Account"
6. Watch the console for logs

**What you'll see:**

**Success Flow:**
```
[Signup] Executing reCAPTCHA...
[Signup] grecaptcha.ready called, executing token...
[Signup] Token received: {hasToken: true, tokenLength: 500, ...}
[Signup] Token received, verifying with server...
[Signup] Verification response: {status: 200, data: {valid: true, score: 0.9}}
[Signup] Verification successful, proceeding with signup...
```

**Error Flow (Token Generation Failed):**
```
[Signup] Executing reCAPTCHA...
[Signup] Error: grecaptcha not loaded
```
**Solution:** reCAPTCHA script didn't load. Check internet connection or ad blockers.

**Error Flow (Verification Failed):**
```
[Signup] Token received, verifying with server...
[Signup] Verification response: {status: 400, data: {error: "reCAPTCHA verification failed..."}}
[Signup] Verification failed: {status: 400, data: {...}}
```
**Solution:** Server-side issue. Check Vercel logs for details.

---

### Step 2: Check Browser Network Tab

**What to do:**
1. Open `https://crm.rankedceo.com/signup`
2. Press F12 → **Network** tab
3. Fill out form and submit
4. Find `/api/auth/verify-recaptcha` request
5. Click on it to see details

**What to check:**

**Request Headers:**
- Should show `Content-Type: application/json`
- Should include `token` and `action` in request body

**Response Status:**
- **200** = Success ✅
- **400** = Verification failed ❌
- **500** = Server error ❌

**Response Body:**

**Success Response:**
```json
{
  "valid": true,
  "score": 0.9
}
```

**Error Response:**
```json
{
  "error": "reCAPTCHA verification failed - score too low",
  "score": 0.3,
  "valid": false,
  "reason": "Score 0.30 is below threshold 0.5"
}
```

---

### Step 3: Check Vercel Function Logs

**What to do:**
1. Go to Vercel Dashboard
2. Select `rankedceo-crm-production` project
3. Click **Deployments** tab
4. Click on latest deployment
5. Click **Functions** tab
6. Find `/api/auth/verify-recaptcha`
7. Click to expand and see logs

**What you'll see:**

**Successful Verification:**
```
[reCAPTCHA] Verification request received: {hasToken: true, action: "signup", tokenLength: 500, ...}
[reCAPTCHA] Calling verification service...
[reCAPTCHA Service] Starting verification... {hasSecretKey: true, secretKeyLength: 40, hasToken: true, tokenLength: 500}
[reCAPTCHA Service] Sending request to Google...
[reCAPTCHA Service] Response received: {status: 200, statusText: "OK"}
[reCAPTCHA Service] Verification response: {success: true, score: 0.9, action: "signup", hostname: "crm.rankedceo.com", ...}
[reCAPTCHA Service] Verification successful. Score: 0.9 Action: signup
[reCAPTCHA] Verification result: {score: 0.9, isValid: true, ...}
[reCAPTCHA] Verification successful
```

**Verification Failed (Wrong Secret Key):**
```
[reCAPTCHA] Verification request received: {hasToken: true, action: "signup", ...}
[reCAPTCHA] Calling verification service...
[reCAPTCHA Service] Starting verification... {hasSecretKey: true, secretKeyLength: 40, ...}
[reCAPTCHA Service] Sending request to Google...
[reCAPTCHA Service] Response received: {status: 200, statusText: "OK"}
[reCAPTCHA Service] Verification response: {success: false, errorCodes: ["invalid-input-secret"], ...}
[reCAPTCHA Service] Verification failed: ["invalid-input-secret"]
[reCAPTCHA] Error: Verification returned null score
[reCAPTCHA] Error: Verification returned null score
```
**Solution:** The secret key in Vercel doesn't match the site key. Get the correct secret key from Google reCAPTCHA admin.

**Verification Failed (Score Too Low):**
```
[reCAPTCHA] Verification request received: {hasToken: true, action: "signup", ...}
[reCAPTCHA] Calling verification service...
[reCAPTCHA Service] Verification response: {success: true, score: 0.3, action: "signup", ...}
[reCAPTCHA Service] Verification successful. Score: 0.3 Action: signup
[reCAPTCHA] Verification result: {score: 0.3, isValid: false, ...}
[reCAPTCHA] Warning: Score below threshold: {score: 0.3, threshold: 0.5, action: "signup"}
[reCAPTCHA] Error: Score below threshold
```
**Solution:** The user was flagged as suspicious. This is working correctly for protection.

**Network Error:**
```
[reCAPTCHA Service] Error verifying token: {error: "fetch failed", stack: "..."}
```
**Solution:** Network issue between Vercel and Google. Check Vercel status and Google status.

---

### Step 4: Check Google reCAPTCHA Admin Console

**What to do:**
1. Go to: https://www.google.com/recaptcha/admin
2. Find your site: `6LeaeFUsAAAAAKr8KyPJu0B5njqb3Ha_bqeUrWQ6`
3. Click on it to see details

**What to check:**

**Verification Statistics:**
- **Total Requests:** How many verifications attempted
- **Success Rate:** Percentage of successful verifications
- **Top 10 Error Codes:** Most common failures

**Common Error Codes:**

| Error Code | Meaning | Solution |
|------------|---------|----------|
| `missing-input-secret` | Secret key not sent to Google | Check service code (shouldn't happen) |
| `invalid-input-secret` | Wrong secret key | Get correct secret key from Google admin |
| `missing-input-response` | Token not sent to server | Check client-side code (shouldn't happen) |
| `invalid-input-response` | Invalid or expired token | Token might be too old (expires in 2 min) |
| `timeout-or-duplicate` | Request timeout or duplicate | Try again, check network |
| `invalid-site-key` | Wrong site key | Check site key in layout.tsx |
| `site-key-inactive` | Site key disabled | Enable site key in Google admin |

**Site Key Settings:**
- **Domain:** Should include `crm.rankedceo.com`
- **Score Threshold:** Can be adjusted (default 0.5)
- **Status:** Should be "Active"

---

## Common Issues and Solutions

### Issue 1: "invalid-input-secret" Error

**Symptoms:**
- Vercel logs show: `errorCodes: ["invalid-input-secret"]`
- All verification requests fail

**Solution:**
1. Go to Google reCAPTCHA admin: https://www.google.com/recaptcha/admin
2. Find your site key: `6LeaeFUsAAAAAKr8KyPJu0B5njqb3Ha_bqeUrWQ6`
3. Copy the **Secret Key** (not the Site Key)
4. Go to Vercel → Settings → Environment Variables
5. Update `RECAPTCHA_SECRET_KEY` with the correct value
6. Deploy to production

### Issue 2: Score Too Low for Legitimate Users

**Symptoms:**
- Vercel logs show: `score: 0.3` or lower
- Real users getting blocked

**Solution:**
1. Go to Google reCAPTCHA admin
2. Check if users are legitimately suspicious
3. If not, lower the threshold in `app/api/auth/verify-recaptcha/route.ts`:
   ```typescript
   // Change from:
   if (score === null || score < 0.5) {
   
   // To:
   if (score === null || score < 0.3) {
   ```
4. Deploy to production

### Issue 3: "grecaptcha not loaded"

**Symptoms:**
- Browser console shows: `[Signup] Error: grecaptcha not loaded`
- Token never generated

**Solution:**
1. Check if script tag is in layout:
   ```html
   <script src="https://www.google.com/recaptcha/api.js?render=SITE_KEY"></script>
   ```
2. Check for ad blockers (disable temporarily)
3. Check internet connection
4. Try incognito/private browser mode

### Issue 4: Network Errors

**Symptoms:**
- Vercel logs show: `errorCodes: ["network-error"]`
- Or service logs show: `error: "fetch failed"`

**Solution:**
1. Check Vercel status: https://status.vercel.com
2. Check Google Cloud status: https://status.cloud.google.com
3. Check if Vercel has outbound internet access
4. Try again later (might be temporary outage)

### Issue 5: "invalid-input-response"

**Symptoms:**
- Vercel logs show: `errorCodes: ["invalid-input-response"]`
- Token generated but verification fails

**Solution:**
1. Token might be too old (expires in 2 minutes)
2. User might have waited too long before submitting
3. Check if token is being sent correctly
4. Check if token length is reasonable (usually 500-2000 characters)

---

## How to Get Detailed Logs (Already Done ✅)

I've added comprehensive logging to help you troubleshoot:

### Client-Side Logging (Browser Console)
- `[Signup] Executing reCAPTCHA...`
- `[Signup] Token received: {hasToken, tokenLength, ...}`
- `[Signup] Verification response: {status, data, ...}`
- `[Signup] Verification successful/failed`

### Server-Side Logging (Vercel Logs)
- `[reCAPTCHA] Verification request received: {...}`
- `[reCAPTCHA Service] Starting verification: {...}`
- `[reCAPTCHA Service] Sending request to Google...`
- `[reCAPTCHA Service] Verification response: {success, score, errorCodes, ...}`
- `[reCAPTCHA] Verification result: {score, isValid, ...}`

### Error Logging
- All errors include timestamps
- Errors include stack traces
- Errors include detailed context

---

## Next Steps for You

### 1. Deploy the Latest Changes
The enhanced logging has been pushed to GitHub. Deploy it to Vercel to get the detailed logs.

### 2. Test Signup with Logs Open
1. Open `https://crm.rankedceo.com/signup`
2. Open browser console (F12)
3. Open Network tab (F12 → Network)
4. Submit the signup form
5. Copy all logs from console
6. Copy the `/api/auth/verify-recaptcha` request/response from Network tab

### 3. Check Vercel Logs
1. Go to Vercel Dashboard
2. Find your latest deployment
3. Check the `/api/auth/verify-recaptcha` function logs
4. Copy all `[reCAPTCHA]` prefixed logs

### 4. Share the Logs
Share the logs with me and I can help diagnose the exact issue:
- Browser console logs
- Network tab request/response
- Vercel function logs

---

## Quick Checklist

Before asking for help, check:

- [ ] Is `RECAPTCHA_SECRET_KEY` set in Vercel?
- [ ] Is the secret key correct (matches the site key)?
- [ ] Is the site key `6LeaeFUsAAAAAKr8KyPJu0B5njqb3Ha_bqeUrWQ6`?
- [ ] Is the domain `crm.rankedceo.com` added to Google reCAPTCHA admin?
- [ ] Are you seeing any errors in browser console?
- [ ] What does the Network tab show for `/api/auth/verify-recaptcha`?
- [ ] What do the Vercel function logs show?

---

## Summary

With the enhanced logging I've added, you'll be able to see exactly where the reCAPTCHA verification is failing:

1. **Browser Console** → Client-side token generation
2. **Network Tab** → API request/response details
3. **Vercel Logs** → Server-side verification process
4. **Google Admin** → Key status and error statistics

The logs will tell you:
- Whether the token was generated successfully
- Whether the verification request was sent
- What Google's response was (score, errors)
- Whether the verification passed or failed

**Deploy the latest changes and try the signup again - the logs will show you exactly what's happening!**