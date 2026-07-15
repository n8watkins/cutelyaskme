// Pure diff logic for the photo deletion lifecycle: when a memory's
// photo_refs list is replaced, which Cloudinary publicIds disappeared?
// Tested in photo-refs.test.ts.

import { parsePhotoRefs, type PhotoRef } from "./memory-display";

export const MAX_MEMORY_PHOTOS = 20;

export function memoryPhotoFolder(planId: string, userId: string): string {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(planId)) throw new Error("invalid plan id");
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(userId)) throw new Error("invalid user id");
  return `date-memories/${planId}/${userId}`;
}

export function memoryPhotoDeliveryUrl(cloudName: string, publicId: string): string {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(cloudName)) {
    throw new Error("invalid Cloudinary cloud name");
  }
  if (!/^[A-Za-z0-9_./-]{1,512}$/.test(publicId) || publicId.includes("..")) {
    throw new Error("invalid Cloudinary public id");
  }

  const encodedPublicId = publicId.split("/").map(encodeURIComponent).join("/");
  return `https://res.cloudinary.com/${encodeURIComponent(cloudName)}/image/upload/${encodedPublicId}`;
}

export function isOwnedMemoryPublicId(
  publicId: string,
  planId: string,
  userId: string,
): boolean {
  const folder = memoryPhotoFolder(planId, userId);
  return (
    publicId.startsWith(`${folder}/`) &&
    /^[A-Za-z0-9_./-]{1,512}$/.test(publicId) &&
    !publicId.includes("..")
  );
}

/**
 * The publicIds present in the stored photo_refs JSON but absent from the
 * incoming list — i.e. the assets being removed. Deduplicated; reorders and
 * additions yield []; malformed stored JSON yields [] (nothing is ever
 * destroyed on a parse failure).
 */
export function removedPublicIds(
  storedJson: string | null,
  incoming: PhotoRef[],
  canDestroy: (publicId: string) => boolean = () => true,
): string[] {
  const stored = parsePhotoRefs(storedJson);
  if (stored.length === 0) return [];
  const keep = new Set(incoming.map((p) => p.publicId));
  return [...new Set(stored.map((p) => p.publicId))].filter(
    (id) => !keep.has(id) && canDestroy(id),
  );
}
