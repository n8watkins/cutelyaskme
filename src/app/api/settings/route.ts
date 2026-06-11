import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { parseSettingsPatch, mergeSettings } from "@/lib/settings";
import { getUserSettings, saveUserSettings } from "@/lib/user-settings";

/** B4: the user's settings (defaults when they've never saved any). */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const settings = await getUserSettings(userId);
  return NextResponse.json({ settings });
}

/**
 * B4: partial update — body may contain any subset of UserSettings fields.
 * Enums are strict (400), radii are rounded/clamped, bounds must keep
 * min < max within 1–25 mi (400 otherwise). Returns the merged settings.
 */
export async function PATCH(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = parseSettingsPatch(body);
  if (!parsed.ok) return NextResponse.json({ message: parsed.error }, { status: 400 });

  const current = await getUserSettings(userId);
  const merged = mergeSettings(current, parsed.value);
  if (!merged.ok) return NextResponse.json({ message: merged.error }, { status: 400 });

  await saveUserSettings(userId, merged.value);
  return NextResponse.json({ settings: merged.value });
}
