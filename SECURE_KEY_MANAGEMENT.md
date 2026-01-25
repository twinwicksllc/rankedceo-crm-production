# 🔐 Secure API Key Management Guide

## Why We Need This

Your previous Gemini API key was exposed in the GitHub repository because it was accidentally committed to files. This document outlines how we'll prevent this from happening again.

---

## 🚫 What NOT to Do

1. **NEVER hardcode API keys** in any file:
   ```typescript
   // ❌ BAD - Key is in the file
   const API_KEY = "AIzaSyCohhHLDMHhM4McUrZ6_t7bazs8mWWOTlE"
   ```

2. **NEVER pass API keys** as command line arguments:
   ```bash
   # ❌ BAD - Key appears in process list
   ./scripts/consult-gemini.sh AIzaSyCohhHLDMHhM4McUrZ6_t7bazs8mWWOTlE "question"
   ```

3. **NEVER log API keys** to console or files:
   ```typescript
   // ❌ BAD - Key appears in logs
   console.log("Using API key:", API_KEY)
   ```

4. **NEVER commit** files containing API keys to git

---

## ✅ What TO Do

### 1. Use Environment Variables

Store API keys in environment variables, never in code:

```typescript
// ✅ GOOD - Key is in environment
const API_KEY = process.env.GEMINI_API_KEY

if (!API_KEY) {
  throw new Error('GEMINI_API_KEY not set')
}
```

### 2. Validate Keys Before Use

Always validate that keys exist and have proper format:

```typescript
export function getGeminiApiKey(): string | null {
  const key = process.env.GEMINI_API_KEY
  if (!key) {
    console.error('[Security] GEMINI_API_KEY not found')
    return null
  }
  
  if (key.length < 10) {
    console.error('[Security] GEMINI_API_KEY appears invalid')
    return null
  }
  
  return key
}
```

### 3. Use Secure Scripts

The `scripts/consult-gemini.sh` script is designed to never log or commit keys:

```bash
# ✅ GOOD - Key is in environment, never logged
GEMINI_API_KEY=your_key_here ./scripts/consult-gemini.sh "your question"
```

---

## 📋 How to Provide the New Key to SuperNinja

### **Recommended Method: Environment Variable**

**Step 1:** Set the key as an environment variable in your terminal:

```bash
export GEMINI_API_KEY="your_new_api_key_here"
```

**Step 2:** Verify it's set:

```bash
echo $GEMINI_API_KEY
```

**Step 3:** Now when SuperNinja needs to consult Gemini, I'll use the environment variable automatically:

```bash
# I'll run this (you don't need to)
GEMINI_API_KEY=$GEMINI_API_KEY ./scripts/consult-gemini.sh "your question"
```

### **Alternative Method: .env.local File**

**Step 1:** Create/update `.env.local`:

```bash
GEMINI_API_KEY=your_new_api_key_here
```

**Step 2:** Verify `.env.local` is in `.gitignore`:

```bash
cat .gitignore | grep ".env.local"
```

You should see:
```
# See https://help.github.com/articles/ignoring-files/
.env*.local
```

**Step 3:** The key is now available as `process.env.GEMINI_API_KEY`

---

## 🔒 Security Best Practices

### 1. Never Commit Keys to Git

Always add `.env*` files to `.gitignore`:

```gitignore
# Environment variables
.env
.env.local
.env.production
.env.development
```

### 2. Use Different Keys for Different Environments

- **Development:** `GEMINI_API_KEY_DEV` (test key)
- **Staging:** `GEMINI_API_KEY_STAGING` (staging key)
- **Production:** `GEMINI_API_KEY` (production key)

### 3. Rotate Keys Regularly

- Change API keys every 90 days
- Use Google Cloud Console to revoke old keys
- Generate new keys and update environment variables

### 4. Monitor Usage

- Check Google Cloud Console for unusual API usage
- Set up alerts for abnormal activity
- Review billing statements regularly

### 5. Use Key Restrictions

In Google Cloud Console:

1. Go to APIs & Services → Credentials
2. Click on your API key
3. Under "Application restrictions":
   - Select "IP addresses" for backend
   - Select "HTTP referrers" for frontend
4. Under "API restrictions":
   - Select only the APIs you need (Gemini API)

---

## 🚨 If a Key Is Exposed Again

### Immediate Actions:

1. **Revoke the key immediately** in Google Cloud Console
2. **Create a new key**
3. **Update environment variables** in Vercel
4. **Remove the key from git history** (if committed)
5. **Force push** the cleaned repository

### Removing Key from Git History:

```bash
# Remove file from git history
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch FILE_WITH_KEY" \
  --prune-empty --tag-name-filter cat -- --all

# Force push (BE CAREFUL - rewrites history)
git push origin --force --all
```

---

## 📝 Checklist for Providing New Key

Before providing your new Gemini API key to SuperNinja, verify:

- [ ] Key is stored in environment variable (`GEMINI_API_KEY`)
- [ ] Key is NOT hardcoded in any file
- [ ] Key is NOT in `.gitignore`'d files that might be committed
- [ ] Key is updated in Vercel environment variables
- [ ] Key has appropriate restrictions in Google Cloud Console
- [ ] Old key has been revoked
- [ ] You have a record of where the key is used

---

## 🔐 SuperNinja's Commitment

I promise to:

1. ✅ Never log API keys to console or files
2. ✅ Never commit API keys to git
3. ✅ Always use environment variables for sensitive data
4. ✅ Validate keys before use
5. ✅ Alert you immediately if I detect a potential security issue

---

## 📞 Emergency Contact

If you suspect a key has been exposed:

1. Revoke the key immediately in Google Cloud Console
2. Contact me immediately
3. We'll follow the "If a Key Is Exposed Again" section above

---

**Last Updated:** 2025-01-25
**Status:** Active security protocol