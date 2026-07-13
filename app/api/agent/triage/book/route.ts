import { NextRequest, NextResponse } from "next/server";
import { triageBookSchema } from "@/lib/validations/triage-booking";
import { CalendarRoutingService } from "@/lib/services/calendar-routing-service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const parsed = triageBookSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const service = new CalendarRoutingService();
    const result = await service.bookTriageAppointment(parsed.data);

    if (result.status === "handoff_required") {
      return NextResponse.json(
        {
          booked: false,
          provider: result.provider,
          handoffRequired: true,
          schedulingUrl: result.schedulingUrl,
        },
        { status: 202 },
      );
    }

    return NextResponse.json(
      {
        booked: true,
        provider: result.provider,
        appointmentId: result.appointmentId,
      },
      { status: 201 },
    );
  } catch (error: any) {
    const message =
      error?.message || "Failed to create triage booking appointment";
    const status = message.includes("no longer available") ? 409 : 500;

    console.error("[Triage Book] Error:", error);
    return NextResponse.json({ error: message }, { status });
  }
}
