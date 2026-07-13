"use client";

import { useEffect, useMemo, useReducer, useRef } from "react";
import {
  AlertTriangle,
  Bot,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  Droplets,
  Flame,
  Loader2,
  MessageCircle,
  ShieldAlert,
  Sparkles,
  X,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IndustryLogo } from "@/components/ui/industry-logo";
import type {
  AppointmentSource,
  CalendlyAvailableSlot,
  CalendlyEventType,
  AgentMessage,
} from "@/lib/types/appointment";

interface AgenticTriageChatbotProps {
  source: AppointmentSource;
  accountId?: string;
  primaryColor?: string;
  position?: "bottom-right" | "bottom-left";
  companyName?: string;
  referralSource?: string;
}

type TriageStage =
  | "issue"
  | "severity"
  | "contact"
  | "calendar"
  | "slots"
  | "booking"
  | "success";
type SeverityLevel = "critical" | "urgent" | "moderate" | "estimate";

type IssueOption = {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  emergency: boolean;
};

type SeverityOption = {
  id: SeverityLevel;
  label: string;
  description: string;
  accent: string;
};

type TranscriptMessage = AgentMessage & { id: string };

type TriageState = {
  isOpen: boolean;
  stage: TriageStage;
  issue: IssueOption | null;
  severity: SeverityOption | null;
  messages: TranscriptMessage[];
  eventTypes: CalendlyEventType[];
  selectedEventType: CalendlyEventType | null;
  availableSlots: CalendlyAvailableSlot[];
  selectedSlot: CalendlyAvailableSlot | null;
  schedulingUrl: string | null;
  loadingEventTypes: boolean;
  loadingSlots: boolean;
  bookingInProgress: boolean;
  bookingError: string | null;
  appointmentId: string | null;
  contact: {
    name: string;
    email: string;
    phone: string;
  };
};

type Action =
  | { type: "open" }
  | { type: "close" }
  | { type: "pick_issue"; issue: IssueOption }
  | { type: "pick_severity"; severity: SeverityOption }
  | { type: "set_contact"; field: keyof TriageState["contact"]; value: string }
  | { type: "enter_calendar" }
  | { type: "load_calendar_start" }
  | { type: "load_calendar_success"; eventTypes: CalendlyEventType[] }
  | { type: "select_event_type"; eventType: CalendlyEventType }
  | { type: "load_slots_start" }
  | { type: "load_slots_success"; slots: CalendlyAvailableSlot[] }
  | { type: "select_slot"; slot: CalendlyAvailableSlot }
  | { type: "book_start" }
  | { type: "book_success"; schedulingUrl?: string; appointmentId?: string }
  | { type: "book_error"; error: string }
  | { type: "reset_booking" };

const SEVERITY_OPTIONS: SeverityOption[] = [
  {
    id: "critical",
    label: "Active damage",
    description: "Water, smoke, sparks, or a total system failure.",
    accent: "bg-red-50 text-red-700 border-red-200",
  },
  {
    id: "urgent",
    label: "Getting worse",
    description: "The problem is contained, but it needs attention today.",
    accent: "bg-amber-50 text-amber-700 border-amber-200",
  },
  {
    id: "moderate",
    label: "Service soon",
    description: "It is disruptive, but it is not actively escalating.",
    accent: "bg-blue-50 text-blue-700 border-blue-200",
  },
  {
    id: "estimate",
    label: "Estimate only",
    description: "Planning, quote, or non-urgent work.",
    accent: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
];

const ISSUE_OPTIONS: Record<AppointmentSource, IssueOption[]> = {
  hvac: [
    {
      id: "no-cooling",
      label: "No cooling",
      description: "The system runs, but the house is not cooling.",
      icon: Wrench,
      emergency: false,
    },
    {
      id: "no-heat",
      label: "No heat",
      description: "The system is on, but there is no warm air.",
      icon: Flame,
      emergency: false,
    },
    {
      id: "smell",
      label: "Burning smell",
      description: "Smoke, burning smell, or an electrical odor.",
      icon: AlertTriangle,
      emergency: true,
    },
    {
      id: "leak",
      label: "Water leak",
      description: "Condensation, dripping, or visible water damage.",
      icon: Droplets,
      emergency: true,
    },
  ],
  plumbing: [
    {
      id: "burst-pipe",
      label: "Burst or active leak",
      description: "Water is escaping now or damage is spreading.",
      icon: Droplets,
      emergency: true,
    },
    {
      id: "no-hot-water",
      label: "No hot water",
      description: "The system is on, but hot water is unavailable.",
      icon: Flame,
      emergency: false,
    },
    {
      id: "drain-backup",
      label: "Drain backup",
      description: "Slow drain, clog, or backup affecting the room.",
      icon: Wrench,
      emergency: false,
    },
    {
      id: "sewer",
      label: "Sewer issue",
      description: "Sewage odor, backup, or overflow risk.",
      icon: AlertTriangle,
      emergency: true,
    },
  ],
  electrical: [
    {
      id: "sparking",
      label: "Sparks or burning smell",
      description: "You saw sparks, smoke, or a hot outlet/panel.",
      icon: Zap,
      emergency: true,
    },
    {
      id: "no-power",
      label: "No power",
      description: "A room, circuit, or the whole home lost power.",
      icon: ShieldAlert,
      emergency: false,
    },
    {
      id: "breaker",
      label: "Breaker keeps tripping",
      description: "The same circuit keeps shutting down.",
      icon: Wrench,
      emergency: false,
    },
    {
      id: "outlet",
      label: "Outlet issue",
      description: "A receptacle, switch, or fixture is not working.",
      icon: Bot,
      emergency: false,
    },
  ],
  smile: [
    {
      id: "consult",
      label: "Consultation request",
      description: "You want to discuss a smile makeover or treatment plan.",
      icon: Sparkles,
      emergency: false,
    },
    {
      id: "pain",
      label: "Pain or swelling",
      description: "There is discomfort and you want prompt attention.",
      icon: AlertTriangle,
      emergency: true,
    },
    {
      id: "cosmetic",
      label: "Cosmetic goals",
      description: "Whitening, alignment, or appearance improvements.",
      icon: Sparkles,
      emergency: false,
    },
    {
      id: "other",
      label: "Other",
      description: "Something else needs a review.",
      icon: Bot,
      emergency: false,
    },
  ],
  crm: [
    {
      id: "strategy",
      label: "Strategy call",
      description: "You want to talk through the best next step.",
      icon: Sparkles,
      emergency: false,
    },
    {
      id: "problem",
      label: "Problem solving",
      description: "You need help with a current issue.",
      icon: AlertTriangle,
      emergency: false,
    },
    {
      id: "demo",
      label: "Book a demo",
      description: "You want to see the platform in action.",
      icon: Calendar,
      emergency: false,
    },
    {
      id: "other",
      label: "Something else",
      description: "You want to talk to the team.",
      icon: Bot,
      emergency: false,
    },
  ],
  manual: [
    {
      id: "general",
      label: "General help",
      description: "You need help from the team.",
      icon: Bot,
      emergency: false,
    },
  ],
  ai_agent: [
    {
      id: "general",
      label: "General help",
      description: "You need help from the team.",
      icon: Bot,
      emergency: false,
    },
  ],
};

function createMessage(role: AgentMessage["role"], content: string): TranscriptMessage {
  return {
    id: `${role}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    timestamp: new Date().toISOString(),
  };
}

function createInitialState(companyName?: string, referralSource?: string): TriageState {
  const companyLine = companyName ? ` You’re coming in from ${companyName}.` : "";
  const referralLine = referralSource ? ` Referral source: ${referralSource}.` : "";

  return {
    isOpen: false,
    stage: "issue",
    issue: null,
    severity: null,
    messages: [
      createMessage(
        "assistant",
        `I’ll triage the situation first, then show the best calendar options.${companyLine}${referralLine}`,
      ),
    ],
    eventTypes: [],
    selectedEventType: null,
    availableSlots: [],
    selectedSlot: null,
    schedulingUrl: null,
    loadingEventTypes: false,
    loadingSlots: false,
    bookingInProgress: false,
    bookingError: null,
    appointmentId: null,
    contact: {
      name: "",
      email: "",
      phone: "",
    },
  };
}

function reducer(state: TriageState, action: Action): TriageState {
  switch (action.type) {
    case "open":
      return { ...state, isOpen: true };
    case "close":
      return { ...state, isOpen: false };
    case "pick_issue":
      return {
        ...state,
        issue: action.issue,
        stage: "severity",
        messages: [
          ...state.messages,
          createMessage("user", action.issue.label),
          createMessage(
            "assistant",
            action.issue.emergency
              ? "That sounds high priority. I’m marking this as urgent so we keep the booking path fast."
              : "Got it. I’ll score the severity next so we can route you correctly.",
          ),
        ],
      };
    case "pick_severity":
      return {
        ...state,
        severity: action.severity,
        stage: "contact",
        messages: [
          ...state.messages,
          createMessage("user", action.severity.label),
          createMessage(
            "assistant",
            "Thanks. Add your contact info and I’ll surface the calendar next.",
          ),
        ],
      };
    case "set_contact":
      return {
        ...state,
        contact: {
          ...state.contact,
          [action.field]: action.value,
        },
      };
    case "enter_calendar":
      return {
        ...state,
        stage: "calendar",
        messages: [
          ...state.messages,
          createMessage("assistant", "Perfect. I’m pulling the best booking options now."),
        ],
      };
    case "load_calendar_start":
      return { ...state, loadingEventTypes: true };
    case "load_calendar_success":
      return { ...state, loadingEventTypes: false, eventTypes: action.eventTypes };
    case "select_event_type":
      return {
        ...state,
        selectedEventType: action.eventType,
        availableSlots: [],
        selectedSlot: null,
        bookingError: null,
        stage: "slots",
        messages: [
          ...state.messages,
          createMessage("user", action.eventType.name),
          createMessage(
            "assistant",
            "Great. Pick a time slot and I’ll validate it before confirming the booking.",
          ),
        ],
      };
    case "load_slots_start":
      return { ...state, loadingSlots: true, bookingError: null };
    case "load_slots_success":
      return {
        ...state,
        loadingSlots: false,
        availableSlots: action.slots,
        selectedSlot: action.slots.length > 0 ? action.slots[0] : null,
      };
    case "select_slot":
      return { ...state, selectedSlot: action.slot, bookingError: null };
    case "book_start":
      return { ...state, bookingInProgress: true, bookingError: null };
    case "book_success":
      return {
        ...state,
        bookingInProgress: false,
        appointmentId: action.appointmentId || null,
        schedulingUrl: action.schedulingUrl || null,
        stage: action.schedulingUrl ? "booking" : "success",
        messages: [
          ...state.messages,
          createMessage(
            "assistant",
            action.schedulingUrl
              ? "Your slot passed validation. Complete the final booking handoff below."
              : "Your appointment is confirmed.",
          ),
        ],
      };
    case "book_error":
      return {
        ...state,
        bookingInProgress: false,
        bookingError: action.error,
        messages: [
          ...state.messages,
          createMessage("assistant", action.error),
        ],
      };
    case "reset_booking":
      return {
        ...state,
        schedulingUrl: null,
        stage: "slots",
      };
    default:
      return state;
  }
}

function getIssueOptions(source: AppointmentSource): IssueOption[] {
  return ISSUE_OPTIONS[source] ?? ISSUE_OPTIONS.manual;
}

function getSeverityOutcome(issue: IssueOption | null, severity: SeverityOption | null) {
  if (issue?.emergency || severity?.id === "critical") {
    return {
      label: "Emergency dispatch",
      tone: "bg-red-50 text-red-700 border-red-200",
      note: "Prioritize live scheduling and minimize delay.",
    };
  }

  if (severity?.id === "urgent") {
    return {
      label: "Same-day triage",
      tone: "bg-amber-50 text-amber-700 border-amber-200",
      note: "Fast follow-up with a time-sensitive calendar option.",
    };
  }

  if (severity?.id === "moderate") {
    return {
      label: "Book soon",
      tone: "bg-blue-50 text-blue-700 border-blue-200",
      note: "Route to an efficient, non-emergency appointment.",
    };
  }

  return {
    label: "Estimate and planning",
    tone: "bg-emerald-50 text-emerald-700 border-emerald-200",
    note: "Good fit for a standard calendar booking.",
  };
}

function getStageLabel(stage: TriageStage): string {
  switch (stage) {
    case "issue":
      return "Step 1 of 4";
    case "severity":
      return "Step 2 of 4";
    case "contact":
      return "Step 3 of 4";
    case "calendar":
      return "Step 4 of 4";
    case "booking":
      return "Booking";
  }
}

export function AgenticTriageChatbot({
  source,
  accountId,
  primaryColor = "#7c3aed",
  position = "bottom-right",
  companyName,
  referralSource,
}: AgenticTriageChatbotProps) {
  const [state, dispatch] = useReducer(
    reducer,
    undefined,
    () => createInitialState(companyName, referralSource),
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const positionClass =
    position === "bottom-right" ? "bottom-6 right-6" : "bottom-6 left-6";
  const issueOptions = useMemo(() => getIssueOptions(source), [source]);
  const triageOutcome = useMemo(
    () => getSeverityOutcome(state.issue, state.severity),
    [state.issue, state.severity],
  );
  const completionReady =
    state.contact.name.trim().length > 1 && state.contact.email.includes("@");

  const activePrompt = useMemo(() => {
    if (state.stage === "issue") return "What are you dealing with right now?";
    if (state.stage === "severity") return "How severe is it?";
    if (state.stage === "contact") return "Who should we book for?";
    if (state.stage === "calendar") return "Pick the right appointment type.";
    if (state.stage === "slots") return "Pick a preferred time slot.";
    if (state.stage === "success") return "Booking complete.";
    return "Your scheduling page is ready.";
  }, [state.stage]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.messages, state.stage, state.schedulingUrl]);

  useEffect(() => {
    if (state.isOpen && state.stage === "contact") {
      window.setTimeout(() => nameInputRef.current?.focus(), 80);
    }
  }, [state.isOpen, state.stage]);

  useEffect(() => {
    if (
      !state.isOpen ||
      state.stage !== "calendar" ||
      state.eventTypes.length > 0 ||
      state.loadingEventTypes
    ) {
      return;
    }

    const loadEventTypes = async () => {
      dispatch({ type: "load_calendar_start" });
      try {
        const params = accountId ? `?account_id=${encodeURIComponent(accountId)}` : "";
        const response = await fetch(`/api/calendly/event-types${params}`);
        const data = await response.json();
        dispatch({
          type: "load_calendar_success",
          eventTypes: Array.isArray(data.event_types) ? data.event_types : [],
        });
      } catch (error) {
        console.error("Failed to load Calendly event types:", error);
        dispatch({ type: "load_calendar_success", eventTypes: [] });
      }
    };

    void loadEventTypes();
  }, [accountId, state.eventTypes.length, state.isOpen, state.loadingEventTypes, state.stage]);

  useEffect(() => {
    if (
      !state.isOpen ||
      state.stage !== "slots" ||
      !state.selectedEventType ||
      state.availableSlots.length > 0 ||
      state.loadingSlots
    ) {
      return;
    }

    const loadSlots = async () => {
      dispatch({ type: "load_slots_start" });
      try {
        const start = new Date();
        const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
        const params = new URLSearchParams({
          event_type_uri: state.selectedEventType.uri,
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          ...(accountId ? { account_id: accountId } : {}),
        });

        const response = await fetch(`/api/calendly/availability?${params.toString()}`);
        const data = await response.json();
        const slots = Array.isArray(data.slots) ? data.slots.slice(0, 12) : [];
        dispatch({ type: "load_slots_success", slots });
      } catch (error) {
        console.error("Failed to load slots:", error);
        dispatch({ type: "load_slots_success", slots: [] });
      }
    };

    void loadSlots();
  }, [
    accountId,
    state.availableSlots.length,
    state.isOpen,
    state.loadingSlots,
    state.selectedEventType,
    state.stage,
  ]);

  function openWidget() {
    dispatch({ type: "open" });
  }

  function closeWidget() {
    dispatch({ type: "close" });
  }

  function handleContinueToCalendar() {
    if (!completionReady) return;
    dispatch({ type: "enter_calendar" });
  }

  function handleSelectEventType(eventType: CalendlyEventType) {
    dispatch({ type: "select_event_type", eventType });
  }

  async function handleConfirmSlotAndBook() {
    if (
      !accountId ||
      !state.issue ||
      !state.severity ||
      !state.selectedEventType ||
      !state.selectedSlot
    ) {
      dispatch({ type: "book_error", error: "Missing booking details. Please try another slot." });
      return;
    }

    dispatch({ type: "book_start" });

    try {
      const validatePayload = {
        accountId,
        source,
        severity: state.severity.id,
        startTime: state.selectedSlot.start_time,
        endTime: state.selectedSlot.end_time,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        preferredProvider: "calendly",
        eventTypeUri: state.selectedEventType.uri,
      };

      const validateResponse = await fetch("/api/agent/triage/validate-slot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validatePayload),
      });

      const validateData = await validateResponse.json();
      if (!validateResponse.ok || !validateData.valid) {
        dispatch({
          type: "book_error",
          error: validateData.reason || "That time is no longer available. Pick a different slot.",
        });
        return;
      }

      const bookPayload = {
        ...validatePayload,
        contact: {
          name: state.contact.name,
          email: state.contact.email,
          phone: state.contact.phone || undefined,
        },
        issueId: state.issue.id,
        issueLabel: state.issue.label,
        title: `${state.issue.label} - ${state.severity.label}`,
        notes: `Selected from triage chatbot (${source})`,
        metadata: {
          triageOutcome: triageOutcome.label,
          eventTypeName: state.selectedEventType.name,
        },
      };

      const bookResponse = await fetch("/api/agent/triage/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookPayload),
      });
      const bookData = await bookResponse.json();

      if (bookResponse.status === 202 && bookData.handoffRequired) {
        dispatch({
          type: "book_success",
          schedulingUrl: bookData.schedulingUrl,
        });
        return;
      }

      if (!bookResponse.ok || !bookData.booked) {
        dispatch({
          type: "book_error",
          error: bookData.error || "Booking failed. Please try a different slot.",
        });
        return;
      }

      dispatch({
        type: "book_success",
        appointmentId: bookData.appointmentId,
      });
    } catch (error) {
      console.error("Failed to book slot:", error);
      dispatch({
        type: "book_error",
        error: "Booking request failed. Please try again.",
      });
    }
  }

  const colorStyle = { "--agent-color": primaryColor } as React.CSSProperties;

  return (
    <div className={`fixed ${positionClass} z-50`} style={colorStyle}>
      {state.isOpen && (
        <div className="mb-4 w-[92vw] max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl sm:w-96">
          <div
            className="flex items-center justify-between px-4 py-3 text-white"
            style={{ backgroundColor: primaryColor }}
          >
            <div className="flex items-center gap-3">
              {source === "plumbing" || source === "hvac" || source === "electrical" ? (
                <div className="rounded-full bg-white px-2 py-0.5">
                  <IndustryLogo industry={source} height={34} priority showFallback={false} />
                </div>
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
                  <Bot className="h-4 w-4" />
                </div>
              )}
              <div>
                <p className="text-sm font-semibold">
                  {companyName ? `${companyName} Triage` : "Agentic Triage"}
                </p>
                <p className="text-xs opacity-80">Lean triage before booking</p>
              </div>
            </div>
            <button
              onClick={closeWidget}
              className="rounded-full p-1 transition-colors hover:bg-white/20"
              aria-label="Close triage chatbot"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>{getStageLabel(state.stage)}</span>
              <span className="rounded-full bg-white px-2 py-1 text-slate-600 shadow-sm">
                {triageOutcome.label}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width:
                    state.stage === "issue"
                      ? "25%"
                      : state.stage === "severity"
                        ? "50%"
                        : state.stage === "contact"
                          ? "75%"
                          : "100%",
                  backgroundColor: primaryColor,
                }}
              />
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-900">{activePrompt}</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">{triageOutcome.note}</p>
          </div>

          <div className="max-h-[62vh] overflow-y-auto bg-slate-50 px-4 py-4">
            <div className="space-y-3">
              {state.messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {message.role === "assistant" && (
                    <div
                      className="mr-2 mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-white"
                      style={{ backgroundColor: primaryColor }}
                    >
                      <Bot className="h-3 w-3" />
                    </div>
                  )}
                  <div
                    className={`max-w-[82%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                      message.role === "user"
                        ? "rounded-br-sm text-white"
                        : "rounded-bl-sm bg-white text-slate-800 shadow-sm"
                    }`}
                    style={message.role === "user" ? { backgroundColor: primaryColor } : undefined}
                  >
                    {message.content}
                  </div>
                </div>
              ))}
            </div>

            {state.stage === "issue" && (
              <div className="mt-4 grid gap-2">
                {issueOptions.map((issue) => {
                  const Icon = issue.icon;
                  return (
                    <button
                      key={issue.id}
                      onClick={() => dispatch({ type: "pick_issue", issue })}
                      className="group rounded-2xl border border-slate-200 bg-white p-3 text-left transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="mt-0.5 rounded-xl bg-slate-100 p-2 text-slate-700 transition-colors group-hover:bg-slate-900 group-hover:text-white"
                          style={issue.emergency ? { backgroundColor: "#fee2e2" } : undefined}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-900">{issue.label}</p>
                          <p className="mt-0.5 text-xs leading-5 text-slate-500">{issue.description}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {state.stage === "severity" && (
              <div className="mt-4 grid grid-cols-1 gap-2">
                {SEVERITY_OPTIONS.map((severity) => (
                  <button
                    key={severity.id}
                    onClick={() => dispatch({ type: "pick_severity", severity })}
                    className={`rounded-2xl border p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-md ${severity.accent}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{severity.label}</p>
                        <p className="mt-0.5 text-xs leading-5 opacity-90">{severity.description}</p>
                      </div>
                      <Clock3 className="h-4 w-4 flex-shrink-0" />
                    </div>
                  </button>
                ))}
              </div>
            )}

            {state.stage === "contact" && (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="grid gap-3">
                  <Input
                    ref={nameInputRef}
                    value={state.contact.name}
                    onChange={(e) =>
                      dispatch({ type: "set_contact", field: "name", value: e.target.value })
                    }
                    placeholder="Full name"
                    className="rounded-2xl border-slate-200"
                  />
                  <Input
                    value={state.contact.email}
                    onChange={(e) =>
                      dispatch({ type: "set_contact", field: "email", value: e.target.value })
                    }
                    placeholder="Email address"
                    type="email"
                    className="rounded-2xl border-slate-200"
                  />
                  <Input
                    value={state.contact.phone}
                    onChange={(e) =>
                      dispatch({ type: "set_contact", field: "phone", value: e.target.value })
                    }
                    placeholder="Phone number (optional)"
                    type="tel"
                    className="rounded-2xl border-slate-200"
                  />
                </div>
                <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-3 text-xs text-slate-600">
                  <span>Priority</span>
                  <span className={`rounded-full border px-2 py-1 font-semibold ${triageOutcome.tone}`}>
                    {triageOutcome.label}
                  </span>
                </div>
                <Button
                  onClick={handleContinueToCalendar}
                  disabled={!completionReady}
                  className="mt-4 w-full rounded-2xl text-white"
                  style={{ backgroundColor: primaryColor }}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  Show calendar options
                </Button>
              </div>
            )}

            {state.stage === "calendar" && (
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    Triage complete
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    {state.issue?.label ?? "Issue"} routed as {triageOutcome.label.toLowerCase()}.
                  </p>
                </div>

                {state.loadingEventTypes ? (
                  <div className="flex items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-10 text-slate-400">
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Loading calendar options
                  </div>
                ) : state.eventTypes.length > 0 ? (
                  <div className="grid gap-2">
                    {state.eventTypes.map((eventType) => (
                      <button
                        key={eventType.uri}
                        onClick={() => handleSelectEventType(eventType)}
                        className="rounded-2xl border border-slate-200 bg-white p-3 text-left transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{eventType.name}</p>
                            {eventType.description && (
                              <p className="mt-0.5 text-xs leading-5 text-slate-500">
                                {eventType.description}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500">
                            <Clock3 className="h-3 w-3" />
                            {eventType.duration} min
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-600">
                    No calendar types are available right now. Please use the standard booking link or contact the team directly.
                  </div>
                )}
              </div>
            )}

            {state.stage === "slots" && (
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                  <p className="text-sm font-semibold text-slate-900">
                    {state.selectedEventType?.name}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    Select a time, then we will validate availability and policy windows before booking.
                  </p>
                </div>

                {state.loadingSlots ? (
                  <div className="flex items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-10 text-slate-400">
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Loading available slots
                  </div>
                ) : state.availableSlots.length > 0 ? (
                  <div className="grid gap-2">
                    {state.availableSlots.map((slot) => {
                      const start = new Date(slot.start_time);
                      const end = new Date(slot.end_time);
                      const isSelected =
                        state.selectedSlot?.start_time === slot.start_time &&
                        state.selectedSlot?.end_time === slot.end_time;

                      return (
                        <button
                          key={`${slot.start_time}_${slot.end_time}`}
                          onClick={() => dispatch({ type: "select_slot", slot })}
                          className={`rounded-2xl border p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-md ${
                            isSelected
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-slate-200 bg-white text-slate-800"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold">
                              {start.toLocaleString(undefined, {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </p>
                            <span className="text-xs opacity-80">
                              {Math.round((end.getTime() - start.getTime()) / 60000)} min
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-600">
                    No open slots found for this event type in the next 7 days.
                  </div>
                )}

                {state.bookingError && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                    {state.bookingError}
                  </div>
                )}

                <Button
                  onClick={handleConfirmSlotAndBook}
                  disabled={!state.selectedSlot || state.bookingInProgress || state.loadingSlots}
                  className="w-full rounded-2xl text-white"
                  style={{ backgroundColor: primaryColor }}
                >
                  {state.bookingInProgress ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Validating and booking
                    </>
                  ) : (
                    <>
                      <Calendar className="mr-2 h-4 w-4" />
                      Confirm selected slot
                    </>
                  )}
                </Button>
              </div>
            )}

            {state.stage === "booking" && state.schedulingUrl && (
              <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
                  <button
                    onClick={() => dispatch({ type: "reset_booking" })}
                    className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Back to calendar options
                  </button>
                  <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                    Ready to book
                  </span>
                </div>
                <iframe
                  src={state.schedulingUrl}
                  className="h-[420px] w-full border-0"
                  title="Schedule Appointment"
                />
              </div>
            )}

            {state.stage === "success" && (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <CheckCircle2 className="h-4 w-4" />
                  Appointment confirmed
                </div>
                <p className="mt-2 text-xs leading-5">
                  We reserved your slot successfully.
                  {state.appointmentId ? ` Reference: ${state.appointmentId}` : ""}
                </p>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>
      )}

      <button
        onClick={() => (state.isOpen ? closeWidget() : openWidget())}
        className="flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition-transform hover:scale-110 active:scale-95"
        style={{ backgroundColor: primaryColor }}
        aria-label="Open Agentic Triage Chatbot"
      >
        {state.isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </div>
  );
}
