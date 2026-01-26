# Landing Page Builder Prompt for RankedCEO CRM

## Project Overview
Create a modern, professional landing page for RankedCEO CRM - an AI-powered, multi-tenant Customer Relationship Management platform designed for service-based businesses (HVAC, plumbing, electrical contractors, and similar industries).

## Product Description

### What RankedCEO CRM Is
RankedCEO CRM is a comprehensive, cloud-based CRM solution that combines traditional contact and deal management with cutting-edge AI capabilities to help service businesses generate, nurture, and convert leads more effectively.

### Current Features (Phases 1-7 Complete - 46.7%)
1. **Authentication System**
   - Secure email/password authentication via Supabase
   - reCAPTCHA v3 protection against bots
   - Multi-tenant architecture with account-based data isolation

2. **Dashboard**
   - Real-time statistics and metrics
   - Quick access to all modules
   - Responsive, modern interface

3. **Contacts Management**
   - Full CRUD operations for contacts
   - Advanced search and filtering
   - Contact detail views with complete history
   - Email, phone, and address management

4. **Companies Management**
   - Company profiles with comprehensive details
   - Industry categorization
   - Website and social media links
   - Associated contacts tracking
   - Company statistics (total companies, contacts, active accounts)

5. **Deals & Pipeline Management**
   - Visual deal tracking through customizable pipelines
   - Stage management (Lead → Qualified → Proposal → Negotiation → Won/Lost)
   - Deal value and probability tracking
   - Win rate analytics
   - Association with contacts and companies

6. **Pipelines**
   - Custom pipeline creation
   - Stage customization
   - Multiple pipelines for different business processes

7. **Activities Module**
   - Activity timeline for contacts, companies, and deals
   - Activity types: Calls, Meetings, Emails, Notes, Tasks
   - Due date tracking and reminders
   - Duration and location tracking
   - Attendee management
   - Activity status tracking (Scheduled, Completed, Cancelled)

### Upcoming Features (Phases 8-15 - In Development)

8. **Email Campaigns (Phase 8)**
   - Bulk email campaigns via SendGrid/Twilio
   - Campaign sequences and automation
   - Email templates and personalization
   - Campaign analytics (open rates, click rates, conversions)
   - A/B testing capabilities

9. **Smart BCC Email Capture (Phase 9)**
   - Automatic email capture via BCC
   - Email parsing and contact extraction
   - Thread tracking and conversation history
   - Automatic activity logging from emails

10. **Form Builder (Phase 10)**
    - Drag-and-drop form builder
    - Embeddable public forms for lead capture
    - Custom fields and validation
    - Form submission management
    - Automatic contact creation from submissions

11. **AI-Powered Features (Phase 11)**
    - **AI Lead Scoring** - Gemini AI analyzes leads and assigns scores based on:
      - Engagement history
      - Company size and industry
      - Deal value and probability
      - Activity patterns
    - **AI-Powered Insights** - Perplexity AI provides:
      - Company research and intelligence
      - Market trends and competitor analysis
      - Personalized outreach recommendations
    - **Smart Recommendations** - AI suggests:
      - Next best actions for deals
      - Optimal contact times
      - Email subject lines and content
      - Deal closure strategies

12. **Analytics Dashboard (Phase 12)**
    - Revenue forecasting
    - Sales performance metrics
    - Team productivity analytics
    - Pipeline health indicators
    - Custom reports and exports
    - Data visualization (charts, graphs, heatmaps)

13. **Settings & Customization (Phase 13)**
    - User profile management
    - Account settings and preferences
    - Custom fields for all modules
    - Email signature management
    - Notification preferences
    - Integration settings

14. **Testing & Quality Assurance (Phase 14)**
    - Comprehensive unit testing
    - Integration testing
    - End-to-end testing
    - Performance optimization
    - Security audits

15. **Final Deployment & Documentation (Phase 15)**
    - Production deployment optimization
    - User documentation and guides
    - Video tutorials
    - API documentation
    - Admin training materials

## Technical Stack

### Frontend
- **Framework**: Next.js 14 (React 18)
- **Styling**: Tailwind CSS
- **UI Components**: Custom component library with shadcn/ui patterns
- **TypeScript**: Full type safety throughout

### Backend
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **API**: Next.js API Routes
- **Real-time**: Supabase Realtime subscriptions

### AI & Integrations
- **AI Lead Scoring**: Google Gemini Pro API
- **AI Research**: Perplexity AI API
- **Email**: SendGrid/Twilio
- **Security**: reCAPTCHA v3
- **Hosting**: Vercel

### Security Features
- Row Level Security (RLS) policies
- Multi-tenant data isolation
- Encrypted data at rest and in transit
- reCAPTCHA v3 bot protection
- Secure API key management

## Design Requirements

### Visual Style
- **Modern & Professional**: Clean, minimalist design that conveys trust and reliability
- **Color Scheme**: Match the existing CRM application
  - Primary: Blue tones (professional, trustworthy)
  - Accent: Green (success, growth)
  - Neutral: Gray scale for text and backgrounds
  - Use the same Tailwind CSS color palette as the app

### Typography
- **Headings**: Bold, clear hierarchy
- **Body Text**: Readable, professional font (Inter, system fonts)
- **Code/Technical**: Monospace for technical details

### Layout Sections

#### 1. Hero Section
- **Headline**: "AI-Powered CRM for Service Businesses"
- **Subheadline**: "Generate more leads, close more deals, and grow your business with intelligent automation"
- **CTA Buttons**: 
  - Primary: "Start Free Trial" (links to /signup)
  - Secondary: "Watch Demo" (video modal or demo page)
- **Hero Image/Animation**: Dashboard preview or animated feature showcase

#### 2. Problem Statement
- Address pain points of service businesses:
  - "Losing leads in spreadsheets and sticky notes?"
  - "Spending hours on manual data entry?"
  - "Missing follow-ups and opportunities?"
  - "Can't predict which leads will convert?"

#### 3. Solution Overview
- Brief explanation of how RankedCEO CRM solves these problems
- Focus on AI-powered automation and intelligence
- Highlight time savings and revenue growth

#### 4. Key Features (Current + Coming Soon)
Display features in a grid or card layout:

**Current Features:**
- 📊 **Smart Dashboard** - Real-time insights at a glance
- 👥 **Contact Management** - Never lose track of a lead
- 🏢 **Company Profiles** - Complete business intelligence
- 💰 **Deal Pipeline** - Visual sales tracking
- 📅 **Activity Timeline** - Complete interaction history
- 🎯 **Custom Pipelines** - Adapt to your workflow

**Coming Soon:**
- 🤖 **AI Lead Scoring** - Know which leads to prioritize
- 📧 **Email Campaigns** - Automated outreach at scale
- 📝 **Form Builder** - Capture leads from your website
- 🔍 **AI Research** - Automatic company intelligence
- 📊 **Advanced Analytics** - Forecast revenue and performance
- ⚡ **Smart BCC** - Capture emails automatically

#### 5. AI Features Spotlight
Dedicated section highlighting AI capabilities:
- **Gemini AI Lead Scoring**: Visual explanation with example scores
- **Perplexity AI Research**: Show how it gathers company intelligence
- **Smart Recommendations**: Examples of AI-suggested actions

#### 6. Use Cases / Industries
- HVAC Contractors
- Plumbing Services
- Electrical Contractors
- Home Services
- B2B Service Providers
- Consulting Firms

#### 7. Pricing (Future)
- Placeholder for pricing tiers
- "Contact for Pricing" or "Coming Soon"
- Emphasize value and ROI

#### 8. Testimonials (Future)
- Placeholder for customer testimonials
- Social proof section

#### 9. Security & Trust
- Highlight security features:
  - Enterprise-grade encryption
  - Multi-tenant isolation
  - reCAPTCHA protection
  - Supabase infrastructure
  - GDPR compliant (if applicable)

#### 10. Call to Action
- Final CTA section before footer
- "Ready to Transform Your Sales Process?"
- Buttons: "Start Free Trial" and "Schedule Demo"

#### 11. Footer
- Links to:
  - About Us
  - Features
  - Pricing
  - Contact
  - Privacy Policy
  - Terms of Service
- Social media links
- Copyright information

### Integration with Existing App

#### Navigation
- **Landing Page Header**:
  - Logo (left)
  - Navigation: Features, Pricing, About, Contact
  - Auth Buttons (right): "Log In" and "Sign Up"

- **Log In Button**: Links to `/login` (existing page)
- **Sign Up Button**: Links to `/signup` (existing page)

#### Consistent Styling
The landing page should use the same design system as the CRM:
- Same Tailwind CSS configuration
- Same color palette
- Same typography
- Same button styles
- Same form input styles
- Same card/container styles

#### Responsive Design
- Mobile-first approach
- Breakpoints: sm (640px), md (768px), lg (1024px), xl (1280px)
- Touch-friendly on mobile
- Optimized images for all screen sizes

### Technical Implementation

#### File Structure
```
app/
├── page.tsx                 # Landing page (root)
├── (auth)/
│   ├── login/page.tsx      # Existing login page
│   └── signup/page.tsx     # Existing signup page
├── (marketing)/
│   ├── features/page.tsx   # Features detail page
│   ├── pricing/page.tsx    # Pricing page
│   └── about/page.tsx      # About page
└── layout.tsx              # Root layout

components/
├── landing/
│   ├── hero.tsx
│   ├── features.tsx
│   ├── ai-spotlight.tsx
│   ├── use-cases.tsx
│   ├── cta.tsx
│   └── footer.tsx
└── ui/                     # Existing UI components
```

#### Performance Requirements
- **Lighthouse Score**: 90+ on all metrics
- **First Contentful Paint**: < 1.5s
- **Time to Interactive**: < 3.5s
- **Image Optimization**: Use Next.js Image component
- **Code Splitting**: Lazy load non-critical components

#### SEO Requirements
- **Meta Tags**: Title, description, keywords
- **Open Graph**: For social sharing
- **Schema Markup**: Organization, Product, SoftwareApplication
- **Sitemap**: Include all pages
- **Robots.txt**: Properly configured

### Content Guidelines

#### Tone & Voice
- **Professional but Approachable**: Not too corporate, not too casual
- **Benefit-Focused**: Emphasize outcomes, not just features
- **Action-Oriented**: Use strong CTAs and active language
- **Trustworthy**: Back claims with specifics and data

#### Copywriting Tips
- Use short, punchy sentences
- Lead with benefits, follow with features
- Include specific numbers and metrics where possible
- Address objections proactively
- Use social proof (when available)

#### Example Headlines
- "Stop Losing Leads. Start Closing Deals."
- "The CRM That Works As Hard As You Do"
- "AI-Powered Sales Intelligence for Service Businesses"
- "From Lead to Close in Half the Time"

### Assets Needed

#### Images
- Dashboard screenshots (from actual app)
- Feature demonstrations (animated GIFs or videos)
- Use cases / industry images
- Team photos (if available)
- Logo in various formats

#### Icons
- Feature icons (consistent style)
- Industry icons
- Social media icons
- UI icons (from existing component library)

#### Videos (Optional)
- Product demo (2-3 minutes)
- Feature walkthroughs
- Customer testimonials

### Accessibility Requirements
- **WCAG 2.1 Level AA Compliance**
- Semantic HTML
- ARIA labels where needed
- Keyboard navigation support
- Screen reader friendly
- Sufficient color contrast (4.5:1 minimum)
- Focus indicators on interactive elements

### Browser Support
- Chrome (last 2 versions)
- Firefox (last 2 versions)
- Safari (last 2 versions)
- Edge (last 2 versions)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Development Instructions

### Step 1: Review Existing Code
- Examine `app/(auth)/login/page.tsx` and `app/(auth)/signup/page.tsx`
- Review `components/ui/` for existing components
- Check `tailwind.config.js` for color scheme and styling
- Review `app/layout.tsx` for global styles

### Step 2: Create Landing Page Structure
- Create `app/page.tsx` as the new landing page
- Build reusable components in `components/landing/`
- Ensure consistent styling with existing app

### Step 3: Implement Sections
- Build each section as a separate component
- Use existing UI components where possible
- Ensure responsive design at all breakpoints

### Step 4: Integrate Authentication
- Link "Log In" button to `/login`
- Link "Sign Up" buttons to `/signup`
- Ensure smooth navigation between landing and auth pages

### Step 5: Optimize Performance
- Optimize images with Next.js Image
- Implement lazy loading for below-fold content
- Minimize JavaScript bundle size
- Add loading states for dynamic content

### Step 6: Test Thoroughly
- Test on multiple devices and browsers
- Verify all links work correctly
- Check form submissions
- Test authentication flow
- Validate accessibility

### Step 7: SEO & Meta Tags
- Add comprehensive meta tags
- Implement Open Graph tags
- Add schema markup
- Create sitemap
- Configure robots.txt

## Success Metrics

### User Engagement
- Time on page > 2 minutes
- Scroll depth > 75%
- CTA click-through rate > 5%
- Signup conversion rate > 2%

### Technical Performance
- Lighthouse Performance > 90
- Lighthouse Accessibility > 95
- Lighthouse Best Practices > 95
- Lighthouse SEO > 95

### Business Goals
- Increase signups by 50%
- Reduce bounce rate to < 40%
- Increase demo requests
- Build email list for marketing

## Additional Notes

### Brand Voice
RankedCEO CRM is positioned as:
- **Intelligent**: AI-powered, data-driven
- **Efficient**: Saves time, automates tasks
- **Reliable**: Enterprise-grade, secure
- **Growth-Focused**: Helps businesses scale

### Competitive Advantages
- AI-powered lead scoring (unique differentiator)
- Built specifically for service businesses
- Modern tech stack (Next.js, Supabase)
- Affordable pricing (when launched)
- Easy to use, quick to implement

### Future Considerations
- Multi-language support
- White-label options
- API access for integrations
- Mobile apps (iOS/Android)
- Advanced reporting and BI tools

---

## Final Checklist

Before considering the landing page complete, ensure:

- [ ] All sections implemented and responsive
- [ ] Links to /login and /signup working
- [ ] Consistent styling with existing app
- [ ] Performance optimized (Lighthouse > 90)
- [ ] Accessibility compliant (WCAG 2.1 AA)
- [ ] SEO meta tags and schema markup added
- [ ] All images optimized
- [ ] Cross-browser tested
- [ ] Mobile-friendly verified
- [ ] CTAs prominent and working
- [ ] Loading states implemented
- [ ] Error handling in place
- [ ] Analytics tracking ready (Google Analytics, etc.)

---

**This landing page should serve as the primary marketing and conversion tool for RankedCEO CRM, effectively communicating the value proposition while seamlessly integrating with the existing authentication system.**