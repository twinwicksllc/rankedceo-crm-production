export interface Company {
  id: string;
  created_at: string;
  updated_at: string;
  account_id: string;
  user_id: string;
  name: string;
  industry?: string | null;
  website?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  country?: string | null;
  employee_count?: number | null;
  status: 'active' | 'inactive' | 'prospect';
  description?: string | null;
}

export interface CreateCompanyInput {
  name: string;
  industry?: string;
  website?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  employee_count?: number;
  status?: 'active' | 'inactive' | 'prospect';
  description?: string;
}

export interface UpdateCompanyInput {
  name?: string;
  industry?: string;
  website?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  employee_count?: number;
  status?: 'active' | 'inactive' | 'prospect';
  description?: string;
}

export interface CompanyFilters {
  search?: string;
  status?: 'active' | 'inactive' | 'prospect';
}