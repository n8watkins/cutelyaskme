// Pure diff logic for the photo deletion lifecycle: when a memory's
// photo_refs list is replaced, which Cloudinary publicIds disappeared?
// Tested in photo-refs.test.ts.

import { parsePhotoRefs, type PhotoRef } from "./memory-display";

/**
 * The publicIds present in the stored photo_refs JSON but absent from the
 * incoming list — i.e. the assets being removed. Deduplicated; reorders and
 * additions yield []; malformed stored JSON yields [] (nothing is ever
 * destroyed on a parse failure).
 */
export function removedPublicIds(storedJson: string | null, incoming: PhotoRef[]): string[] {
  const stored = parsePhotoRefs(storedJson);
  if (stored.length === 0) return [];
  const keep = new Set(incoming.map((p) => p.publicId));
  return [...new Set(stored.map((p) => p.publicId))].filter((id) => !keep.has(id));
}
