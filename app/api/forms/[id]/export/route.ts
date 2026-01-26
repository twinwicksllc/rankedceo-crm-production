import { NextRequest, NextResponse } from 'next/server'
import { FormSubmissionService } from '@/lib/services/form-submission-service'

/**
 * Form Export API Endpoint
 * GET /api/forms/[id]/export?format=csv|json - Export form submissions
 */

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const searchParams = request.nextUrl.searchParams
    const format = (searchParams.get('format') || 'csv') as 'csv' | 'json'

    const submissionService = new FormSubmissionService()
    
    let content: string
    let contentType: string
    let filename: string

    if (format === 'csv') {
      content = await submissionService.exportToCSV(params.id)
      contentType = 'text/csv'
      filename = `form-submissions-${params.id}.csv`
    } else {
      content = await submissionService.exportToJSON(params.id)
      contentType = 'application/json'
      filename = `form-submissions-${params.id}.json`
    }

    return new NextResponse(content, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('[Form Export API] Error exporting submissions:', error)
    return NextResponse.json(
      { error: 'Failed to export submissions' },
      { status: 500 }
    )
  }
}
