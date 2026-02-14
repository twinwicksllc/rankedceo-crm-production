export interface OnboardingStatus {
  onboarding_completed: boolean;
  onboarding_step: number;
  onboarding_skipped: boolean;
  onboarding_completed_at: string | null;
}

export interface CompanyInfo {
  name: string;
  company_size?: string;
  industry?: string;
  website?: string;
  phone?: string;
  address?: string;
}

export interface OnboardingData {
  step: number;
  company_info?: CompanyInfo;
  preferences?: {
    timezone?: string;
    currency?: string;
    date_format?: string;
  };
}

export const COMPANY_SIZES = [
  { value: '1-10', label: '1-10 employees' },
  { value: '11-50', label: '11-50 employees' },
  { value: '51-200', label: '51-200 employees' },
  { value: '201-500', label: '201-500 employees' },
  { value: '501+', label: '501+ employees' },
];

export const INDUSTRIES = [
  { value: 'hvac', label: 'HVAC' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'roofing', label: 'Roofing' },
  { value: 'landscaping', label: 'Landscaping' },
  { value: 'construction', label: 'Construction' },
  { value: 'home_services', label: 'Home Services' },
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'consulting', label: 'Consulting' },
  { value: 'technology', label: 'Technology' },
  { value: 'other', label: 'Other' },
];

export const ONBOARDING_STEPS = [
  { step: 0, title: 'Welcome', description: 'Get started with RankedCEO CRM' },
  { step: 1, title: 'Company Info', description: 'Tell us about your business' },
  { step: 2, title: 'Team Setup', description: 'Invite your team members' },
  { step: 3, title: 'Preferences', description: 'Customize your experience' },
  { step: 4, title: 'Complete', description: 'You\'re all set!' },
];