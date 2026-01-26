import { NextRequest, NextResponse } from 'next/server'
import { FormService } from '@/lib/services/form-service'
import { updateFormSchema } from '@/lib/validations/form'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const formService = new FormService()
    const form = await formService.getFormById(params.id)

    if (!form) {
      return NextResponse.json(
        { error: 'Form not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(form)
  } catch (error) {
    console.error('[Form API] Error fetching form:', error)
    return NextResponse.json(
      { error: 'Failed to fetch form' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const validatedData = updateFormSchema.parse(body)

    const formService = new FormService()
    const form = await formService.updateForm(params.id, validatedData)

    return NextResponse.json(form)
  } catch (error) {
    console.error('[Form API] Error updating form:', error)
    return NextResponse.json(
      { 
        error: 'Failed to update form',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const formService = new FormService()
    await formService.deleteForm(params.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Form API] Error deleting form:', error)
    return NextResponse.json(
      { error: 'Failed to delete form' },
      { status: 500 }
    )
  }
}
