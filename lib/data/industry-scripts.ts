// ---------------------------------------------------------------------------
// Industry NEBP Scripts — AI Employee Backend Only
// ---------------------------------------------------------------------------
// These scripts are NOT rendered in any operator dashboard UI.
// They are used exclusively by the AI employee backend system for:
//   - Inbound call openers
//   - Discovery question sequences
//   - Appointment booking logic
// ---------------------------------------------------------------------------

export type IndustryType = "hvac" | "plumbing" | "electrical";

export interface IndustryScript {
  industry: IndustryType;
  inbound_opener: string;
  discovery_questions: string[];
  appointment_booking_logic: AppointmentBookingLogic;
  objection_handlers: ObjectionHandler[];
}

export interface AppointmentBookingLogic {
  emergency: string;
  urgent: string;
  scheduled: string;
  estimate_only: string;
}

export interface ObjectionHandler {
  objection: string;
  response: string;
}

// ---------------------------------------------------------------------------
// HVAC Pro Scripts
// ---------------------------------------------------------------------------

const hvacScript: IndustryScript = {
  industry: "hvac",

  inbound_opener:
    "Hi, this is [Name] calling from [Company]. I'm reaching out because you recently submitted a service request for your HVAC system. I wanted to make sure we get you taken care of quickly — can I ask, is this something that's affecting your comfort right now, or are you looking to get ahead of it before the season changes?",

  discovery_questions: [
    "How old is your current system?",
    "Have you noticed any unusual sounds, smells, or changes in your energy bill?",
    "Is this your primary residence or a rental or commercial property?",
    "Have you had any previous work done on this system?",
    "What's most important to you — getting it fixed fast, or finding the most cost-effective solution?",
  ],

  appointment_booking_logic: {
    emergency:
      "I completely understand — let me check our same-day availability right now. We have a technician who can be there [time slot]. Does that work for you? If not, our next available is [next slot].",
    urgent:
      "Given what you're describing, I'd like to get someone out to you within the next 48 hours. I have openings on [day 1] at [time] or [day 2] at [time]. Which works better for your schedule?",
    scheduled:
      "Great — let me find a time that works for you. I have availability on [day 1], [day 2], or [day 3]. Do any of those work? We can do morning or afternoon.",
    estimate_only:
      "Absolutely — we offer free estimates. I can have someone out within 48 hours to take a look and give you an accurate quote with no obligation. Would [day] or [day] work for you?",
  },

  objection_handlers: [
    {
      objection: "I'm going to get a few more quotes first.",
      response:
        "That's completely fair — we encourage that. I'll tell you, most customers who compare us end up choosing us because of our response time and warranty. Can I ask what's most important to you in choosing a company?",
    },
    {
      objection: "How much is this going to cost?",
      response:
        "Great question — I don't want to give you a number without seeing the system first. That's why we offer a free diagnostic visit. Once our tech takes a look, we'll give you a written quote before any work begins. No surprises.",
    },
    {
      objection: "I need to talk to my spouse first.",
      response:
        "Of course — I completely understand. Would it help if I sent over some information you could share with them? And I can hold a time slot for 24 hours if you'd like to lock something in while you chat.",
    },
  ],
};

// ---------------------------------------------------------------------------
// Plumb Pro Scripts
// ---------------------------------------------------------------------------

const plumbingScript: IndustryScript = {
  industry: "plumbing",

  inbound_opener:
    "Hi, this is [Name] from [Company]. I'm following up on your plumbing service request. I want to make sure we get someone out to you quickly — can you tell me, is there any active water damage happening right now, or has the situation stabilized?",

  discovery_questions: [
    "Where exactly is the issue located — kitchen, bathroom, basement, or outside?",
    "Is there any visible water damage or standing water?",
    "Do you know where your main water shutoff valve is?",
    "How long has this been going on?",
    "Is this a rental property or your own home?",
  ],

  appointment_booking_logic: {
    emergency:
      "If there's active water damage, I want to get someone to you immediately. Let me check our emergency dispatch — we have a plumber available [time]. Can I send them over now? In the meantime, if you can locate your main shutoff valve, turning it off will help prevent further damage.",
    urgent:
      "I want to get this resolved for you quickly. I have availability tomorrow at [time] or the day after at [time]. Which works better? Our plumber will call 30 minutes before arriving.",
    scheduled:
      "No problem — let's get you on the schedule. I have openings on [day 1], [day 2], or [day 3]. Morning or afternoon tends to work best for most customers — do you have a preference?",
    estimate_only:
      "We'd be happy to come out and take a look at no charge. I can have someone there within 48 hours to assess the situation and give you a written estimate. Would [day] or [day] work?",
  },

  objection_handlers: [
    {
      objection: "I'm going to try to fix it myself first.",
      response:
        "I totally respect that — a lot of our customers are handy. Just keep in mind that some plumbing issues can get worse quickly if the root cause isn't addressed. If you run into any trouble, we're here. Can I give you our direct line?",
    },
    {
      objection: "Do you charge for the estimate?",
      response:
        "No — our estimates are completely free. We come out, assess the situation, and give you a written quote before any work begins. You're never obligated to proceed.",
    },
    {
      objection: "I had a bad experience with a plumber before.",
      response:
        "I'm sorry to hear that — unfortunately that happens in our industry. I can tell you that we're licensed, insured, and all our work comes with a written warranty. We also do background checks on all our technicians. Would you like me to send over some customer reviews?",
    },
  ],
};

// ---------------------------------------------------------------------------
// Spark Pro Scripts
// ---------------------------------------------------------------------------

const electricalScript: IndustryScript = {
  industry: "electrical",

  inbound_opener:
    "Hi, this is [Name] from [Company]. I'm calling about your electrical service request. Safety is our top priority — can I ask, is everything currently safe in your home, or are you experiencing any flickering lights, burning smells, or tripped breakers that won't reset?",

  discovery_questions: [
    "Is this a safety concern or more of an upgrade or improvement project?",
    "How old is your electrical panel?",
    "Are you experiencing any flickering lights or frequently tripping breakers?",
    "Is this for a residential home or commercial property?",
    "Do you know the amperage of your current panel — is it 100 amp or 200 amp?",
  ],

  appointment_booking_logic: {
    emergency:
      "If you're smelling burning or seeing sparks, I want you to turn off the breaker to that area if it's safe to do so, and I'm dispatching a licensed electrician to you right now. We have someone available [time]. Is that address [address from form]?",
    urgent:
      "Flickering lights and tripping breakers can be a sign of a larger issue — I'd like to get someone out to you within 24 to 48 hours. I have availability [day 1] at [time] or [day 2] at [time]. Which works for you?",
    scheduled:
      "Great — let's get you on the calendar. I have openings on [day 1], [day 2], or [day 3]. Our electricians typically give a 2-hour arrival window. Morning or afternoon?",
    estimate_only:
      "We offer free estimates on all projects. I can have a licensed electrician out within 48 hours to assess the work and give you a detailed written quote. Would [day] or [day] work?",
  },

  objection_handlers: [
    {
      objection: "Is this going to require a permit?",
      response:
        "Great question — it depends on the scope of work. Our electrician will let you know during the estimate whether a permit is required. If it is, we handle the entire permit process for you. It's included in our quote.",
    },
    {
      objection: "I want to get another quote.",
      response:
        "Absolutely — that's smart. Just make sure whoever you're comparing us to is licensed and insured. We're happy to match competitive quotes from licensed contractors. What's most important to you — price, speed, or warranty?",
    },
    {
      objection: "Can I just do it myself?",
      response:
        "For small things like replacing a light switch, sure. But for panel work, new circuits, or anything involving your main service, most jurisdictions require a licensed electrician and a permit. Unpermitted electrical work can also affect your homeowner's insurance. Happy to explain what's required for your specific project.",
    },
  ],
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const INDUSTRY_SCRIPTS: Record<IndustryType, IndustryScript> = {
  hvac: hvacScript,
  plumbing: plumbingScript,
  electrical: electricalScript,
};

/**
 * Get the script for a specific industry.
 */
export function getIndustryScript(industry: IndustryType): IndustryScript {
  return INDUSTRY_SCRIPTS[industry];
}
