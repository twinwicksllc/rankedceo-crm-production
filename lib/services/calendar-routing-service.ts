import { createAdminClient } from "@/lib/supabase/admin";
import {
  getAvailableSlots,
  getEventTypes,
} from "@/lib/services/calendly-service";
import type {
  CalendarProvider,
  TriageBookInput,
  TriageSeverity,
  TriageSlotValidationInput,
} from "@/lib/validations/triage-booking";

type ProviderConnection = {
  provider: CalendarProvider;
  id: string;
  account_id: string;
  access_token: string;
  refresh_token?: string | null;
  token_expires_at?: string | null;
  external_calendar_id?: string | null;
  calendly_user_uri?: string | null;
  metadata?: Record<string, unknown> | null;
};

type ValidationResult = {
  ok: boolean;
  provider: CalendarProvider;
  reason?: string;
};

const WINDOW_RULES: Record<
  TriageSeverity,
  {
    minLeadMinutes: number;
    maxAdvanceDays: number;
    allowedWeekdays: number[];
    startMinute: number;
    endMinute: number;
  }
> = {
  critical: {
    minLeadMinutes: 0,
    maxAdvanceDays: 7,
    allowedWeekdays: [0, 1, 2, 3, 4, 5, 6],
    startMinute: 0,
    endMinute: 24 * 60,
  },
  urgent: {
    minLeadMinutes: 30,
    maxAdvanceDays: 14,
    allowedWeekdays: [0, 1, 2, 3, 4, 5, 6],
    startMinute: 6 * 60,
    endMinute: 22 * 60,
  },
  moderate: {
    minLeadMinutes: 120,
    maxAdvanceDays: 30,
    allowedWeekdays: [1, 2, 3, 4, 5, 6],
    startMinute: 8 * 60,
    endMinute: 18 * 60,
  },
  estimate: {
    minLeadMinutes: 24 * 60,
    maxAdvanceDays: 60,
    allowedWeekdays: [1, 2, 3, 4, 5],
    startMinute: 9 * 60,
    endMinute: 17 * 60,
  },
};

function getWeekdayAndMinute(date: Date, timeZone: string): {
  weekday: number;
  minuteOfDay: number;
} {
  const formatter = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  });

  const parts = formatter.formatToParts(date);
  const weekdayRaw = parts.find((p) => p.type === "weekday")?.value || "Mon";
  const hour = Number(parts.find((p) => p.type === "hour")?.value || "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value || "0");

  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return {
    weekday: weekdayMap[weekdayRaw] ?? 1,
    minuteOfDay: hour * 60 + minute,
  };
}

function validateWindowRules(input: {
  startTime: string;
  endTime: string;
  severity: TriageSeverity;
  timezone: string;
}): { valid: boolean; reason?: string } {
  const start = new Date(input.startTime);
  const end = new Date(input.endTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { valid: false, reason: "Invalid date format" };
  }

  if (end <= start) {
    return { valid: false, reason: "End time must be after start time" };
  }

  const durationMinutes = Math.floor((end.getTime() - start.getTime()) / 60000);
  if (durationMinutes < 15 || durationMinutes > 240) {
    return {
      valid: false,
      reason: "Appointment duration must be between 15 and 240 minutes",
    };
  }

  const rules = WINDOW_RULES[input.severity];
  const now = Date.now();
  const leadMinutes = (start.getTime() - now) / 60000;
  if (leadMinutes < rules.minLeadMinutes) {
    return {
      valid: false,
      reason: `Selected time is too soon for ${input.severity} triage window`,
    };
  }

  const maxAdvanceMinutes = rules.maxAdvanceDays * 24 * 60;
  if (leadMinutes > maxAdvanceMinutes) {
    return {
      valid: false,
      reason: `Selected time is beyond the ${rules.maxAdvanceDays}-day booking window`,
    };
  }

  const startLocal = getWeekdayAndMinute(start, input.timezone);
  const endLocal = getWeekdayAndMinute(end, input.timezone);

  if (!rules.allowedWeekdays.includes(startLocal.weekday)) {
    return {
      valid: false,
      reason: "Selected weekday is outside allowed appointment days",
    };
  }

  if (
    startLocal.minuteOfDay < rules.startMinute ||
    endLocal.minuteOfDay > rules.endMinute
  ) {
    return {
      valid: false,
      reason: "Selected time is outside allowed appointment hours",
    };
  }

  return { valid: true };
}

async function validateCalendlySlot(
  connection: ProviderConnection,
  input: TriageSlotValidationInput,
): Promise<ValidationResult> {
  if (!input.eventTypeUri) {
    return {
      ok: false,
      provider: "calendly",
      reason: "eventTypeUri is required for Calendly validation",
    };
  }

  const slots = await getAvailableSlots(
    connection.access_token,
    input.eventTypeUri,
    input.startTime,
    input.endTime,
  );

  const match = slots.some(
    (slot) =>
      new Date(slot.start_time).toISOString() ===
        new Date(input.startTime).toISOString() &&
      new Date(slot.end_time).toISOString() === new Date(input.endTime).toISOString(),
  );

  return match
    ? { ok: true, provider: "calendly" }
    : {
        ok: false,
        provider: "calendly",
        reason: "Selected slot is no longer available in Calendly",
      };
}

function intervalsOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
): boolean {
  return new Date(startA) < new Date(endB) && new Date(endA) > new Date(startB);
}

async function validateGoogleSlot(
  connection: ProviderConnection,
  input: TriageSlotValidationInput,
): Promise<ValidationResult> {
  const calendarId = connection.external_calendar_id || "primary";

  const response = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${connection.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      timeMin: input.startTime,
      timeMax: input.endTime,
      timeZone: input.timezone,
      items: [{ id: calendarId }],
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    return {
      ok: false,
      provider: "google",
      reason: `Google availability check failed: ${details}`,
    };
  }

  const data = (await response.json()) as {
    calendars?: Record<string, { busy?: Array<{ start: string; end: string }> }>;
  };
  const busy = data.calendars?.[calendarId]?.busy || [];
  const hasOverlap = busy.some((b) =>
    intervalsOverlap(input.startTime, input.endTime, b.start, b.end),
  );

  return hasOverlap
    ? {
        ok: false,
        provider: "google",
        reason: "Selected slot conflicts with Google Calendar busy time",
      }
    : { ok: true, provider: "google" };
}

async function validateOutlookSlot(
  connection: ProviderConnection,
  input: TriageSlotValidationInput,
): Promise<ValidationResult> {
  const query = new URLSearchParams({
    startDateTime: input.startTime,
    endDateTime: input.endTime,
    $top: "20",
  });

  const response = await fetch(
    `https://graph.microsoft.com/v1.0/me/calendar/calendarView?${query.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${connection.access_token}`,
        Prefer: `outlook.timezone="${input.timezone}"`,
      },
    },
  );

  if (!response.ok) {
    const details = await response.text();
    return {
      ok: false,
      provider: "outlook",
      reason: `Outlook availability check failed: ${details}`,
    };
  }

  const data = (await response.json()) as {
    value?: Array<{
      start?: { dateTime?: string };
      end?: { dateTime?: string };
      showAs?: string;
    }>;
  };

  const events = data.value || [];
  const hasOverlap = events.some((event) => {
    if (!event.start?.dateTime || !event.end?.dateTime) return false;
    if (event.showAs === "free") return false;
    return intervalsOverlap(
      input.startTime,
      input.endTime,
      new Date(event.start.dateTime).toISOString(),
      new Date(event.end.dateTime).toISOString(),
    );
  });

  return hasOverlap
    ? {
        ok: false,
        provider: "outlook",
        reason: "Selected slot conflicts with Outlook Calendar busy time",
      }
    : { ok: true, provider: "outlook" };
}

async function resolveProviderConnection(
  accountId: string,
  preferredProvider?: CalendarProvider,
): Promise<ProviderConnection | null> {
  const supabase = createAdminClient();

  const providerPriority = preferredProvider
    ? [preferredProvider]
    : (["google", "outlook", "calendly"] as CalendarProvider[]);

  for (const provider of providerPriority) {
    if (provider === "calendly") {
      const { data } = await supabase
        .from("calendly_connections")
        .select(
          "id, account_id, access_token, refresh_token, token_expires_at, calendly_user_uri",
        )
        .eq("account_id", accountId)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        return {
          provider: "calendly",
          ...data,
        } as ProviderConnection;
      }

      continue;
    }

    const { data } = await supabase
      .from("calendar_provider_connections")
      .select(
        "id, account_id, provider, access_token, refresh_token, token_expires_at, external_calendar_id, external_user_id, metadata",
      )
      .eq("account_id", accountId)
      .eq("provider", provider)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      return {
        provider,
        ...data,
      } as ProviderConnection;
    }
  }

  return null;
}

async function assertNoLocalDoubleBooking(
  accountId: string,
  startTime: string,
  endTime: string,
): Promise<void> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("appointments")
    .select("id")
    .eq("account_id", accountId)
    .in("status", ["scheduled", "rescheduled"])
    .lt("start_time", endTime)
    .gt("end_time", startTime)
    .limit(1);

  if (error) {
    throw new Error(`Failed to verify local booking conflicts: ${error.message}`);
  }

  if ((data || []).length > 0) {
    throw new Error("Selected time is no longer available (already booked)");
  }
}

async function createGoogleEvent(
  connection: ProviderConnection,
  input: TriageBookInput,
): Promise<{ providerEventId?: string; meetingUrl?: string }> {
  const calendarId = connection.external_calendar_id || "primary";

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${connection.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: input.title || `${input.issueLabel} consultation`,
        description: input.description || input.notes || "Created via triage chatbot",
        start: {
          dateTime: input.startTime,
          timeZone: input.timezone,
        },
        end: {
          dateTime: input.endTime,
          timeZone: input.timezone,
        },
        attendees: [{ email: input.contact.email, displayName: input.contact.name }],
      }),
    },
  );

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Failed to create Google Calendar event: ${details}`);
  }

  const event = (await response.json()) as {
    id?: string;
    htmlLink?: string;
    hangoutLink?: string;
  };

  return {
    providerEventId: event.id,
    meetingUrl: event.hangoutLink || event.htmlLink,
  };
}

async function createOutlookEvent(
  connection: ProviderConnection,
  input: TriageBookInput,
): Promise<{ providerEventId?: string; meetingUrl?: string }> {
  const response = await fetch("https://graph.microsoft.com/v1.0/me/events", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${connection.access_token}`,
      "Content-Type": "application/json",
      Prefer: `outlook.timezone=\"${input.timezone}\"`,
    },
    body: JSON.stringify({
      subject: input.title || `${input.issueLabel} consultation`,
      body: {
        contentType: "Text",
        content: input.description || input.notes || "Created via triage chatbot",
      },
      start: {
        dateTime: new Date(input.startTime).toISOString(),
        timeZone: "UTC",
      },
      end: {
        dateTime: new Date(input.endTime).toISOString(),
        timeZone: "UTC",
      },
      attendees: [
        {
          emailAddress: {
            address: input.contact.email,
            name: input.contact.name,
          },
          type: "required",
        },
      ],
      isOnlineMeeting: true,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Failed to create Outlook event: ${details}`);
  }

  const event = (await response.json()) as {
    id?: string;
    webLink?: string;
    onlineMeeting?: { joinUrl?: string };
  };

  return {
    providerEventId: event.id,
    meetingUrl: event.onlineMeeting?.joinUrl || event.webLink,
  };
}

export class CalendarRoutingService {
  async validateSlot(input: TriageSlotValidationInput): Promise<ValidationResult> {
    const ruleCheck = validateWindowRules({
      startTime: input.startTime,
      endTime: input.endTime,
      severity: input.severity,
      timezone: input.timezone,
    });

    if (!ruleCheck.valid) {
      return {
        ok: false,
        provider: input.preferredProvider || "calendly",
        reason: ruleCheck.reason,
      };
    }

    const connection = await resolveProviderConnection(
      input.accountId,
      input.preferredProvider,
    );

    if (!connection) {
      return {
        ok: false,
        provider: input.preferredProvider || "calendly",
        reason: "No active calendar provider connection found",
      };
    }

    await assertNoLocalDoubleBooking(input.accountId, input.startTime, input.endTime);

    if (connection.provider === "calendly") {
      return validateCalendlySlot(connection, input);
    }

    if (connection.provider === "google") {
      return validateGoogleSlot(connection, input);
    }

    return validateOutlookSlot(connection, input);
  }

  async bookTriageAppointment(input: TriageBookInput): Promise<{
    appointmentId?: string;
    provider: CalendarProvider;
    status: "booked" | "handoff_required";
    schedulingUrl?: string;
  }> {
    const validation = await this.validateSlot(input);
    if (!validation.ok) {
      throw new Error(validation.reason || "Slot validation failed");
    }

    const connection = await resolveProviderConnection(
      input.accountId,
      input.preferredProvider,
    );

    if (!connection) {
      throw new Error("No connected calendar provider was found");
    }

    // Calendly booking must complete on its hosted booking URL.
    if (connection.provider === "calendly") {
      if (!input.eventTypeUri) {
        throw new Error("eventTypeUri is required for Calendly handoff booking");
      }

      const eventTypes = await getEventTypes(
        connection.access_token,
        connection.calendly_user_uri || "",
      );
      const selectedEventType = eventTypes.find((et) => et.uri === input.eventTypeUri);

      if (!selectedEventType?.scheduling_url) {
        throw new Error("Could not resolve Calendly scheduling URL for selected event type");
      }

      return {
        provider: "calendly",
        status: "handoff_required",
        schedulingUrl: selectedEventType.scheduling_url,
      };
    }

    const providerEvent =
      connection.provider === "google"
        ? await createGoogleEvent(connection, input)
        : await createOutlookEvent(connection, input);

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("appointments")
      .insert({
        account_id: input.accountId,
        invitee_name: input.contact.name,
        invitee_email: input.contact.email,
        invitee_phone: input.contact.phone || null,
        title: input.title || `${input.issueLabel} consultation`,
        description: input.description || null,
        status: "scheduled",
        appointment_type: "meeting",
        start_time: input.startTime,
        end_time: input.endTime,
        timezone: input.timezone,
        duration_minutes: Math.round(
          (new Date(input.endTime).getTime() - new Date(input.startTime).getTime()) /
            60000,
        ),
        meeting_url: providerEvent.meetingUrl || null,
        source: input.source,
        notes: input.notes || null,
        metadata: {
          triage: {
            issue_id: input.issueId,
            issue_label: input.issueLabel,
            severity: input.severity,
          },
          provider: connection.provider,
          provider_event_id: providerEvent.providerEventId,
          ...(input.metadata || {}),
        },
      })
      .select("id")
      .single();

    if (error) {
      // 23P01 is the overlap trigger in PostgreSQL; normalize to a user-safe error.
      if (error.code === "23P01") {
        throw new Error("Selected time is no longer available (already booked)");
      }
      throw new Error(`Failed to persist appointment: ${error.message}`);
    }

    return {
      appointmentId: data.id,
      provider: connection.provider,
      status: "booked",
    };
  }
}
