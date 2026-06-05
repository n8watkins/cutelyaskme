import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { generateItinerary } from "@/lib/itinerary";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const {
    inviteToken,
    selectedDate,
    selectedDateLabel,
    selectedTime,
    selectedTimeLabel,
    selectedEntree,
    selectedActivities,
  } = body ?? {};

  if (!inviteToken) {
    return NextResponse.json({ message: "Missing invite token" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Look up invite by token
  const { data: invite, error: inviteError } = await admin
    .from("invites")
    .select("id, sender_id, status")
    .eq("token", inviteToken)
    .single();

  if (inviteError || !invite) {
    return NextResponse.json({ message: "Invite not found" }, { status: 404 });
  }

  if (invite.status === "completed") {
    return NextResponse.json({ message: "Invite already completed" }, { status: 409 });
  }

  // Generate itinerary (single optimized Gemini call)
  const itinerary = await generateItinerary({
    selectedDateLabel,
    selectedTimeLabel,
    selectedEntree,
    selectedActivities: selectedActivities ?? [],
  }).catch(() => null);

  const now = new Date().toISOString();

  // Create plan
  const { data: plan, error: planError } = await admin
    .from("date_plans")
    .insert({
      invite_id: invite.id,
      sender_id: invite.sender_id,
      recipient_id: user.id,
      selected_date: selectedDate,
      selected_date_label: selectedDateLabel,
      selected_time: selectedTime,
      selected_time_label: selectedTimeLabel,
      selected_entree: selectedEntree,
      selected_activities: selectedActivities ?? [],
      itinerary,
      itinerary_generated_at: itinerary ? now : null,
      completed_at: now,
    })
    .select("id")
    .single();

  if (planError || !plan) {
    return NextResponse.json({ message: "Could not save plan." }, { status: 500 });
  }

  // Mark invite completed
  await admin
    .from("invites")
    .update({ status: "completed" })
    .eq("id", invite.id);

  return NextResponse.json({ planId: plan.id });
}
