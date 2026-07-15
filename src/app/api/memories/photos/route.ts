import { auth } from "@clerk/nextjs/server";
import { destroyCloudinaryImage } from "@/lib/cloudinary";
import { db } from "@/lib/db";
import { dateMemories, datePlans } from "@/lib/db/schema";
import {
  isOwnedMemoryPublicId,
  MAX_MEMORY_PHOTOS,
  memoryPhotoDeliveryUrl,
  removedPublicIds,
} from "@/lib/photo-refs";
import { requireRouteClaimedParticipant } from "@/lib/plan-route-access";
import { isStoredPlanDateOver } from "@/lib/plan-lifecycle";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

type PhotoRefInput = { publicId: string };

// Persist the full photo list for this user's memory (client manages the array).
export async function PUT(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const planId = body?.planId as string | undefined;
  const incoming = body?.photoRefs as PhotoRefInput[] | undefined;

  if (!planId || !Array.isArray(incoming)) {
    return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloudName) {
    return NextResponse.json({ message: "Cloudinary not configured" }, { status: 503 });
  }

  const seenPublicIds = new Set<string>();
  const photoRefs: { url: string; publicId: string }[] = [];
  for (const photo of incoming) {
    if (photoRefs.length >= MAX_MEMORY_PHOTOS) break;
    if (
      !photo ||
      typeof photo.publicId !== "string" ||
      !isOwnedMemoryPublicId(photo.publicId, planId, userId) ||
      seenPublicIds.has(photo.publicId)
    ) {
      continue;
    }
    seenPublicIds.add(photo.publicId);
    photoRefs.push({
      url: memoryPhotoDeliveryUrl(cloudName, photo.publicId),
      publicId: photo.publicId,
    });
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

  // F4: a canceled date never happened. Nothing about it can be written.
  if (plan.canceledAt) {
    return NextResponse.json({ message: "This date was canceled" }, { status: 409 });
  }
  if (!(await isStoredPlanDateOver(plan))) {
    return NextResponse.json({ message: "Come back after your date 💞" }, { status: 403 });
  }

  // Photo deletion lifecycle: anything in the caller's OWN stored row that is
  // missing from the incoming list is being removed, so the Cloudinary asset
  // should be destroyed too. Diffing against the stored row, never client
  // input) guarantees we only destroy assets this user actually uploaded.
  const [existing] = await db
    .select({ photoRefs: dateMemories.photoRefs })
    .from(dateMemories)
    .where(and(eq(dateMemories.planId, planId), eq(dateMemories.authorId, userId)))
    .limit(1);
  const removed = removedPublicIds(
    existing?.photoRefs ?? null,
    photoRefs,
    (publicId) => isOwnedMemoryPublicId(publicId, planId, userId),
  );

  const now = new Date().toISOString();
  const serialized = JSON.stringify(photoRefs);

  await db
    .insert(dateMemories)
    .values({
      id: crypto.randomUUID(),
      planId,
      authorId: userId,
      notes: null,
      poem: null,
      photoRefs: serialized,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [dateMemories.planId, dateMemories.authorId],
      set: { photoRefs: serialized, updatedAt: now },
    });

  // Best-effort cleanup AFTER the refs update: a Cloudinary failure must not
  // fail the PUT. A leaked asset is better than a stuck UI.
  if (removed.length > 0) {
    const results = await Promise.allSettled(removed.map((id) => destroyCloudinaryImage(id)));
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        console.error(`Failed to destroy Cloudinary asset ${removed[i]}:`, r.reason);
      }
    });
  }

  return NextResponse.json({ ok: true });
}
