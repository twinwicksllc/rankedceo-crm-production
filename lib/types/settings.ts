export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  role: string;
  phone: string | null;
  title: string | null;
}

export interface AccountSettings {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  timezone: string;
  company_size: string | null;
  industry: string | null;
  website: string | null;
  phone: string | null;
  address: string | null;
  settings: any;
}

export interface NotificationSettings {
  email_notifications: boolean;
  deal_updates: boolean;
  activity_reminders: boolean;
  weekly_summary: boolean;
  marketing_emails: boolean;
}

export interface SecuritySettings {
  two_factor_enabled: boolean;
  last_password_change: string | null;
  active_sessions: number;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  avatar_url: string | null;
  last_login_at: string | null;
  created_at: string;
}

export const USER_ROLES = [
  { value: 'admin', label: 'Administrator' },
  { value: 'manager', label: 'Manager' },
  { value: 'sales', label: 'Sales Representative' },
  { value: 'support', label: 'Support' },
  { value: 'viewer', label: 'Viewer' },
];

export const ACCOUNT_PLANS = [
  { value: 'free', label: 'Free Plan' },
  { value: 'starter', label: 'Starter Plan' },
  { value: 'professional', label: 'Professional Plan' },
  { value: 'enterprise', label: 'Enterprise Plan' },
];