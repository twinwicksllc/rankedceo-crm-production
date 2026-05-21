# RankedCEO CRM

A modern, full-featured Customer Relationship Management (CRM) system built with Next.js 14, Supabase, and AI integration. Production-ready with 11 major modules, 67 routes, and complete security coverage.

**Status:** ✅ Production Ready | **Version:** 1.0.0 | **Live:** https://crm.rankedceo.com

## 🎯 Quick Links

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Installation](#-installation)
- [Environment Variables](#-environment-variables)
- [Project Structure](#-project-structure)
- [Database Schema](#-database-schema)
- [Security](#-security)
- [API Routes](#-api-routes)
- [Deployment](#-deployment)
- [Documentation](#-documentation)
- [Testing](#-testing)
- [Support](#-support)

## 🚀 Features

### Core CRM Features
- **Contact Management** - Comprehensive contact database with full CRUD, search, filtering, and activity tracking
- **Company Management** - Track companies, relationships, and associated contacts with detailed profiles
- **Deal Pipeline** - Visual pipeline management with customizable stages and deal tracking
- **Activity Tracking** - Log calls, meetings, emails, notes, and tasks with timeline visualization
- **Activity Timeline** - Chronological view of all interactions with contacts, companies, and deals

### Advanced Features
- **Email Campaigns** - Create and manage email campaigns with SendGrid integration
- **Email Templates** - Pre-built templates for common business scenarios
- **Smart BCC Email Capture** - Automatically capture emails via BCC for seamless integration
- **Email Threading** - View complete email conversations within the CRM
- **Form Builder** - 17 field types with drag-and-drop interface
- **Public Forms** - Share forms for lead capture and customer feedback
- **Commission Tracking** - Automatic commission calculation and reporting with rate management
- **Analytics & Reporting** - Revenue, pipeline, and activity analytics with interactive charts

### User Experience
- **Multi-step Onboarding** - Guided setup for new users with welcome, company info, team setup, preferences, and completion steps
- **Settings Module** - Comprehensive user and account management
  - Profile settings (name, phone, title)
  - Account settings (company info, plan)
  - Team management (view members, roles)
  - Notification preferences
  - Security settings (password management, 2FA UI)
- **Responsive Design** - Mobile, tablet, and desktop optimized
- **Dark/Light Mode Ready** - Styled with Tailwind CSS for theme support
- **Accessible UI** - Built with Radix UI for accessibility

### Security & Architecture
- **Multi-tenant Architecture** - Complete data isolation per account
- **Row Level Security (RLS)** - 100% RLS coverage on all database tables
- **Authentication** - Secure Supabase Auth with email/password
- **reCAPTCHA v3** - Bot protection on authentication flows
- **SECURITY DEFINER Functions** - Secure database operations with elevated privileges
- **SQL Injection Protection** - Parameterized queries throughout
- **Session Management** - Secure session handling with middleware
- **Protected Routes** - Authentication required for dashboard access

## 🛠️ Tech Stack

### Frontend
- **Framework:** Next.js 14 (App Router with React 18)
- **Language:** TypeScript (100% typed)
- **Styling:** Tailwind CSS 3.4
- **UI Components:** Radix UI + Custom Components
- **Charts:** Recharts for data visualization
- **Icons:** Lucide React
- **Validation:** Zod (runtime type checking)
- **HTTP Client:** @supabase/supabase-js

### Backend & Database
- **Database:** PostgreSQL via Supabase
- **Authentication:** Supabase Auth
- **API Routes:** Next.js API Routes with TypeScript
- **ORM Approach:** Direct SQL with Supabase client

### External Services
- **Email:** SendGrid (via Twilio) for email campaigns
- **Bot Protection:** Google reCAPTCHA v3 Enterprise
- **AI Ready:** Gemini (lead scoring), Perplexity (research)

### Deployment
- **Hosting:** Vercel (Edge Functions, Edge Middleware)
- **Version Control:** Git + GitHub
- **CI/CD:** Vercel auto-deployment from GitHub

## 📦 Installation

### Prerequisites

- **Node.js:** 20.x or higher (24.x recommended)
- **npm:** 10.x or higher (or yarn/pnpm)
- **Supabase Account:** https://supabase.com
- **SendGrid Account:** https://sendgrid.com (optional, for email features)
- **Google reCAPTCHA v3 Keys:** https://www.google.com/recaptcha/admin
- **Vercel Account:** https://vercel.com (for deployment)

### Step 1: Clone the Repository

```bash
git clone https://github.com/twinwicksllc/rankedceo-crm-production.git
cd rankedceo-crm-production
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Set Up Supabase

1. Create a new Supabase project at https://supabase.com
2. Go to SQL Editor in your Supabase dashboard
3. Run all migrations in order from `supabase/migrations/` directory:
   - `20240116000001_*.sql` - Initial schema
   - `20240116000002_*.sql` - Core tables
   - Continue in numerical order
4. See [Migration Instructions](#database-migrations) for detailed steps

### Step 4: Configure Environment Variables

Create a `.env.local` file in the root directory:

```bash
# Supabase (Required)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# reCAPTCHA v3 (Required for authentication)
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=your_recaptcha_site_key
RECAPTCHA_SECRET_KEY=your_recaptcha_secret_key

# SendGrid (Required for email features)
SENDGRID_API_KEY=your_sendgrid_api_key

# AI Services (Optional - for future integration)
NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_api_key
NEXT_PUBLIC_PERPLEXITY_API_KEY=your_perplexity_api_key

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000  # Change to your domain in production
```

See `.env.example` for a complete template.

### Step 5: Run Development Server

```bash
npm run dev
```

Visit http://localhost:3000 in your browser.

### Step 6: Build for Production

```bash
npm run build
npm start
```

## 🔐 Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | `https://xxxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | `eyJhbGc...` |
| `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` | reCAPTCHA v3 site key | `6Le7tsIp...` |
| `RECAPTCHA_SECRET_KEY` | reCAPTCHA v3 secret key | `6Le7tsIp...` |
| `SENDGRID_API_KEY` | SendGrid API key | `SG.xxxxx` |

### Optional Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_GEMINI_API_KEY` | Google Gemini API key | `AIzaSyDxxxxx` |
| `NEXT_PUBLIC_PERPLEXITY_API_KEY` | Perplexity API key | `pplx-xxxxx` |
| `NEXT_PUBLIC_APP_URL` | Application URL | `https://crm.rankedceo.com` |

## 📊 Project Structure

```
rankedceo-crm-production/
├── app/                              # Next.js App Router
│   ├── (auth)/                       # Authentication pages
│   │   ├── login/page.tsx           # Login page
│   │   ├── signup/page.tsx          # Signup page
│   │   └── layout.tsx               # Auth layout
│   │
│   ├── (dashboard)/                  # Protected dashboard pages
│   │   ├── layout.tsx               # Dashboard layout with sidebar
│   │   ├── page.tsx                 # Dashboard home
│   │   │
│   │   ├── activities/              # Activities module
│   │   │   ├── page.tsx            # Activities list
│   │   │   └── [id]/page.tsx       # Activity detail
│   │   │
│   │   ├── campaigns/               # Campaigns module
│   │   │   ├── page.tsx            # Campaigns list
│   │   │   ├── new/page.tsx        # Create campaign
│   │   │   └── [id]/               # Campaign details
│   │   │
│   │   ├── commissions/             # Commission tracking
│   │   │   ├── page.tsx            # Commission dashboard
│   │   │   ├── rates/page.tsx      # Commission rates
│   │   │   └── reports/page.tsx    # Reports
│   │   │
│   │   ├── companies/               # Companies module
│   │   │   ├── page.tsx            # Companies list
│   │   │   ├── new/page.tsx        # Create company
│   │   │   ├── [id]/page.tsx       # Company detail
│   │   │   └── [id]/edit/page.tsx  # Edit company
│   │   │
│   │   ├── contacts/                # Contacts module
│   │   │   ├── page.tsx            # Contacts list
│   │   │   ├── new/page.tsx        # Create contact
│   │   │   ├── [id]/page.tsx       # Contact detail
│   │   │   └── [id]/edit/page.tsx  # Edit contact
│   │   │
│   │   ├── deals/                   # Deals module
│   │   │   ├── page.tsx            # Deals/pipeline view
│   │   │   ├── new/page.tsx        # Create deal
│   │   │   ├── [id]/page.tsx       # Deal detail
│   │   │   └── [id]/edit/page.tsx  # Edit deal
│   │   │
│   │   ├── email-templates/         # Email template management
│   │   ├── emails/                  # Email inbox
│   │   │
│   │   ├── forms/                   # Form builder
│   │   │   ├── page.tsx            # Forms list
│   │   │   ├── new/page.tsx        # Create form
│   │   │   └── [id]/edit/page.tsx  # Edit form
│   │   │
│   │   ├── onboarding/              # Onboarding wizard
│   │   │   └── page.tsx            # Multi-step wizard
│   │   │
│   │   ├── pipelines/               # Pipeline management
│   │   │   ├── page.tsx            # Pipelines list
│   │   │   └── new/page.tsx        # Create pipeline
│   │   │
│   │   ├── reports/                 # Analytics dashboards
│   │   │   └── page.tsx            # Analytics & reports
│   │   │
│   │   └── settings/                # Settings module
│   │       ├── page.tsx            # Settings home
│   │       ├── profile/page.tsx    # Profile settings
│   │       └── team/page.tsx       # Team settings
│   │
│   ├── api/                         # API routes
│   │   ├── auth/
│   │   │   └── logout/route.ts     # Logout endpoint
│   │   │
│   │   ├── activities/
│   │   │   ├── route.ts            # CRUD operations
│   │   │   └── [id]/route.ts       # Detail operations
│   │   │
│   │   ├── analytics/              # Analytics endpoints
│   │   │   ├── revenue/route.ts
│   │   │   ├── pipeline/route.ts
│   │   │   └── activity/route.ts
│   │   │
│   │   ├── campaigns/
│   │   │   ├── route.ts
│   │   │   └── [id]/route.ts
│   │   │
│   │   ├── companies/
│   │   │   ├── route.ts
│   │   │   └── [id]/route.ts
│   │   │
│   │   ├── contacts/
│   │   │   ├── route.ts
│   │   │   └── [id]/route.ts
│   │   │
│   │   ├── deals/
│   │   │   ├── route.ts
│   │   │   └── [id]/route.ts
│   │   │
│   │   ├── forms/
│   │   │   ├── route.ts
│   │   │   ├── submit/route.ts    # Public form submission
│   │   │   └── [id]/route.ts
│   │   │
│   │   ├── onboarding/            # Onboarding wizard API
│   │   │
│   │   ├── pipelines/
│   │   │   ├── route.ts
│   │   │   └── [id]/route.ts
│   │   │
│   │   ├── settings/              # Settings API
│   │   │
│   │   └── webhook/
│   │       └── sendgrid/route.ts  # SendGrid webhook
│   │
│   ├── f/                          # Public forms
│   │   └── [id]/page.tsx          # Public form page
│   │
│   ├── globals.css                # Global styles
│   ├── layout.tsx                 # Root layout
│   └── page.tsx                   # Homepage
│
├── components/                    # React components
│   ├── activities/                # Activity components
│   │   ├── activity-form.tsx
│   │   ├── activity-list.tsx
│   │   └── activity-timeline.tsx
│   │
│   ├── analytics/                 # Analytics components
│   │   ├── revenue-dashboard.tsx
│   │   ├── pipeline-dashboard.tsx
│   │   └── activity-dashboard.tsx
│   │
│   ├── campaigns/                 # Campaign components
│   │   ├── campaign-form.tsx
│   │   ├── campaign-list.tsx
│   │   └── sequence-builder.tsx
│   │
│   ├── email/                     # Email components
│   │   ├── email-form.tsx
│   │   ├── email-list.tsx
│   │   └── bcc-instructions.tsx
│   │
│   ├── forms/                     # Form components
│   │   ├── form-builder.tsx       # Drag-and-drop builder
│   │   ├── form-field.tsx
│   │   ├── contact-form.tsx
│   │   ├── company-form.tsx
│   │   ├── deal-form.tsx
│   │   └── activity-form.tsx
│   │
│   ├── onboarding/                # Onboarding components
│   │   ├── welcome-step.tsx
│   │   ├── company-info-step.tsx
│   │   ├── team-setup-step.tsx
│   │   ├── preferences-step.tsx
│   │   ├── complete-step.tsx
│   │   └── progress-indicator.tsx
│   │
│   ├── settings/                  # Settings components
│   │   ├── profile-settings.tsx
│   │   ├── account-settings.tsx
│   │   ├── team-settings.tsx
│   │   ├── notification-settings.tsx
│   │   └── security-settings.tsx
│   │
│   ├── dashboard-nav.tsx          # Navigation sidebar
│   ├── dashboard-header.tsx       # Dashboard header
│   └── ui/                        # Radix UI components
│       ├── button.tsx
│       ├── input.tsx
│       ├── card.tsx
│       ├── dialog.tsx
│       ├── dropdown-menu.tsx
│       ├── select.tsx
│       ├── tabs.tsx
│       ├── badge.tsx
│       ├── alert.tsx
│       ├── progress.tsx
│       └── ...more UI components
│
├── lib/                           # Utilities and services
│   ├── analytics/                 # Analytics functions
│   │   ├── revenue.ts            # Revenue calculations
│   │   ├── pipeline.ts           # Pipeline metrics
│   │   └── activity.ts           # Activity metrics
│   │
│   ├── services/                  # Service classes
│   │   ├── activity-service.ts
│   │   ├── campaign-service.ts
│   │   ├── commission-service.ts
│   │   ├── company-service.ts
│   │   ├── contact-service.ts
│   │   ├── deal-service.ts
│   │   ├── email-service.ts
│   │   ├── form-service.ts
│   │   ├── onboarding-service.ts
│   │   ├── pipeline-service.ts
│   │   └── settings-service.ts
│   │
│   ├── supabase/                  # Supabase clients
│   │   ├── client.ts             # Browser client
│   │   ├── server.ts             # Server client
│   │   └── service-role.ts       # Service role client
│   │
│   ├── types/                     # TypeScript types
│   │   ├── activity.ts
│   │   ├── campaign.ts
│   │   ├── commission.ts
│   │   ├── company.ts
│   │   ├── contact.ts
│   │   ├── deal.ts
│   │   ├── form.ts
│   │   ├── onboarding.ts
│   │   ├── pipeline.ts
│   │   └── settings.ts
│   │
│   ├── validations/               # Zod schemas
│   │   ├── activity.ts
│   │   ├── campaign.ts
│   │   ├── company.ts
│   │   ├── contact.ts
│   │   ├── deal.ts
│   │   ├── form.ts
│   │   ├── pipeline.ts
│   │   └── settings.ts
│   │
│   ├── email/                     # Email utilities
│   │   ├── sendgrid.ts
│   │   ├── templates.ts
│   │   └── parser.ts
│   │
│   ├── auth/                      # Authentication utilities
│   │   └── recaptcha.ts
│   │
│   ├── ai/                        # AI integration (ready)
│   │   ├── gemini.ts
│   │   └── perplexity.ts
│   │
│   ├── utils.ts                   # General utilities
│   └── constants.ts               # App constants
│
├── supabase/                      # Database
│   ├── migrations/                # All database migrations
│   │   ├── 20240116000001_*.sql
│   │   ├── 20240116000002_*.sql
│   │   └── ...more migrations
│   └── types.ts                   # Generated Supabase types
│
├── public/                        # Static files
│   ├── images/
│   └── icons/
│
├── .env.example                   # Environment template
├── .env.local                     # Local environment (git ignored)
├── .gitignore                     # Git ignore rules
├── package.json                   # Dependencies
├── tsconfig.json                  # TypeScript configuration
├── tailwind.config.ts             # Tailwind CSS configuration
├── postcss.config.js              # PostCSS configuration
├── next.config.js                 # Next.js configuration
├── middleware.ts                  # Route middleware
│
└── docs/                          # Documentation
    ├── README.md                  # This file
    ├── DEPLOYMENT_GUIDE.md        # Deployment instructions
    ├── DATABASE_SCHEMA.md         # Database documentation
    ├── API_ROUTES.md              # API endpoint documentation
    ├── SECURITY.md                # Security implementation details
    └── PHASE_*.md                 # Phase completion docs
```

## 🗄️ Database Schema

The application uses **30+ PostgreSQL tables** with complete Row Level Security:

### Core Tables
- **accounts** - Multi-tenant account data and settings
- **users** - User profiles and authentication metadata
- **contacts** - Contact management with 15+ fields
- **companies** - Company information and statistics
- **deals** - Deal pipeline and tracking
- **pipelines** - Pipeline stages and configuration
- **pipeline_stages** - Individual pipeline stages
- **activities** - Activity tracking (calls, meetings, emails, notes, tasks)

### Feature Tables
- **campaigns** - Email campaign management
- **email_templates** - Pre-built and custom email templates
- **email_messages** - Email message history
- **email_threads** - Email threading
- **forms** - Custom form definitions
- **form_fields** - Form field configurations
- **form_submissions** - User form submissions
- **commissions** - Commission tracking and calculation
- **commission_rates** - Commission rate definitions

### Analytics Tables
- **lead_sources** - Lead source tracking
- **qualified_leads_global** - Global lead scoring

### Supporting Tables
- **team_members** - Team management
- **team_invitations** - Team invitation management

**Total:** 30+ tables | **RLS Policies:** 60+ | **Database Functions:** 15+ | **Indexes:** 50+

See `docs/DATABASE_SCHEMA.md` for complete schema documentation.

## 🔐 Security

### Row Level Security (RLS)
- **100% Coverage** - All tables protected with RLS policies
- **Multi-tenant Isolation** - Users can only access their account's data
- **Service Role Functions** - SECURITY DEFINER functions for privileged operations
- **SQL Injection Protection** - Parameterized queries throughout

### Authentication
- **Supabase Auth** - Email/password authentication
- **reCAPTCHA v3** - Bot protection on signup and login
- **Session Management** - Secure session handling with middleware
- **Protected Routes** - All dashboard routes require authentication
- **JWT Tokens** - Secure token-based authentication

### Data Protection
- **Encrypted Passwords** - bcrypt hashing via Supabase
- **Environment Variables** - Sensitive data in .env.local
- **API Key Protection** - SendGrid and reCAPTCHA keys server-side only
- **CORS Configuration** - Restricted to authorized origins

See `docs/SECURITY.md` for complete security documentation.

## 📡 API Routes

The application includes **17 API routes** for all major operations:

### Authentication
- `POST /api/auth/logout` - User logout

### Resources (CRUD)
- `GET/POST /api/activities` - Activities list and create
- `GET/PUT/DELETE /api/activities/[id]` - Activity operations
- `GET/POST /api/campaigns` - Campaigns
- `GET/POST /api/companies` - Companies
- `GET/POST /api/contacts` - Contacts
- `GET/POST /api/deals` - Deals
- `GET/POST /api/forms` - Forms
- `GET/POST /api/pipelines` - Pipelines

### Analytics
- `GET /api/analytics/revenue` - Revenue data
- `GET /api/analytics/revenue/by-month` - Revenue by month
- `GET /api/analytics/revenue/by-user` - Revenue by user
- `GET /api/analytics/pipeline` - Pipeline metrics
- `GET /api/analytics/activity` - Activity metrics

### Webhooks
- `POST /api/webhook/sendgrid` - SendGrid email webhook

### Public
- `POST /api/forms/submit` - Public form submission

All API routes include:
- ✅ Authentication checks
- ✅ Input validation with Zod
- ✅ Error handling
- ✅ Proper HTTP status codes
- ✅ Logging for debugging

See `docs/API_ROUTES.md` for detailed API documentation.

## 🚀 Deployment

### Vercel Deployment (Recommended)

1. **Push to GitHub**
```bash
git push origin main
```

2. **Connect to Vercel**
   - Go to https://vercel.com
   - Click "New Project"
   - Select your GitHub repository
   - Click "Import"

3. **Configure Project Settings**
   - **Framework Preset:** Next.js
   - **Root Directory:** `./` (root)
   - **Build Command:** `npm run build`
   - **Output Directory:** `.next`

4. **Add Environment Variables**
   - Go to "Settings" → "Environment Variables"
   - Add all variables from `.env.example`:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`
     - `RECAPTCHA_SECRET_KEY`
     - `SENDGRID_API_KEY`
     - `NEXT_PUBLIC_GEMINI_API_KEY` (optional)
     - `NEXT_PUBLIC_PERPLEXITY_API_KEY` (optional)
     - `NEXT_PUBLIC_APP_URL` (set to your production domain)

5. **Deploy**
   - Click "Deploy"
   - Wait for build to complete
   - Your app is live!

### Custom Domain
1. Go to "Settings" → "Domains"
2. Add your custom domain (e.g., `crm.rankedceo.com`)
3. Update DNS records (instructions provided by Vercel)
4. SSL certificate auto-configured

### Database Migrations
Before first deployment, run all migrations in Supabase:

```bash
# In Supabase SQL Editor
-- Run migrations in order:
-- 1. 20240116000001_*.sql
-- 2. 20240116000002_*.sql
-- ... continue in order
```

See `docs/DEPLOYMENT_GUIDE.md` for detailed deployment instructions.

## 📖 Documentation

### Getting Started
- [Installation Guide](#-installation) - Setup instructions
- [Environment Variables](#-environment-variables) - Configuration
- [Project Structure](#-project-structure) - File organization

### Development
- `docs/DEPLOYMENT_GUIDE.md` - Production deployment steps
- `docs/DATABASE_SCHEMA.md` - Database tables and relationships
- `docs/API_ROUTES.md` - API endpoint documentation
- `docs/SECURITY.md` - Security implementation details
- `CHANGELOG.md` - Version history and changes

### Phase Documentation
- `PHASE_01_COMPLETE.md` through `PHASE_14_COMPLETE.md` - Detailed phase information
- `FINAL_PROJECT_SUMMARY.md` - Complete project overview
- `PHASE_7_RECAPTCHA_INTEGRATION_SUMMARY.md` - reCAPTCHA setup

### Technical Guides
- `PRODUCTION_READINESS_CHECKLIST.md` - Pre-launch checklist
- `ONBOARDING_COMPLETE_MIGRATION.sql` - Database setup
- `ANALYTICS_API_ROUTES_COMPLETE.md` - Analytics implementation
- `RLS_COMPLETE_COVERAGE.md` - Security policies

## 🧪 Testing

### Manual Testing Checklist

**Authentication**
- [ ] Sign up with new account
- [ ] Login with credentials
- [ ] Logout functionality
- [ ] Try invalid credentials (should fail)

**Onboarding**
- [ ] Complete 5-step onboarding
- [ ] Skip onboarding
- [ ] Verify onboarding data saved

**Core Modules** (Full CRUD for each)
- [ ] **Contacts:** Create, read, update, delete, search, filter
- [ ] **Companies:** Create, read, update, delete, view statistics
- [ ] **Deals:** Create, read, update, delete, move through pipeline
- [ ] **Activities:** Create, view, edit, filter by type
- [ ] **Pipelines:** Create, view stages, customize

**Advanced Features**
- [ ] **Campaigns:** Create, view, manage sequences
- [ ] **Email Templates:** View, create from template
- [ ] **Forms:** Create form, submit publicly
- [ ] **Analytics:** View revenue, pipeline, and activity dashboards
- [ ] **Commissions:** View rates, track commissions
- [ ] **Settings:** Update profile, account, team info

**UI/UX**
- [ ] Responsive design (mobile, tablet, desktop)
- [ ] Navigation works on all pages
- [ ] Loading states appear
- [ ] Error messages display
- [ ] Success notifications show

### Browser Compatibility
- [ ] Chrome (desktop & mobile)
- [ ] Firefox (desktop & mobile)
- [ ] Safari (desktop & mobile)
- [ ] Edge (desktop)

### Performance Testing
- [ ] Page load time < 2 seconds
- [ ] API response time < 1 second
- [ ] Form submission < 500ms
- [ ] Search response < 500ms

## 📈 Performance Metrics

### Build Performance
- **Build Time:** ~60 seconds
- **Bundle Size:** 87.4 kB (shared chunks)
- **Total Routes:** 67 (50 pages + 17 API routes)
- **Largest Page:** /reports (103 kB)
- **TypeScript:** 0 errors, 100% coverage

### Database Performance
- **Tables:** 30+
- **Indexes:** 50+
- **RLS Policies:** 60+
- **Query Time:** < 100ms (optimized)

### Code Metrics
- **Total Files:** 200+
- **Components:** 40+
- **Services:** 13+
- **Lines of Code:** ~21,000+

## 🎯 Module Overview

### Contacts Module
Track leads, prospects, and customers with complete profiles.

**Features:**
- Contact list with advanced search and filtering
- 15+ contact fields (name, email, phone, company, title, etc.)
- Activity timeline per contact
- Associated deals and companies
- Import/export capabilities

**Paths:** `/contacts`, `/contacts/[id]`, `/contacts/new`, `/contacts/[id]/edit`

### Companies Module
Manage organization information and relationships.

**Features:**
- Company profiles with multiple fields
- Associated contacts and deals
- Company statistics (total deals, revenue)
- Activity tracking
- Contact associations

**Paths:** `/companies`, `/companies/[id]`, `/companies/new`, `/companies/[id]/edit`

### Deals Module
Manage sales pipeline and opportunities.

**Features:**
- Full deal lifecycle management
- Customizable pipeline stages
- Deal value and probability tracking
- Timeline and activity history
- Associated contacts and companies
- Automatic commission calculation when won

**Paths:** `/deals`, `/deals/[id]`, `/deals/new`, `/deals/[id]/edit`

### Activities Module
Track all customer interactions.

**Features:**
- 5 activity types: Call, Meeting, Email, Note, Task
- Activity forms with pre-filled values
- Complete timeline view per contact/company/deal
- Activity filtering and search
- Timestamps and user attribution

**Paths:** `/activities`, `/activities/[id]`

### Campaigns Module
Create and manage email campaigns.

**Features:**
- Campaign creation wizard
- Email template selection
- Contact list management
- Sequence builder (drag-and-drop)
- Campaign analytics
- SendGrid integration

**Paths:** `/campaigns`, `/campaigns/new`, `/campaigns/[id]/build`

### Forms Module
Build and manage custom forms.

**Features:**
- 17 field types (text, email, phone, select, checkbox, etc.)
- Drag-and-drop builder
- Public form sharing
- Form submission tracking
- Data export (CSV, JSON)
- Conditional logic (ready for implementation)

**Paths:** `/forms`, `/forms/new`, `/forms/[id]/edit`, `/f/[id]` (public)

### Email Module
Manage email communication.

**Features:**
- Email template library
- Smart BCC email capture
- Email threading
- Conversation history
- Email analytics

**Paths:** `/emails`, `/email-templates`

### Commission Module
Track commission and manage payouts.

**Features:**
- Commission rate management
- Automatic calculation (when deal status = "won")
- Commission tracking and reporting
- Payout management
- Commission history

**Paths:** `/commissions`, `/commissions/rates`, `/commissions/reports`

### Analytics Module
Comprehensive business intelligence.

**Features:**
- Revenue analytics (total, by month, by user)
- Pipeline analytics (by stage, win rate, cycle time)
- Activity analytics (by type, leaderboard)
- Interactive charts (Recharts)
- Data export

**Paths:** `/reports`, `/reports/revenue`, `/reports/pipeline`, `/reports/activity`

### Settings Module
User and account management.

**Features:**
- Profile settings (name, phone, title)
- Account settings (company info, plan)
- Team management (view members, roles)
- Notification preferences (5 toggles)
- Security settings (password, 2FA UI)

**Paths:** `/settings`, `/settings/profile`, `/settings/team`, `/settings/billing`

### Onboarding Module
Guided setup for new users.

**Features:**
- 5-step onboarding wizard
- Welcome step
- Company info collection
- Team member setup
- Preferences configuration
- Completion step with next steps

**Paths:** `/onboarding`

## 💡 Key Design Decisions

1. **Service Layer Architecture** - Business logic separated from routes for testability
2. **Zod Validation** - Runtime type checking on all inputs
3. **Server Components** - Maximum performance with Next.js 14
4. **RLS First Security** - Database security as primary defense
5. **Responsive Design** - Mobile-first CSS with Tailwind
6. **Accessible Components** - Radix UI for WCAG compliance

## 📝 Development Workflow

### Local Development
```bash
# Start dev server
npm run dev

# Watch for TypeScript errors
npm run type-check

# Format code
npm run format

# Lint code
npm run lint
```

### Creating New Features
1. Create TypeScript types in `lib/types/`
2. Create Zod validation in `lib/validations/`
3. Create service in `lib/services/`
4. Create API route in `app/api/`
5. Create components in `components/`
6. Create page in `app/(dashboard)/`
7. Test manually
8. Commit with descriptive message

### Database Changes
1. Create migration file in `supabase/migrations/`
2. Test in local Supabase instance
3. Apply to production via Supabase dashboard
4. Update types if needed

## 🚨 Known Limitations & Technical Debt

- Some service classes use `any` types (should be fully typed)
- Limited test coverage (no unit tests yet)
- CampaignService needs refactoring
- Team invitation emails are placeholder
- 2FA settings UI only (not fully implemented)
- Some features ready for integration (Gemini, Perplexity)

See `PRODUCTION_READINESS_CHECKLIST.md` for complete list.

## 🔜 Future Roadmap

### Immediate (v1.1)
- [ ] Proper TypeScript typing throughout
- [ ] Unit and integration tests
- [ ] Email verification for signups
- [ ] 2FA implementation

### Short-term (v1.2)
- [ ] AI Lead Scoring (Gemini)
- [ ] AI Research Assistant (Perplexity)
- [ ] Advanced reporting and dashboards
- [ ] E2E testing
- [ ] Performance optimization

### Medium-term (v1.3+)
- [ ] Mobile app (React Native)
- [ ] Workflow automation
- [ ] Calendar integration
- [ ] VoIP integration
- [ ] Document management
- [ ] Advanced search
- [ ] Custom fields per account

## 🆘 Support & Help

### Documentation
- Check relevant phase documentation for detailed information
- Review API routes documentation for integrations
- See security documentation for architecture details

### Issues & Bugs
- GitHub Issues (private repository)
- Check existing documentation for solutions

### Technical Support
- **Email:** support@twinwicksllc.com
- **Business:** info@twinwicksllc.com

## 📄 License

**Proprietary** - All rights reserved by TwinWicks LLC

This is a proprietary application built for TwinWicks LLC. Unauthorized copying, modification, or distribution is prohibited.

## 🙏 Acknowledgments

**Built by:** TwinWicks LLC Development Team

**Key Technologies:**
- [Next.js](https://nextjs.org/) - React framework
- [Supabase](https://supabase.com/) - PostgreSQL database
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [Radix UI](https://www.radix-ui.com/) - Accessible components
- [Recharts](https://recharts.org/) - Data visualization
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [Vercel](https://vercel.com/) - Deployment

---

**Status:** ✅ Production Ready v1.0.0  
**Last Updated:** February 2026  
**Repository:** https://github.com/twinwicksllc/rankedceo-crm-production  
**Live:** https://crm.rankedceo.com

Built with ❤️ by [TwinWicks LLC](https://twinwicksllc.com)

- [ ] Workflow automation
- [ ] Calendar integration
- [ ] VoIP integration
- [ ] Document management

## 📊 Statistics

- **67 Routes** (50 pages + 17 API routes)
- **40+ UI Components**
- **13+ Service Classes**
- **30+ Database Tables**
- **~21,000 Lines of Code**
- **100% RLS Coverage**

---

Built with ❤️ by TwinWicks LLC