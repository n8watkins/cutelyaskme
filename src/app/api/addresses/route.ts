import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { savedAddresses } from "@/lib/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ addresses: [] }, { status: 401 });

  // Home first, then pickup, then customs newest-first.
  const rows = await db
    .select()
    .from(savedAddresses)
    .where(eq(savedAddresses.userId, userId))
    .orderBy(
      sql`case ${savedAddresses.kind} when 'home' then 0 when 'pickup' then 1 else 2 end`,
      desc(savedAddresses.createdAt),
    );

  return NextResponse.json({ addresses: rows });
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const label = ((body?.label as string | undefined) ?? "").trim();
  const address = ((body?.address as string | undefined) ?? "").trim();
  const lat = typeof body?.lat === "number" ? body.lat : null;
  const lng = typeof body?.lng === "number" ? body.lng : null;
  const rawKind = (body?.kind as string | undefined) ?? "custom";
  const kind = rawKind === "home" || rawKind === "pickup" ? rawKind : "custom";

  if (!label || !address) {
    return NextResponse.json({ message: "Label and address required" }, { status: 400 });
  }

  // Home/pickup are singletons — saving again replaces the previous one.
  if (kind !== "custom") {
    await db
      .delete(savedAddresses)
      .where(and(eq(savedAddresses.userId, userId), eq(savedAddresses.kind, kind)));
  }

  const row = {
    id: crypto.randomUUID(),
    userId,
    label,
    kind,
    address,
    lat,
    lng,
    createdAt: new Date().toISOString(),
  };
  await db.insert(savedAddresses).values(row);

  return NextResponse.json({ address: row });
}

export async function DELETE(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ message: "Missing id" }, { status: 400 });

  await db
    .delete(savedAddresses)
    .where(and(eq(savedAddresses.userId, userId), eq(savedAddresses.id, id)));

  return NextResponse.json({ ok: true });
}
