import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { AppointmentCard } from '@/components/agent/appointment-card'
import { AppointmentService } from '@/lib/services/appointment-service'

export const dynamic = 'force-dynamic'

export default async function AppointmentDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const service = new AppointmentService()
  const appointment = await service.getAppointment(params.id)

  if (!appointment) notFound()

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/appointments" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Appointment Details</h1>
          <p className="text-gray-500 text-sm mt-0.5">View and manage this appointment</p>
        </div>
      </div>

      <AppointmentCard appointment={appointment} />

      {appointment.description && (
        <div className="mt-4 bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Notes</h3>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{appointment.description}</p>
        </div>
      )}

      {appointment.agent_conversation && Array.isArray(appointment.agent_conversation) && appointment.agent_conversation.length > 0 && (
        <div className="mt-4 bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">AI Agent Conversation</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {appointment.agent_conversation.map((msg: any, i: number) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-xl px-3 py-2 text-xs ${
                  msg.role === 'user'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}