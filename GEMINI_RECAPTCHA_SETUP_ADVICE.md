# Gemini 2.5 Pro: reCAPTCHA v3 Setup and Troubleshooting

Of course! This is a great set of questions, and they cover the most common hurdles when implementing reCAPTCHA v3 in a modern framework like Next.js.

Let's break down each of your questions with specific, actionable answers for your setup at `crm.rankedceo.com`.

---

### 1. After creating a new reCAPTCHA v3 site key, how long does it typically take for Google to activate it?

**Short Answer:** It's practically instantaneous.

**Detailed Answer:**
In 99.9% of cases, a new reCAPTCHA v3 site key is active and ready to use within a minute or two of creation. The propagation across Google's global infrastructure is extremely fast.

If you've just created the key and it's not working, the cause is almost certainly **not** a delay on Google's end. The problem is more likely to be one of the following:

*   **Browser Caching:** Your browser might have cached a previous version of the page before you added the correct site key.
*   **Server/CDN Caching:** If you're using a service like Vercel or Cloudflare, a previous deployment might be cached.
*   **Configuration Error:** A typo in the site key in your environment variables or code.

**Actionable Step:**
Always perform a hard refresh ( `Ctrl+Shift+R` on Windows/Linux, `Cmd+Shift+R` on Mac) in your browser after deploying a change involving the site key. If you use a CDN, consider purging its cache.

---

### 2. Are there any common "gotchas" or delays when first setting up reCAPTCHA v3?

Yes, absolutely. Here are the most common ones:

*   **Domain Mismatch:** The domain list in your reCAPTCHA Admin Console is very strict.
    *   `crm.rankedceo.com` is different from `www.crm.rankedceo.com`. Make sure you've added the exact domain you are serving from.
    *   For local development, you **must** add `localhost` to the list of allowed domains.
*   **Key Mismatch (Site vs. Secret):**
    *   The **Site Key** (public) is used in your frontend Next.js code (`<Script>` component, `useRecaptcha` hook).
    *   The **Secret Key** (private) is used *only* on your server-side API route for verification. Accidentally swapping them or exposing the secret key on the client-side will cause failure.
*   **Environment Variables:**
    *   In Next.js, you likely use `.env.local` for development. Ensure that you have set the production environment variables correctly in your hosting provider's dashboard (e.g., Vercel, Netlify). A common mistake is for `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` to be missing in the production environment.
*   **Script Not Loaded Before Execution:** Your `useRecaptcha` hook might try to call `grecaptcha.execute()` before the Next.js `<Script>` has finished loading. The `strategy="afterInteractive"` is good, but you should also use the `onLoad` callback to set a state variable confirming the script is ready.

**Example `onLoad` implementation:**

```jsx
// In your layout or a specific component
import Script from 'next/script';
import { useState } from 'react';

function RecaptchaProvider({ children }) {
  const [isRecaptchaReady, setIsRecaptchaReady] = useState(false);

  return (
    <>
      <Script
        src={`https://www.google.com/recaptcha/api.js?render=${process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY}`}
        strategy="afterInteractive"
        onLoad={() => {
          console.log("reCAPTCHA script loaded successfully.");
          setIsRecaptchaReady(true);
        }}
        onError={(e) => {
          console.error("reCAPTCHA script failed to load:", e);
        }}
      />
      {/* You can pass isRecaptchaReady down via context if needed */}
      {children}
    </>
  );
}
```

---

### 3. What's the best way to test if the domain whitelist is working correctly?

This requires a two-pronged approach: testing a valid domain and an invalid one.

**Step 1: Confirm the Correct Domain Works**
1.  **Deploy:** Deploy your application to `crm.rankedceo.com`.
2.  **Open Developer Tools:** Open the browser's developer tools and go to the **Console** and **Network** tabs.
3.  **Trigger Action:** Perform the action that generates a token (e.g., submitting a form).
4.  **Check Console:** You should see **no errors** related to reCAPTCHA.
5.  **Check Server Logs:** Your server-side verification endpoint should receive the token and log a successful response from Google (`"success": true`). This is the ultimate proof.

**Step 2: Test an *Unlisted* Domain (The Negative Test)**
This is the most definitive test.
1.  **Find an Unlisted Domain:** Use a temporary preview URL from your hosting provider (e.g., a Vercel preview deployment URL like `my-project-git-branch-org.vercel.app`) and **ensure this temporary domain is NOT in your reCAPTCHA whitelist**.
2.  **Open Developer Tools:** Navigate to that preview URL and open the console.
3.  **Look for the Error:** You should see a very specific error message in the browser console, which is the key indicator:
    > **ERROR for site owner: Invalid domain for site key**

If you see this error on the unlisted domain and everything works perfectly on `crm.rankedceo.com`, your domain whitelist is configured correctly.

---

### 4. Should I see any specific console messages when reCAPTCHA v3 loads successfully?

**By default, no.** reCAPTCHA v3 is designed to be invisible and unobtrusive. A successful load is silent. The absence of errors *is* the sign of success.

The only visual indicator is the reCAPTCHA badge that appears on the bottom right of the screen (which you can reposition or hide, per Google's terms).

**Actionable Troubleshooting Step:**
To get explicit confirmation for debugging, use the `onLoad` and `onError` props on the Next.js `<Script>` component, as shown in the answer to question #2. This is the best practice for monitoring script loading in Next.js.

```jsx
<Script
  src={`https://www.google.com/recaptcha/api.js?render=${process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY}`}
  strategy="afterInteractive"
  onLoad={() => console.log("✅ reCAPTCHA Loaded")}
  onError={() => console.error("❌ reCAPTCHA Failed to Load")}
/>
```

---

### 5. What are the most common reasons for "script failed to load" errors even with correct domain whitelisting?

This is usually an issue on the client-side or network, not with your reCAPTCHA configuration.

1.  **Ad Blockers / Privacy Extensions:** This is the #1 cause. Extensions like uBlock Origin, AdGuard, or Privacy Badger often block requests to Google's domains, including `google.com/recaptcha/` and `gstatic.com`.
    *   **Test:** Test your site in an Incognito/Private window with all extensions disabled. If it works there, an extension is the culprit.
2.  **Content Security Policy (CSP):** If your application sends a CSP header, it might be blocking the script from loading. Your CSP must allow scripts and frames from Google.
    *   **Actionable Step:** Check the response headers for your site. If you have a `content-security-policy` header, ensure it includes the following directives:
        ```
        script-src 'self' https://www.google.com https://www.gstatic.com;
        frame-src 'self' https://www.google.com https://www.gstatic.com;
        ```
3.  **Corporate Firewalls or Proxies:** If you are testing from a corporate network, it might have strict rules that block Google's domains.
    *   **Test:** Try accessing the site from a different network, like your mobile phone's data connection.
4.  **Incorrect Script URL:** A typo in the `src` prop of the `<Script>` component. Double-check that the URL is exactly `https://www.google.com/recaptcha/api.js?render=YOUR_SITE_KEY`. Ensure your environment variable is being populated correctly.

### Summary Troubleshooting Checklist

1.  **Verify Keys & Domain:**
    *   Go to Google reCAPTCHA Admin Console.
    *   Confirm `crm.rankedceo.com` is listed (no `https://`, no trailing slash).
    *   Double-check that `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` in your hosting environment matches the **Site Key**.
    *   Double-check that `RECAPTCHA_SECRET