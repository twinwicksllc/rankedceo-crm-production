"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { LeadFormShell } from "@/components/industry/lead-form-shell";
import type { HvacLeadInput } from "@/lib/validations/industry-lead";

const TOTAL_STEPS = 5;

const SERVICE_TYPES = [
  { value: "ac_repair", label: "AC Repair" },
  { value: "heating_repair", label: "Heating Repair" },
  { value: "installation", label: "New Installation" },
  { value: "maintenance", label: "Maintenance / Tune-up" },
  { value: "duct_cleaning", label: "Duct Cleaning" },
  { value: "thermostat", label: "Thermostat Issue" },
  { value: "other", label: "Other" },
];

const SYMPTOMS = [
  { value: "not_cooling", label: "Not cooling" },
  { value: "not_heating", label: "Not heating" },
  { value: "strange_noise", label: "Strange noise" },
  { value: "bad_smell", label: "Bad smell" },
  { value: "high_energy_bill", label: "High energy bill" },
  { value: "leaking_water", label: "Leaking water" },
  { value: "thermostat_issues", label: "Thermostat issues" },
  { value: "uneven_temperatures", label: "Uneven temperatures" },
  { value: "wont_turn_on", label: "System won't turn on" },
];

const URGENCY_OPTIONS = [
  { value: "emergency", label: "🚨 Emergency — Need help ASAP" },
  { value: "urgent", label: "⚡ Urgent — Within 48 hours" },
  { value: "scheduled", label: "📅 Scheduled — Flexible timing" },
  { value: "estimate_only", label: "💬 Estimate Only — Just a quote" },
];

const STEP_TITLES = [
  "Contact Information",
  "Service Type",
  "Problem Description",
  "Property Details",
  "Scheduling",
];

interface HvacLeadFormProps {
  onSubmit: (data: HvacLeadInput) => Promise<void>;
  operatorId?: string;
}

type FormData = {
  // Step 1
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  service_address: string;
  city: string;
  state: string;
  zip_code: string;
  // Step 2
  service_type: string;
  system_age: string;
  system_brand: string;
  // Step 3
  symptoms: string[];
  problem_description: string;
  urgency: string;
  last_service_date: string;
  // Step 4
  property_type: string;
  square_footage: string;
  num_units: string;
  // Step 5
  preferred_time: string;
  preferred_contact_method: string;
  has_warranty: boolean;
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
  system_age: "",
  system_brand: "",
  symptoms: [],
  problem_description: "",
  urgency: "scheduled",
  last_service_date: "",
  property_type: "residential",
  square_footage: "",
  num_units: "",
  preferred_time: "",
  preferred_contact_method: "phone",
  has_warranty: false,
  notes: "",
};

export function HvacLeadForm({ onSubmit, operatorId }: HvacLeadFormProps) {
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
    if (s === 3) {
      if (!formData.urgency) newErrors.urgency = "Please select urgency";
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
      const payload: HvacLeadInput = {
        operator_id: operatorId ?? null,
        industry: "hvac",
        customer_name: formData.customer_name,
        customer_email: formData.customer_email,
        customer_phone: formData.customer_phone,
        service_address: formData.service_address || undefined,
        city: formData.city || undefined,
        state: formData.state || undefined,
        zip_code: formData.zip_code || undefined,
        urgency: formData.urgency as HvacLeadInput["urgency"],
        preferred_contact_method:
          formData.preferred_contact_method as HvacLeadInput["preferred_contact_method"],
        preferred_time: formData.preferred_time || undefined,
        notes: formData.notes || undefined,
        service_details: {
          service_type: formData.service_type as
            | "ac_repair"
            | "heating_repair"
            | "installation"
            | "maintenance"
            | "duct_cleaning"
            | "thermostat"
            | "other",
          system_age: formData.system_age || undefined,
          system_brand: formData.system_brand || undefined,
          symptoms: formData.symptoms,
          property_type: formData.property_type as "residential" | "commercial",
          square_footage: formData.square_footage || undefined,
          num_units: formData.num_units || undefined,
          has_warranty: formData.has_warranty,
          last_service_date: formData.last_service_date || undefined,
          problem_description: formData.problem_description || undefined,
        },
      };
      await onSubmit(payload);
    } catch (err) {
      console.error("[HvacLeadForm] Submission error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <LeadFormShell
      industry="hvac"
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
                placeholder="Dallas"
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
                  placeholder="75001"
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
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {SERVICE_TYPES.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => update("service_type", opt.value)}
                  className={`rounded-lg border px-4 py-3 text-left text-sm font-medium transition-all ${
                    formData.service_type === opt.value
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50"
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
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="system_age">System Age (approx.)</Label>
              <Input
                id="system_age"
                value={formData.system_age}
                onChange={(e) => update("system_age", e.target.value)}
                placeholder="e.g. 8 years"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="system_brand">System Brand</Label>
              <Input
                id="system_brand"
                value={formData.system_brand}
                onChange={(e) => update("system_brand", e.target.value)}
                placeholder="e.g. Carrier, Trane, Lennox"
              />
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
            <Label htmlFor="problem_description">
              Describe the problem in your own words
            </Label>
            <Textarea
              id="problem_description"
              value={formData.problem_description}
              onChange={(e) => update("problem_description", e.target.value)}
              placeholder="My AC stopped cooling yesterday and is making a rattling sound..."
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
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 bg-white text-gray-700 hover:border-blue-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="last_service_date">
              When was the last service?
            </Label>
            <Input
              id="last_service_date"
              value={formData.last_service_date}
              onChange={(e) => update("last_service_date", e.target.value)}
              placeholder="e.g. 2 years ago, never"
            />
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
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 bg-white text-gray-700 hover:border-blue-300"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="square_footage">Square Footage (approx.)</Label>
              <Input
                id="square_footage"
                value={formData.square_footage}
                onChange={(e) => update("square_footage", e.target.value)}
                placeholder="e.g. 2000 sq ft"
              />
            </div>
            {formData.property_type === "commercial" && (
              <div className="space-y-2">
                <Label htmlFor="num_units">Number of Units</Label>
                <Input
                  id="num_units"
                  value={formData.num_units}
                  onChange={(e) => update("num_units", e.target.value)}
                  placeholder="e.g. 4"
                />
              </div>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="has_warranty"
              checked={formData.has_warranty}
              onCheckedChange={(checked) =>
                update("has_warranty", checked === true)
              }
            />
            <Label htmlFor="has_warranty" className="cursor-pointer">
              My system is still under warranty
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
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 bg-white text-gray-700 hover:border-blue-300"
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
