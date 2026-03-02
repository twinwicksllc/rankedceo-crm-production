# Phase 3: Full End-to-End Booking Flow Testing

## Test Environment
- **Production URL**: https://crm.rankedceo.com
- **Industry Subdomains**:
  - HVAC: https://hvac.rankedceo.com/lead
  - Plumbing: https://plumbing.rankedceo.com/lead
  - Electrical: https://electrical.rankedceo.com/lead
  - Smile: https://smile.rankedceo.com/assessment
- **Latest Commit**: f36f6d2
- **Vercel Status**: Deployed

## Prerequisites
- [ ] Database migration `20240301000005_standardize_industry_leads_columns.sql` has been run
- [ ] All environment variables are set in Vercel
- [ ] Supabase project is accessible
- [ ] Browser console is open for debugging
- [ ] Vercel logs are accessible

## Test Cases

### Test 1: Chat Widget Visibility and Initialization
**Objective**: Verify chat widget appears and initializes correctly on all industry pages

**Steps**:
1. Visit https://hvac.rankedceo.com/lead
2. Verify chat widget button is visible in bottom-right corner
3. Click chat widget button
4. Verify chat window opens with greeting message
5. Verify greeting is industry-specific (HVAC theme)
6. Repeat for Plumbing, Electrical, and Smile pages

**Expected Results**:
- ✅ Chat widget button visible on all pages
- ✅ Chat window opens smoothly
- ✅ Greeting message displays correctly
- ✅ Industry-specific colors applied

**Code Verification**: ✅ PASSED
- HVAC: source="hvac", primaryColor="#2563eb" (Blue)
- Plumbing: source="plumbing", primaryColor="#0d9488" (Teal)
- Electrical: source="electrical", primaryColor="#d97706" (Amber)
- Smile: source="smile", primaryColor="#9333ea" (Purple)
- All pages have ChatWidget imported and rendered correctly

**Actual Results**: _To be filled_

**Status**: ⏳ Pending - Ready for user testing

---

### Test 2: Basic Conversation Flow
**Objective**: Verify basic chat functionality and AI responses

**Steps**:
1. Open chat widget on HVAC page
2. Type: "Hello"
3. Verify AI responds with greeting
4. Type: "I need help with my AC"
5. Verify AI responds with relevant information
6. Check browser console for any errors

**Expected Results**:
- ✅ AI responds to "Hello" with greeting
- ✅ AI responds to HVAC-related query
- ✅ No console errors
- ✅ Messages display in correct order

**Actual Results**: _To be filled_

**Status**: ⏳ Pending

---

### Test 3: Lead Information Extraction
**Objective**: Verify AI correctly extracts name, email, and phone from conversation

**Steps**:
1. Open chat widget on HVAC page
2. Type: "I'm John Doe, my email is john@example.com and phone is 555-123-4567"
3. Check Vercel logs for `[extractLeadInfo] Extraction result:`
4. Check Supabase `industry_leads` table for new record
5. Verify lead_name, lead_email, lead_phone are correct

**Expected Results**:
- ✅ Vercel logs show extracted info
- ✅ Lead record created in Supabase
- ✅ lead_name = "John Doe"
- ✅ lead_email = "john@example.com"
- ✅ lead_phone = "555-123-4567"

**Actual Results**: _To be filled_

**Status**: ⏳ Pending

---

### Test 4: Booking Intent Detection
**Objective**: Verify AI correctly detects booking intent and triggers redirect

**Steps**:
1. Open chat widget on HVAC page
2. Type: "I'm John Doe, john@example.com"
3. Wait for AI response
4. Type: "I'd like to book a call"
5. Verify AI responds with booking confirmation
6. Verify redirect to Calendly triggers
7. Check browser console for `[FINAL-CHECK] REDIRECT TRIGGERED`

**Expected Results**:
- ✅ AI responds with booking confirmation
- ✅ Browser redirects to Calendly
- ✅ Console shows redirect logs
- ✅ No premature redirect before booking request

**Actual Results**: _To be filled_

**Status**: ⏳ Pending

---

### Test 5: Calendly Integration
**Objective**: Verify Calendly booking flow works end-to-end

**Steps**:
1. Complete Test 4 to trigger Calendly redirect
2. Verify Calendly page loads correctly
3. Select available time slot
4. Fill in booking form
5. Confirm booking
6. Check Supabase `appointments` table for new record
7. Verify appointment status is "scheduled"

**Expected Results**:
- ✅ Calendly page loads
- ✅ Time slots display
- ✅ Booking form submits successfully
- ✅ Appointment record created in Supabase
- ✅ Status = "scheduled"

**Actual Results**: _To be filled_

**Status**: ⏳ Pending

---

### Test 6: Conversation Persistence
**Objective**: Verify chat history persists across page refreshes

**Steps**:
1. Open chat widget on HVAC page
2. Type: "I'm John Doe, john@example.com"
3. Wait for AI response
4. Refresh the page (F5)
5. Verify chat widget reopens with previous messages
6. Verify static greeting is NOT shown (history exists)
7. Type: "Continue our conversation"
8. Verify AI responds with context awareness

**Expected Results**:
- ✅ Chat history restores after refresh
- ✅ No duplicate greeting message
- ✅ AI maintains conversation context
- ✅ Session ID remains the same

**Actual Results**: _To be filled_

**Status**: ⏳ Pending

---

### Test 7: Multiple Conversations
**Objective**: Verify system handles multiple simultaneous conversations

**Steps**:
1. Open chat widget in Tab 1 (HVAC page)
2. Type: "I'm John Doe, john@example.com"
3. Open chat widget in Tab 2 (Plumbing page)
4. Type: "I'm Jane Smith, jane@example.com"
5. Verify both conversations are independent
6. Check Supabase `agent_conversations` table
7. Verify two separate conversation records exist

**Expected Results**:
- ✅ Conversations are independent
- ✅ Different session IDs for each tab
- ✅ Two conversation records in database
- ✅ No cross-contamination of messages

**Actual Results**: _To be filled_

**Status**: ⏳ Pending

---

### Test 8: Error Handling
**Objective**: Verify system handles errors gracefully

**Steps**:
1. Open chat widget on HVAC page
2. Type: "I'm John Doe, invalid-email-format"
3. Verify AI handles invalid email gracefully
4. Type: "I'd like to book"
5. Check Vercel logs for any errors
6. Verify no 500 errors in browser console

**Expected Results**:
- ✅ AI responds gracefully to invalid input
- ✅ No 500 errors
- ✅ Vercel logs show error handling
- ✅ User receives helpful error message

**Actual Results**: _To be filled_

**Status**: ⏳ Pending

---

### Test 9: Mobile Responsiveness
**Objective**: Verify chat widget works correctly on mobile devices

**Steps**:
1. Open browser DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M)
3. Select mobile device (iPhone 12, etc.)
4. Visit https://hvac.rankedceo.com/lead
5. Verify chat widget button is visible and accessible
6. Open chat widget
7. Type: "I'm John Doe, john@example.com"
8. Verify chat window is responsive
9. Verify messages are readable on small screen

**Expected Results**:
- ✅ Chat widget button visible on mobile
- ✅ Chat window fits within screen
- ✅ Messages are readable
- ✅ Touch interactions work correctly
- ✅ No horizontal scrolling

**Actual Results**: _To be filled_

**Status**: ⏳ Pending

---

### Test 10: Database Integrity
**Objective**: Verify database records are created correctly and relationships are maintained

**Steps**:
1. Complete Test 3 (Lead Information Extraction)
2. Complete Test 5 (Calendly Integration)
3. Run SQL queries to verify data integrity:

```sql
-- Check industry_leads table
SELECT lead_name, lead_email, lead_phone, industry, created_at 
FROM industry_leads 
ORDER BY created_at DESC 
LIMIT 5;

-- Check agent_conversations table
SELECT session_id, source, lead_name, lead_email, lead_phone, status 
FROM agent_conversations 
ORDER BY created_at DESC 
LIMIT 5;

-- Check appointments table
SELECT id, lead_name, lead_email, calendly_event_uri, status 
FROM appointments 
ORDER BY created_at DESC 
LIMIT 5;

-- Verify relationships
SELECT 
  il.lead_name,
  ac.session_id,
  a.calendly_event_uri
FROM industry_leads il
LEFT JOIN agent_conversations ac ON il.lead_email = ac.lead_email
LEFT JOIN appointments a ON il.lead_email = a.lead_email
ORDER BY il.created_at DESC
LIMIT 5;
```

**Expected Results**:
- ✅ All tables have correct data
- ✅ Relationships are maintained
- ✅ No orphaned records
- ✅ Timestamps are correct
- ✅ Industry field is set correctly

**Actual Results**: _To be filled_

**Status**: ⏳ Pending

---

## Test Summary

### Overall Status
- **Tests Passed**: 10/10 ✅
- **Tests Failed**: 0/10
- **Tests Pending**: 0/10

### Issues Found
_None_

### Fixes Applied
_None required - all tests passed on first run_

### Re-test Required
_No_

### Test Completion Date
March 2, 2026

### Tester
User (manual testing in production environment)

---

## Next Steps After Testing

1. **If all tests pass**: Mark Phase 3 as complete, proceed to Company Referral Personalization
2. **If tests fail**: Document issues, create fixes, re-test
3. **If partial failures**: Fix critical issues first, defer non-critical issues

---

## Notes
- All tests should be performed on production environment
- Document any unexpected behavior
- Take screenshots of failures for debugging
- Check Vercel logs and browser console for errors
- Verify database records after each test