import { auth, clerkClient } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { invites } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { sendInviteEmail } from "@/lib/email";
import { NextRequest, NextResponse } from "next/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Simple in-memory rate limit: max 10 invites per user per hour
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count++;
  return true;
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const { recipientName, recipientEmail } = body ?? {};

  if (
    typeof recipientName !== "string" ||
    typeof recipientEmail !== "string" ||
    !recipientName.trim() ||
    !EMAIL_RE.test(recipientEmail.trim())
  ) {
    return NextResponse.json({ message: "Missing or invalid fields" }, { status: 400 });
  }

  if (!checkRateLimit(userId)) {
    return NextResponse.json({ message: "Too many invites. Try again later." }, { status: 429 });
  }

  const clerk = await clerkClient();
  const sender = await clerk.users.getUser(userId);
  const senderName =
    sender.firstName ??
    sender.emailAddresses[0]?.emailAddress?.split("@")[0] ??
    "Someone";

  const id = crypto.randomUUID();
  const token = crypto.randomUUID();

  await db.insert(invites).values({
    id,
    token,
    senderId: userId,
    recipientName: recipientName.trim(),
    recipientEmail: recipientEmail.trim().toLowerCase(),
  });

  try {
    await sendInviteEmail({
      recipientName: recipientName.trim(),
      recipientEmail: recipientEmail.trim().toLowerCase(),
      senderName,
      token,
    });
  } catch {
    // Non-blocking — invite is created, email is best-effort
  }

  return NextResponse.json({ token });
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select()
    .from(invites)
    .where(eq(invites.senderId, userId))
    .orderBy(desc(invites.createdAt));

  return NextResponse.json({ invites: rows });
}
