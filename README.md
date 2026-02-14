# RankedCEO CRM

A modern, full-featured Customer Relationship Management (CRM) system built with Next.js 14, Supabase, and AI integration.

## 🚀 Features

### Core CRM Features
- **Contact Management** - Comprehensive contact database with full CRUD operations
- **Company Management** - Track companies and their relationships
- **Deal Pipeline** - Visual pipeline with customizable stages
- **Activity Tracking** - Log calls, meetings, emails, notes, and tasks
- **Email Campaigns** - Create and manage email campaigns with SendGrid
- **Form Builder** - Build custom forms with 17 field types
- **Commission Tracking** - Automatic commission calculation and reporting
- **Analytics & Reporting** - Revenue, pipeline, and activity analytics

### Advanced Features
- **Smart BCC Email Capture** - Automatically capture emails via BCC
- **Multi-step Onboarding** - Guided setup for new users
- **Team Management** - Invite and manage team members
- **Settings & Preferences** - Comprehensive settings management
- **AI Integration** - Ready for Gemini AI lead scoring and Perplexity AI research

### Security & Architecture
- **Multi-tenant Architecture** - Complete data isolation per account
- **Row Level Security (RLS)** - Database-level security with Supabase
- **Authentication** - Secure auth with reCAPTCHA v3
- **SECURITY DEFINER Functions** - Secure database operations

## 🛠️ Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Database:** PostgreSQL (Supabase)
- **Authentication:** Supabase Auth
- **Styling:** Tailwind CSS
- **UI Components:** Radix UI
- **Email:** SendGrid (via Twilio)
- **Charts:** Recharts
- **Validation:** Zod
- **Deployment:** Vercel

## 📦 Installation

### Prerequisites
- Node.js 20.x or higher
- npm or yarn
- Supabase account
- SendGrid account (for email features)
- Google reCAPTCHA v3 keys

### Environment Variables

Create a `.env.local` file with the following variables:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# AI Services
NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_api_key
NEXT_PUBLIC_PERPLEXITY_API_KEY=your_perplexity_api_key

# Email
SENDGRID_API_KEY=your_sendgrid_api_key

# reCAPTCHA
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=your_recaptcha_site_key
RECAPTCHA_SECRET_KEY=your_recaptcha_secret_key

# App
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

### Setup Steps

1. **Clone the repository**
```bash
git clone https://github.com/twinwicksllc/rankedceo-crm-production.git
cd rankedceo-crm-production
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up Supabase**
   - Create a new Supabase project
   - Run all migrations in `supabase/migrations/` in order
   - See `ONBOARDING_COMPLETE_MIGRATION.sql` for onboarding setup

4. **Configure environment variables**
   - Copy `.env.example` to `.env.local`
   - Fill in all required values

5. **Run development server**
```bash
npm run dev
```

6. **Build for production**
```bash
npm run build
npm start
```

## 📊 Project Structure

```
rankedceo-crm-production/
├── app/                          # Next.js app directory
│   ├── (auth)/                   # Authentication pages
│   ├── (dashboard)/              # Dashboard pages
│   │   ├── activities/           # Activities module
│   │   ├── campaigns/            # Campaigns module
│   │   ├── commissions/          # Commissions module
│   │   ├── companies/            # Companies module
│   │   ├── contacts/             # Contacts module
│   │   ├── deals/                # Deals module
│   │   ├── email-templates/      # Email templates
│   │   ├── emails/               # Email inbox
│   │   ├── onboarding/           # Onboarding wizard
│   │   ├── pipelines/            # Pipeline management
│   │   ├── reports/              # Analytics & reports
│   │   └── settings/             # Settings module
│   └── api/                      # API routes
├── components/                   # React components
│   ├── activities/               # Activity components
│   ├── analytics/                # Analytics components
│   ├── email/                    # Email components
│   ├── forms/                    # Form components
│   ├── onboarding/               # Onboarding components
│   ├── settings/                 # Settings components
│   └── ui/                       # UI components (Radix)
├── lib/                          # Utilities and services
│   ├── analytics/                # Analytics functions
│   ├── services/                 # Service layer
│   ├── supabase/                 # Supabase clients
│   ├── types/                    # TypeScript types
│   └── validations/              # Zod schemas
├── supabase/                     # Supabase migrations
│   └── migrations/               # Database migrations
└── public/                       # Static assets
```

## 🗄️ Database Schema

The application uses 30+ tables with full Row Level Security:

### Core Tables
- `accounts` - Multi-tenant account data
- `users` - User profiles and authentication
- `contacts` - Contact management
- `companies` - Company management
- `deals` - Deal pipeline
- `pipelines` - Pipeline stages
- `activities` - Activity tracking

### Feature Tables
- `campaigns` - Email campaigns
- `email_templates` - Email templates
- `email_messages` - Email capture
- `forms` - Form builder
- `form_submissions` - Form responses
- `commissions` - Commission tracking
- `commission_rates` - Commission rates

### AI & Analytics
- `lead_sources` - Lead tracking
- `qualified_leads_global` - Lead scoring

## 🔐 Security

### Row Level Security (RLS)
All tables have RLS policies that enforce multi-tenant isolation:
- Users can only access data from their account
- SECURITY DEFINER functions for privileged operations
- SQL injection protection with `SET search_path = public`

### Authentication
- Supabase Auth with email/password
- reCAPTCHA v3 for bot protection
- Session management
- Password requirements

### Data Protection
- Multi-tenant architecture
- Account-level data isolation
- Secure API routes
- Environment variable protection

## 📈 Analytics

The CRM includes comprehensive analytics:

### Revenue Analytics
- Total revenue tracking
- Revenue by month
- Revenue by user
- Average deal size
- Revenue trends

### Pipeline Analytics
- Pipeline value by stage
- Win rate calculation
- Average deal cycle time
- Deals by source
- Pipeline velocity

### Activity Analytics
- Activity distribution by type
- Task completion rate
- Team leaderboard
- Activity statistics

## 🚀 Deployment

### Vercel Deployment

1. **Connect to Vercel**
```bash
vercel
```

2. **Configure environment variables in Vercel**
   - Add all variables from `.env.local`
   - Set `NEXT_PUBLIC_APP_URL` to your production domain

3. **Deploy**
```bash
vercel --prod
```

### Database Setup
Run all migrations in Supabase SQL Editor:
1. `ONBOARDING_COMPLETE_MIGRATION.sql` - Onboarding setup
2. Other migrations in `supabase/migrations/` directory

## 📝 Documentation

- `PHASE_*_COMPLETE.md` - Phase completion documentation
- `ONBOARDING_MIGRATIONS_REQUIRED.md` - Migration instructions
- `RLS_COMPLETE_COVERAGE.md` - Security documentation
- `ANALYTICS_API_ROUTES_COMPLETE.md` - API documentation

## 🧪 Testing

### Manual Testing Checklist
- [ ] User signup and login
- [ ] Onboarding flow (5 steps)
- [ ] Contact CRUD operations
- [ ] Company CRUD operations
- [ ] Deal pipeline management
- [ ] Activity tracking
- [ ] Email campaigns
- [ ] Form builder
- [ ] Commission tracking
- [ ] Analytics dashboards
- [ ] Settings management

### Browser Testing
- [ ] Chrome
- [ ] Firefox
- [ ] Safari
- [ ] Edge
- [ ] Mobile browsers

## 🤝 Contributing

This is a private project for TwinWicks LLC. For questions or support, contact the development team.

## 📄 License

Proprietary - All rights reserved by TwinWicks LLC

## 🆘 Support

For technical support or questions:
- Email: support@twinwicksllc.com
- Documentation: See phase completion docs
- Issues: GitHub Issues (private repository)

## 🎯 Roadmap

### Completed (v1.0)
- ✅ Core CRM features
- ✅ Email campaigns
- ✅ Form builder
- ✅ Analytics
- ✅ Commission tracking
- ✅ Onboarding wizard
- ✅ Settings module

### Future Enhancements
- [ ] AI-powered lead scoring (Gemini)
- [ ] AI research assistant (Perplexity)
- [ ] Mobile app
- [ ] Advanced reporting
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