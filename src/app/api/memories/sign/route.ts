import { auth } from "@clerk/nextjs/server";
import { signCloudinaryParams } from "@/lib/cloudinary";
import { NextResponse } from "next/server";

// Hands the client a short-lived signature so it can upload directly to
// Cloudinary without the API secret ever reaching the browser.
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return NextResponse.json({ message: "Cloudinary not configured" }, { status: 503 });
  }

  const timestamp = Math.round(Date.now() / 1000);
  const folder = "date-memories";

  // Sign the alphabetically-sorted params, then append the secret (Cloudinary spec).
  const signature = signCloudinaryParams({ folder, timestamp }, apiSecret);

  return NextResponse.json({ cloudName, apiKey, timestamp, folder, signature });
}
