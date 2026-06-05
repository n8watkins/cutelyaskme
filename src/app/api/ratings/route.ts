import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const { planId, score, note } = body ?? {};

  if (!planId || typeof score !== "number" || score < 1 || score > 5) {
    return NextResponse.json({ message: "Invalid rating" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Verify user is a participant
  const { data: plan } = await admin
    .from("date_plans")
    .select("sender_id, recipient_id")
    .eq("id", planId)
    .single();

  if (!plan || (plan.sender_id !== user.id && plan.recipient_id !== user.id)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { error } = await admin.from("date_ratings").upsert(
    { plan_id: planId, rater_id: user.id, score, note: note ?? null },
    { onConflict: "plan_id,rater_id" },
  );

  if (error) {
    return NextResponse.json({ message: "Could not save rating." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
