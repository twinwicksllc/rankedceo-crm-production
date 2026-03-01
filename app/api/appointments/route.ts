import { NextRequest, NextResponse } from 'next/server'
import { AppointmentService } from '@/lib/services/appointment-service'
import { createAppointmentSchema } from '@/lib/validations/appointment'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const service = new AppointmentService()

    const filters = {
      status: searchParams.get('status') as any || undefined,
      source: searchParams.get('source') as any || undefined,
      contact_id: searchParams.get('contact_id') || undefined,
      date_from: searchParams.get('date_from') || undefined,
      date_to: searchParams.get('date_to') || undefined,
      search: searchParams.get('search') || undefined,
    }

    const appointments = await service.getAppointments(filters)
    const stats = await service.getStats()

    return NextResponse.json({ appointments, stats })
  } catch (error: any) {
    console.error('[Appointments GET] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch appointments' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = createAppointmentSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const service = new AppointmentService()

    // Get account_id from authenticated user
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userData } = await supabase
      .from('users')
      .select('id, account_id')
      .eq('email', user.email)
      .single()

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const appointment = await service.createAppointment({
      ...parsed.data,
      account_id: userData.account_id,
      booked_by_user_id: userData.id,
    })

    return NextResponse.json({ appointment }, { status: 201 })
  } catch (error: any) {
    console.error('[Appointments POST] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create appointment' },
      { status: 500 }
    )
  }
}