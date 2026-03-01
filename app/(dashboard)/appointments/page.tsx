import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Calendar, Plus, Clock, CheckCircle2, TrendingUp } from 'lucide-react'
import { AppointmentCard } from '@/components/agent/appointment-card'
import { AppointmentService } from '@/lib/services/appointment-service'

export const dynamic = 'force-dynamic'

export default async function AppointmentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const service = new AppointmentService()
  const [appointments, stats] = await Promise.all([
    service.getAppointments().catch(() => []),
    service.getStats().catch(() => ({ total: 0, scheduled: 0, completed: 0, cancelled: 0, this_week: 0 })),
  ])

  const upcoming = appointments.filter((a: any) => a.status === 'scheduled')
  const past = appointments.filter((a: any) => a.status !== 'scheduled')

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Appointments</h1>
          <p className="text-gray-500 mt-1">Manage all scheduled calls and meetings</p>
        </div>
        <Link
          href="/appointments/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          New Appointment
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total', value: stats.total, icon: <Calendar className="w-5 h-5 text-purple-600" />, bg: 'bg-purple-50' },
          { label: 'Scheduled', value: stats.scheduled, icon: <Clock className="w-5 h-5 text-blue-600" />, bg: 'bg-blue-50' },
          { label: 'Completed', value: stats.completed, icon: <CheckCircle2 className="w-5 h-5 text-green-600" />, bg: 'bg-green-50' },
          { label: 'This Week', value: stats.this_week, icon: <TrendingUp className="w-5 h-5 text-orange-600" />, bg: 'bg-orange-50' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className={`w-10 h-10 rounded-lg ${stat.bg} flex items-center justify-center mb-3`}>
              {stat.icon}
            </div>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-sm text-gray-500">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Upcoming ({upcoming.length})</h2>
        {upcoming.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">No upcoming appointments</p>
            <p className="text-gray-400 text-sm mt-1">Book a new appointment or connect Calendly in Settings</p>
            <Link
              href="/appointments/new"
              className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Book Appointment
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((appt: any) => (
              <Link key={appt.id} href={`/appointments/${appt.id}`}>
                <AppointmentCard appointment={appt} />
              </Link>
            ))}
          </div>
        )}
      </div>

      {past.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Past Appointments ({past.length})</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {past.slice(0, 9).map((appt: any) => (
              <Link key={appt.id} href={`/appointments/${appt.id}`}>
                <AppointmentCard appointment={appt} />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}