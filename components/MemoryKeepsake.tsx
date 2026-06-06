"use client";

import { useRef, useState } from "react";

type PhotoRef = { url: string; publicId: string };

const MAX_BYTES = 10 * 1024 * 1024; // Cloudinary free-plan image cap

// Cloudinary URLs support inline transforms — build an optimized square thumb.
function thumb(url: string) {
  return url.replace("/upload/", "/upload/c_fill,w_400,h_400,q_auto,f_auto/");
}

export function MemoryKeepsake({
  planId,
  initialNotes,
  initialPoem,
  initialPhotos,
}: {
  planId: string;
  initialNotes: string;
  initialPoem: string | null;
  initialPhotos: PhotoRef[];
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [poem, setPoem] = useState<string | null>(initialPoem);
  const [photos, setPhotos] = useState<PhotoRef[]>(initialPhotos);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function generate() {
    if (!notes.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, notes }),
      });
      if (!res.ok) {
        setError("Couldn't make your keepsake. Try again.");
        return;
      }
      const data = (await res.json()) as { poem: string | null; poemGenerated: boolean };
      if (data.poemGenerated && data.poem) setPoem(data.poem);
      else setError("Saved your notes, but the poem couldn't be written right now.");
    } catch {
      setError("Couldn't make your keepsake. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function persistPhotos(next: PhotoRef[]) {
    await fetch("/api/memories/photos", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId, photoRefs: next }),
    });
  }

  async function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setUploading(true);
    setError(null);

    try {
      const signRes = await fetch("/api/memories/sign");
      if (!signRes.ok) {
        setError("Photo uploads aren't set up yet.");
        return;
      }
      const sign = (await signRes.json()) as {
        cloudName: string;
        apiKey: string;
        timestamp: number;
        folder: string;
        signature: string;
      };

      const uploaded: PhotoRef[] = [];
      for (const file of files) {
        if (file.size > MAX_BYTES) {
          setError("Each photo must be under 10 MB.");
          continue;
        }
        const form = new FormData();
        form.append("file", file);
        form.append("api_key", sign.apiKey);
        form.append("timestamp", String(sign.timestamp));
        form.append("signature", sign.signature);
        form.append("folder", sign.folder);

        const up = await fetch(`https://api.cloudinary.com/v1_1/${sign.cloudName}/image/upload`, {
          method: "POST",
          body: form,
        });
        if (!up.ok) {
          setError("A photo failed to upload.");
          continue;
        }
        const d = (await up.json()) as { secure_url: string; public_id: string };
        uploaded.push({ url: d.secure_url, publicId: d.public_id });
      }

      if (uploaded.length > 0) {
        const next = [...photos, ...uploaded];
        setPhotos(next);
        await persistPhotos(next);
      }
    } catch {
      setError("Upload failed. Try again.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removePhoto(publicId: string) {
    const next = photos.filter((p) => p.publicId !== publicId);
    setPhotos(next);
    await persistPhotos(next).catch(() => {});
  }

  return (
    <div className="rounded-[24px] border-2 border-[#e7d9ff] bg-white/90 p-5">
      <h2 className="mb-1 text-center font-black text-[#3a2530]">Keepsake 💌</h2>
      <p className="mb-4 text-center text-sm text-[#8a6a78]">
        Jot down the highlights, the funny moments, what you loved — and we&apos;ll turn
        them into a little poem to look back on.
      </p>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={4}
        placeholder="The way she laughed at the bookstore… that tiny dessert place… getting lost on the way home…"
        className="w-full resize-y rounded-2xl border-2 border-[#e7d9ff] bg-[#faf7ff] px-3 py-2 text-sm text-[#3a2530] placeholder:text-[#c0a0b0] outline-none focus:border-[#c7a6ff]"
      />

      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}

      <button
        type="button"
        onClick={() => void generate()}
        disabled={loading || !notes.trim()}
        className="mt-3 w-full rounded-full bg-[#c7a6ff] py-3 font-black text-white shadow-[0_8px_20px_rgba(199,166,255,0.32)] transition disabled:opacity-60 hover:brightness-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#e7d9ff]"
      >
        {loading ? "Writing…" : poem ? "Rewrite our keepsake ✨" : "Write our keepsake ✨"}
      </button>

      {poem && (
        <div className="mt-4 rounded-2xl border-2 border-[#e7d9ff] bg-[#faf7ff] p-4">
          <p className="whitespace-pre-line text-center font-serif text-[15px] leading-relaxed text-[#3a2530]">
            {poem}
          </p>
        </div>
      )}

      {/* Photos */}
      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-black uppercase tracking-widest text-[#c0a0b0]">Photos</p>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="rounded-full border-2 border-[#c7a6ff] px-3 py-1 text-xs font-black text-[#7c5aa0] transition hover:bg-[#f5f0ff] disabled:opacity-60"
          >
            {uploading ? "Uploading…" : "＋ Add photos"}
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => void onPickFiles(e)}
          className="hidden"
        />

        {photos.length > 0 ? (
          <div className="grid grid-cols-3 gap-2">
            {photos.map((p) => (
              <div key={p.publicId} className="group relative aspect-square overflow-hidden rounded-xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={thumb(p.url)} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => void removePhoto(p.publicId)}
                  aria-label="Remove photo"
                  className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/55 text-xs font-black text-white opacity-0 transition group-hover:opacity-100"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-xs text-[#c0a0b0]">
            Add a few snaps from the date — they&apos;ll live here with your poem.
          </p>
        )}
      </div>
    </div>
  );
}
