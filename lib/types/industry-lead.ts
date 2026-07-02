// ---------------------------------------------------------------------------
// Industry Lead Types
// Shared across HVAC Pro, Plumb Pro, and Spark Pro
// ---------------------------------------------------------------------------

export type IndustryType = "hvac" | "plumbing" | "electrical";

export type LeadStatus =
  | "new" // Just submitted — needs attention
  | "contacted" // Operator reached out
  | "scheduled" // Appointment booked
  | "completed" // Job done
  | "lost"; // Did not convert

export type ServiceUrgency =
  | "emergency" // Same day / ASAP — safety or active damage
  | "urgent" // Within 24-48 hours
  | "scheduled" // Flexible timing
  | "estimate_only"; // Just want a quote

export type PreferredContactMethod = "phone" | "email" | "text";

// ---------------------------------------------------------------------------
// Core Lead Interface
// ---------------------------------------------------------------------------

export interface IndustryLead {
  id: string;
  account_id: string;
  auth_user_id: string | null; // NULL for unattributed/pool leads
  industry: IndustryType;

  // Contact Info
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  service_address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;

  // Service Request
  urgency: ServiceUrgency;
  preferred_contact_method: PreferredContactMethod;
  preferred_time: string | null;
  notes: string | null;

  // Industry-specific data (JSONB — flexible per industry)
  service_details: Record<string, unknown>;

  // Status & Assignment
  status: LeadStatus;
  estimated_value: number | null;
  assigned_to: string | null;

  // Timestamps
  submitted_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Input Types (for form submission)
// ---------------------------------------------------------------------------

export interface SubmitLeadInput {
  // Attribution
  operator_id?: string | null; // auth_user_id of the operator (from URL param)
  industry: IndustryType;

  // Contact Info
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  service_address?: string;
  city?: string;
  state?: string;
  zip_code?: string;

  // Service Request
  urgency: ServiceUrgency;
  preferred_contact_method: PreferredContactMethod;
  preferred_time?: string;
  notes?: string;

  // Industry-specific data
  service_details: Record<string, unknown>;
}

export interface UpdateLeadInput {
  status?: LeadStatus;
  estimated_value?: number | null;
  assigned_to?: string | null;
  notes?: string;
}

// ---------------------------------------------------------------------------
// HVAC-specific service_details shape
// ---------------------------------------------------------------------------

export interface HvacServiceDetails {
  service_type:
    | "ac_repair"
    | "heating_repair"
    | "installation"
    | "maintenance"
    | "duct_cleaning"
    | "thermostat"
    | "other";
  system_age?: string;
  system_brand?: string;
  symptoms: string[];
  property_type: "residential" | "commercial";
  square_footage?: string;
  num_units?: string;
  has_warranty?: boolean;
  last_service_date?: string;
}

// ---------------------------------------------------------------------------
// Plumbing-specific service_details shape
// ---------------------------------------------------------------------------

export interface PlumbingServiceDetails {
  service_type:
    | "leak_repair"
    | "drain_cleaning"
    | "water_heater"
    | "pipe_replacement"
    | "fixture_install"
    | "sewer"
    | "emergency"
    | "other";
  location_in_home?: string;
  symptoms: string[];
  is_water_shutoff_needed?: boolean;
  property_type: "residential" | "commercial";
  home_age?: string;
  has_shutoff_valve_access?: boolean;
  water_source?: "city" | "well";
}

// ---------------------------------------------------------------------------
// Electrical-specific service_details shape
// ---------------------------------------------------------------------------

export interface ElectricalServiceDetails {
  service_type:
    | "panel_upgrade"
    | "outlet_switch"
    | "wiring"
    | "lighting"
    | "ev_charger"
    | "generator"
    | "inspection"
    | "emergency"
    | "other";
  panel_type?: "circuit_breaker" | "fuse_box" | "unknown";
  symptoms: string[];
  is_power_out?: boolean;
  property_type: "residential" | "commercial";
  home_age?: string;
  panel_amperage?: "100" | "200" | "unknown";
  num_stories?: string;
  permit_needed?: boolean;
}

// ---------------------------------------------------------------------------
// Stats & Filters
// ---------------------------------------------------------------------------

export interface LeadStats {
  total: number;
  new_count: number;
  emergency_count: number;
  urgent_count: number;
  scheduled_count: number;
  completed_count: number;
  lost_count: number;
  conversion_rate: number; // completed / (completed + lost) * 100
  avg_estimated_value: number | null;
  total_pipeline_value: number;
}

export interface LeadFilters {
  industry?: IndustryType;
  status?: LeadStatus | "all";
  urgency?: ServiceUrgency | "all";
  search?: string; // searches customer_name, email, phone, city
  date_from?: string;
  date_to?: string;
}

// ---------------------------------------------------------------------------
// Server Action Results
// ---------------------------------------------------------------------------

export interface SubmitLeadResult {
  success: boolean;
  leadId?: string;
  error?: string;
}

export interface GetLeadsResult {
  success: boolean;
  data: IndustryLead[];
  error?: string;
}

export interface UpdateLeadResult {
  success: boolean;
  error?: string;
}

// ---------------------------------------------------------------------------
// Industry Config (for UI theming)
// ---------------------------------------------------------------------------

export interface IndustryConfig {
  industry: IndustryType;
  name: string; // "HVAC Pro", "Plumb Pro", "Spark Pro"
  tagline: string;
  color: {
    primary: string; // Tailwind class e.g. "blue-600"
    light: string; // Tailwind class e.g. "blue-50"
    border: string; // Tailwind class e.g. "blue-200"
    text: string; // Tailwind class e.g. "blue-700"
    button: string; // Tailwind class e.g. "bg-blue-600 hover:bg-blue-700"
    badge: string; // Tailwind class e.g. "bg-blue-100 text-blue-700"
    gradient: string; // Tailwind class e.g. "from-blue-50 via-white to-blue-25"
  };
  icon: string; // Lucide icon name: "Flame" | "Wrench" | "Lightbulb"
  subdomain: string; // "hvac" | "plumbing" | "electrical"
}

export const INDUSTRY_CONFIGS: Record<IndustryType, IndustryConfig> = {
  hvac: {
    industry: "hvac",
    name: "HVAC Pro",
    tagline: "Heating, Cooling & Air Quality Services",
    color: {
      primary: "blue-600",
      light: "blue-50",
      border: "blue-200",
      text: "blue-700",
      button: "bg-blue-600 hover:bg-blue-700",
      badge: "bg-blue-100 text-blue-700",
      gradient: "from-blue-50 via-white to-blue-25",
    },
    icon: "Flame",
    subdomain: "hvac",
  },
  plumbing: {
    industry: "plumbing",
    name: "Plumb Pro",
    tagline: "Plumbing, Drain & Water Services",
    color: {
      primary: "teal-600",
      light: "teal-50",
      border: "teal-200",
      text: "teal-700",
      button: "bg-teal-600 hover:bg-teal-700",
      badge: "bg-teal-100 text-teal-700",
      gradient: "from-teal-50 via-white to-teal-25",
    },
    icon: "Wrench",
    subdomain: "plumbing",
  },
  electrical: {
    industry: "electrical",
    name: "Spark Pro",
    tagline: "Electrical Installation & Repair Services",
    color: {
      primary: "amber-600",
      light: "amber-50",
      border: "amber-200",
      text: "amber-700",
      button: "bg-amber-600 hover:bg-amber-700",
      badge: "bg-amber-100 text-amber-700",
      gradient: "from-amber-50 via-white to-amber-25",
    },
    icon: "Lightbulb",
    subdomain: "electrical",
  },
};
