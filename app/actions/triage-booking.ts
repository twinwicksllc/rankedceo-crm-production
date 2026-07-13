"use server";

import {
  triageBookSchema,
  triageSlotValidationSchema,
  type TriageBookInput,
  type TriageSlotValidationInput,
} from "@/lib/validations/triage-booking";
import { CalendarRoutingService } from "@/lib/services/calendar-routing-service";

export async function validateTriageSlotAction(input: TriageSlotValidationInput) {
  const parsed = triageSlotValidationSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Validation failed",
      details: parsed.error.flatten(),
    };
  }

  const service = new CalendarRoutingService();
  const result = await service.validateSlot(parsed.data);

  return {
    ok: result.ok,
    provider: result.provider,
    reason: result.reason,
  };
}

export async function bookTriageAppointmentAction(input: TriageBookInput) {
  const parsed = triageBookSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Validation failed",
      details: parsed.error.flatten(),
    };
  }

  try {
    const service = new CalendarRoutingService();
    const result = await service.bookTriageAppointment(parsed.data);

    return {
      ok: true,
      ...result,
    };
  } catch (error: any) {
    return {
      ok: false,
      error: error?.message || "Failed to book triage appointment",
    };
  }
}
