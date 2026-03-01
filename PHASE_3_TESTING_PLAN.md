# Phase 3: Full End-to-End Booking Flow Testing Plan

## Overview
This document provides a comprehensive testing plan for the AI chat booking system across all industry subdomains.

## Prerequisites

### Before Testing
- [ ] Ensure `agent_conversations` migration has been run in Supabase
- [ ] Verify Vercel deployment is complete (check latest commit: a400911)
- [ ] Have test email addresses ready (use real emails for Calendly testing)
- [ ] Have Calendly account connected for at least one user
- [ ] Verify environment variables are set in Vercel:
  - `GEMINI_API_KEY`
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `DEFAULT_ACCOUNT_ID`

### Test Accounts Needed
- [ ] HVAC operator account (with Calendly connected)
- [ ] Plumbing operator account (with Calendly connected)
- [ ] Electrical operator account (with Calendly connected)
- [ ] Smile operator account (with Calendly connected)
- [ ] Test lead accounts (anonymous users)

---

## Test Environment

### URLs to Test
- HVAC: https://hvac.rankedceo.com/lead
- Plumbing: https://plumbing.rankedceo.com/lead
- Electrical: https://electrical.rankedceo.com/lead
- Smile: https://smile.rankedceo.com/assessment

### Browser Tools
- Open browser DevTools (F12)
- Go to Console tab for logs
- Go to Network tab for API requests
- Go to Application tab for localStorage/sessionStorage

---

## Test Scenarios

### Test 1: Chat Widget Visibility and Initialization

**Objective:** Verify chat widget loads correctly on all landing pages

**Steps:**
1. Navigate to https://hvac.rankedceo.com/lead
2. Verify chat widget button is visible in bottom-right corner
3. Verify button has correct color (blue #2563eb for HVAC)
4. Click chat widget button
5. Verify chat window opens
6. Verify greeting message appears
7. Verify greeting is HVAC-specific
8. Close chat widget
9. Repeat for Plumbing (teal #0d9488)
10. Repeat for Electrical (amber #d97706)
11. Repeat for Smile (purple #9333ea)

**Expected Results:**
- Chat widget visible on all pages
- Correct industry-specific colors
- Greeting messages are industry-specific
- Chat window opens and closes smoothly

**Issues to Log:**
- Widget not visible
- Wrong color
- No greeting message
- Generic greeting instead of industry-specific

---

### Test 2: Basic Conversation Flow

**Objective:** Verify AI responds to basic messages

**Steps:**
1. Open chat widget on HVAC page
2. Send message: "Hello"
3. Verify AI responds
4. Send message: "I need help with my AC"
5. Verify AI acknowledges and asks for information
6. Send message: "My name is John"
7. Verify AI acknowledges name
8. Send message: "My email is john@test.com"
9. Verify AI acknowledges email
10. Send message: "I'd like to book a call"
11. Verify AI shows booking modal or calendar

**Expected Results:**
- AI responds to all messages
- AI collects name and email
- AI offers booking when requested
- Conversation flows naturally

**Issues to Log:**
- No response from AI
- Generic responses
- Doesn't collect information
- Doesn't offer booking

---

### Test 3: Lead Information Extraction

**Objective:** Verify AI correctly extracts lead info from conversation

**Steps:**
1. Open chat widget on Plumbing page
2. Send message: "Hi, I'm Jane Smith and my email is jane@example.com"
3. Check browser console for logs
4. Send message: "My phone is 555-123-4567"
5. Check Supabase database:
   ```sql
   SELECT * FROM agent_conversations 
   WHERE session_id = '[session_id from console]'
   ORDER BY created_at DESC 
   LIMIT 1;
   ```
6. Verify lead_name, lead_email, lead_phone are populated
7. Verify messages array contains all messages with timestamps

**Expected Results:**
- Name extracted: "Jane Smith"
- Email extracted: "jane@example.com"
- Phone extracted: "555-123-4567"
- All messages stored in database with timestamps

**Issues to Log:**
- Lead info not extracted
- Incorrect extraction
- Messages not saved to database
- Missing timestamps

---

### Test 4: Booking Intent Detection

**Objective:** Verify AI correctly detects booking intent

**Steps:**
1. Open chat widget on Electrical page
2. Send message: "I have a question about pricing"
3. Verify AI does NOT show booking modal
4. Send message: "How much do you charge?"
5. Verify AI does NOT show booking modal
6. Send message: "I'd like to schedule a consultation"
7. Verify AI shows booking modal
8. Send message: "Can we book a time?"
9. Verify AI shows booking modal
10. Send message: "Yes, let's do it"
11. Verify AI shows booking modal

**Expected Results:**
- Booking modal shown only when intent detected
- Questions don't trigger booking
- Clear booking requests trigger modal

**Issues to Log:**
- Booking modal shown too early
- Booking modal not shown when requested
- False positives/negatives in intent detection

---

### Test 5: Calendly Integration

**Objective:** Verify Calendly booking flow works end-to-end

**Prerequisites:** Operator account must have Calendly connected

**Steps:**
1. Log in as HVAC operator
2. Connect Calendly account in Settings
3. Logout
4. Navigate to https://hvac.rankedceo.com/lead
5. Open chat widget
6. Provide name and email
7. Request booking
8. Verify booking modal appears with Calendly calendar
9. Select an available time slot
10. Fill in Calendly booking form
11. Confirm booking
12. Verify booking confirmation appears in chat
13. Check email for Calendly confirmation
14. Check Supabase appointments table:
    ```sql
    SELECT * FROM appointments 
    WHERE invitee_email = '[your test email]'
    ORDER BY created_at DESC 
    LIMIT 1;
    ```

**Expected Results:**
- Calendly calendar loads in modal
- Available time slots shown
- Booking form appears
- Booking confirmed
- Email received
- Appointment created in database
- Conversation status updated to "booked"

**Issues to Log:**
- Calendly not loading
- No available slots
- Booking fails
- No email received
- Appointment not created
- Conversation status not updated

---

### Test 6: Conversation Persistence

**Objective:** Verify conversation persists across page reloads

**Steps:**
1. Open chat widget on Smile page
2. Send message: "Hello, I'm testing persistence"
3. Note the session_id from browser console
4. Refresh the page (F5)
5. Open chat widget again
6. Verify previous messages are still visible
7. Send message: "This is after refresh"
8. Check database:
    ```sql
    SELECT messages FROM agent_conversations 
    WHERE session_id = '[session_id]';
    ```
9. Verify both messages are in database

**Expected Results:**
- Chat history preserved after refresh
- Session ID remains the same
- All messages stored in database

**Issues to Log:**
- Chat history lost after refresh
- New session created on refresh
- Messages not persisted

---

### Test 7: Multiple Conversations

**Objective:** Verify system handles multiple concurrent conversations

**Steps:**
1. Open HVAC page in Chrome
2. Open Plumbing page in Firefox
3. Open Electrical page in Edge
4. Start conversations in all three browsers
5. Send different messages in each
6. Verify each conversation is independent
7. Check database for all three conversations:
    ```sql
    SELECT session_id, source, lead_name, lead_email 
    FROM agent_conversations 
    WHERE status = 'active'
    ORDER BY created_at DESC;
    ```

**Expected Results:**
- Each conversation has unique session_id
- Conversations don't interfere with each other
- All conversations stored correctly

**Issues to Log:**
- Conversations mixing
- Session conflicts
- Data corruption

---

### Test 8: Error Handling

**Objective:** Verify system handles errors gracefully

**Steps:**
1. Open chat widget
2. Send very long message (10,000+ characters)
3. Verify system handles it
4. Send special characters: !@#$%^&*()
5. Verify system handles it
6. Send empty message
7. Verify system handles it
8. Disconnect internet
9. Send message
10. Verify error message appears
11. Reconnect internet
12. Send message
13. Verify system recovers

**Expected Results:**
- Long messages handled
- Special characters handled
- Empty messages handled
- Network errors show user-friendly message
- System recovers after reconnection

**Issues to Log:**
- System crashes
- No error messages
- System doesn't recover

---

### Test 9: Mobile Responsiveness

**Objective:** Verify chat widget works on mobile devices

**Steps:**
1. Open browser DevTools
2. Toggle device toolbar (Ctrl+Shift+M)
3. Select iPhone 14 Pro
4. Navigate to HVAC page
5. Verify chat widget is visible
6. Open chat widget
7. Verify chat window fits on screen
8. Send test message
9. Verify response
10. Test on other devices (iPad, Android)

**Expected Results:**
- Chat widget visible on mobile
- Chat window responsive
- Messages readable
- Typing works

**Issues to Log:**
- Widget not visible on mobile
- Chat window too large
- Text not readable
- Typing issues

---

### Test 10: Database Integrity

**Objective:** Verify database integrity after testing

**Steps:**
1. Check for orphaned conversations:
    ```sql
    SELECT COUNT(*) FROM agent_conversations 
    WHERE status = 'active' 
    AND updated_at < NOW() - INTERVAL '1 hour';
    ```
2. Check for conversations without messages:
    ```sql
    SELECT id, session_id FROM agent_conversations 
    WHERE jsonb_array_length(messages) = 0;
    ```
3. Check for duplicate sessions:
    ```sql
    SELECT session_id, COUNT(*) 
    FROM agent_conversations 
    GROUP BY session_id 
    HAVING COUNT(*) > 1;
    ```
4. Check conversation statistics:
    ```sql
    SELECT 
      source,
      status,
      COUNT(*) as count
    FROM agent_conversations
    GROUP BY source, status
    ORDER BY source, status;
    ```

**Expected Results:**
- No orphaned conversations
- No conversations without messages
- No duplicate sessions
- Statistics look reasonable

**Issues to Log:**
- Orphaned conversations
- Empty conversations
- Duplicate sessions
- Unusual statistics

---

## Test Results Template

### Test 1: Chat Widget Visibility
- **Status:** ☐ Pass ☐ Fail
- **Notes:** 

### Test 2: Basic Conversation Flow
- **Status:** ☐ Pass ☐ Fail
- **Notes:** 

### Test 3: Lead Information Extraction
- **Status:** ☐ Pass ☐ Fail
- **Notes:** 

### Test 4: Booking Intent Detection
- **Status:** ☐ Pass ☐ Fail
- **Notes:** 

### Test 5: Calendly Integration
- **Status:** ☐ Pass ☐ Fail
- **Notes:** 

### Test 6: Conversation Persistence
- **Status:** ☐ Pass ☐ Fail
- **Notes:** 

### Test 7: Multiple Conversations
- **Status:** ☐ Pass ☐ Fail
- **Notes:** 

### Test 8: Error Handling
- **Status:** ☐ Pass ☐ Fail
- **Notes:** 

### Test 9: Mobile Responsiveness
- **Status:** ☐ Pass ☐ Fail
- **Notes:** 

### Test 10: Database Integrity
- **Status:** ☐ Pass ☐ Fail
- **Notes:** 

---

## Common Issues and Solutions

### Issue: Chat widget not visible
**Solution:** Check browser console for errors, verify JavaScript is enabled

### Issue: AI not responding
**Solution:** Check GEMINI_API_KEY is set, check network tab for API errors

### Issue: Calendly not loading
**Solution:** Verify operator has connected Calendly, check access token

### Issue: Booking not confirmed
**Solution:** Check Calendly webhook is configured, check webhook logs

### Issue: Conversation not persisting
**Solution:** Verify database migration ran, check RLS policies

---

## Performance Benchmarks

### Target Metrics
- Chat widget load time: < 2 seconds
- AI response time: < 3 seconds
- Calendly load time: < 5 seconds
- Database query time: < 500ms

### How to Measure
1. Open browser DevTools Network tab
2. Filter by XHR/Fetch requests
3. Check timing for each API call
4. Record response times

---

## Security Testing

### Test Cases
- [ ] Verify RLS policies prevent cross-account access
- [ ] Verify anonymous conversations don't expose other users' data
- [ ] Verify SQL injection attempts are blocked
- [ ] Verify XSS attempts are blocked

### SQL Injection Test
```sql
-- Try to inject SQL in chat message
Message: "'; DROP TABLE agent_conversations; --"
Expected: Message stored as text, no SQL execution
```

---

## Accessibility Testing

### Test Cases
- [ ] Chat widget is keyboard navigable
- [ ] Chat widget has proper ARIA labels
- [ ] Chat widget works with screen readers
- [ ] Color contrast meets WCAG standards

---

## Browser Compatibility

### Browsers to Test
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

---

## Post-Testing Cleanup

### Clean Up Test Data
```sql
-- Delete test conversations
DELETE FROM agent_conversations 
WHERE lead_email LIKE '%@test.com'
OR lead_email LIKE '%@example.com';

-- Delete test appointments
DELETE FROM appointments 
WHERE invitee_email LIKE '%@test.com'
OR invitee_email LIKE '%@example.com';
```

### Archive Test Results
- [ ] Save screenshots of issues
- [ ] Export test results to spreadsheet
- [ ] Document any bugs found
- [ ] Create GitHub issues for bugs

---

## Next Steps After Testing

### If All Tests Pass
1. Deploy to production
2. Monitor for 24 hours
3. Collect user feedback
4. Plan Phase 5 (Analytics Dashboard)

### If Tests Fail
1. Document all failures
2. Prioritize by severity
3. Fix critical issues first
4. Re-test after fixes
5. Document solutions

---

## Contact Information

### For Issues
- GitHub Issues: https://github.com/twinwicksllc/rankedceo-crm-production/issues
- Support: [Your support email]

### For Questions
- Technical Lead: [Name]
- Product Owner: [Name]

---

## Appendix: Useful Queries

### Get All Active Conversations
```sql
SELECT 
  id,
  session_id,
  source,
  lead_name,
  lead_email,
  status,
  created_at,
  jsonb_array_length(messages) as message_count
FROM agent_conversations
WHERE status = 'active'
ORDER BY created_at DESC;
```

### Get Conversation Details
```sql
SELECT 
  id,
  session_id,
  source,
  lead_name,
  lead_email,
  lead_phone,
  status,
  appointment_id,
  messages,
  created_at,
  updated_at
FROM agent_conversations
WHERE session_id = '[session_id]';
```

### Get Booked Conversations
```sql
SELECT 
  ac.id,
  ac.session_id,
  ac.source,
  ac.lead_name,
  ac.lead_email,
  a.title,
  a.start_time,
  a.status
FROM agent_conversations ac
LEFT JOIN appointments a ON ac.appointment_id = a.id
WHERE ac.status = 'booked'
ORDER BY ac.created_at DESC;
```

### Get Statistics by Source
```sql
SELECT 
  source,
  COUNT(*) as total,
  COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
  COUNT(CASE WHEN status = 'booked' THEN 1 END) as booked,
  COUNT(CASE WHEN status = 'abandoned' THEN 1 END) as abandoned,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed
FROM agent_conversations
GROUP BY source
ORDER BY source;
```

---

**Testing Plan Version:** 1.0  
**Last Updated:** 2024-03-01  
**Prepared By:** SuperNinja AI Agent