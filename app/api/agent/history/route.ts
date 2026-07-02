import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId required" },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();

    const { data: conversation, error } = await supabase
      .from("agent_conversations")
      .select("messages, lead_name, lead_email, lead_phone, status")
      .eq("session_id", sessionId)
      .maybeSingle();

    if (error) {
      console.error("[Agent History] Error fetching conversation:", error);
      return NextResponse.json({ messages: [] });
    }

    if (!conversation || !conversation.messages) {
      return NextResponse.json({ messages: [] });
    }

    const leadCaptured = !!(conversation.lead_email || conversation.lead_phone);

    return NextResponse.json({
      messages: conversation.messages,
      leadCaptured,
      leadName: conversation.lead_name,
    });
  } catch (error) {
    console.error("[Agent History] Unexpected error:", error);
    return NextResponse.json({ messages: [] });
  }
}
