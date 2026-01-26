'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  LayoutDashboard, 
  Users, 
  Building2, 
  DollarSign, 
  GitBranch,
  Calendar,
  Inbox,
  Mail,
  FileText,
  Settings
} from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/contacts', label: 'Contacts', icon: Users },
  { href: '/companies', label: 'Companies', icon: Building2 },
  { href: '/deals', label: 'Deals', icon: DollarSign },
  { href: '/pipelines', label: 'Pipelines', icon: GitBranch },
  { href: '/activities', label: 'Activities', icon: Calendar },
  { href: '/emails', label: 'Emails', icon: Inbox },
  { href: '/campaigns', label: 'Campaigns', icon: Mail },
  { href: '/email-templates', label: 'Templates', icon: FileText },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function DashboardNav() {
  const pathname = usePathname()

  return (
    <nav className="flex-1 px-4 space-y-1">
      {navItems.map((item) => {
        const Icon = item.icon
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
        
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
              isActive
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Icon className="h-5 w-5 mr-3" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
