import { Database } from './database'

export type Account = Database['public']['Tables']['accounts']['Row']
export type User = Database['public']['Tables']['users']['Row']
export type Contact = Database['public']['Tables']['contacts']['Row']
export type Company = Database['public']['Tables']['companies']['Row']
export type Deal = Database['public']['Tables']['deals']['Row']
export type Activity = Database['public']['Tables']['activities']['Row']

export type ContactWithRelations = Contact & {
  company?: Company | null
  owner?: User | null
}

export type CompanyWithRelations = Company & {
  contacts?: Contact[]
  deals?: Deal[]
}

export type DealWithRelations = Deal & {
  contact?: Contact | null
  company?: Company | null
  owner?: User | null
}

export type ActivityWithRelations = Activity & {
  contact?: Contact | null
  company?: Company | null
  deal?: Deal | null
  owner?: User | null
}