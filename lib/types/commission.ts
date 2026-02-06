export interface CommissionRate {
  id: string;
  account_id: string;
  user_id: string;
  rate: number;
  effective_from: string;
  effective_to: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Commission {
  id: string;
  account_id: string;
  deal_id: string;
  user_id: string;
  amount: number;
  rate: number;
  deal_value: number;
  status: 'pending' | 'approved' | 'paid' | 'cancelled';
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CommissionWithDetails extends Commission {
  deal?: {
    id: string;
    title: string;
    stage: string;
    contact?: {
      name: string;
    };
    company?: {
      name: string;
    };
  };
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface CreateCommissionRateInput {
  user_id: string;
  rate: number;
  effective_from: string;
  effective_to?: string | null;
  is_active?: boolean;
  notes?: string | null;
}

export interface UpdateCommissionRateInput {
  rate?: number;
  effective_from?: string;
  effective_to?: string | null;
  is_active?: boolean;
  notes?: string | null;
}

export interface CreateCommissionInput {
  deal_id: string;
  user_id: string;
  amount: number;
  rate: number;
  deal_value: number;
  status?: 'pending' | 'approved' | 'paid' | 'cancelled';
  notes?: string | null;
}

export interface UpdateCommissionInput {
  amount?: number;
  rate?: number;
  deal_value?: number;
  status?: 'pending' | 'approved' | 'paid' | 'cancelled';
  paid_at?: string | null;
  notes?: string | null;
}

export interface CommissionStats {
  total_pending: number;
  total_approved: number;
  total_paid: number;
  total_cancelled: number;
  pending_amount: number;
  approved_amount: number;
  paid_amount: number;
  total_commissions: number;
}

export interface UserCommissionStats {
  user_id: string;
  user_name: string;
  user_email: string;
  total_commissions: number;
  total_amount: number;
  pending_amount: number;
  paid_amount: number;
  commission_count: number;
  average_rate: number;
}

export interface CommissionFilters {
  status?: 'pending' | 'approved' | 'paid' | 'cancelled';
  user_id?: string;
  deal_id?: string;
  start_date?: string;
  end_date?: string;
  search?: string;
}