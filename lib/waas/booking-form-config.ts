// =============================================================================
// Settings for the lead form inside the `booking` section (B5).
//
// Stored in the section's `config` so the existing client editor (booleans,
// text, comma lists) and its allow-lists handle it. Every key is optional. A
// site that never set any of them gets the form ON, per the 2026-10-31
// decision for existing tenants; the owner can turn it off in the editor.
// =============================================================================

export const BOOKING_FORM_DEFAULTS = {
  heading: "Send us a message",
  buttonLabel: "Send message",
  successMessage:
    "Thanks! We got your message and will be in touch shortly.",
} as const;

export const MAX_FORM_SERVICES = 8;

export interface BookingFormSettings {
  enabled: boolean;
  heading: string;
  buttonLabel: string;
  successMessage: string;
  /** Choices for the "service" drop-down; empty hides the drop-down. */
  services: string[];
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function asList(value: unknown): string[] {
  const items = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  return items
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter(Boolean)
    .slice(0, MAX_FORM_SERVICES);
}

export function resolveBookingFormSettings(
  config: Record<string, unknown> | null | undefined,
): BookingFormSettings {
  const c = config ?? {};
  return {
    enabled: asBoolean(c.formEnabled, true),
    heading: asString(c.formHeading) ?? BOOKING_FORM_DEFAULTS.heading,
    buttonLabel: asString(c.formButtonLabel) ?? BOOKING_FORM_DEFAULTS.buttonLabel,
    successMessage:
      asString(c.formSuccessMessage) ?? BOOKING_FORM_DEFAULTS.successMessage,
    services: asList(c.formServices),
  };
}

/**
 * How the form behaves for a tenant, decided on the server:
 *  - "live": site is active and the signing token exists -> accepts submissions
 *  - "preview": site is not live yet (owner preview) -> shown, cannot submit
 *  - "off": the owner turned it off, or a live site has no signing secret
 *    (fail closed: never offer a form that cannot be verified)
 */
export type BookingFormMode = "live" | "preview" | "off";

export function bookingFormMode(input: {
  settingsEnabled: boolean;
  tenantStatus: string;
  hasToken: boolean;
}): BookingFormMode {
  if (!input.settingsEnabled) return "off";
  if (input.tenantStatus !== "active") return "preview";
  return input.hasToken ? "live" : "off";
}
