'use client'

import { EmailThreadWithMessages } from '@/lib/types/email'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  MessageSquare, 
  Users, 
  Calendar,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useState } from 'react'
import { EmailCard } from './email-card'

interface EmailThreadProps {
  thread: EmailThreadWithMessages
  onEmailView?: (emailId: string) => void
  onMarkAsRead?: (emailId: string) => void
  expanded?: boolean
}

export function EmailThread({ 
  thread, 
  onEmailView, 
  onMarkAsRead,
  expanded: defaultExpanded = false 
}: EmailThreadProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  const formatDate = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true })
    } catch {
      return dateString
    }
  }

  const unreadCount = thread.messages?.filter((msg: any) => !msg.opened).length || 0

  const getPreviewText = () => {
    if (thread.latest_message?.body_plain) {
      const preview = thread.latest_message.body_plain.replace(/\n/g, ' ').trim()
      return preview.length > 100 ? preview.substring(0, 100) + '...' : preview
    }
    return 'No content'
  }

  return (
    <Card className="mb-4">
      <CardHeader 
        className="cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="h-5 w-5 text-blue-500" />
              <CardTitle className="text-lg">{thread.subject}</CardTitle>
              {unreadCount > 0 && (
                <Badge variant="default">{unreadCount} new</Badge>
              )}
            </div>
            
            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                <span>{thread.participants.length} participants</span>
              </div>
              <div className="flex items-center gap-1">
                <MessageSquare className="h-4 w-4" />
                <span>{thread.message_count} messages</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>Last: {formatDate(thread.last_message_at)}</span>
              </div>
            </div>

            {thread.latest_message && (
              <p className="text-sm text-muted-foreground mt-2 italic">
                {thread.latest_message.from_name || thread.latest_message.from_address}: {getPreviewText()}
              </p>
            )}
          </div>

          <Button variant="ghost" size="sm">
            {isExpanded ? (
              <ChevronUp className="h-5 w-5" />
            ) : (
              <ChevronDown className="h-5 w-5" />
            )}
          </Button>
        </div>
      </CardHeader>

      {isExpanded && thread.messages && (
        <CardContent className="space-y-4">
          {thread.messages.map((message: any) => (
            <div key={message.id} className="ml-4 border-l-2 pl-4 relative">
              <div className="absolute left-0 top-0 bottom-0 w-2 bg-blue-200 rounded-full"></div>
              <EmailCard
                email={message}
                onView={onEmailView}
                onMarkAsRead={onMarkAsRead}
              />
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  )
}