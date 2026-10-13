import { NextRequest, NextResponse } from "next/server";
import { AppointmentService } from "@/lib/services/appointment-service";
import { updateAppointmentSchema } from "@/lib/validations/appointment";
import { getErrorMessage } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const service = new AppointmentService();
    const appointment = await service.getAppointment(id);

    if (!appointment) {
      return NextResponse.json(
        { error: "Appointment not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ appointment });
  } catch (error) {
    console.error("[Appointment GET] Error:", error);
    return NextResponse.json(
      { error: getErrorMessage(error, "Failed to fetch appointment") },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = updateAppointmentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const service = new AppointmentService();
    const appointment = await service.updateAppointment(id, parsed.data);

    return NextResponse.json({ appointment });
  } catch (error) {
    console.error("[Appointment PATCH] Error:", error);
    return NextResponse.json(
      { error: getErrorMessage(error, "Failed to update appointment") },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const service = new AppointmentService();
    await service.cancelAppointment(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Appointment DELETE] Error:", error);
    return NextResponse.json(
      { error: getErrorMessage(error, "Failed to cancel appointment") },
      { status: 500 },
    );
  }
}
