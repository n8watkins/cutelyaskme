import { auth } from "@clerk/nextjs/server";
import { signCloudinaryParams } from "@/lib/cloudinary";
import { db } from "@/lib/db";
import { datePlans } from "@/lib/db/schema";
import { requireRouteClaimedParticipant } from "@/lib/plan-route-access";
import { isStoredPlanDateOver } from "@/lib/plan-lifecycle";
import { memoryPhotoFolder } from "@/lib/photo-refs";
import { reserveMemoryPhotoSignature } from "@/lib/photo-upload-budget";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

// Hands the client a short-lived signature so it can upload directly to
// Cloudinary without the API secret ever reaching the browser.
export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const planId = request.nextUrl.searchParams.get("planId")?.trim();
  if (!planId) {
    return NextResponse.json({ message: "Plan id is required" }, { status: 400 });
  }

  const [plan] = await db.select().from(datePlans).where(eq(datePlans.id, planId)).limit(1);
  if (!plan) {
    return NextResponse.json({ message: "Plan not found" }, { status: 404 });
  }
  try {
    requireRouteClaimedParticipant(plan, userId);
  } catch {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }
  if (plan.canceledAt) {
    return NextResponse.json({ message: "This date was canceled" }, { status: 409 });
  }
  if (!(await isStoredPlanDateOver(plan))) {
    return NextResponse.json({ message: "Come back after your date 💞" }, { status: 403 });
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return NextResponse.json({ message: "Cloudinary not configured" }, { status: 503 });
  }

  if (!(await reserveMemoryPhotoSignature(planId, userId))) {
    return NextResponse.json(
      { message: "Photo upload limit reached. Try again tomorrow." },
      { status: 429 },
    );
  }

  const timestamp = Math.round(Date.now() / 1000);
  const folder = memoryPhotoFolder(planId, userId);
  const publicId = `${folder}/${crypto.randomUUID()}`;
  const overwrite = "false";

  // One signature authorizes one generated asset name and cannot replace it.
  const signature = signCloudinaryParams(
    { overwrite, public_id: publicId, timestamp },
    apiSecret,
  );

  return NextResponse.json({
    cloudName,
    apiKey,
    timestamp,
    publicId,
    overwrite,
    signature,
  });
}
