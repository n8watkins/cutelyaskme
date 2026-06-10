import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getUsageToday } from "@/lib/api-usage";

/** C7: today's outbound API call counts (shown in the planner / Settings). */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const usage = await getUsageToday(["yelp", "overpass", "osrm"]);
  return NextResponse.json({ usage });
}
