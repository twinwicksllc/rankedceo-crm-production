export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      accounts: {
        Row: {
          id: string
          name: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
          updated_at?: string
        }
      }
      users: {
        Row: {
          id: string
          account_id: string
          email: string
          full_name: string | null
          role: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          account_id: string
          email: string
          full_name?: string | null
          role?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          account_id?: string
          email?: string
          full_name?: string | null
          role?: string
          created_at?: string
          updated_at?: string
        }
      }
      contacts: {
        Row: {
          id: string
          account_id: string
          first_name: string
          last_name: string
          email: string | null
          phone: string | null
          company_id: string | null
          owner_id: string | null
          lead_score: number | null
          tags: string[] | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          account_id: string
          first_name: string
          last_name: string
          email?: string | null
          phone?: string | null
          company_id?: string | null
          owner_id?: string | null
          lead_score?: number | null
          tags?: string[] | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          account_id?: string
          first_name?: string
          last_name?: string
          email?: string | null
          phone?: string | null
          company_id?: string | null
          owner_id?: string | null
          lead_score?: number | null
          tags?: string[] | null
          created_at?: string
          updated_at?: string
        }
      }
      companies: {
        Row: {
          id: string
          account_id: string
          name: string
          industry: string | null
          employee_count: number | null
          website: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          account_id: string
          name: string
          industry?: string | null
          employee_count?: number | null
          website?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          account_id?: string
          name?: string
          industry?: string | null
          employee_count?: number | null
          website?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      deals: {
        Row: {
          id: string
          account_id: string
          title: string
          value: number
          currency: string
          probability: number
          pipeline_id: string
          stage_id: string
          contact_id: string | null
          company_id: string | null
          owner_id: string | null
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          account_id: string
          title: string
          value: number
          currency?: string
          probability?: number
          pipeline_id: string
          stage_id: string
          contact_id?: string | null
          company_id?: string | null
          owner_id?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          account_id?: string
          title?: string
          value?: number
          currency?: string
          probability?: number
          pipeline_id?: string
          stage_id?: string
          contact_id?: string | null
          company_id?: string | null
          owner_id?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
      }
      activities: {
        Row: {
          id: string
          account_id: string
          type: string
          title: string
          description: string | null
          due_date: string | null
          completed_at: string | null
          contact_id: string | null
          company_id: string | null
          deal_id: string | null
          owner_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          account_id: string
          type: string
          title: string
          description?: string | null
          due_date?: string | null
          completed_at?: string | null
          contact_id?: string | null
          company_id?: string | null
          deal_id?: string | null
          owner_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          account_id?: string
          type?: string
          title?: string
          description?: string | null
          due_date?: string | null
          completed_at?: string | null
          contact_id?: string | null
          company_id?: string | null
          deal_id?: string | null
          owner_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}