// ============================================================
// Appointment Service - CRUD operations with Supabase
// ============================================================

import { createClient } from '@/lib/supabase/server'
import type {
  Appointment,
  AppointmentWithRelations,
  CreateAppointmentInput,
  UpdateAppointmentInput,
  AppointmentFilters,
  CalendlyConnection,
} from '@/lib/types/appointment'

export class AppointmentService {
  private supabase: any = null

  private async getClient() {
    if (!this.supabase) {
      this.supabase = await createClient()
    }
    return this.supabase
  }

  private async getUserInfo() {
    const supabase = await this.getClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) throw new Error('Not authenticated')

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, account_id, name, email')
      .eq('email', user.email)
      .single()

    if (userError || !userData) throw new Error('User record not found')
    return userData
  }

  // ── Appointments CRUD ──────────────────────────────────────

  async getAppointments(filters: AppointmentFilters = {}): Promise<AppointmentWithRelations[]> {
    const supabase = await this.getClient()
    const userData = await this.getUserInfo()

    let query = supabase
      .from('appointments')
      .select(`
        *,
        contact:contacts(id, first_name, last_name, email, phone),
        company:companies(id, name),
        deal:deals(id, title),
        booked_by_user:users!booked_by_user_id(id, name, email)
      `)
      .eq('account_id', userData.account_id)
      .order('start_time', { ascending: true })

    if (filters.status) query = query.eq('status', filters.status)
    if (filters.source) query = query.eq('source', filters.source)
    if (filters.contact_id) query = query.eq('contact_id', filters.contact_id)
    if (filters.date_from) query = query.gte('start_time', filters.date_from)
    if (filters.date_to) query = query.lte('start_time', filters.date_to)
    if (filters.search) {
      query = query.or(
        `invitee_name.ilike.%${filters.search}%,invitee_email.ilike.%${filters.search}%,title.ilike.%${filters.search}%`
      )
    }

    const { data, error } = await query
    if (error) throw new Error(`Failed to fetch appointments: ${error.message}`)
    return data || []
  }

  async getAppointment(id: string): Promise<AppointmentWithRelations | null> {
    const supabase = await this.getClient()
    const userData = await this.getUserInfo()

    const { data, error } = await supabase
      .from('appointments')
      .select(`
        *,
        contact:contacts(id, first_name, last_name, email, phone),
        company:companies(id, name),
        deal:deals(id, title),
        booked_by_user:users!booked_by_user_id(id, name, email)
      `)
      .eq('id', id)
      .eq('account_id', userData.account_id)
      .single()

    if (error) return null
    return data
  }

  async createAppointment(input: CreateAppointmentInput): Promise<Appointment> {
    const supabase = await this.getClient()

    const { data, error } = await supabase
      .from('appointments')
      .insert(input)
      .select()
      .single()

    if (error) throw new Error(`Failed to create appointment: ${error.message}`)
    return data
  }

  async updateAppointment(id: string, input: UpdateAppointmentInput): Promise<Appointment> {
    const supabase = await this.getClient()
    const userData = await this.getUserInfo()

    const { data, error } = await supabase
      .from('appointments')
      .update(input)
      .eq('id', id)
      .eq('account_id', userData.account_id)
      .select()
      .single()

    if (error) throw new Error(`Failed to update appointment: ${error.message}`)
    return data
  }

  async cancelAppointment(id: string): Promise<Appointment> {
    return this.updateAppointment(id, { status: 'cancelled' })
  }

  async getUpcomingAppointments(limit = 5): Promise<AppointmentWithRelations[]> {
    const supabase = await this.getClient()
    const userData = await this.getUserInfo()

    const { data, error } = await supabase
      .from('appointments')
      .select(`
        *,
        contact:contacts(id, first_name, last_name, email),
        company:companies(id, name)
      `)
      .eq('account_id', userData.account_id)
      .eq('status', 'scheduled')
      .gte('start_time', new Date().toISOString())
      .order('start_time', { ascending: true })
      .limit(limit)

    if (error) throw new Error(`Failed to fetch upcoming appointments: ${error.message}`)
    return data || []
  }

  async getStats(): Promise<{
    total: number
    scheduled: number
    completed: number
    cancelled: number
    this_week: number
  }> {
    const supabase = await this.getClient()
    const userData = await this.getUserInfo()

    const now = new Date()
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - now.getDay())
    weekStart.setHours(0, 0, 0, 0)

    const { data, error } = await supabase
      .from('appointments')
      .select('status, start_time')
      .eq('account_id', userData.account_id)

    if (error) throw new Error(`Failed to fetch stats: ${error.message}`)

    const appointments = data || []
    return {
      total: appointments.length,
      scheduled: appointments.filter((a: any) => a.status === 'scheduled').length,
      completed: appointments.filter((a: any) => a.status === 'completed').length,
      cancelled: appointments.filter((a: any) => a.status === 'cancelled').length,
      this_week: appointments.filter((a: any) => new Date(a.start_time) >= weekStart).length,
    }
  }

  // ── Calendly Connection ────────────────────────────────────

  async getCalendlyConnection(): Promise<CalendlyConnection | null> {
    const supabase = await this.getClient()
    const userData = await this.getUserInfo()

    const { data, error } = await supabase
      .from('calendly_connections')
      .select('*')
      .eq('user_id', userData.id)
      .eq('is_active', true)
      .single()

    if (error) return null
    return data
  }

  async saveCalendlyConnection(connection: {
    access_token: string
    refresh_token?: string
    token_expires_at?: string
    calendly_user_uri: string
    calendly_user_name?: string
    calendly_user_email?: string
    calendly_organization_uri?: string
  }): Promise<CalendlyConnection> {
    const supabase = await this.getClient()
    const userData = await this.getUserInfo()

    const { data, error } = await supabase
      .from('calendly_connections')
      .upsert({
        account_id: userData.account_id,
        user_id: userData.id,
        is_active: true,
        ...connection,
      }, { onConflict: 'user_id' })
      .select()
      .single()

    if (error) throw new Error(`Failed to save Calendly connection: ${error.message}`)
    return data
  }

  async disconnectCalendly(): Promise<void> {
    const supabase = await this.getClient()
    const userData = await this.getUserInfo()

    const { error } = await supabase
      .from('calendly_connections')
      .update({ is_active: false })
      .eq('user_id', userData.id)

    if (error) throw new Error(`Failed to disconnect Calendly: ${error.message}`)
  }

  // ── Get active Calendly connection for an account (for public booking) ──

  async getAccountCalendlyConnection(accountId: string): Promise<CalendlyConnection | null> {
    const supabase = await this.getClient()

    const { data, error } = await supabase
      .from('calendly_connections')
      .select('*')
      .eq('account_id', accountId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error) return null
    return data
  }
}