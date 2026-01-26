import { notFound } from 'next/navigation'
import Link from 'next/link'
import { CampaignService } from '@/lib/services/campaign-service'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Edit, Copy } from 'lucide-react'

export default async function EmailTemplateDetailPage({ params }: { params: { id: string } }) {
  const campaignService = new CampaignService()
  const template = await campaignService.getTemplate(params.id)
  
  if (!template) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/email-templates">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">{template.name}</h1>
            <p className="text-sm text-gray-500">Created {new Date(template.created_at).toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Subject Line</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-medium">{template.subject}</p>
          </CardContent>
        </Card>
      </div>

      {template.variables && template.variables.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Available Variables</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {template.variables.map((variable, index) => (
                <Badge key={index} variant="secondary" className="font-mono">
                  {'{{'}{variable}{'}}'}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>HTML Content</CardTitle>
          <Button variant="outline" size="sm">
            <Copy className="h-4 w-4 mr-2" />
            Copy
          </Button>
        </CardHeader>
        <CardContent>
          <pre className="bg-gray-50 p-4 rounded-lg overflow-x-auto text-sm">
            <code>{template.body}</code>
          </pre>
        </CardContent>
      </Card>
    </div>
  )
}
