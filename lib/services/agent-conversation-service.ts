// ============================================================
// Agent Conversation Service
// Manages AI chat conversations with persistent storage
// ============================================================

import { createClient } from '@/lib/supabase/server'
import type {
  AgentConversation,
  AgentMessage,
  AgentContext,
  AppointmentSource,
} from '@/lib/types/appointment'

export class AgentConversationService {
  private supabase: any = null

  private async getClient() {
    if (!this.supabase) {
      this.supabase = await createClient()
    }
    return this.supabase
  }

  // ============================================================
  // Get or Create Conversation
  // ============================================================

  async getOrCreateConversation(
    sessionId: string,
    source: AppointmentSource,
    accountId?: string
  ): Promise<AgentConversation | null> {
    const supabase = await this.getClient()

    try {
      // Try to find existing active conversation
      const { data: existing } = await supabase
        .from('agent_conversations')
        .select('*')
        .eq('session_id', sessionId)
        .eq('source', source)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (existing && !existing.error) {
        return existing
      }

      // Create new conversation
      const { data: newConversation, error } = await supabase
        .from('agent_conversations')
        .insert({
          session_id: sessionId,
          source: source,
          account_id: accountId || null,
          messages: [],
          status: 'active',
        })
        .select()
        .single()

      if (error) throw error
      return newConversation
    } catch (error) {
      console.error('[AgentConversationService] Error getting/creating conversation:', error)
      return null
    }
  }

  // ============================================================
  // Get Conversation by ID
  // ============================================================

  async getConversationById(
    conversationId: string
  ): Promise<AgentConversation | null> {
    const supabase = await this.getClient()

    try {
      const { data, error } = await supabase
        .from('agent_conversations')
        .select('*')
        .eq('id', conversationId)
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('[AgentConversationService] Error getting conversation:', error)
      return null
    }
  }

  // ============================================================
  // Add Message to Conversation
  // ============================================================

  async addMessage(
    conversationId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    metadata?: Record<string, any>
  ): Promise<boolean> {
    const supabase = await this.getClient()

    try {
      const { data: conversation } = await supabase
        .from('agent_conversations')
        .select('messages')
        .eq('id', conversationId)
        .single()

      if (!conversation) {
        console.error('[AgentConversationService] Conversation not found')
        return false
      }

      const newMessage: AgentMessage = {
        role,
        content,
        timestamp: new Date().toISOString(),
        metadata: metadata || {},
      }

      const updatedMessages = [...(conversation.messages || []), newMessage]

      const { error } = await supabase
        .from('agent_conversations')
        .update({
          messages: updatedMessages,
          updated_at: new Date().toISOString(),
        })
        .eq('id', conversationId)

      if (error) throw error
      return true
    } catch (error) {
      console.error('[AgentConversationService] Error adding message:', error)
      return false
    }
  }

  // ============================================================
  // Update Conversation Status
  // ============================================================

  async updateStatus(
    conversationId: string,
    status: 'active' | 'booked' | 'abandoned' | 'completed',
    appointmentId?: string
  ): Promise<boolean> {
    const supabase = await this.getClient()

    try {
      const updateData: any = {
        status,
        updated_at: new Date().toISOString(),
      }

      if (appointmentId) {
        updateData.appointment_id = appointmentId
      }

      const { error } = await supabase
        .from('agent_conversations')
        .update(updateData)
        .eq('id', conversationId)

      if (error) throw error
      return true
    } catch (error) {
      console.error('[AgentConversationService] Error updating status:', error)
      return false
    }
  }

  // ============================================================
  // Update Lead Information
  // ============================================================

  async updateLeadInfo(
    conversationId: string,
    leadInfo: {
      name?: string
      email?: string
      phone?: string
    }
  ): Promise<boolean> {
    const supabase = await this.getClient()

    try {
      const { error } = await supabase
        .from('agent_conversations')
        .update({
          lead_name: leadInfo.name,
          lead_email: leadInfo.email,
          lead_phone: leadInfo.phone,
          updated_at: new Date().toISOString(),
        })
        .eq('id', conversationId)

      if (error) throw error
      return true
    } catch (error) {
      console.error('[AgentConversationService] Error updating lead info:', error)
      return false
    }
  }

  // ============================================================
  // Get Conversations by Account
  // ============================================================

  async getConversationsByAccount(
    accountId: string,
    filters?: {
      source?: AppointmentSource
      status?: 'active' | 'booked' | 'abandoned' | 'completed'
      limit?: number
      offset?: number
    }
  ): Promise<AgentConversation[]> {
    const supabase = await this.getClient()

    try {
      let query = supabase
        .from('agent_conversations')
        .select('*')
        .eq('account_id', accountId)
        .order('created_at', { ascending: false })

      if (filters?.source) {
        query = query.eq('source', filters.source)
      }

      if (filters?.status) {
        query = query.eq('status', filters.status)
      }

      if (filters?.limit) {
        query = query.limit(filters.limit)
      }

      if (filters?.offset) {
        query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1)
      }

      const { data, error } = await query

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('[AgentConversationService] Error getting conversations:', error)
      return []
    }
  }

  // ============================================================
  // Get Conversation Statistics
  // ============================================================

  async getStatistics(accountId: string): Promise<{
    total: number
    active: number
    booked: number
    abandoned: number
    completed: number
    bySource: Record<string, number>
  }> {
    const supabase = await this.getClient()

    try {
      const { data: conversations } = await supabase
        .from('agent_conversations')
        .select('status, source')
        .eq('account_id', accountId)

      if (!conversations) {
        return {
          total: 0,
          active: 0,
          booked: 0,
          abandoned: 0,
          completed: 0,
          bySource: {},
        }
      }

      const stats = {
        total: conversations.length,
        active: 0,
        booked: 0,
        abandoned: 0,
        completed: 0,
        bySource: {} as Record<string, number>,
      }

      conversations.forEach((conv: any) => {
        // Count by status
        if (conv.status === 'active') stats.active++
        else if (conv.status === 'booked') stats.booked++
        else if (conv.status === 'abandoned') stats.abandoned++
        else if (conv.status === 'completed') stats.completed++

        // Count by source
        stats.bySource[conv.source] = (stats.bySource[conv.source] || 0) + 1
      })

      return stats
    } catch (error) {
      console.error('[AgentConversationService] Error getting statistics:', error)
      return {
        total: 0,
        active: 0,
        booked: 0,
        abandoned: 0,
        completed: 0,
        bySource: {},
      }
    }
  }

  // ============================================================
  // Delete Old Conversations (Cleanup)
  // ============================================================

  async deleteOldConversations(daysOld: number = 30): Promise<number> {
    const supabase = await this.getClient()

    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysOld)

      const { data, error } = await supabase
        .from('agent_conversations')
        .delete()
        .lt('created_at', cutoffDate.toISOString())
        .select('id')

      if (error) throw error
      return data?.length || 0
    } catch (error) {
      console.error('[AgentConversationService] Error deleting old conversations:', error)
      return 0
    }
  }
}

// Export singleton instance
export const agentConversationService = new AgentConversationService()