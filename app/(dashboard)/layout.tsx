import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { 
  LayoutDashboard, 
  Users, 
  Building2, 
  DollarSign, 
  Activity, 
  Mail, 
  FileText, 
  BarChart3,
  Settings,
  LogOut,
  Sparkles
} from 'lucide-react'
import { Button } from '@/components/ui/button'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Contacts', href: '/contacts', icon: Users },
    { name: 'Companies', href: '/companies', icon: Building2 },
    { name: 'Deals', href: '/deals', icon: DollarSign },
    { name: 'Activities', href: '/activities', icon: Activity },
    { name: 'Campaigns', href: '/campaigns', icon: Mail },
    { name: 'Forms', href: '/forms', icon: FileText },
    { name: 'Reports', href: '/reports', icon: BarChart3 },
    { name: 'AI Insights', href: '/ai-insights', icon: Sparkles },
  ]

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-primary">RankedCEO</h1>
          <p className="text-sm text-muted-foreground">CRM Platform</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md hover:bg-gray-100 text-gray-700 hover:text-gray-900 transition-colors"
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-200 space-y-2">
          <Link
            href="/settings"
            className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md hover:bg-gray-100 text-gray-700 hover:text-gray-900 transition-colors"
          >
            <Settings className="h-5 w-5" />
            Settings
          </Link>
          <form action="/api/auth/logout" method="POST">
            <Button
              type="submit"
              variant="ghost"
              className="w-full justify-start gap-3 text-gray-700 hover:text-gray-900"
            >
              <LogOut className="h-5 w-5" />
              Logout
            </Button>
          </form>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}