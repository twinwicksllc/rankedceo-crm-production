import Link from 'next/link'
import Image from 'next/image'
import { ButtonLanding as Button } from '@/components/ui/button-landing'
import { CardLanding as Card, CardContentLanding as CardContent, CardDescriptionLanding as CardDescription, CardHeaderLanding as CardHeader, CardTitleLanding as CardTitle } from '@/components/ui/card-landing'
import { BadgeLanding as Badge } from '@/components/ui/badge-landing'
import { 
  Activity, 
  BarChart3, 
  Brain, 
  Building2, 
  Calendar, 
  Check, 
  FileText, 
  Inbox, 
  Lock, 
  Mail, 
  Search, 
  Settings, 
  Shield, 
  Sparkles, 
  Users, 
  Zap 
} from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col" itemScope itemType="https://schema.org/WebPage">
      {/* Navigation */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60" role="banner">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/ranked_logo.png"
              alt="RankedCEO"
              width={150}
              height={40}
              className="h-8 w-auto"
              priority
            />
          </Link>
          <nav className="hidden gap-6 md:flex">
            <Link href="#features" className="text-sm font-medium transition-colors hover:text-primary">
              Features
            </Link>
            <Link href="#ai" className="text-sm font-medium transition-colors hover:text-primary">
              AI Capabilities
            </Link>
            <Link href="#use-cases" className="text-sm font-medium transition-colors hover:text-primary">
              Use Cases
            </Link>
            <Link href="#security" className="text-sm font-medium transition-colors hover:text-primary">
              Security
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link href="/login">Log in</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">Start Free Trial</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1" role="main">
        {/* Hero Section */}
        <section className="container py-20 md:py-32" aria-labelledby="hero-heading">
          <div className="mx-auto max-w-4xl text-center">
            <Badge className="mb-4 bg-accent text-accent-foreground" variant="secondary">
              <Sparkles className="mr-1 h-3 w-3" aria-hidden="true" />
              AI-Powered CRM
            </Badge>
            <h1 id="hero-heading" className="mb-6 text-balance text-5xl font-bold tracking-tight md:text-6xl lg:text-7xl">
              The CRM Built for Service Businesses
            </h1>
            <p className="mb-8 text-pretty text-lg text-muted-foreground md:text-xl">
              {'Manage contacts, close deals, and grow your business with AI-powered lead scoring and intelligent research. Built for HVAC, plumbing, electrical, and home service professionals.'}
            </p>
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="lg" asChild className="w-full sm:w-auto">
                <Link href="/signup">
                  Start Free Trial
                  <Zap className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="w-full sm:w-auto bg-transparent">
                <Link href="/login">View Demo</Link>
              </Button>
            </div>
            <div className="mt-12 grid gap-8 md:grid-cols-3">
              <div className="flex flex-col items-center gap-2">
                <div className="text-3xl font-bold text-primary">AI-Powered</div>
                <p className="text-sm text-muted-foreground">Gemini & Perplexity AI</p>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="text-3xl font-bold text-primary">Multi-Tenant</div>
                <p className="text-sm text-muted-foreground">Enterprise Architecture</p>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="text-3xl font-bold text-primary">Modern Stack</div>
                <p className="text-sm text-muted-foreground">Next.js & Supabase</p>
              </div>
            </div>
          </div>
        </section>

        {/* Problem/Solution Section */}
        <section className="border-t bg-muted/30 py-20">
          <div className="container">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="mb-4 text-balance text-3xl font-bold md:text-4xl">
                Stop Losing Leads in Spreadsheets
              </h2>
              <p className="mb-12 text-pretty text-lg text-muted-foreground">
                Service businesses lose thousands in revenue managing leads across scattered tools. RankedCEO centralizes everything with AI to help you close more deals.
              </p>
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
                      <span className="text-2xl text-destructive">✗</span>
                    </div>
                    <CardTitle className="text-xl">Before RankedCEO</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-left text-sm text-muted-foreground">
                    <p>• Leads scattered across email, phone, forms</p>
                    <p>• Manual follow-up tracking</p>
                    <p>• No insight into lead quality</p>
                    <p>• Time wasted on bad leads</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                      <Check className="h-5 w-5 text-accent" />
                    </div>
                    <CardTitle className="text-xl">With RankedCEO</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-left text-sm text-muted-foreground">
                    <p>• All leads centralized in one CRM</p>
                    <p>• Automated activity tracking</p>
                    <p>• AI lead scoring prioritizes best leads</p>
                    <p>• Focus on high-value opportunities</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section id="features" className="py-20">
          <div className="container">
            <div className="mx-auto mb-12 max-w-2xl text-center">
              <h2 className="mb-4 text-balance text-3xl font-bold md:text-4xl">
                Everything You Need to Manage Customers
              </h2>
              <p className="text-pretty text-lg text-muted-foreground">
                From first contact to closed deal, track every interaction with your customers.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <Users className="mb-2 h-8 w-8 text-primary" />
                  <CardTitle>Contact Management</CardTitle>
                  <CardDescription>
                    Organize all your customer and prospect information in one place
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader>
                  <Building2 className="mb-2 h-8 w-8 text-primary" />
                  <CardTitle>Company Tracking</CardTitle>
                  <CardDescription>
                    Manage relationships with businesses and track multiple contacts per company
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader>
                  <BarChart3 className="mb-2 h-8 w-8 text-primary" />
                  <CardTitle>Deal Pipelines</CardTitle>
                  <CardDescription>
                    Visualize your sales pipeline and move deals through custom stages
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader>
                  <Activity className="mb-2 h-8 w-8 text-primary" />
                  <CardTitle>Activity Tracking</CardTitle>
                  <CardDescription>
                    Log calls, meetings, and notes to never miss a follow-up
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader>
                  <Calendar className="mb-2 h-8 w-8 text-primary" />
                  <CardTitle>Task Management</CardTitle>
                  <CardDescription>
                    Schedule tasks and reminders to stay on top of your sales process
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader>
                  <Settings className="mb-2 h-8 w-8 text-primary" />
                  <CardTitle>Custom Pipelines</CardTitle>
                  <CardDescription>
                    Create unlimited pipelines tailored to your unique sales process
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>

            <div className="mt-12">
              <h3 className="mb-6 text-center text-2xl font-bold">Coming Soon</h3>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <Card className="border-dashed">
                  <CardHeader>
                    <Mail className="mb-2 h-6 w-6 text-muted-foreground" />
                    <CardTitle className="text-base">Email Campaigns</CardTitle>
                  </CardHeader>
                </Card>
                <Card className="border-dashed">
                  <CardHeader>
                    <Inbox className="mb-2 h-6 w-6 text-muted-foreground" />
                    <CardTitle className="text-base">Smart BCC Capture</CardTitle>
                  </CardHeader>
                </Card>
                <Card className="border-dashed">
                  <CardHeader>
                    <FileText className="mb-2 h-6 w-6 text-muted-foreground" />
                    <CardTitle className="text-base">Form Builder</CardTitle>
                  </CardHeader>
                </Card>
                <Card className="border-dashed">
                  <CardHeader>
                    <BarChart3 className="mb-2 h-6 w-6 text-muted-foreground" />
                    <CardTitle className="text-base">Advanced Analytics</CardTitle>
                  </CardHeader>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* AI Spotlight */}
        <section id="ai" className="border-t bg-muted/30 py-20">
          <div className="container">
            <div className="mx-auto mb-12 max-w-2xl text-center">
              <Badge className="mb-4 bg-accent text-accent-foreground" variant="secondary">
                <Brain className="mr-1 h-3 w-3" />
                Powered by AI
              </Badge>
              <h2 className="mb-4 text-balance text-3xl font-bold md:text-4xl">
                Intelligence That Works For You
              </h2>
              <p className="text-pretty text-lg text-muted-foreground">
                Let AI do the heavy lifting while you focus on closing deals.
              </p>
            </div>
            <div className="grid gap-8 lg:grid-cols-2">
              <Card className="border-2 border-primary/20">
                <CardHeader>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <Sparkles className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-2xl">AI Lead Scoring with Gemini</CardTitle>
                  <CardDescription className="text-base">
                    Automatically prioritize your best opportunities with Google Gemini AI
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-3">
                    <Check className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                    <p className="text-sm text-muted-foreground">
                      Analyze contact data, deal size, and engagement patterns
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <Check className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                    <p className="text-sm text-muted-foreground">
                      Score leads from 0-100 based on likelihood to close
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <Check className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                    <p className="text-sm text-muted-foreground">
                      Focus your team on the highest-value opportunities
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-2 border-accent/20">
                <CardHeader>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10">
                    <Search className="h-6 w-6 text-accent" />
                  </div>
                  <CardTitle className="text-2xl">AI Research with Perplexity</CardTitle>
                  <CardDescription className="text-base">
                    Get instant company insights powered by Perplexity AI
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-3">
                    <Check className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                    <p className="text-sm text-muted-foreground">
                      Research companies before your first call
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <Check className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                    <p className="text-sm text-muted-foreground">
                      Discover business size, services, and market position
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <Check className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                    <p className="text-sm text-muted-foreground">
                      Show up prepared and close deals faster
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Use Cases */}
        <section id="use-cases" className="py-20">
          <div className="container">
            <div className="mx-auto mb-12 max-w-2xl text-center">
              <h2 className="mb-4 text-balance text-3xl font-bold md:text-4xl">
                Built for Service Businesses
              </h2>
              <p className="text-pretty text-lg text-muted-foreground">
                Designed specifically for the unique needs of home service professionals
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                    <Zap className="h-8 w-8 text-primary" />
                  </div>
                  <CardTitle>HVAC Companies</CardTitle>
                  <CardDescription>
                    Track maintenance contracts, seasonal campaigns, and emergency service requests
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                    <Settings className="h-8 w-8 text-primary" />
                  </div>
                  <CardTitle>Plumbing Services</CardTitle>
                  <CardDescription>
                    Manage repair jobs, installation projects, and recurring maintenance clients
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                    <Sparkles className="h-8 w-8 text-primary" />
                  </div>
                  <CardTitle>Electrical Contractors</CardTitle>
                  <CardDescription>
                    Organize commercial and residential projects from quote to completion
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                    <Building2 className="h-8 w-8 text-primary" />
                  </div>
                  <CardTitle>Home Services</CardTitle>
                  <CardDescription>
                    Perfect for landscaping, cleaning, pest control, and more
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </section>

        {/* Security Section */}
        <section id="security" className="border-t bg-muted/30 py-20">
          <div className="container">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mb-4 flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <Shield className="h-8 w-8 text-primary" />
                </div>
              </div>
              <h2 className="mb-4 text-balance text-3xl font-bold md:text-4xl">
                Enterprise-Grade Security
              </h2>
              <p className="mb-12 text-pretty text-lg text-muted-foreground">
                Your customer data is protected with bank-level security and modern best practices.
              </p>
              <div className="grid gap-6 md:grid-cols-3">
                <div className="flex flex-col items-center gap-2">
                  <Lock className="h-10 w-10 text-primary" />
                  <h3 className="font-semibold">End-to-End Encryption</h3>
                  <p className="text-sm text-muted-foreground">All data encrypted in transit and at rest</p>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <Building2 className="h-10 w-10 text-primary" />
                  <h3 className="font-semibold">Multi-Tenant Architecture</h3>
                  <p className="text-sm text-muted-foreground">Complete data isolation between organizations</p>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <Shield className="h-10 w-10 text-primary" />
                  <h3 className="font-semibold">reCAPTCHA v3</h3>
                  <p className="text-sm text-muted-foreground">Advanced bot protection and fraud prevention</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-20">
          <div className="container">
            <Card className="border-2 border-primary/20 bg-primary/5">
              <CardContent className="flex flex-col items-center gap-6 p-12 text-center">
                <h2 className="text-balance text-3xl font-bold md:text-4xl">
                  Ready to Transform Your Sales Process?
                </h2>
                <p className="max-w-2xl text-pretty text-lg text-muted-foreground">
                  {'Join service businesses who are closing more deals with AI-powered lead management. Start your free trial today—no credit card required.'}
                </p>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button size="lg" asChild>
                    <Link href="/signup">
                      Start Free Trial
                      <Zap className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button size="lg" variant="outline" asChild>
                    <Link href="/login">View Demo</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t bg-muted/30 py-12">
        <div className="container">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
                  <span className="text-lg font-bold text-primary-foreground">R</span>
                </div>
                <span className="text-xl font-bold">RankedCEO</span>
              </div>
              <p className="text-sm text-muted-foreground">
                AI-powered CRM for service businesses
              </p>
            </div>
            <div>
              <h3 className="mb-3 text-sm font-semibold">Product</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="#features" className="transition-colors hover:text-foreground">Features</Link></li>
                <li><Link href="#ai" className="transition-colors hover:text-foreground">AI Capabilities</Link></li>
                <li><Link href="#use-cases" className="transition-colors hover:text-foreground">Use Cases</Link></li>
                <li><Link href="#security" className="transition-colors hover:text-foreground">Security</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="mb-3 text-sm font-semibold">Company</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="#" className="transition-colors hover:text-foreground">About</Link></li>
                <li><Link href="#" className="transition-colors hover:text-foreground">Blog</Link></li>
                <li><Link href="#" className="transition-colors hover:text-foreground">Careers</Link></li>
                <li><Link href="#" className="transition-colors hover:text-foreground">Contact</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="mb-3 text-sm font-semibold">Legal</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="#" className="transition-colors hover:text-foreground">Privacy</Link></li>
                <li><Link href="#" className="transition-colors hover:text-foreground">Terms</Link></li>
                <li><Link href="#" className="transition-colors hover:text-foreground">Security</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 border-t pt-8 text-center text-sm text-muted-foreground">
            <p>© 2026 RankedCEO. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
