# Subdomain Testing Checklist

## Pre-Deployment Checklist
- ✅ Database migration run (`20240222000000_create_industry_leads.sql`)
- ✅ DNS configured in GoDaddy
- ✅ Custom domains added in Vercel
- ✅ Build fixed and deployed successfully
- ✅ Middleware routing configured

## Industry Subdomains

### 1. HVAC Pro - hvac.rankedceo.com

#### Landing Page
- [ ] Page loads without errors
- [ ] HVAC Pro branding visible
- [ ] Navigation menu present
- [ ] Footer links working

#### Lead Submission Form
- [ ] Form accessible at `/hvac/lead`
- [ ] All form fields visible and functional
- [ ] Form validation works (required fields)
- [ ] Form submission succeeds
- [ ] Success page displays after submission
- [ ] Lead appears in dashboard

#### Dashboard
- [ ] Login page accessible at `/hvac/login`
- [ ] Signup page accessible at `/hvac/signup`
- [ ] Dashboard loads after login
- [ ] Lead list displays submitted leads
- [ ] Lead details view works
- [ ] Lead status can be updated

#### Data Isolation
- [ ] HVAC leads only visible to HVAC users
- [ ] Can't access plumbing/electrical leads
- [ ] User metadata has `industry: 'hvac'`

---

### 2. Plumb Pro - plumbing.rankedceo.com

#### Landing Page
- [ ] Page loads without errors
- [ ] Plumb Pro branding visible
- [ ] Navigation menu present
- [ ] Footer links working

#### Lead Submission Form
- [ ] Form accessible at `/plumbing/lead`
- [ ] All form fields visible and functional
- [ ] Form validation works (required fields)
- [ ] Form submission succeeds
- [ ] Success page displays after submission
- [ ] Lead appears in dashboard

#### Dashboard
- [ ] Login page accessible at `/plumbing/login`
- [ ] Signup page accessible at `/plumbing/signup`
- [ ] Dashboard loads after login
- [ ] Lead list displays submitted leads
- [ ] Lead details view works
- [ ] Lead status can be updated

#### Data Isolation
- [ ] Plumbing leads only visible to plumbing users
- [ ] Can't access HVAC/electrical leads
- [ ] User metadata has `industry: 'plumbing'`

---

### 3. Spark Pro - electrical.rankedceo.com

#### Landing Page
- [ ] Page loads without errors
- [ ] Spark Pro branding visible
- [ ] Navigation menu present
- [ ] Footer links working

#### Lead Submission Form
- [ ] Form accessible at `/electrical/lead`
- [ ] All form fields visible and functional
- [ ] Form validation works (required fields)
- [ ] Form submission succeeds
- [ ] Success page displays after submission
- [ ] Lead appears in dashboard

#### Dashboard
- [ ] Login page accessible at `/electrical/login`
- [ ] Signup page accessible at `/electrical/signup`
- [ ] Dashboard loads after login
- [ ] Lead list displays submitted leads
- [ ] Lead details view works
- [ ] Lead status can be updated

#### Data Isolation
- [ ] Electrical leads only visible to electrical users
- [ ] Can't access HVAC/plumbing leads
- [ ] User metadata has `industry: 'electrical'`

---

### 4. Smile Dashboard - smile.rankedceo.com

#### Landing Page
- [ ] Page loads without errors
- [ ] Smile MakeOver branding visible
- [ ] Navigation menu present

#### Assessment Form
- [ ] Form accessible at `/smile/assessment`
- [ ] All assessment questions visible
- [ ] Form validation works
- [ ] Form submission succeeds
- [ ] Success page displays after submission
- [ ] Assessment data saved correctly

#### Dashboard
- [ ] Dashboard loads after login
- [ ] Patient assessments visible
- [ ] Case mix data displays correctly
- [ ] Revenue calculations accurate

#### Data Isolation
- [ ] Patient data only visible to correct practice
- [ ] RLS policies working correctly

---

## Cross-Industry Testing

### User Flow
- [ ] Sign up as HVAC user at `/hvac/signup`
- [ ] Verify redirect to `/hvac` dashboard
- [ ] Try to access `/plumbing` - should redirect to HVAC subdomain
- [ ] Try to access `/electrical` - should redirect to HVAC subdomain

### Lead Data
- [ ] Submit lead on HVAC form
- [ ] Login as HVAC user - lead visible
- [ ] Login as plumbing user - lead NOT visible
- [ ] Submit lead on plumbing form
- [ ] Login as plumbing user - only plumbing leads visible

### Security
- [ ] Cannot access leads from other industries via API
- [ ] Cannot modify leads from other industries via API
- [ ] RLS policies enforced at database level

---

## Performance Testing

### Load Times
- [ ] HVAC landing page loads in < 3 seconds
- [ ] Plumbing landing page loads in < 3 seconds
- [ ] Electrical landing page loads in < 3 seconds
- [ ] Smile landing page loads in < 3 seconds

### Form Submission
- [ ] Lead submission completes in < 2 seconds
- [ ] Assessment submission completes in < 2 seconds

### Dashboard
- [ ] Dashboard loads in < 3 seconds
- [ ] Lead list loads in < 2 seconds
- [ ] Analytics load in < 3 seconds

---

## Mobile Responsiveness

### Landing Pages
- [ ] HVAC landing page responsive on mobile
- [ ] Plumbing landing page responsive on mobile
- [ ] Electrical landing page responsive on mobile
- [ ] Smile landing page responsive on mobile

### Forms
- [ ] Lead forms work on mobile
- [ ] Assessment form works on mobile
- [ ] Dashboard usable on mobile

---

## Browser Compatibility

### Desktop Browsers
- [ ] Chrome - all subdomains work
- [ ] Firefox - all subdomains work
- [ ] Safari - all subdomains work
- [ ] Edge - all subdomains work

### Mobile Browsers
- [ ] Chrome mobile - all subdomains work
- [ ] Safari mobile - all subdomains work

---

## Known Issues & Limitations

### Current Limitations
1. Industry isolation relies on user metadata - needs proper enforcement
2. No analytics tracking implemented yet
3. Email notifications not configured for lead submissions
4. Pool account for unattributed leads needs testing

### Future Enhancements
1. Add analytics tracking (Google Analytics, etc.)
2. Implement email notifications for new leads
3. Add real-time lead updates via WebSocket
4. Implement lead scoring algorithms
5. Add CRM integration options

---

## Deployment Status

### Latest Commit
- Commit: `cc3daba`
- Branch: `main`
- Status: Deployed to Vercel

### Vercel Deployment
- Production URL: https://crm.rankedceo.com
- Subdomains:
  - HVAC: https://hvac.rankedceo.com
  - Plumbing: https://plumbing.rankedceo.com
  - Electrical: https://electrical.rankedceo.com
  - Smile: https://smile.rankedceo.com

### DNS Configuration
- All CNAME records pointing to `cname.vercel-dns.com`
- DNS propagation may take 5-60 minutes

---

## Next Steps

1. **Immediate (Today)**
   - Test all subdomain landing pages
   - Test lead submission forms
   - Verify data isolation

2. **Short-term (This Week)**
   - Add analytics tracking
   - Configure email notifications
   - Test with real users

3. **Medium-term (Next Month)**
   - Implement lead scoring
   - Add CRM integrations
   - Performance optimization

4. **Long-term (Next Quarter)**
   - Mobile apps
   - Advanced analytics
   - AI-powered lead qualification