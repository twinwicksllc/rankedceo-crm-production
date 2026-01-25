export interface Contact {
  id: string;
  created_at: string;
  updated_at: string;
  account_id: string;
  user_id: string;
  company_id?: string | null;
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  job_title?: string | null;
  status: 'active' | 'inactive' | 'prospect';
  notes?: string | null;
}

export interface CreateContactInput {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  job_title?: string;
  company_id?: string;
  status?: 'active' | 'inactive' | 'prospect';
  notes?: string;
}

export interface UpdateContactInput {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  job_title?: string;
  company_id?: string;
  status?: 'active' | 'inactive' | 'prospect';
  notes?: string;
}

export interface ContactFilters {
  search?: string;
  company_id?: string;
  status?: 'active' | 'inactive' | 'prospect';
}