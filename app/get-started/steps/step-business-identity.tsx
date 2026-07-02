"use client";

// =============================================================================
// Step 1: Business Identity
// =============================================================================

import React, { useState, useEffect } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { Step1FormData } from "../onboarding-flow";
import {
  extractAuditPreFillForStep1,
  type AuditPreFillData,
} from "@/lib/waas/actions/onboarding/audit";

const TRADES = [
  "Plumbing",
  "HVAC",
  "Electrical",
  "Roofing",
  "Landscaping",
  "Pest Control",
  "Cleaning Services",
  "Painting",
  "Flooring",
  "General Contractor",
  "Concrete & Masonry",
  "Tree Service",
  "Garage Door",
  "Locksmith",
  "Pool & Spa",
  "Other",
];

interface Props {
  form: UseFormReturn<Step1FormData>;
  onSubmit: (data: Step1FormData) => void;
  isLoading: boolean;
  auditId?: string | null;
}

interface PreFilledFields {
  business_name: boolean;
  city: boolean;
  state: boolean;
  tagline: boolean;
  services_offered: boolean;
}

export function StepBusinessIdentity({
  form,
  onSubmit,
  isLoading,
  auditId,
}: Props) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    setValue,
  } = form;
  const selectedTrade = watch("primary_trade");
  const [showOptionalDetails, setShowOptionalDetails] = useState(false);
  const [auditPreFill, setAuditPreFill] = useState<AuditPreFillData | null>(
    null,
  );
  const [preFilledFields, setPreFilledFields] = useState<PreFilledFields>({
    business_name: false,
    city: false,
    state: false,
    tagline: false,
    services_offered: false,
  });

  // Fetch and apply audit pre-fill data when auditId is available
  useEffect(() => {
    if (!auditId) return;

    const fetchPreFill = async () => {
      try {
        const preFill = await extractAuditPreFillForStep1(auditId);
        setAuditPreFill(preFill);

        // Apply pre-fill values using setValue, marking which fields were pre-filled
        const filled: PreFilledFields = {
          business_name: false,
          city: false,
          state: false,
          tagline: false,
          services_offered: false,
        };

        if (preFill.business_name_guess) {
          setValue("legal_name", preFill.business_name_guess, {
            shouldValidate: true,
          });
          filled.business_name = true;
        }

        if (preFill.city_guess) {
          setValue("city", preFill.city_guess, { shouldValidate: true });
          filled.city = true;
        }

        if (preFill.state_guess) {
          setValue("state", preFill.state_guess, { shouldValidate: true });
          filled.state = true;
        }

        if (preFill.suggested_tagline) {
          setValue("tagline", preFill.suggested_tagline, {
            shouldValidate: true,
          });
          filled.tagline = true;
        }

        if (preFill.services_list && preFill.services_list.length > 0) {
          const servicesList = preFill.services_list.join(", ");
          setValue("services_offered", servicesList, { shouldValidate: true });
          filled.services_offered = true;
        }

        setPreFilledFields(filled);

        // If we filled some optional fields, expand the optional section so user sees them
        if (filled.tagline || filled.services_offered) {
          setShowOptionalDetails(true);
        }
      } catch (err) {
        console.error("Error loading audit pre-fill:", err);
      }
    };

    fetchPreFill();
  }, [auditId, setValue]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 mb-4">
          <span className="text-blue-400 text-xs font-semibold uppercase tracking-wider">
            Step 1 of 4
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white leading-tight">
          Tell us about your business
        </h1>
        <p className="text-slate-500 dark:text-white/50 mt-2 text-sm sm:text-base">
          This forms the foundation of your RankedCEO website.
        </p>
        {auditId && (
          <div className="mt-3 flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="6" stroke="#34D399" strokeWidth="1.5" />
              <path
                d="M4.5 7l2 2 3-3"
                stroke="#34D399"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Linked to your SEO audit report — some fields pre-filled below
          </div>
        )}
      </div>

      {/* Fields */}
      <div className="space-y-5">
        {/* Legal Name */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-white/70">
              Business Legal Name <span className="text-red-400">*</span>
            </label>
            {preFilledFields.business_name && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                From your audit
              </span>
            )}
          </div>
          <input
            {...register("legal_name")}
            type="text"
            placeholder="e.g. Acme Plumbing LLC"
            className={inputClass(!!errors.legal_name)}
            autoFocus
          />
          {errors.legal_name && (
            <p className="mt-1.5 text-xs text-red-400">
              {errors.legal_name.message}
            </p>
          )}
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-white/70 mb-2">
            Your Email Address <span className="text-red-400">*</span>
          </label>
          <input
            {...register("email")}
            type="email"
            placeholder="you@yourbusiness.com"
            className={inputClass(!!errors.email)}
          />
          {errors.email && (
            <p className="mt-1.5 text-xs text-red-400">
              {errors.email.message}
            </p>
          )}
        </div>

        {/* Physical Address */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-white/70 mb-2">
            Business Address <span className="text-red-400">*</span>
          </label>
          <input
            {...register("physical_address")}
            type="text"
            placeholder="123 Main Street"
            className={inputClass(!!errors.physical_address)}
          />
          {errors.physical_address && (
            <p className="mt-1.5 text-xs text-red-400">
              {errors.physical_address.message}
            </p>
          )}
        </div>

        {/* City / State / ZIP */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between gap-2 mb-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-white/70">
                City <span className="text-red-400">*</span>
              </label>
              {preFilledFields.city && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                  From audit
                </span>
              )}
            </div>
            <input
              {...register("city")}
              type="text"
              placeholder="Chicago"
              className={inputClass(!!errors.city)}
            />
            {errors.city && (
              <p className="mt-1.5 text-xs text-red-400">
                {errors.city.message}
              </p>
            )}
          </div>
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-white/70">
                State <span className="text-red-400">*</span>
              </label>
              {preFilledFields.state && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                  From audit
                </span>
              )}
            </div>
            <input
              {...register("state")}
              type="text"
              placeholder="IL"
              maxLength={2}
              className={inputClass(!!errors.state) + " uppercase"}
            />
            {errors.state && (
              <p className="mt-1.5 text-xs text-red-400">
                {errors.state.message}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-white/70 mb-2">
              ZIP <span className="text-red-400">*</span>
            </label>
            <input
              {...register("zip")}
              type="text"
              placeholder="60601"
              maxLength={10}
              className={inputClass(!!errors.zip)}
            />
            {errors.zip && (
              <p className="mt-1.5 text-xs text-red-400">
                {errors.zip.message}
              </p>
            )}
          </div>
        </div>

        {/* Primary Trade */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-white/70 mb-2">
            Primary Trade / Service <span className="text-red-400">*</span>
          </label>
          <select
            {...register("primary_trade")}
            className={inputClass(!!errors.primary_trade) + " cursor-pointer"}
          >
            <option value="">Select your trade…</option>
            {TRADES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          {errors.primary_trade && (
            <p className="mt-1.5 text-xs text-red-400">
              {errors.primary_trade.message}
            </p>
          )}
        </div>

        {selectedTrade === "Other" && (
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-white/70 mb-2">
              Industry Type <span className="text-red-400">*</span>
            </label>
            <input
              {...register("primary_trade_other")}
              type="text"
              placeholder="e.g. Junk Removal"
              className={inputClass(!!errors.primary_trade_other)}
            />
            {errors.primary_trade_other && (
              <p className="mt-1.5 text-xs text-red-400">
                {errors.primary_trade_other.message}
              </p>
            )}
          </div>
        )}

        {/* Optional Details Collapsible Section */}
        <div className="mt-8 pt-6 border-t border-slate-200 dark:border-white/10">
          <button
            type="button"
            onClick={() => setShowOptionalDetails(!showOptionalDetails)}
            className="flex items-center gap-2 text-slate-600 dark:text-white/60 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              className={`transition-transform duration-200 ${showOptionalDetails ? "rotate-90" : ""}`}
            >
              <path
                d="M6 12L10 8L6 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="text-sm font-medium">Optional details</span>
            <span className="text-xs text-slate-400 dark:text-white/40">
              (you can fill these later in your portal)
            </span>
          </button>

          {showOptionalDetails && (
            <div className="mt-5 space-y-5 p-4 rounded-lg bg-slate-50 dark:bg-white/5">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-white/70">
                      Tagline
                    </label>
                    {preFilledFields.tagline && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                        From audit
                      </span>
                    )}
                  </div>
                  <input
                    {...register("tagline")}
                    type="text"
                    placeholder="e.g. Fast, honest service done right"
                    className={inputClass(!!errors.tagline)}
                  />
                  {errors.tagline && (
                    <p className="mt-1.5 text-xs text-red-400">
                      {errors.tagline.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-white/70 mb-2">
                    Business Type
                  </label>
                  <input
                    {...register("business_type")}
                    type="text"
                    placeholder="e.g. Local service business"
                    className={inputClass(!!errors.business_type)}
                  />
                  {errors.business_type && (
                    <p className="mt-1.5 text-xs text-red-400">
                      {errors.business_type.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-white/70 mb-2">
                    Phone Number
                  </label>
                  <input
                    {...register("phone")}
                    type="tel"
                    placeholder="(312) 555-1212"
                    className={inputClass(!!errors.phone)}
                  />
                  {errors.phone && (
                    <p className="mt-1.5 text-xs text-red-400">
                      {errors.phone.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-white/70 mb-2">
                    Business Hours
                  </label>
                  <input
                    {...register("business_hours")}
                    type="text"
                    placeholder="Mon-Fri 8AM-6PM, Sat 9AM-2PM"
                    className={inputClass(!!errors.business_hours)}
                  />
                  {errors.business_hours && (
                    <p className="mt-1.5 text-xs text-red-400">
                      {errors.business_hours.message}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-white/70">
                    Services / Products
                  </label>
                  {preFilledFields.services_offered && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                      From audit
                    </span>
                  )}
                </div>
                <textarea
                  {...register("services_offered")}
                  rows={3}
                  placeholder="List your top services (comma separated), e.g. Drain cleaning, water heater repair, sewer line replacement"
                  className={inputClass(!!errors.services_offered)}
                />
                {errors.services_offered && (
                  <p className="mt-1.5 text-xs text-red-400">
                    {errors.services_offered.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-white/70 mb-2">
                  Target Audience
                </label>
                <input
                  {...register("target_audience")}
                  type="text"
                  placeholder="e.g. Homeowners in Chicago metro"
                  className={inputClass(!!errors.target_audience)}
                />
                {errors.target_audience && (
                  <p className="mt-1.5 text-xs text-red-400">
                    {errors.target_audience.message}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Submit */}
      <div className="mt-8">
        <button
          type="submit"
          disabled={isLoading}
          className="w-full h-14 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-white font-semibold text-base hover:from-blue-500 hover:to-violet-500 transition-all duration-200 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-3"
        >
          {isLoading ? (
            <>
              <svg
                className="animate-spin w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="white"
                  strokeWidth="3"
                  strokeOpacity="0.25"
                />
                <path
                  d="M12 2a10 10 0 0 1 10 10"
                  stroke="white"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
              Saving…
            </>
          ) : (
            <>
              Continue to Domain Selection
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path
                  d="M3.75 9h10.5M9.75 4.5L14.25 9l-4.5 4.5"
                  stroke="white"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </>
          )}
        </button>
      </div>
    </form>
  );
}

function inputClass(hasError: boolean) {
  return `w-full h-12 sm:h-14 px-4 rounded-xl bg-slate-100 dark:bg-white/5 border ${
    hasError
      ? "border-red-500/50 focus:border-red-500"
      : "border-slate-300 dark:border-white/10 focus:border-blue-500/60"
  } text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/25 text-sm sm:text-base outline-none focus:ring-2 ${
    hasError ? "focus:ring-red-500/20" : "focus:ring-blue-500/20"
  } transition-all duration-200 bg-clip-padding [&_option]:bg-white dark:[&_option]:bg-[#0A0F1E] [&_option]:text-slate-900 dark:[&_option]:text-white`;
}
