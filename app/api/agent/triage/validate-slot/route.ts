import { NextRequest, NextResponse } from "next/server";
import { triageSlotValidationSchema } from "@/lib/validations/triage-booking";
import { CalendarRoutingService } from "@/lib/services/calendar-routing-service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const parsed = triageSlotValidationSchema.safeParse(payload);

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
    const result = await service.validateSlot(parsed.data);

    if (!result.ok) {
      return NextResponse.json(
        {
          valid: false,
          provider: result.provider,
          reason: result.reason || "Slot is not available",
        },
        { status: 409 },
      );
    }

    return NextResponse.json({ valid: true, provider: result.provider });
  } catch (error: any) {
    console.error("[Triage Validate Slot] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to validate slot" },
      { status: 500 },
    );
  }
}
