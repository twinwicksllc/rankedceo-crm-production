"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { LeadFormShell } from "@/components/industry/lead-form-shell";
import type { ElectricalLeadInput } from "@/lib/validations/industry-lead";

const TOTAL_STEPS = 5;

const SERVICE_TYPES = [
  { value: "panel_upgrade", label: "Panel Upgrade" },
  { value: "outlet_switch", label: "Outlet / Switch" },
  { value: "wiring", label: "Wiring" },
  { value: "lighting", label: "Lighting" },
  { value: "ev_charger", label: "EV Charger Install" },
  { value: "generator", label: "Generator" },
  { value: "inspection", label: "Inspection" },
  { value: "emergency", label: "🚨 Emergency" },
  { value: "other", label: "Other" },
];

const SYMPTOMS = [
  { value: "flickering_lights", label: "Flickering lights" },
  { value: "frequent_trips", label: "Frequently tripping breakers" },
  { value: "burning_smell", label: "Burning smell" },
  { value: "sparks_from_outlet", label: "Sparks from outlet" },
  { value: "partial_power_out", label: "Power outage (partial)" },
  { value: "outlets_not_working", label: "Outlets not working" },
  { value: "buzzing_sounds", label: "Buzzing / humming sounds" },
  { value: "high_electric_bill", label: "High electric bill" },
];

const URGENCY_OPTIONS = [
  {
    value: "emergency",
    label: "🚨 Emergency — Sparks, burning smell, or power out",
  },
  { value: "urgent", label: "⚡ Urgent — Within 24-48 hours" },
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

interface ElectricalLeadFormProps {
  onSubmit: (data: ElectricalLeadInput) => Promise<void>;
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
  panel_type: string;
  symptoms: string[];
  problem_description: string;
  urgency: string;
  is_power_out: boolean;
  property_type: string;
  home_age: string;
  panel_amperage: string;
  num_stories: string;
  permit_needed: boolean;
  preferred_time: string;
  preferred_contact_method: string;
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
  panel_type: "unknown",
  symptoms: [],
  problem_description: "",
  urgency: "scheduled",
  is_power_out: false,
  property_type: "residential",
  home_age: "",
  panel_amperage: "unknown",
  num_stories: "",
  permit_needed: false,
  preferred_time: "",
  preferred_contact_method: "phone",
  notes: "",
};

export function ElectricalLeadForm({
  onSubmit,
  operatorId,
}: ElectricalLeadFormProps) {
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
      const payload: ElectricalLeadInput = {
        operator_id: operatorId ?? null,
        industry: "electrical",
        customer_name: formData.customer_name,
        customer_email: formData.customer_email,
        customer_phone: formData.customer_phone,
        service_address: formData.service_address || undefined,
        city: formData.city || undefined,
        state: formData.state || undefined,
        zip_code: formData.zip_code || undefined,
        urgency: formData.urgency as ElectricalLeadInput["urgency"],
        preferred_contact_method:
          formData.preferred_contact_method as ElectricalLeadInput["preferred_contact_method"],
        preferred_time: formData.preferred_time || undefined,
        notes: formData.notes || undefined,
        service_details: {
          service_type: formData.service_type as
            | "panel_upgrade"
            | "outlet_switch"
            | "wiring"
            | "lighting"
            | "ev_charger"
            | "generator"
            | "inspection"
            | "emergency"
            | "other",
          panel_type: formData.panel_type as
            "circuit_breaker" | "fuse_box" | "unknown",
          symptoms: formData.symptoms,
          is_power_out: formData.is_power_out,
          property_type: formData.property_type as "residential" | "commercial",
          home_age: formData.home_age || undefined,
          panel_amperage: formData.panel_amperage as "100" | "200" | "unknown",
          num_stories: formData.num_stories || undefined,
          permit_needed: formData.permit_needed,
          problem_description: formData.problem_description || undefined,
        },
      };
      await onSubmit(payload);
    } catch (err) {
      console.error("[ElectricalLeadForm] Submission error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <LeadFormShell
      industry="electrical"
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
                placeholder="Phoenix"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={formData.state}
                  onChange={(e) => update("state", e.target.value)}
                  placeholder="AZ"
                  maxLength={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="zip_code">ZIP Code</Label>
                <Input
                  id="zip_code"
                  value={formData.zip_code}
                  onChange={(e) => update("zip_code", e.target.value)}
                  placeholder="85001"
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
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {SERVICE_TYPES.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => update("service_type", opt.value)}
                  className={`rounded-lg border px-3 py-3 text-left text-sm font-medium transition-all ${
                    formData.service_type === opt.value
                      ? "border-amber-500 bg-amber-50 text-amber-700"
                      : "border-gray-200 bg-white text-gray-700 hover:border-amber-300 hover:bg-amber-50"
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
            <Label>Panel Type</Label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: "circuit_breaker", label: "Circuit Breaker" },
                { value: "fuse_box", label: "Fuse Box" },
                { value: "unknown", label: "Don't Know" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => update("panel_type", opt.value)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                    formData.panel_type === opt.value
                      ? "border-amber-500 bg-amber-50 text-amber-700"
                      : "border-gray-200 bg-white text-gray-700 hover:border-amber-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Step 3: Problem Description ── */}
      {step === 3 && (
        <div className="space-y-4">
          {/* Safety alert for emergencies */}
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs text-amber-800 font-medium">
              ⚠️ If you smell burning or see sparks, turn off the breaker to
              that area and call 911 if needed before submitting this form.
            </p>
          </div>
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
            <Label htmlFor="problem_description">Describe the issue</Label>
            <Textarea
              id="problem_description"
              value={formData.problem_description}
              onChange={(e) => update("problem_description", e.target.value)}
              placeholder="Breakers keep tripping in the kitchen and I noticed a burning smell near the panel..."
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
                      ? "border-amber-500 bg-amber-50 text-amber-700"
                      : "border-gray-200 bg-white text-gray-700 hover:border-amber-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="is_power_out"
              checked={formData.is_power_out}
              onCheckedChange={(checked) =>
                update("is_power_out", checked === true)
              }
            />
            <Label htmlFor="is_power_out" className="cursor-pointer">
              I currently have no power (partial or full outage)
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
                      ? "border-amber-500 bg-amber-50 text-amber-700"
                      : "border-gray-200 bg-white text-gray-700 hover:border-amber-300"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="home_age">Age of Property (approx.)</Label>
              <Input
                id="home_age"
                value={formData.home_age}
                onChange={(e) => update("home_age", e.target.value)}
                placeholder="e.g. 40 years, built 1985"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="num_stories">Number of Stories</Label>
              <Input
                id="num_stories"
                value={formData.num_stories}
                onChange={(e) => update("num_stories", e.target.value)}
                placeholder="e.g. 1, 2"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Panel Amperage</Label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: "100", label: "100 Amp" },
                { value: "200", label: "200 Amp" },
                { value: "unknown", label: "Don't Know" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => update("panel_amperage", opt.value)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                    formData.panel_amperage === opt.value
                      ? "border-amber-500 bg-amber-50 text-amber-700"
                      : "border-gray-200 bg-white text-gray-700 hover:border-amber-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="permit_needed"
              checked={formData.permit_needed}
              onCheckedChange={(checked) =>
                update("permit_needed", checked === true)
              }
            />
            <Label htmlFor="permit_needed" className="cursor-pointer">
              I believe a permit may be required for this work
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
                      ? "border-amber-500 bg-amber-50 text-amber-700"
                      : "border-gray-200 bg-white text-gray-700 hover:border-amber-300"
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
