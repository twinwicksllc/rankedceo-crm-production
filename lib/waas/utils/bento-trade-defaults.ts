// =============================================================================
// WaaS Tier 1: Bento trade-specific default content
//
// Curated fallback card content for the BentoEmergencySection, keyed by the
// exact `primary_trade` string values offered by the onboarding trade picker
// (`app/get-started/steps/step-business-identity.tsx`). Used whenever a
// tenant hasn't customized `content.items` yet, so the emergency bento cards
// reflect trade-specific urgency framing instead of generic copy.
//
// See AEO/Bento audit finding 2.4 — originally only Plumbing, HVAC, and
// Electrical had curated defaults; the remaining 12 trades from the picker
// fell back to generic "default" copy that undercut AEO/answer-engine value.
// =============================================================================

export type BentoItem = {
  icon: string;
  title: string;
  description: string;
};

export const DEFAULT_ITEMS_BY_TRADE: Record<string, BentoItem[]> = {
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
  Roofing: [
    {
      icon: "Leak",
      title: "Active Roof Leak Response",
      description:
        "Emergency tarp-and-seal to stop water intrusion before it spreads.",
    },
    {
      icon: "Storm",
      title: "Storm Damage Assessment",
      description:
        "Fast on-roof inspection for wind, hail, and fallen-limb damage.",
    },
    {
      icon: "Flashing",
      title: "Flashing and Vent Failures",
      description:
        "Targeted repair for the leading causes of hidden ceiling leaks.",
    },
    {
      icon: "Insurance",
      title: "Insurance-Ready Documentation",
      description: "Photo-backed damage reports to support your claim.",
    },
  ],
  Landscaping: [
    {
      icon: "Storm",
      title: "Storm Cleanup Response",
      description:
        "Fallen branches, debris, and downed limbs cleared fast and safely.",
    },
    {
      icon: "Irrigation",
      title: "Irrigation Line Break",
      description:
        "Rapid shutoff and repair to stop water waste and yard flooding.",
    },
    {
      icon: "Hazard",
      title: "Hazard Tree Limb Removal",
      description: "Safe removal of limbs threatening structures or paths.",
    },
    {
      icon: "Seasonal",
      title: "Seasonal Recovery Plan",
      description: "Post-storm turf and bed restoration scheduling.",
    },
  ],
  "Pest Control": [
    {
      icon: "Infestation",
      title: "Active Infestation Response",
      description:
        "Same-day treatment for wasps, rodents, and other urgent pest issues.",
    },
    {
      icon: "Inspection",
      title: "Entry Point Inspection",
      description:
        "Pinpoint how pests are getting in before damage escalates.",
    },
    {
      icon: "Safe",
      title: "Pet and Family-Safe Treatment",
      description: "Application methods reviewed for household safety.",
    },
    {
      icon: "Follow-up",
      title: "Re-Treatment Guarantee",
      description: "Follow-up visits included if activity returns.",
    },
  ],
  "Cleaning Services": [
    {
      icon: "Rapid",
      title: "Same-Day Emergency Cleaning",
      description:
        "Fast turnaround for move-outs, floods, and post-event messes.",
    },
    {
      icon: "Bio",
      title: "Biohazard-Aware Handling",
      description:
        "Trained handling for spills, water damage, and sanitation needs.",
    },
    {
      icon: "Licensed",
      title: "Insured, Background-Checked Crews",
      description: "Vetted teams you can trust in your home or business.",
    },
    {
      icon: "Follow-up",
      title: "Satisfaction Re-Clean",
      description: "Touch-up visit if any area doesn't meet standard.",
    },
  ],
  Painting: [
    {
      icon: "Rapid",
      title: "Water Damage Touch-Up",
      description:
        "Fast repaint response after leaks or moisture staining appears.",
    },
    {
      icon: "Prep",
      title: "Surface Prep and Repair",
      description: "Patch, sand, and prime before every finish coat.",
    },
    {
      icon: "Licensed",
      title: "Low-VOC Material Options",
      description: "Safer paint choices for occupied homes and businesses.",
    },
    {
      icon: "Follow-up",
      title: "Touch-Up Warranty",
      description: "Return visits covered for early finish issues.",
    },
  ],
  Flooring: [
    {
      icon: "Leak",
      title: "Water-Damaged Floor Response",
      description:
        "Rapid assessment and removal to prevent subfloor and mold damage.",
    },
    {
      icon: "Inspection",
      title: "Subfloor Damage Check",
      description: "Moisture and structural inspection before re-install.",
    },
    {
      icon: "Licensed",
      title: "Material-Matched Repairs",
      description: "Seamless patch repairs across hardwood, tile, and vinyl.",
    },
    {
      icon: "Follow-up",
      title: "Post-Install Walkthrough",
      description: "Final inspection to confirm level, secure flooring.",
    },
  ],
  "General Contractor": [
    {
      icon: "Rapid",
      title: "Storm and Structural Damage",
      description:
        "Emergency stabilization for wind, water, or impact damage.",
    },
    {
      icon: "Clear",
      title: "Upfront Project Scope",
      description: "Clear scope, timeline, and cost before work begins.",
    },
    {
      icon: "Licensed",
      title: "Licensed and Permitted Work",
      description: "Code-compliant repairs with proper permitting handled.",
    },
    {
      icon: "Follow-up",
      title: "Post-Repair Walkthrough",
      description: "Final inspection to confirm quality and completion.",
    },
  ],
  "Concrete & Masonry": [
    {
      icon: "Crack",
      title: "Structural Crack Assessment",
      description:
        "Fast inspection of foundation, wall, or slab cracks before they worsen.",
    },
    {
      icon: "Hazard",
      title: "Trip-Hazard Repair",
      description: "Uneven walkway and driveway repair to reduce liability.",
    },
    {
      icon: "Licensed",
      title: "Structural-Grade Materials",
      description: "Mix and reinforcement suited to load-bearing repairs.",
    },
    {
      icon: "Follow-up",
      title: "Cure and Seal Follow-up",
      description: "Post-repair sealing to extend the life of the work.",
    },
  ],
  "Tree Service": [
    {
      icon: "Hazard",
      title: "Hazard Tree Removal",
      description:
        "Urgent removal of leaning, split, or storm-damaged trees.",
    },
    {
      icon: "Storm",
      title: "Storm Debris Response",
      description: "Fast cleanup of fallen limbs and downed trees.",
    },
    {
      icon: "Inspection",
      title: "Risk Assessment",
      description:
        "Certified evaluation of trees near structures and power lines.",
    },
    {
      icon: "Licensed",
      title: "Insured Crane and Climb Crews",
      description: "Properly equipped teams for tall or tight-access jobs.",
    },
  ],
  "Garage Door": [
    {
      icon: "Stuck",
      title: "Stuck or Off-Track Door",
      description:
        "Same-day response for doors that won't open, close, or stay on track.",
    },
    {
      icon: "Spring",
      title: "Broken Spring Replacement",
      description: "Safe, fast replacement of high-tension spring failures.",
    },
    {
      icon: "Lockout",
      title: "Lockout and Opener Failure",
      description: "Restore access when openers or remotes stop working.",
    },
    {
      icon: "Follow-up",
      title: "Safety Sensor Check",
      description: "Full safety inspection included with every repair.",
    },
  ],
  Locksmith: [
    {
      icon: "Lockout",
      title: "Emergency Lockout Response",
      description:
        "Fast, damage-free entry for home, auto, or business lockouts.",
    },
    {
      icon: "Rekey",
      title: "Break-In Rekey Service",
      description: "Immediate rekeying after a break-in or lost key concern.",
    },
    {
      icon: "Licensed",
      title: "Licensed and Bonded Technicians",
      description: "Background-checked locksmiths you can trust with access.",
    },
    {
      icon: "Follow-up",
      title: "Security Upgrade Consult",
      description: "Recommendations to harden entry points after service.",
    },
  ],
  "Pool & Spa": [
    {
      icon: "Leak",
      title: "Active Leak Detection",
      description:
        "Fast leak isolation to stop water and chemical loss.",
    },
    {
      icon: "Equipment",
      title: "Pump and Equipment Failure",
      description: "Urgent diagnostics for pumps, filters, and heaters.",
    },
    {
      icon: "Safe",
      title: "Water Safety Check",
      description: "Chemical balance and safety inspection on urgent calls.",
    },
    {
      icon: "Follow-up",
      title: "Seasonal Service Plan",
      description: "Follow-up maintenance scheduling after repair.",
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

/**
 * Resolve the curated Bento fallback cards for a given trade, falling back
 * to the generic `default` set when the trade has no curated entry (or is
 * null/empty, e.g. before onboarding sets `primary_trade`).
 */
export function getBentoDefaultsForTrade(
  trade: string | null | undefined,
): BentoItem[] {
  if (trade && DEFAULT_ITEMS_BY_TRADE[trade]) {
    return DEFAULT_ITEMS_BY_TRADE[trade];
  }
  return DEFAULT_ITEMS_BY_TRADE.default;
}
