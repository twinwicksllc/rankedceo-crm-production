// Activity type definitions
export type ActivityType = 'call' | 'meeting' | 'email' | 'note' | 'task';
export type ActivityStatus = 'pending' | 'completed' | 'cancelled';

export interface Activity {
  id: string;
  created_at: string;
  updated_at: string;
  account_id: string;
  user_id: string;
  contact_id?: string | null;
  company_id?: string | null;
  deal_id?: string | null;
  type: ActivityType;
  title: string;
  description?: string | null;
  status: ActivityStatus;
  due_date?: string | null;
  completed_at?: string | null;
  duration_minutes?: number | null;
  location?: string | null;
  attendees?: string[] | null;
  metadata?: Record<string, any>;
}

export interface ActivityWithRelations extends Activity {
  contact?: {
    id: string;
    first_name: string;
    last_name: string;
    email?: string | null;
  };
  company?: {
    id: string;
    name: string;
  };
  deal?: {
    id: string;
    title: string;
  };
}

export interface CreateActivityInput {
  type: ActivityType;
  title: string;
  description?: string;
  contact_id?: string;
  company_id?: string;
  deal_id?: string;
  status?: ActivityStatus;
  due_date?: string;
  duration_minutes?: number;
  location?: string;
  attendees?: string[];
  metadata?: Record<string, any>;
}

export interface UpdateActivityInput {
  type?: ActivityType;
  title?: string;
  description?: string;
  status?: ActivityStatus;
  due_date?: string;
  completed_at?: string;
  duration_minutes?: number;
  location?: string;
  attendees?: string[];
  metadata?: Record<string, any>;
}

export interface ActivityFilters {
  type?: ActivityType;
  status?: ActivityStatus;
  contact_id?: string;
  company_id?: string;
  deal_id?: string;
  search?: string;
  date_from?: string;
  date_to?: string;
}