import type {
  HowItWorksSectionContent,
  ResolvedTenant,
} from "@/lib/waas/templates/types";

interface HowItWorksSectionProps {
  tenant: ResolvedTenant;
  content?: HowItWorksSectionContent;
}

export function HowItWorksSection({ tenant, content }: HowItWorksSectionProps) {
  const trade = tenant.primary_trade ?? tenant.target_industry ?? "Service";
  const headline = content?.headline ?? `How Our ${trade} Process Works`;
  const intro =
    content?.intro ??
    "A clear and predictable process from first contact to final walkthrough.";
  const steps = content?.steps ?? [
    {
      title: "Request Service",
      description: "Reach out by phone or online and tell us what you need.",
    },
    {
      title: "Get A Plan",
      description:
        "We confirm scope, timeline, and pricing before work starts.",
    },
    {
      title: "Project Complete",
      description:
        "Our team completes the job and ensures everything is working as expected.",
    },
  ];

  return (
    <section
      className="py-20 px-4 sm:px-6 lg:px-8"
      style={{ backgroundColor: "var(--brand-background)" }}
      aria-label="How it works"
    >
      <div className="max-w-6xl mx-auto">
        {content?.eyebrow && (
          <p
            className="text-xs uppercase tracking-[0.18em] mb-3"
            style={{ color: "var(--brand-primary)" }}
          >
            {content.eyebrow}
          </p>
        )}

        <h2
          className="font-brand-heading text-3xl sm:text-4xl font-bold mb-3"
          style={{ color: "var(--brand-text)" }}
        >
          {headline}
        </h2>
        <p
          className="font-brand-body text-base mb-8"
          style={{ color: "var(--brand-text)", opacity: 0.72 }}
        >
          {intro}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {steps.slice(0, 6).map((step, index) => (
            <div
              key={`${step.title}-${index}`}
              className="rounded-xl border p-5"
              style={{ borderColor: "var(--brand-accent)" }}
            >
              <div
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold mb-3"
                style={{
                  backgroundColor: "var(--brand-primary)",
                  color: "#fff",
                }}
              >
                {index + 1}
              </div>
              <h3
                className="font-brand-heading text-lg font-semibold"
                style={{ color: "var(--brand-text)" }}
              >
                {step.title}
              </h3>
              <p
                className="font-brand-body text-sm mt-2"
                style={{ color: "var(--brand-text)", opacity: 0.72 }}
              >
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
