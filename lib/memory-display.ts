// G1: pure helpers for the keepsake card page — which memory row a viewer
// should see, and safe parsing of a row's photo_refs JSON. Tested in
// memory-display.test.ts.

export type MemoryRowLike = {
  authorId: string;
  notes: string | null;
  poem: string | null;
  photoRefs: string;
  musicTrack: string | null;
  updatedAt: string;
};

export type PhotoRef = { url: string; publicId: string };

/**
 * The memory to display for a viewer: their own row when they wrote one,
 * otherwise the other participant's (newest first when several), else null.
 * `viewerId` may be null (Task B's share-link path) — then any row works.
 */
export function pickMemoryForViewer<T extends MemoryRowLike>(
  memories: T[],
  viewerId: string | null,
): T | null {
  if (memories.length === 0) return null;
  const own = viewerId ? memories.find((m) => m.authorId === viewerId) : undefined;
  if (own) return own;
  // Not the viewer's own — show the most recently updated one.
  return [...memories].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
}

/** Parse a photo_refs JSON column to a clean PhotoRef[] — bad JSON/shape → []. */
export function parsePhotoRefs(json: string | null): PhotoRef[] {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is PhotoRef =>
        typeof p === "object" &&
        p !== null &&
        typeof (p as PhotoRef).url === "string" &&
        typeof (p as PhotoRef).publicId === "string",
    );
  } catch {
    return [];
  }
}
