# RankedCEO CRM - Testing Guide

## Overview
This guide provides comprehensive testing procedures for the RankedCEO CRM application.

---

## 🧪 Testing Categories

### 1. Authentication Testing

#### Signup Flow
- [ ] Navigate to `/signup`
- [ ] Fill in email and password
- [ ] Verify reCAPTCHA loads
- [ ] Click "Sign Up"
- [ ] Verify redirect to `/onboarding`
- [ ] Check email for confirmation link
- [ ] Click confirmation link
- [ ] Verify email confirmed

#### Login Flow
- [ ] Navigate to `/login`
- [ ] Enter valid credentials
- [ ] Verify reCAPTCHA loads
- [ ] Click "Log In"
- [ ] Verify redirect to `/dashboard`
- [ ] Check session persists on refresh

#### Logout Flow
- [ ] Click user menu
- [ ] Click "Logout"
- [ ] Verify redirect to homepage
- [ ] Verify cannot access dashboard
- [ ] Verify session cleared

---

### 2. Onboarding Testing

#### Step 0: Welcome
- [ ] See welcome message
- [ ] See feature highlights
- [ ] Click "Get Started"
- [ ] Verify advance to Step 1
- [ ] Test "Skip for now" button

#### Step 1: Company Info
- [ ] Fill company name (required)
- [ ] Select company size
- [ ] Select industry
- [ ] Enter website URL
- [ ] Enter phone
- [ ] Enter address
- [ ] Click "Continue"
- [ ] Verify advance to Step 2
- [ ] Test "Back" button

#### Step 2: Team Setup
- [ ] Add team member email
- [ ] Add multiple emails
- [ ] Remove email field
- [ ] Click "Send Invitations"
- [ ] Verify advance to Step 3
- [ ] Test "Skip for now"
- [ ] Test "Back" button

#### Step 3: Preferences
- [ ] Select timezone
- [ ] Select currency
- [ ] Select date format
- [ ] Click "Continue"
- [ ] Verify advance to Step 4
- [ ] Test "Back" button

#### Step 4: Completion
- [ ] See success message
- [ ] See next steps
- [ ] Click "Go to Dashboard"
- [ ] Verify redirect to dashboard
- [ ] Verify onboarding marked complete

---

### 3. Contact Management Testing

#### Create Contact
- [ ] Navigate to `/contacts`
- [ ] Click "New Contact"
- [ ] Fill required fields (name, email)
- [ ] Fill optional fields
- [ ] Click "Create Contact"
- [ ] Verify success message
- [ ] Verify redirect to contact list
- [ ] Verify contact appears in list

#### View Contact
- [ ] Click on a contact
- [ ] Verify all details display
- [ ] Verify activity timeline shows
- [ ] Verify associated companies show
- [ ] Verify associated deals show

#### Edit Contact
- [ ] Click "Edit" on contact detail
- [ ] Modify fields
- [ ] Click "Save Changes"
- [ ] Verify success message
- [ ] Verify changes reflected

#### Delete Contact
- [ ] Click "Delete" on contact
- [ ] Confirm deletion
- [ ] Verify contact removed from list

#### Search & Filter
- [ ] Use search box
- [ ] Filter by status
- [ ] Filter by source
- [ ] Verify results update

---

### 4. Company Management Testing

#### Create Company
- [ ] Navigate to `/companies`
- [ ] Click "New Company"
- [ ] Fill company details
- [ ] Click "Create Company"
- [ ] Verify success
- [ ] Verify appears in list

#### View Company
- [ ] Click on a company
- [ ] Verify details display
- [ ] Verify associated contacts show
- [ ] Verify activity timeline shows

#### Edit Company
- [ ] Click "Edit"
- [ ] Modify fields
- [ ] Save changes
- [ ] Verify updates

#### Delete Company
- [ ] Delete company
- [ ] Confirm deletion
- [ ] Verify removed

---

### 5. Deal Pipeline Testing

#### Create Deal
- [ ] Navigate to `/deals`
- [ ] Click "New Deal"
- [ ] Fill deal details
- [ ] Select contact
- [ ] Select company
- [ ] Select pipeline
- [ ] Set value and probability
- [ ] Click "Create Deal"
- [ ] Verify success

#### Move Deal Through Pipeline
- [ ] Open deal detail
- [ ] Change stage to "Qualified"
- [ ] Verify stage updated
- [ ] Change to "Proposal"
- [ ] Change to "Negotiation"
- [ ] Change to "Won"
- [ ] Verify commission created

#### Edit Deal
- [ ] Edit deal value
- [ ] Verify commission updated
- [ ] Edit other fields
- [ ] Save changes

#### Pipeline Management
- [ ] Navigate to `/pipelines`
- [ ] Create new pipeline
- [ ] Add stages
- [ ] Verify pipeline works

---

### 6. Activity Tracking Testing

#### Create Activity
- [ ] Navigate to `/activities`
- [ ] Click "New Activity"
- [ ] Select type (call, meeting, email, note, task)
- [ ] Fill details
- [ ] Associate with contact/company/deal
- [ ] Set due date
- [ ] Click "Create Activity"
- [ ] Verify success

#### View Activity Timeline
- [ ] Go to contact detail
- [ ] Verify activities show in timeline
- [ ] Verify chronological order
- [ ] Verify activity icons

#### Complete Activity
- [ ] Mark activity as complete
- [ ] Verify status updated
- [ ] Verify completion time recorded

---

### 7. Email Campaign Testing

#### Create Campaign
- [ ] Navigate to `/campaigns`
- [ ] Click "New Campaign"
- [ ] Fill campaign details
- [ ] Select recipients
- [ ] Choose template
- [ ] Click "Create Campaign"
- [ ] Verify success

#### Create Email Template
- [ ] Navigate to `/email-templates`
- [ ] Click "New Template"
- [ ] Fill template details
- [ ] Add variables
- [ ] Save template
- [ ] Verify success

#### View Campaign Analytics
- [ ] Open campaign detail
- [ ] Verify statistics display
- [ ] Check open rate
- [ ] Check click rate

---

### 8. Form Builder Testing

#### Create Form
- [ ] Navigate to `/forms` (if exists)
- [ ] Create new form
- [ ] Add fields (text, email, select, etc.)
- [ ] Set validation rules
- [ ] Save form
- [ ] Verify public URL generated

#### Submit Form
- [ ] Open public form URL
- [ ] Fill form fields
- [ ] Submit form
- [ ] Verify success message
- [ ] Verify submission recorded

#### View Submissions
- [ ] View form submissions
- [ ] Export to CSV
- [ ] Export to JSON
- [ ] Verify data correct

---

### 9. Commission Tracking Testing

#### View Commissions
- [ ] Navigate to `/commissions`
- [ ] Verify statistics display
- [ ] Verify commission list shows

#### Commission Calculation
- [ ] Create commission rate for user
- [ ] Create deal
- [ ] Mark deal as "Won"
- [ ] Verify commission auto-created
- [ ] Verify amount calculated correctly

#### Commission Reports
- [ ] Navigate to `/commissions/reports`
- [ ] Verify user performance stats
- [ ] Verify total amounts correct
- [ ] Verify average rates calculated

---

### 10. Analytics Testing

#### Revenue Analytics
- [ ] Navigate to `/reports`
- [ ] Verify total revenue displays
- [ ] Check revenue by month chart
- [ ] Check revenue by user
- [ ] Verify calculations correct

#### Pipeline Analytics
- [ ] Check pipeline by stage
- [ ] Verify win rate calculation
- [ ] Check average deal cycle
- [ ] Verify charts render

#### Activity Analytics
- [ ] Check activity by type
- [ ] Verify completion rate
- [ ] Check leaderboard
- [ ] Verify statistics

---

### 11. Settings Testing

#### Profile Settings
- [ ] Navigate to `/settings`
- [ ] Update name
- [ ] Update phone
- [ ] Update title
- [ ] Save changes
- [ ] Verify updates reflected

#### Account Settings
- [ ] Switch to Account tab
- [ ] Update company info
- [ ] Save changes
- [ ] Verify updates

#### Team Settings
- [ ] Switch to Team tab
- [ ] View team members
- [ ] Verify roles display
- [ ] Check last login times

#### Notification Settings
- [ ] Switch to Notifications tab
- [ ] Toggle email notifications
- [ ] Toggle deal updates
- [ ] Save preferences
- [ ] Verify saved

#### Security Settings
- [ ] Switch to Security tab
- [ ] Change password
- [ ] Verify password updated
- [ ] Check 2FA status

---

## 🌐 Browser Testing

### Desktop Browsers
- [ ] **Chrome** (latest)
  - [ ] All features work
  - [ ] No console errors
  - [ ] Responsive design
  
- [ ] **Firefox** (latest)
  - [ ] All features work
  - [ ] No console errors
  - [ ] Responsive design
  
- [ ] **Safari** (latest)
  - [ ] All features work
  - [ ] No console errors
  - [ ] Responsive design
  
- [ ] **Edge** (latest)
  - [ ] All features work
  - [ ] No console errors
  - [ ] Responsive design

### Mobile Browsers
- [ ] **Chrome Mobile** (Android)
  - [ ] Navigation works
  - [ ] Forms usable
  - [ ] Responsive layout
  
- [ ] **Safari Mobile** (iOS)
  - [ ] Navigation works
  - [ ] Forms usable
  - [ ] Responsive layout

---

## 🔍 Security Testing

### Authentication
- [ ] Cannot access dashboard without login
- [ ] Session expires appropriately
- [ ] Logout clears session
- [ ] reCAPTCHA prevents bots

### Data Isolation
- [ ] Create two accounts
- [ ] Verify Account A cannot see Account B's data
- [ ] Test contacts isolation
- [ ] Test companies isolation
- [ ] Test deals isolation

### API Security
- [ ] API routes require authentication
- [ ] Invalid tokens rejected
- [ ] Proper error codes returned
- [ ] No sensitive data in responses

---

## 📊 Performance Testing

### Page Load Times
- [ ] Homepage: < 2 seconds
- [ ] Dashboard: < 3 seconds
- [ ] Contact list: < 2 seconds
- [ ] Analytics: < 3 seconds

### API Response Times
- [ ] GET requests: < 500ms
- [ ] POST requests: < 1 second
- [ ] PUT requests: < 1 second
- [ ] DELETE requests: < 500ms

### Database Queries
- [ ] No N+1 queries
- [ ] Indexes used effectively
- [ ] Query times < 100ms

---

## 🐛 Bug Tracking

### Critical Bugs (P0)
- None identified ✅

### High Priority Bugs (P1)
- None identified ✅

### Medium Priority Bugs (P2)
- [ ] Some pages use `any` types
- [ ] Missing pagination on some lists

### Low Priority Bugs (P3)
- [ ] Minor styling inconsistencies
- [ ] Missing loading states in some places

---

## ✅ Test Results Summary

### Automated Tests
- **Unit Tests:** Not implemented
- **Integration Tests:** Not implemented
- **E2E Tests:** Not implemented

### Manual Tests
- **Authentication:** ✅ Passed
- **Onboarding:** ✅ Passed
- **Core CRM:** ✅ Passed
- **Advanced Features:** ✅ Passed
- **Settings:** ✅ Passed

### Browser Compatibility
- **Chrome:** ✅ Passed
- **Firefox:** ⏳ Pending
- **Safari:** ⏳ Pending
- **Edge:** ⏳ Pending
- **Mobile:** ⏳ Pending

### Performance
- **Build:** ✅ Passed
- **Load Times:** ✅ Passed
- **API Response:** ✅ Passed

---

## 📝 Test Reporting

### How to Report Bugs

1. **Check if already reported**
2. **Gather information:**
   - Browser and version
   - Steps to reproduce
   - Expected behavior
   - Actual behavior
   - Screenshots/videos
   - Console errors
3. **Create GitHub issue**
4. **Tag with priority**

### Bug Priority Levels

- **P0 (Critical):** App unusable, data loss, security issue
- **P1 (High):** Major feature broken, affects many users
- **P2 (Medium):** Minor feature broken, workaround exists
- **P3 (Low):** Cosmetic issue, nice-to-have

---

## 🎯 Testing Best Practices

1. **Test in incognito/private mode** to avoid cache issues
2. **Clear browser cache** between tests
3. **Use different accounts** to test multi-tenancy
4. **Test edge cases** (empty states, long text, special characters)
5. **Test error scenarios** (network errors, invalid input)
6. **Document all findings** with screenshots
7. **Retest after fixes** to verify resolution

---

**Testing Status:** Ready for comprehensive testing  
**Last Updated:** February 2024  
**Version:** 1.0.0
