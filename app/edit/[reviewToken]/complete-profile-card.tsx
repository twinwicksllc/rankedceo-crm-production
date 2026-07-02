"use client";

import Link from "next/link";

interface MissingField {
  key: string;
  label: string;
}

interface CompleteProfileCardProps {
  tenantId: string;
  reviewToken: string;
  missingFields: MissingField[];
}

/**
 * Card displayed on portal home to encourage clients to complete optional profile fields.
 * Shows up when at least one optional field is missing.
 */
export function CompleteProfileCard({
  tenantId,
  reviewToken,
  missingFields,
}: CompleteProfileCardProps) {
  if (missingFields.length === 0) return null;

  const fieldsText =
    missingFields.length === 1
      ? missingFields[0].label
      : `${missingFields.length} fields`;

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 mb-5">
      <div className="flex gap-4">
        <div className="shrink-0 flex items-start pt-0.5">
          <span className="text-xl">📝</span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-amber-900 mb-1">
            Complete your profile
          </h3>
          <p className="text-xs text-amber-800 mb-3">
            Add {fieldsText} to make your website more complete and improve SEO.
          </p>
          <div className="space-y-1 mb-3">
            {missingFields.map((field) => (
              <p
                key={field.key}
                className="text-xs text-amber-700 flex items-center gap-1.5"
              >
                <span className="w-1 h-1 rounded-full bg-amber-600 shrink-0" />
                {field.label}
              </p>
            ))}
          </div>
          <Link
            href={`/edit/${reviewToken}?tab=edit`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-medium hover:bg-amber-700 transition-colors"
          >
            Add missing details →
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * Helper to identify missing optional profile fields from tenant data.
 */
export function getMissingProfileFields(
  tenantData: Record<string, unknown>,
): MissingField[] {
  const fields: MissingField[] = [];

  const brandConfig =
    (tenantData.brand_config as Record<string, unknown> | null) ?? {};

  // Check each optional field
  const optionalFields: Array<[string, string]> = [
    ["tagline", "Business tagline"],
    ["phone", "Phone number"],
    ["services_offered", "Services offered"],
    ["business_hours", "Business hours"],
    ["target_audience", "Target audience"],
  ];

  for (const [key, label] of optionalFields) {
    const value = brandConfig[key];
    const isEmpty =
      !value || (typeof value === "string" && value.trim().length === 0);

    if (isEmpty) {
      fields.push({ key, label });
    }
  }

  return fields;
}
