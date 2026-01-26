import { NextRequest, NextResponse } from 'next/server'
import { FormSubmissionService } from '@/lib/services/form-submission-service'
import { submitFormSchema } from '@/lib/validations/form'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const validatedData = submitFormSchema.parse({
      form_id: params.id,
      ...body,
    })

    const submissionService = new FormSubmissionService()
    
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'
    const referrer = request.headers.get('referer') || undefined

    const submission = await submissionService.submitForm(
      validatedData,
      ipAddress,
      userAgent,
      referrer
    )

    return NextResponse.json({
      success: true,
      submission_id: submission.id,
      message: 'Form submitted successfully',
    })
  } catch (error) {
    console.error('[Form Submission API] Error:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    return NextResponse.json(
      { 
        error: 'Failed to submit form',
        details: errorMessage
      },
      { status: 500 }
    )
  }
}
