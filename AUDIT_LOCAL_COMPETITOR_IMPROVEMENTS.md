# Audit: Local Competitor Scoring Improvements

**Date:** July 15, 2026  
**Branch:** feat/optimize-existing-layout-refresh  
**Priority:** Tier 1 (Quick wins, no new API costs)

## Problem Statement

The audit currently scores local businesses against national/enterprise competitors as equals. Example:
- **twin-wicks.com** (small local dev shop in Lake County, IL): Not ranked locally
- **americaneagle.com** (national 300-person digital agency): Ranked #12 nationally for generic enterprise keywords

Result: Audit appears broken ("Why am I compared to a national agency?") even though the system is technically working.

## Root Causes

### 1. **Competitors are unclassified raw URLs**
- Files: `app/audit/start/audit-start-form.tsx`, `app/api/audit/run/route.ts`
- Issue: User enters 3 competitor URLs with zero entity classification
- Current behavior: Gemini/Perplexity keywords and Serper queries treat all competitors identically
- Impact: National agencies rank higher on broad/enterprise keywords, making them appear dominant

### 2. **Location resolution uses county-level targeting**
- File: `lib/waas/services/serper/location-utils.ts` → `buildQueryCandidates()`
- Issue: Serper queries pass `"Lake County, IL"` instead of specific city (e.g., `"Waukegan, IL"`)
- Evidence: Google SERP for "AI web application developer Lake County IL" pulls national agencies over genuine local shops
- Impact: Widens search radius unnaturally, mixing local + regional + national results

### 3. **Keyword generation biased toward enterprise/B2B phrasing**
- File: `lib/waas/services/keyword-generator/ai-providers.ts` lines 156-165 (Gemini prompt)
- Current keywords generated:
  - `"AI web application developer Lake County IL"`
  - `"AWS cloud architecture services Lake County"`
  - `"custom AI solutions development"`
- Issue: These are not how real customers search locally; they're enterprise B2B keywords
- Real local search: `"web developer near me"`, `"app developer in Waukegan"`, `"best web dev company local"`
- Impact: Skews results toward national agencies with large content/SEO teams who optimize for broad B2B terms

### 4. **No Local Pack / Google Maps tracking** (Tier 2 item, noted for context)
- The audit only checks organic web results
- Real local SEO: Google Maps 3-pack is the primary battleground (proximity + reviews + business profile)
- This is why "Not ranked" is actually accurate but feels wrong to users — they expect local pack inclusion

---

## Tier 1 Fixes (No new API cost, implement tomorrow)

### Fix #1: Classify competitors as "Likely Local" or "Possibly National"

**What to do:**
1. When competitor URLs are submitted (or during the audit), call `collectSiteSignals()` on each
2. Extract `addressHint` and `locationHint` from competitor's homepage
3. Check if competitor's detected location matches target's location (same city + state or county)
4. Store classification in `report_data` under `provider_meta.competitor_classification`

**Files to modify:**
- `lib/waas/services/audit-engine/index.ts` → Add `classifyCompetitors()` function after `runFullAudit()` starts
- `lib/waas/types.ts` → Update `AuditReportData.provider_meta` to include `competitor_classification: Array<{url, domain, is_likely_local}>`
- `app/audit/[auditId]/client.tsx` → Render a subtle indicator on the leaderboard (e.g., "🌍 National" badge for non-local competitors)

**Pseudo-code:**
```typescript
function classifyCompetitors(
  targetLocation: string, // "Lake County, IL" or detected city
  competitorUrls: string[]
): Array<{url: string; domain: string; is_likely_local: boolean}> {
  return competitorUrls.map(url => {
    const signals = collectSiteSignals(url); // reuse existing function
    const competitorCity = signals.locationHint?.split(",")[0]; // "Waukegan"
    const targetCity = targetLocation.split(",")[0]; // "Waukegan"
    return {
      url,
      domain: extractDomain(url),
      is_likely_local: competitorCity === targetCity
    };
  });
}
```

---

### Fix #2: Use city-level location instead of county in Serper queries

**What to do:**
1. Extract city from detected address when available (`"123 Main St, Waukegan, IL 60085"` → `"Waukegan, IL"`)
2. Fallback to existing location string only if no street address is found
3. Pass city-level string to `buildQueryCandidates()` and ultimately to `serperSearch()`

**Files to modify:**
- `lib/waas/services/audit-engine/index.ts` → After `generateIndustryKeywordPlan()`, extract city from `keywordPlan.detectedAddress`
- `lib/waas/services/serper/location-utils.ts` → Update `buildQueryCandidates()` to accept optional city precision level

**Pseudo-code:**
```typescript
function extractCityFromAddress(address: string | null): string | null {
  // "123 Main St, Waukegan, IL 60085" -> "Waukegan, IL"
  const match = address?.match(/,\s*([A-Za-z\s]+,\s*[A-Z]{2})\s*\d{5}/);
  return match?.[1] ?? null;
}

// In runFullAudit():
const detectedLocation = location ?? keywordPlan.detectedLocation ?? "Chicago, IL";
const cityLevel = extractCityFromAddress(keywordPlan.detectedAddress) ?? detectedLocation;
// Pass cityLevel to getSearchRankings()
```

---

### Fix #3: Rewrite keyword generation prompt to favor real local search behavior

**What to do:**
1. Update Gemini prompt in `generateWithGemini()` to explicitly bias toward local search patterns
2. Add example phrases real customers use: `"[service] near me"`, `"best [service] in [City]"`
3. Add instruction: `"Avoid enterprise/technical B2B keywords unless the business explicitly targets enterprises"`

**File to modify:**
- `lib/waas/services/keyword-generator/ai-providers.ts` lines 156-175

**Current prompt keywords rule:**
```
"- high-intent service keywords that a real buyer would search",
"- include geographic intent tied to detected city/market",
"- avoid generic filler and avoid the business name unless clearly transactional",
"- each keyword must be 2-7 words",
```

**New prompt keywords rule:**
```
"- high-intent LOCAL service keywords (how a customer in the city searches, not enterprise keywords)",
"- real-world examples: '[service] near me', '[service] in [City]', 'best [service] [City]', '[service] company local'",
"- include geographic intent tied to detected city (not county or region)",
"- avoid enterprise/B2B technical keywords unless business is explicitly B2B enterprise-facing",
"- avoid generic filler and brand name unless clearly transactional",
"- each keyword must be 2-7 words",
"- do NOT use keywords that mix technical terms with geographic modifiers (e.g. 'AWS cloud architecture Lake County')",
```

---

## Testing Plan (after implementation)

1. **Re-audit twin-wicks.com** with americaneagle.com as competitor
   - Expected: americaneagle.com marked as "🌍 Not a local competitor" or similar
   - Expected: Keywords shift from `"AI web application developer Lake County"` to `"web development near me"`, `"web developer Waukegan"`, `"best web development company local"`
   - Expected: Serper queries use `"Waukegan, IL"` instead of `"Lake County, IL"` as base location

2. **Run against a true local competitor** (e.g., another actual Waukegan dev shop)
   - Expected: Competitor marked as "✅ Local competitor"
   - Expected: More balanced leaderboard positioning

3. **Check Vercel logs** (WAAS_AUDIT_DEBUG=true) for:
   - `keyword:start` events showing city-level location
   - `competitor:classified` events (new) showing classification results

---

## Future Work (Tier 2 — separate PR)

- [ ] Add Google Maps Local Pack tracking via Serper Places endpoint
- [ ] UI to manually tag competitor type ("Local", "Franchise", "National")
- [ ] Expanded confidence scoring that factors in competitor locality mismatch
- [ ] Weighted leaderboard scoring (local competitors weighted higher)

---

## Files to modify (summary)

1. `lib/waas/services/audit-engine/index.ts` — Add competitor classification, extract city from address
2. `lib/waas/services/keyword-generator/ai-providers.ts` — Update Gemini + Perplexity prompts
3. `lib/waas/services/serper/location-utils.ts` — Accept city-level location precision
4. `lib/waas/types.ts` — Add competitor classification to report_data schema
5. `app/audit/[auditId]/client.tsx` — Render competitor locality badges on leaderboard

---

## Estimated effort

- Fix #1 (competitor classification): 2–3 hours
- Fix #2 (city-level location): 1–2 hours
- Fix #3 (keyword prompt): 30 min–1 hour
- **Total: 4–6 hours**

---

**Next steps:** Pick one fix to start with (recommend Fix #2 for immediate impact, then Fix #1 for messaging).
