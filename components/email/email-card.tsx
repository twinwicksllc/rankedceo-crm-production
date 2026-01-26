'use client'

import { EmailMessageWithThread } from '@/lib/types/email'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Mail, 
  ArrowRight, 
  Calendar, 
  User, 
  Building, 
  DollarSign,
  Eye,
  EyeOff
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface EmailCardProps {
  email: EmailMessageWithThread
  onView?: (emailId: string) => void
  onMarkAsRead?: (emailId: string) => void
}

export function EmailCard({ email, onView, onMarkAsRead }: EmailCardProps) {
  const isUnread = !email.opened
  const isInbound = email.direction === 'inbound'

  const formatDate = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true })
    } catch {
      return dateString
    }
  }

  const getPreviewText = () => {
    if (email.body_plain) {
      const preview = email.body_plain.replace(/\n/g, ' ').trim()
      return preview.length > 150 ? preview.substring(0, 150) + '...' : preview
    }
    return 'No content'
  }

  return (
    <Card className={`hover:shadow-md transition-shadow ${isUnread ? 'border-l-4 border-l-blue-500' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {isInbound ? (
                <ArrowRight className="h-4 w-4 text-blue-500" />
              ) : (
                <ArrowRight className="h-4 w-4 text-green-500 rotate-180" />
              )}
              <h3 className="font-semibold truncate text-lg">{email.subject}</h3>
              {isUnread && (
                <Badge variant="default" className="ml-2">New</Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-3 w-3" />
              <span className="font-medium">
                {email.from_name || email.from_address}
              </span>
              {!email.from_name && <span className="text-xs">({email.from_address})</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 ml-4">
            <Badge variant={isInbound ? "secondary" : "outline"}>
              {isInbound ? 'Inbound' : 'Outbound'}
            </Badge>
            {isUnread && onMarkAsRead && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onMarkAsRead(email.id)}
                title="Mark as read"
              >
                <Eye className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          {getPreviewText()}
        </p>
        
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mb-3">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>{formatDate(email.received_at)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Mail className="h-3 w-3" />
            <span>To: {email.to_addresses.length} recipient(s)</span>
          </div>
          {email.cc_addresses && email.cc_addresses.length > 0 && (
            <div className="flex items-center gap-1">
              <Mail className="h-3 w-3" />
              <span>CC: {email.cc_addresses.length} recipient(s)</span>
            </div>
          )}
        </div>

        {email.contact_id || email.company_id || email.deal_id ? (
          <div className="flex flex-wrap gap-2 pt-3 border-t">
            {email.contact && (
              <div className="flex items-center gap-1 text-xs bg-blue-50 px-2 py-1 rounded">
                <User className="h-3 w-3 text-blue-600" />
                <span className="text-blue-900">{email.contact.name}</span>
              </div>
            )}
            {email.company && (
              <div className="flex items-center gap-1 text-xs bg-purple-50 px-2 py-1 rounded">
                <Building className="h-3 w-3 text-purple-600" />
                <span className="text-purple-900">{email.company.name}</span>
              </div>
            )}
            {email.deal && (
              <div className="flex items-center gap-1 text-xs bg-green-50 px-2 py-1 rounded">
                <DollarSign className="h-3 w-3 text-green-600" />
                <span className="text-green-900">{email.deal.name}</span>
              </div>
            )}
          </div>
        ) : null}

        {onView && (
          <div className="mt-3">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => onView(email.id)}
            >
              View Email
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}