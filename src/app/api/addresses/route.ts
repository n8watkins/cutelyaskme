import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { savedAddresses } from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ addresses: [] }, { status: 401 });

  const rows = await db
    .select()
    .from(savedAddresses)
    .where(eq(savedAddresses.userId, userId))
    .orderBy(desc(savedAddresses.createdAt));

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

  if (!label || !address) {
    return NextResponse.json({ message: "Label and address required" }, { status: 400 });
  }

  const row = {
    id: crypto.randomUUID(),
    userId,
    label,
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
