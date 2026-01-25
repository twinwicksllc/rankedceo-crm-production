export interface Deal {
  id: string;
  created_at: string;
  updated_at: string;
  account_id: string;
  user_id: string;
  contact_id?: string | null;
  company_id?: string | null;
  pipeline_id?: string | null;
  title: string;
  description?: string | null;
  stage: 'Lead' | 'Qualified' | 'Proposal' | 'Negotiation' | 'Won' | 'Lost';
  value: number;
  win_probability: number;
  expected_close_date?: string | null;
}

export interface CreateDealInput {
  title: string;
  description?: string;
  contact_id?: string;
  company_id?: string;
  pipeline_id?: string;
  stage?: 'Lead' | 'Qualified' | 'Proposal' | 'Negotiation' | 'Won' | 'Lost';
  value: number;
  win_probability?: number;
  expected_close_date?: string;
}

export interface UpdateDealInput {
  title?: string;
  description?: string;
  contact_id?: string;
  company_id?: string;
  pipeline_id?: string;
  stage?: 'Lead' | 'Qualified' | 'Proposal' | 'Negotiation' | 'Won' | 'Lost';
  value?: number;
  win_probability?: number;
  expected_close_date?: string;
}

export interface DealFilters {
  search?: string;
  pipeline_id?: string;
  stage?: 'Lead' | 'Qualified' | 'Proposal' | 'Negotiation' | 'Won' | 'Lost';
}