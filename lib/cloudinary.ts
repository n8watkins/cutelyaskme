// Cloudinary helpers shared by the upload-signing route and the server-side
// destroy call. Signing is pure (tested in cloudinary.test.ts); destroy talks
// to the Cloudinary API and is only ever called from server code.

import { createHash } from "crypto";

/**
 * Cloudinary request signature: SHA-1 of the alphabetically-sorted
 * `key=value` params joined with `&`, with the API secret appended
 * (per the Cloudinary signing spec).
 */
export function signCloudinaryParams(
  params: Record<string, string | number>,
  apiSecret: string,
): string {
  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return createHash("sha1").update(`${toSign}${apiSecret}`).digest("hex");
}

/**
 * Delete an uploaded image from Cloudinary. Throws when the call fails so
 * callers can treat destroys as best-effort (Promise.allSettled + log).
 * A "not found" result is treated as success — the asset is already gone.
 */
export async function destroyCloudinaryImage(publicId: string): Promise<void> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary not configured");
  }

  const timestamp = Math.round(Date.now() / 1000);
  const signature = signCloudinaryParams({ public_id: publicId, timestamp }, apiSecret);

  const form = new FormData();
  form.append("public_id", publicId);
  form.append("timestamp", String(timestamp));
  form.append("api_key", apiKey);
  form.append("signature", signature);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    throw new Error(`Cloudinary destroy failed (HTTP ${res.status}) for ${publicId}`);
  }
  const data = (await res.json()) as { result?: string };
  if (data.result !== "ok" && data.result !== "not found") {
    throw new Error(`Cloudinary destroy returned "${data.result}" for ${publicId}`);
  }
}
