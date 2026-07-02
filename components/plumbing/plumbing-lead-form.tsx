"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { LeadFormShell } from "@/components/industry/lead-form-shell";
import type { PlumbingLeadInput } from "@/lib/validations/industry-lead";

const TOTAL_STEPS = 5;

const SERVICE_TYPES = [
  { value: "leak_repair", label: "Leak Repair" },
  { value: "drain_cleaning", label: "Drain Cleaning" },
  { value: "water_heater", label: "Water Heater" },
  { value: "pipe_replacement", label: "Pipe Replacement" },
  { value: "fixture_install", label: "Fixture Installation" },
  { value: "sewer", label: "Sewer Line" },
  { value: "emergency", label: "🚨 Emergency" },
  { value: "other", label: "Other" },
];

const SYMPTOMS = [
  { value: "dripping_faucet", label: "Dripping faucet" },
  { value: "slow_drain", label: "Slow drain" },
  { value: "no_hot_water", label: "No hot water" },
  { value: "low_pressure", label: "Low water pressure" },
  { value: "water_stain", label: "Water stain / damage" },
  { value: "gurgling_sounds", label: "Gurgling sounds" },
  { value: "sewage_smell", label: "Sewage smell" },
  { value: "running_toilet", label: "Running toilet" },
  { value: "burst_pipe", label: "Burst / broken pipe" },
];

const URGENCY_OPTIONS = [
  { value: "emergency", label: "🚨 Emergency — Active leak or flooding" },
  { value: "urgent", label: "⚡ Urgent — Within 24 hours" },
  { value: "scheduled", label: "📅 Scheduled — Flexible timing" },
  { value: "estimate_only", label: "💬 Estimate Only — Just a quote" },
];

const LOCATIONS = [
  "Kitchen",
  "Bathroom",
  "Basement",
  "Laundry Room",
  "Garage",
  "Outdoor / Yard",
  "Multiple Areas",
  "Unknown",
];

const STEP_TITLES = [
  "Contact Information",
  "Service Type",
  "Problem Description",
  "Property Details",
  "Scheduling",
];

interface PlumbingLeadFormProps {
  onSubmit: (data: PlumbingLeadInput) => Promise<void>;
  operatorId?: string;
}

type FormData = {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  service_address: string;
  city: string;
  state: string;
  zip_code: string;
  service_type: string;
  location_in_home: string;
  symptoms: string[];
  problem_description: string;
  urgency: string;
  is_water_shutoff_needed: boolean;
  property_type: string;
  home_age: string;
  has_shutoff_valve_access: boolean;
  water_source: string;
  preferred_time: string;
  preferred_contact_method: string;
  has_home_warranty: boolean;
  notes: string;
};

const initialData: FormData = {
  customer_name: "",
  customer_email: "",
  customer_phone: "",
  service_address: "",
  city: "",
  state: "",
  zip_code: "",
  service_type: "",
  location_in_home: "",
  symptoms: [],
  problem_description: "",
  urgency: "scheduled",
  is_water_shutoff_needed: false,
  property_type: "residential",
  home_age: "",
  has_shutoff_valve_access: false,
  water_source: "city",
  preferred_time: "",
  preferred_contact_method: "phone",
  has_home_warranty: false,
  notes: "",
};

export function PlumbingLeadForm({
  onSubmit,
  operatorId,
}: PlumbingLeadFormProps) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<FormData>(initialData);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>(
    {},
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const update = (field: keyof FormData, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const toggleSymptom = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      symptoms: prev.symptoms.includes(value)
        ? prev.symptoms.filter((s) => s !== value)
        : [...prev.symptoms, value],
    }));
  };

  const validateStep = (s: number): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};
    if (s === 1) {
      if (!formData.customer_name.trim())
        newErrors.customer_name = "Full name is required";
      if (!formData.customer_email.trim())
        newErrors.customer_email = "Email is required";
      if (
        formData.customer_email &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.customer_email)
      )
        newErrors.customer_email = "Invalid email format";
      if (!formData.customer_phone.trim())
        newErrors.customer_phone = "Phone number is required";
    }
    if (s === 2) {
      if (!formData.service_type)
        newErrors.service_type = "Please select a service type";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(step)) setStep((prev) => Math.min(prev + 1, TOTAL_STEPS));
  };
  const handlePrevious = () => setStep((prev) => Math.max(prev - 1, 1));

  const handleSubmit = async () => {
    if (!validateStep(step)) return;
    setIsSubmitting(true);
    try {
      const payload: PlumbingLeadInput = {
        operator_id: operatorId ?? null,
        industry: "plumbing",
        customer_name: formData.customer_name,
        customer_email: formData.customer_email,
        customer_phone: formData.customer_phone,
        service_address: formData.service_address || undefined,
        city: formData.city || undefined,
        state: formData.state || undefined,
        zip_code: formData.zip_code || undefined,
        urgency: formData.urgency as PlumbingLeadInput["urgency"],
        preferred_contact_method:
          formData.preferred_contact_method as PlumbingLeadInput["preferred_contact_method"],
        preferred_time: formData.preferred_time || undefined,
        notes: formData.notes || undefined,
        service_details: {
          service_type: formData.service_type as
            | "leak_repair"
            | "drain_cleaning"
            | "water_heater"
            | "pipe_replacement"
            | "fixture_install"
            | "sewer"
            | "emergency"
            | "other",
          location_in_home: formData.location_in_home || undefined,
          symptoms: formData.symptoms,
          is_water_shutoff_needed: formData.is_water_shutoff_needed,
          property_type: formData.property_type as "residential" | "commercial",
          home_age: formData.home_age || undefined,
          has_shutoff_valve_access: formData.has_shutoff_valve_access,
          water_source: formData.water_source as "city" | "well",
          problem_description: formData.problem_description || undefined,
        },
      };
      await onSubmit(payload);
    } catch (err) {
      console.error("[PlumbingLeadForm] Submission error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <LeadFormShell
      industry="plumbing"
      totalSteps={TOTAL_STEPS}
      currentStep={step}
      stepTitle={STEP_TITLES[step - 1]}
      isSubmitting={isSubmitting}
      onNext={handleNext}
      onPrevious={handlePrevious}
      onSubmit={handleSubmit}
    >
      {/* ── Step 1: Contact Info ── */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="customer_name">Full Name *</Label>
              <Input
                id="customer_name"
                value={formData.customer_name}
                onChange={(e) => update("customer_name", e.target.value)}
                placeholder="John Smith"
                className={errors.customer_name ? "border-red-500" : ""}
              />
              {errors.customer_name && (
                <p className="text-xs text-red-500">{errors.customer_name}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer_email">Email Address *</Label>
              <Input
                id="customer_email"
                type="email"
                value={formData.customer_email}
                onChange={(e) => update("customer_email", e.target.value)}
                placeholder="john@example.com"
                className={errors.customer_email ? "border-red-500" : ""}
              />
              {errors.customer_email && (
                <p className="text-xs text-red-500">{errors.customer_email}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer_phone">Phone Number *</Label>
              <Input
                id="customer_phone"
                type="tel"
                value={formData.customer_phone}
                onChange={(e) => update("customer_phone", e.target.value)}
                placeholder="(555) 123-4567"
                className={errors.customer_phone ? "border-red-500" : ""}
              />
              {errors.customer_phone && (
                <p className="text-xs text-red-500">{errors.customer_phone}</p>
              )}
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="service_address">Service Address</Label>
              <Input
                id="service_address"
                value={formData.service_address}
                onChange={(e) => update("service_address", e.target.value)}
                placeholder="123 Main St"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => update("city", e.target.value)}
                placeholder="Austin"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={formData.state}
                  onChange={(e) => update("state", e.target.value)}
                  placeholder="TX"
                  maxLength={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="zip_code">ZIP Code</Label>
                <Input
                  id="zip_code"
                  value={formData.zip_code}
                  onChange={(e) => update("zip_code", e.target.value)}
                  placeholder="78701"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 2: Service Type ── */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>What service do you need? *</Label>
            <div className="grid grid-cols-2 gap-2">
              {SERVICE_TYPES.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => update("service_type", opt.value)}
                  className={`rounded-lg border px-4 py-3 text-left text-sm font-medium transition-all ${
                    formData.service_type === opt.value
                      ? "border-teal-500 bg-teal-50 text-teal-700"
                      : "border-gray-200 bg-white text-gray-700 hover:border-teal-300 hover:bg-teal-50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {errors.service_type && (
              <p className="text-xs text-red-500">{errors.service_type}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Where is the issue located?</Label>
            <div className="grid grid-cols-2 gap-2">
              {LOCATIONS.map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => update("location_in_home", loc)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                    formData.location_in_home === loc
                      ? "border-teal-500 bg-teal-50 text-teal-700"
                      : "border-gray-200 bg-white text-gray-700 hover:border-teal-300"
                  }`}
                >
                  {loc}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Step 3: Problem Description ── */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>
              What symptoms are you experiencing? (Select all that apply)
            </Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {SYMPTOMS.map((s) => (
                <div key={s.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`symptom-${s.value}`}
                    checked={formData.symptoms.includes(s.value)}
                    onCheckedChange={() => toggleSymptom(s.value)}
                  />
                  <Label
                    htmlFor={`symptom-${s.value}`}
                    className="cursor-pointer font-normal"
                  >
                    {s.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="problem_description">Describe the problem</Label>
            <Textarea
              id="problem_description"
              value={formData.problem_description}
              onChange={(e) => update("problem_description", e.target.value)}
              placeholder="Water is leaking from under the kitchen sink and there's a stain on the cabinet floor..."
              rows={3}
              className="resize-none"
            />
          </div>
          <div className="space-y-2">
            <Label>How urgent is this? *</Label>
            <div className="space-y-2">
              {URGENCY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => update("urgency", opt.value)}
                  className={`w-full rounded-lg border px-4 py-3 text-left text-sm font-medium transition-all ${
                    formData.urgency === opt.value
                      ? "border-teal-500 bg-teal-50 text-teal-700"
                      : "border-gray-200 bg-white text-gray-700 hover:border-teal-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="is_water_shutoff_needed"
              checked={formData.is_water_shutoff_needed}
              onCheckedChange={(checked) =>
                update("is_water_shutoff_needed", checked === true)
              }
            />
            <Label htmlFor="is_water_shutoff_needed" className="cursor-pointer">
              Water needs to be shut off immediately
            </Label>
          </div>
        </div>
      )}

      {/* ── Step 4: Property Details ── */}
      {step === 4 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Property Type</Label>
            <div className="grid grid-cols-2 gap-3">
              {["residential", "commercial"].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => update("property_type", type)}
                  className={`rounded-lg border px-4 py-3 text-sm font-medium capitalize transition-all ${
                    formData.property_type === type
                      ? "border-teal-500 bg-teal-50 text-teal-700"
                      : "border-gray-200 bg-white text-gray-700 hover:border-teal-300"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="home_age">Age of Property (approx.)</Label>
            <Input
              id="home_age"
              value={formData.home_age}
              onChange={(e) => update("home_age", e.target.value)}
              placeholder="e.g. 15 years, built 2005"
            />
          </div>
          <div className="space-y-2">
            <Label>Water Source</Label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: "city", label: "City / Municipal" },
                { value: "well", label: "Well Water" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => update("water_source", opt.value)}
                  className={`rounded-lg border px-4 py-3 text-sm font-medium transition-all ${
                    formData.water_source === opt.value
                      ? "border-teal-500 bg-teal-50 text-teal-700"
                      : "border-gray-200 bg-white text-gray-700 hover:border-teal-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="has_shutoff_valve_access"
              checked={formData.has_shutoff_valve_access}
              onCheckedChange={(checked) =>
                update("has_shutoff_valve_access", checked === true)
              }
            />
            <Label
              htmlFor="has_shutoff_valve_access"
              className="cursor-pointer"
            >
              I know where my main water shutoff valve is
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="has_home_warranty"
              checked={formData.has_home_warranty}
              onCheckedChange={(checked) =>
                update("has_home_warranty", checked === true)
              }
            />
            <Label htmlFor="has_home_warranty" className="cursor-pointer">
              I have a home warranty
            </Label>
          </div>
        </div>
      )}

      {/* ── Step 5: Scheduling ── */}
      {step === 5 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Preferred Contact Method</Label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: "phone", label: "📞 Phone" },
                { value: "text", label: "💬 Text" },
                { value: "email", label: "📧 Email" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => update("preferred_contact_method", opt.value)}
                  className={`rounded-lg border px-3 py-3 text-sm font-medium transition-all ${
                    formData.preferred_contact_method === opt.value
                      ? "border-teal-500 bg-teal-50 text-teal-700"
                      : "border-gray-200 bg-white text-gray-700 hover:border-teal-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="preferred_time">Preferred Appointment Time</Label>
            <Input
              id="preferred_time"
              value={formData.preferred_time}
              onChange={(e) => update("preferred_time", e.target.value)}
              placeholder="e.g. Weekday mornings, anytime this week"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Anything else we should know?</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="Gate code, parking instructions, pets on property..."
              rows={3}
              className="resize-none"
            />
          </div>
        </div>
      )}
    </LeadFormShell>
  );
}
