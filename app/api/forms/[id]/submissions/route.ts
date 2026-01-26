import { NextRequest, NextResponse } from 'next/server'
import { FormService } from '@/lib/services/form-service'

/**
 * Form Submissions API Endpoint
 * GET /api/forms/[id]/submissions - Get form submissions
 */

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const formService = new FormService()
    const submissions = await formService.getFormSubmissions(params.id)

    return NextResponse.json(submissions)
  } catch (error) {
    console.error('[Form Submissions API] Error fetching submissions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch submissions' },
      { status: 500 }
    )
  }
}
