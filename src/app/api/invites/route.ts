import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendInviteEmail } from "@/lib/email";
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
  const { recipientName, recipientEmail } = body ?? {};

  if (
    typeof recipientName !== "string" ||
    typeof recipientEmail !== "string" ||
    !recipientName.trim() ||
    !recipientEmail.trim()
  ) {
    return NextResponse.json({ message: "Missing fields" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Get sender display name
  const { data: profile } = await admin
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  const senderName =
    profile?.display_name ?? user.email?.split("@")[0] ?? "Someone";

  // Create invite
  const { data: invite, error } = await admin
    .from("invites")
    .insert({
      sender_id: user.id,
      recipient_name: recipientName.trim(),
      recipient_email: recipientEmail.trim().toLowerCase(),
    })
    .select("id, token")
    .single();

  if (error || !invite) {
    return NextResponse.json(
      { message: "Could not create invite." },
      { status: 500 },
    );
  }

  // Send email
  try {
    await sendInviteEmail({
      recipientName: recipientName.trim(),
      recipientEmail: recipientEmail.trim().toLowerCase(),
      senderName,
      token: invite.token,
    });
  } catch {
    // Don't fail the request — invite is created, email is best-effort
    // In production, add a retry queue here
  }

  return NextResponse.json({ token: invite.token });
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { data: invites } = await supabase
    .from("invites")
    .select("id, token, recipient_name, recipient_email, status, created_at")
    .eq("sender_id", user.id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ invites: invites ?? [] });
}
