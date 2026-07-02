// =============================================================================
// WaaS Tier 1: BentoEmergencySection (Server Component)
// Mobile-first bento layout with an always-available Emergency Toggle CTA.
// =============================================================================

import type {
  BentoEmergencySectionContent,
  ResolvedTenant,
  SectionConfig,
} from "@/lib/waas/templates/types";

interface BentoEmergencySectionProps {
  tenant: ResolvedTenant;
  config: SectionConfig["config"];
  content?: BentoEmergencySectionContent;
}

type BentoItem = {
  icon: string;
  title: string;
  description: string;
};

type VisualDirection = "signal" | "calm" | "warm" | "premium" | "showcase";

type VisualPreset = {
  atmosphere: string;
  cardSurface: string;
  cardBorder: string;
  toggleSurface: string;
  idleCta: string;
  emergencyCta: string;
};

const VISUAL_PRESETS: Record<VisualDirection, VisualPreset> = {
  signal: {
    atmosphere:
      "radial-gradient(circle at 8% 14%, rgba(248, 113, 113, 0.28) 0, transparent 38%), radial-gradient(circle at 92% 88%, rgba(239, 68, 68, 0.26) 0, transparent 35%), linear-gradient(135deg, rgba(15, 23, 42, 0.03) 0%, rgba(255, 255, 255, 0.06) 100%)",
    cardSurface: "rgba(255,255,255,0.94)",
    cardBorder: "rgba(239, 68, 68, 0.24)",
    toggleSurface: "rgba(255,255,255,0.98)",
    idleCta: "#0f766e",
    emergencyCta: "#dc2626",
  },
  calm: {
    atmosphere:
      "radial-gradient(circle at 12% 18%, rgba(56, 189, 248, 0.22) 0, transparent 38%), radial-gradient(circle at 88% 84%, rgba(14, 116, 144, 0.2) 0, transparent 36%), linear-gradient(120deg, rgba(240, 249, 255, 0.7) 0%, rgba(255, 255, 255, 0.6) 100%)",
    cardSurface: "rgba(255,255,255,0.92)",
    cardBorder: "rgba(14, 116, 144, 0.2)",
    toggleSurface: "rgba(255,255,255,0.98)",
    idleCta: "#0369a1",
    emergencyCta: "#0284c7",
  },
  warm: {
    atmosphere:
      "radial-gradient(circle at 10% 15%, rgba(251, 191, 36, 0.25) 0, transparent 40%), radial-gradient(circle at 90% 86%, rgba(249, 115, 22, 0.22) 0, transparent 34%), linear-gradient(125deg, rgba(255, 251, 235, 0.8) 0%, rgba(255, 255, 255, 0.5) 100%)",
    cardSurface: "rgba(255,255,255,0.92)",
    cardBorder: "rgba(249, 115, 22, 0.22)",
    toggleSurface: "rgba(255,252,244,0.98)",
    idleCta: "#b45309",
    emergencyCta: "#ea580c",
  },
  premium: {
    atmosphere:
      "radial-gradient(circle at 14% 18%, rgba(168, 85, 247, 0.2) 0, transparent 36%), radial-gradient(circle at 86% 84%, rgba(30, 41, 59, 0.24) 0, transparent 35%), linear-gradient(140deg, rgba(248, 250, 252, 0.7) 0%, rgba(226, 232, 240, 0.45) 100%)",
    cardSurface: "rgba(255,255,255,0.92)",
    cardBorder: "rgba(100, 116, 139, 0.24)",
    toggleSurface: "rgba(248,250,252,0.98)",
    idleCta: "#1d4ed8",
    emergencyCta: "#7c3aed",
  },
  showcase: {
    atmosphere:
      "radial-gradient(circle at 6% 18%, rgba(34, 197, 94, 0.2) 0, transparent 36%), radial-gradient(circle at 94% 82%, rgba(16, 185, 129, 0.2) 0, transparent 34%), linear-gradient(130deg, rgba(236, 253, 245, 0.65) 0%, rgba(255, 255, 255, 0.5) 100%)",
    cardSurface: "rgba(255,255,255,0.92)",
    cardBorder: "rgba(16, 185, 129, 0.22)",
    toggleSurface: "rgba(255,255,255,0.98)",
    idleCta: "#047857",
    emergencyCta: "#059669",
  },
};

const DEFAULT_ITEMS_BY_TRADE: Record<string, BentoItem[]> = {
  Plumbing: [
    {
      icon: "Leak",
      title: "Burst Pipe Repair",
      description:
        "Fast isolation, pressure stabilization, and clean restoration plan.",
    },
    {
      icon: "Drain",
      title: "Drain Blockage Removal",
      description:
        "Hydro-jet capable response for severe kitchen and mainline clogs.",
    },
    {
      icon: "Heater",
      title: "Water Heater Diagnostics",
      description: "Gas and electric systems, with same-visit safety checks.",
    },
    {
      icon: "Sewer",
      title: "Sewer Line Camera Scan",
      description: "Pinpoint root cause before full repair to reduce downtime.",
    },
  ],
  HVAC: [
    {
      icon: "Cooling",
      title: "No-Cool Emergency",
      description:
        "Rapid AC diagnostics for compressor, capacitor, and airflow issues.",
    },
    {
      icon: "Heating",
      title: "No-Heat Emergency",
      description:
        "System-safe startup and failure isolation for urgent calls.",
    },
    {
      icon: "Airflow",
      title: "Airflow Failure",
      description:
        "Static pressure checks and duct-path triage for quick recovery.",
    },
    {
      icon: "Thermostat",
      title: "Control Failure",
      description:
        "Thermostat and control board checks with replacement options.",
    },
  ],
  Electrical: [
    {
      icon: "Panel",
      title: "Panel Fault Triage",
      description:
        "Hot breaker, trip-loop, and feeder checks with safety-first workflow.",
    },
    {
      icon: "Circuit",
      title: "Dead Circuit Restore",
      description:
        "Targeted circuit tracing to restore critical rooms quickly.",
    },
    {
      icon: "Outlet",
      title: "Outlet and Switch Safety",
      description: "Arc and heat diagnostics for urgent hazards and failures.",
    },
    {
      icon: "Backup",
      title: "Backup Power Readiness",
      description: "Generator and transfer checks during outage conditions.",
    },
  ],
  default: [
    {
      icon: "Rapid",
      title: "Priority Dispatch",
      description: "Priority queue handling for urgent service interruptions.",
    },
    {
      icon: "Clear",
      title: "Upfront Scope",
      description: "Clear scope before work starts with practical options.",
    },
    {
      icon: "Licensed",
      title: "Licensed Team",
      description:
        "Qualified technicians with documented process and safety checks.",
    },
    {
      icon: "Follow-up",
      title: "After-Service Follow-up",
      description: "Post-repair verification to confirm stable performance.",
    },
  ],
};

function readConfigString(
  config: SectionConfig["config"],
  key: string,
  fallback: string,
): string {
  const value = config[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function readConfigNumber(
  config: SectionConfig["config"],
  key: string,
  fallback: number,
): number {
  const value = config[key];
  if (typeof value === "number" && Number.isFinite(value) && value > 0)
    return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return fallback;
}

function readConfigStringArray(
  config: SectionConfig["config"],
  key: string,
  fallback: string[],
): string[] {
  const value = config[key];
  if (Array.isArray(value)) {
    const fromArray = value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
    if (fromArray.length > 0) return fromArray;
  }

  if (typeof value === "string" && value.trim()) {
    const fromCsv = value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    if (fromCsv.length > 0) return fromCsv;
  }

  return fallback;
}

export function BentoEmergencySection({
  tenant,
  config,
  content,
}: BentoEmergencySectionProps) {
  const trade = tenant.primary_trade ?? tenant.target_industry ?? "default";
  const fallbackItems =
    DEFAULT_ITEMS_BY_TRADE[trade] ?? DEFAULT_ITEMS_BY_TRADE.default;

  const itemCards: BentoItem[] = content?.items?.length
    ? content.items.map((item) => ({
        icon: item.icon ?? "Service",
        title: item.title,
        description:
          item.description ??
          "Fast, practical support from a trained local technician.",
      }))
    : fallbackItems;

  const businessName =
    tenant.brand_config.business_name ||
    tenant.legal_name ||
    "Local Service Team";
  const phoneRaw = tenant.brand_config.contact.phone ?? "";
  const phoneDigits = phoneRaw.replace(/\D/g, "");

  const responseMinutes = readConfigNumber(config, "responseMinutes", 45);
  const dispatchFee = readConfigNumber(config, "dispatchFee", 89);
  const visualDirectionRaw = readConfigString(
    config,
    "visualDirection",
    "signal",
  );
  const visualDirection = (
    ["signal", "calm", "warm", "premium", "showcase"] as const
  ).includes(visualDirectionRaw as VisualDirection)
    ? (visualDirectionRaw as VisualDirection)
    : "signal";
  const preset = VISUAL_PRESETS[visualDirection];

  const emergencyLabel = readConfigString(
    config,
    "emergencyLabel",
    "Emergency Mode ON",
  );
  const standardLabel = readConfigString(
    config,
    "standardLabel",
    "Standard Dispatch",
  );
  const operatingHours = readConfigString(
    config,
    "operatingHours",
    "24/7 Priority Support",
  );
  const serviceArea = readConfigString(
    config,
    "serviceArea",
    tenant.target_location
      ? `Serving ${tenant.target_location}`
      : "Serving your local area",
  );
  const brands = readConfigStringArray(config, "brands", [
    "Carrier",
    "Trane",
    "Rheem",
    "Lennox",
  ]);

  const eyebrow = content?.eyebrow ?? "Tier 1 Emergency Service";
  const headline = content?.headline ?? `Mobile-First ${trade} Response Grid`;
  const subheadline =
    content?.subheadline ??
    `Get clear triage, priority routing, and a direct call path in one screen. ${businessName} keeps urgent requests simple and actionable.`;
  const bottomCtaText =
    content?.bottomCtaText ??
    "Emergency lane gives you priority dispatch and live triage.";
  const toggleId = `emergency-toggle-${tenant.id.replace(/[^a-zA-Z0-9_-]/g, "") || "site"}`;

  return (
    <section
      className="relative overflow-hidden px-4 py-10 sm:px-6 lg:px-8"
      style={{ backgroundColor: "var(--brand-background)" }}
      aria-label="Emergency service bento"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-100"
        style={{
          background: preset.atmosphere,
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "linear-gradient(to right, transparent 0%, transparent 48%, rgba(15,23,42,0.08) 49%, transparent 51%, transparent 100%)",
          backgroundSize: "38px 38px",
        }}
      />

      <div className="relative mx-auto max-w-6xl">
        <header
          className="mb-6 bento-reveal"
          style={{ animationDelay: "40ms" }}
        >
          <p
            className="inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider"
            style={{
              backgroundColor: "var(--brand-accent)",
              color: "var(--brand-primary)",
              boxShadow: "0 10px 24px rgba(15,23,42,0.08)",
            }}
          >
            {eyebrow}
          </p>
          <h2
            className="mt-3 font-brand-heading text-3xl font-bold leading-tight sm:text-4xl"
            style={{ color: "var(--brand-text)" }}
          >
            {headline}
          </h2>
          <p
            className="mt-3 max-w-3xl font-brand-body text-base sm:text-lg"
            style={{ color: "var(--brand-text)", opacity: 0.78 }}
          >
            {subheadline}
          </p>
        </header>

        <div
          className="mb-5 grid gap-4 rounded-2xl border p-4 bento-reveal"
          style={{
            borderColor: preset.cardBorder,
            backgroundColor: preset.cardSurface,
            boxShadow: "0 16px 45px rgba(15,23,42,0.08)",
            animationDelay: "110ms",
          }}
        >
          <p
            className="font-brand-heading text-base font-semibold"
            style={{ color: "var(--brand-text)" }}
          >
            Answer-First Snapshot
          </p>
          <p
            className="font-brand-body text-sm"
            style={{ color: "var(--brand-text)", opacity: 0.8 }}
          >
            Need urgent help now? Typical response window is about{" "}
            {responseMinutes} minutes in core zones, with an initial dispatch
            fee of ${dispatchFee}. Call once and get direct triage, service
            priority, and the soonest technician slot.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {itemCards.map((item, index) => (
            <article
              key={item.title}
              className={`rounded-2xl border p-4 bento-reveal ${index === 0 ? "sm:col-span-2 lg:col-span-3" : "lg:col-span-2"}`}
              style={{
                borderColor: preset.cardBorder,
                backgroundColor: preset.cardSurface,
                boxShadow: "0 14px 35px rgba(15,23,42,0.08)",
                animationDelay: `${160 + index * 80}ms`,
              }}
            >
              <p
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: "var(--brand-primary)" }}
              >
                {item.icon}
              </p>
              <h3
                className="mt-2 font-brand-heading text-lg font-semibold"
                style={{ color: "var(--brand-text)" }}
              >
                {item.title}
              </h3>
              <p
                className="mt-2 font-brand-body text-sm"
                style={{ color: "var(--brand-text)", opacity: 0.75 }}
              >
                {item.description}
              </p>
            </article>
          ))}

          <article
            className="rounded-2xl border p-4 sm:col-span-2 lg:col-span-3 bento-reveal"
            style={{
              borderColor: preset.cardBorder,
              backgroundColor: preset.cardSurface,
              boxShadow: "0 14px 35px rgba(15,23,42,0.08)",
              animationDelay: "520ms",
            }}
          >
            <h3
              className="font-brand-heading text-lg font-semibold"
              style={{ color: "var(--brand-text)" }}
            >
              Dispatch Facts
            </h3>
            <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt
                  className="font-semibold"
                  style={{ color: "var(--brand-primary)" }}
                >
                  Response Window
                </dt>
                <dd style={{ color: "var(--brand-text)", opacity: 0.8 }}>
                  ~{responseMinutes} min
                </dd>
              </div>
              <div>
                <dt
                  className="font-semibold"
                  style={{ color: "var(--brand-primary)" }}
                >
                  Dispatch Fee
                </dt>
                <dd style={{ color: "var(--brand-text)", opacity: 0.8 }}>
                  ${dispatchFee}
                </dd>
              </div>
              <div>
                <dt
                  className="font-semibold"
                  style={{ color: "var(--brand-primary)" }}
                >
                  Hours
                </dt>
                <dd style={{ color: "var(--brand-text)", opacity: 0.8 }}>
                  {operatingHours}
                </dd>
              </div>
            </dl>
          </article>

          <article
            className="rounded-2xl border p-4 sm:col-span-2 lg:col-span-3 bento-reveal"
            style={{
              borderColor: preset.cardBorder,
              backgroundColor: preset.cardSurface,
              boxShadow: "0 14px 35px rgba(15,23,42,0.08)",
              animationDelay: "600ms",
            }}
          >
            <h3
              className="font-brand-heading text-lg font-semibold"
              style={{ color: "var(--brand-text)" }}
            >
              Brands and Coverage
            </h3>
            <p
              className="mt-2 text-sm"
              style={{ color: "var(--brand-text)", opacity: 0.75 }}
            >
              {serviceArea}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {brands.map((brand) => (
                <span
                  key={brand}
                  className="rounded-full border px-2.5 py-1 text-xs font-semibold"
                  style={{
                    borderColor: "var(--brand-accent)",
                    color: "var(--brand-text)",
                  }}
                >
                  {brand}
                </span>
              ))}
            </div>
          </article>
        </div>

        <p
          className="mt-4 text-sm font-medium bento-reveal"
          style={{
            color: "var(--brand-text)",
            opacity: 0.72,
            animationDelay: "700ms",
          }}
        >
          {bottomCtaText}
        </p>
      </div>

      {/* Pure CSS state toggle keeps this interaction responsive without client JS. */}
      <div className="fixed bottom-4 left-1/2 z-50 w-[min(92vw,420px)] -translate-x-1/2">
        <input id={toggleId} type="checkbox" className="peer sr-only" />

        <div
          className="rounded-2xl border p-3 shadow-2xl"
          style={{
            borderColor: preset.cardBorder,
            backgroundColor: preset.toggleSurface,
          }}
        >
          <div className="mb-2 flex items-center justify-between gap-3">
            <p
              className="text-sm font-semibold"
              style={{ color: "var(--brand-text)" }}
            >
              Emergency Toggle
            </p>
            <label
              htmlFor={toggleId}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full border px-2 py-1 text-xs font-semibold"
              style={{
                borderColor: preset.cardBorder,
                color: "var(--brand-text)",
              }}
            >
              <span
                aria-hidden="true"
                className="relative h-4 w-8 rounded-full"
                style={{ backgroundColor: "rgba(15,23,42,0.18)" }}
              >
                <span className="absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-white transition-transform duration-200 peer-checked:translate-x-4" />
              </span>
              <span className="peer-checked:hidden">{standardLabel}</span>
              <span className="hidden peer-checked:inline">
                {emergencyLabel}
              </span>
            </label>
          </div>

          {phoneDigits ? (
            <>
              <a
                href={`tel:${phoneDigits}`}
                className="flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold text-white peer-checked:hidden"
                style={{ backgroundColor: preset.idleCta }}
                aria-label={`Call ${businessName}`}
              >
                Call {phoneRaw || "Now"}
              </a>

              <a
                href={`tel:${phoneDigits}`}
                className="hidden w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold text-white peer-checked:flex"
                style={{ backgroundColor: preset.emergencyCta }}
                aria-label={`Emergency call ${businessName}`}
              >
                Emergency Call - Priority Queue
              </a>

              <p className="mt-2 text-center text-[11px] text-rose-700 hidden peer-checked:block">
                Priority lane active. Dispatcher routes your request first.
              </p>
            </>
          ) : (
            <p
              className="rounded-xl border px-3 py-2 text-center text-xs"
              style={{
                borderColor: preset.cardBorder,
                color: "var(--brand-text)",
              }}
            >
              Add a business phone number to activate one-tap emergency calling.
            </p>
          )}
        </div>
      </div>

      <style>{`
        @keyframes bento-rise {
          0% {
            opacity: 0;
            transform: translateY(16px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .bento-reveal {
          opacity: 0;
          animation: bento-rise 520ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }

        @media (prefers-reduced-motion: reduce) {
          .bento-reveal {
            animation: none;
            opacity: 1;
            transform: none;
          }
        }
      `}</style>
    </section>
  );
}
