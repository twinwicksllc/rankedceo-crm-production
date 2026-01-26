import { NextRequest, NextResponse } from 'next/server'
import { FormService } from '@/lib/services/form-service'
import { createClient } from '@/lib/supabase/server'
import { createFormSchema } from '@/lib/validations/form'

/**
 * Forms API Endpoint
 * GET /api/forms - Get all forms
 * POST /api/forms - Create new form
 */

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search') || undefined
    const status = searchParams.get('status') || undefined

    const formService = new FormService()
    const forms = await formService.getForms({
      search,
      status: status as any,
    })

    return NextResponse.json(forms)
  } catch (error) {
    console.error('[Forms API] Error fetching forms:', error)
    return NextResponse.json(
      { error: 'Failed to fetch forms' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { data: userData } = await supabase
      .from('users')
      .select('account_id')
      .eq('id', user.id)
      .single()

    if (!userData?.account_id) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const validatedData = createFormSchema.parse(body)

    const formService = new FormService()
    const form = await formService.createForm(validatedData, userData.account_id)

    return NextResponse.json(form, { status: 201 })
  } catch (error) {
    console.error('[Forms API] Error creating form:', error)
    return NextResponse.json(
      { 
        error: 'Failed to create form',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
