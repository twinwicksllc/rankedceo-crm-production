import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared base schemas
// ---------------------------------------------------------------------------

export const urgencySchema = z.enum([
  "emergency",
  "urgent",
  "scheduled",
  "estimate_only",
]);
export const statusSchema = z.enum([
  "new",
  "contacted",
  "scheduled",
  "completed",
  "lost",
]);
export const industrySchema = z.enum(["hvac", "plumbing", "electrical"]);
export const contactMethodSchema = z.enum(["phone", "email", "text"]);

// ---------------------------------------------------------------------------
// Contact info (shared across all industries — Step 1)
// ---------------------------------------------------------------------------

export const contactInfoSchema = z.object({
  customer_name: z.string().min(2, "Full name is required"),
  customer_email: z.string().email("Please enter a valid email address"),
  customer_phone: z
    .string()
    .min(10, "Please enter a valid phone number")
    .regex(/^[\d\s\-\(\)\+\.]+$/, "Please enter a valid phone number"),
  service_address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip_code: z
    .string()
    .regex(/^\d{5}(-\d{4})?$/, "Please enter a valid ZIP code")
    .optional()
    .or(z.literal("")),
});

// ---------------------------------------------------------------------------
// Scheduling (shared — Step 5)
// ---------------------------------------------------------------------------

export const schedulingSchema = z.object({
  urgency: urgencySchema,
  preferred_contact_method: contactMethodSchema.default("phone"),
  preferred_time: z.string().optional(),
  notes: z.string().max(1000, "Notes must be under 1000 characters").optional(),
});

// ---------------------------------------------------------------------------
// HVAC service details (Steps 2-4)
// ---------------------------------------------------------------------------

export const hvacServiceDetailsSchema = z.object({
  service_type: z.enum([
    "ac_repair",
    "heating_repair",
    "installation",
    "maintenance",
    "duct_cleaning",
    "thermostat",
    "other",
  ]),
  system_age: z.string().optional(),
  system_brand: z.string().optional(),
  symptoms: z.array(z.string()).default([]),
  property_type: z.enum(["residential", "commercial"]).default("residential"),
  square_footage: z.string().optional(),
  num_units: z.string().optional(),
  has_warranty: z.boolean().default(false),
  last_service_date: z.string().optional(),
  problem_description: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Plumbing service details (Steps 2-4)
// ---------------------------------------------------------------------------

export const plumbingServiceDetailsSchema = z.object({
  service_type: z.enum([
    "leak_repair",
    "drain_cleaning",
    "water_heater",
    "pipe_replacement",
    "fixture_install",
    "sewer",
    "emergency",
    "other",
  ]),
  location_in_home: z.string().optional(),
  symptoms: z.array(z.string()).default([]),
  is_water_shutoff_needed: z.boolean().default(false),
  property_type: z.enum(["residential", "commercial"]).default("residential"),
  home_age: z.string().optional(),
  has_shutoff_valve_access: z.boolean().default(false),
  water_source: z.enum(["city", "well"]).optional(),
  problem_description: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Electrical service details (Steps 2-4)
// ---------------------------------------------------------------------------

export const electricalServiceDetailsSchema = z.object({
  service_type: z.enum([
    "panel_upgrade",
    "outlet_switch",
    "wiring",
    "lighting",
    "ev_charger",
    "generator",
    "inspection",
    "emergency",
    "other",
  ]),
  panel_type: z.enum(["circuit_breaker", "fuse_box", "unknown"]).optional(),
  symptoms: z.array(z.string()).default([]),
  is_power_out: z.boolean().default(false),
  property_type: z.enum(["residential", "commercial"]).default("residential"),
  home_age: z.string().optional(),
  panel_amperage: z.enum(["100", "200", "unknown"]).optional(),
  num_stories: z.string().optional(),
  permit_needed: z.boolean().default(false),
  problem_description: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Full lead submission schemas (per industry)
// ---------------------------------------------------------------------------

const baseLeadSchema = contactInfoSchema.merge(schedulingSchema).extend({
  operator_id: z.string().uuid().nullable().optional(),
  industry: industrySchema,
});

export const hvacLeadSchema = baseLeadSchema.extend({
  service_details: hvacServiceDetailsSchema,
});

export const plumbingLeadSchema = baseLeadSchema.extend({
  service_details: plumbingServiceDetailsSchema,
});

export const electricalLeadSchema = baseLeadSchema.extend({
  service_details: electricalServiceDetailsSchema,
});

// ---------------------------------------------------------------------------
// Update lead schema (for operator dashboard actions)
// ---------------------------------------------------------------------------

export const updateLeadSchema = z.object({
  status: statusSchema.optional(),
  estimated_value: z.number().min(0).nullable().optional(),
  assigned_to: z.string().nullable().optional(),
  notes: z.string().max(1000).optional(),
});

// ---------------------------------------------------------------------------
// Type exports (inferred from schemas)
// ---------------------------------------------------------------------------

export type ContactInfoInput = z.infer<typeof contactInfoSchema>;
export type SchedulingInput = z.infer<typeof schedulingSchema>;
export type HvacServiceDetailsInput = z.infer<typeof hvacServiceDetailsSchema>;
export type PlumbingServiceDetailsInput = z.infer<
  typeof plumbingServiceDetailsSchema
>;
export type ElectricalServiceDetailsInput = z.infer<
  typeof electricalServiceDetailsSchema
>;
export type HvacLeadInput = z.infer<typeof hvacLeadSchema>;
export type PlumbingLeadInput = z.infer<typeof plumbingLeadSchema>;
export type ElectricalLeadInput = z.infer<typeof electricalLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
