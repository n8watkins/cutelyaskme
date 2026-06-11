"use client";

// G1: the full-screen animated keepsake card rendered by /plan/[id]/memory.
// All data arrives via props from the server page. The author additionally
// gets a track picker (persisted via PATCH /api/memories/share) and a share
// toggle that mints/revokes the public `?share=<token>` link.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { PhotoRef } from "@/lib/memory-display";
import { buildShareUrl } from "@/lib/memory-share";
import { MUSIC_TRACKS, resolveMusicTrack } from "@/lib/memory-music";

const SLIDE_MS = 4500;

// Fixed drift configs (no render-time randomness — react-hooks/purity).
const HEARTS: { left: string; size: string; duration: string; delay: string; emoji: string }[] = [
  { left: "6%", size: "16px", duration: "13s", delay: "0s", emoji: "💗" },
  { left: "18%", size: "22px", duration: "17s", delay: "3.5s", emoji: "🌸" },
  { left: "32%", size: "14px", duration: "15s", delay: "7s", emoji: "💞" },
  { left: "47%", size: "18px", duration: "19s", delay: "1.5s", emoji: "💗" },
  { left: "61%", size: "13px", duration: "14s", delay: "9s", emoji: "🌷" },
  { left: "74%", size: "20px", duration: "18s", delay: "5s", emoji: "💕" },
  { left: "88%", size: "15px", duration: "16s", delay: "11s", emoji: "💗" },
];

// Cloudinary URLs support inline transforms (same trick as MemoryKeepsake).
function slideUrl(url: string) {
  return url.replace("/upload/", "/upload/c_fill,w_900,h_675,q_auto,f_auto/");
}
function thumbUrl(url: string) {
  return url.replace("/upload/", "/upload/c_fill,w_200,h_200,q_auto,f_auto/");
}

export function KeepsakeCard({
  planId,
  title,
  dateLabel,
  poem,
  notes,
  photos,
  initialTrackId,
  canPickTrack,
  canShare,
  initialShareToken,
  serifClass,
}: {
  planId: string;
  title: string;
  dateLabel: string | null;
  poem: string | null;
  notes: string | null;
  photos: PhotoRef[];
  /** A MUSIC_TRACKS id (already resolved/validated server-side). */
  initialTrackId: string;
  /** True when the viewer authored this memory — shows the track picker. */
  canPickTrack: boolean;
  /** True when the viewer authored this memory — shows the share toggle. */
  canShare: boolean;
  /** The author's current share token (null = sharing off / not the author). */
  initialShareToken: string | null;
  /** className of the display serif (next/font) for the poem + title. */
  serifClass: string;
}) {
  // ── Slideshow ──
  const [slide, setSlide] = useState(0);
  useEffect(() => {
    if (photos.length < 2) return;
    const timer = setInterval(() => {
      setSlide((s) => (s + 1) % photos.length);
    }, SLIDE_MS);
    return () => clearInterval(timer);
  }, [photos.length]);

  // ── Music (tap-to-play only — browsers block autoplay) ──
  const audioRef = useRef<HTMLAudioElement>(null);
  const [trackId, setTrackId] = useState(initialTrackId);
  const [playing, setPlaying] = useState(false);
  const track = resolveMusicTrack(trackId);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }
    void audio
      .play()
      .then(() => setPlaying(true))
      .catch(() => setPlaying(false));
  }

  function pickTrack(id: string) {
    if (id === trackId) return;
    setTrackId(id);
    const audio = audioRef.current;
    if (audio && playing) {
      // Swap the source mid-play so the new loop starts right away.
      audio.src = resolveMusicTrack(id).src;
      void audio.play().catch(() => setPlaying(false));
    }
    // Persist the choice (optimistic — local playback already switched; the
    // picker only renders for the author, whose row the PATCH targets).
    void fetch("/api/memories/share", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId, musicTrack: id }),
    }).catch(() => {});
  }

  // ── Share link (author only) ──
  const [shareToken, setShareToken] = useState(initialShareToken);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // window.location.origin isn't available during SSR — grab it after mount
  // (async, per the no-sync-setState-in-effect lint rule).
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) setOrigin(window.location.origin);
    });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const shareUrl = shareToken && origin ? buildShareUrl(origin, planId, shareToken) : null;

  async function setSharing(on: boolean) {
    setShareBusy(true);
    setShareError(null);
    try {
      const res = await fetch("/api/memories/share", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, share: on }),
      });
      if (!res.ok) throw new Error("share toggle failed");
      const data = (await res.json()) as { shareToken: string | null };
      setShareToken(data.shareToken);
    } catch {
      setShareError("Couldn't update the share link. Try again.");
    } finally {
      setShareBusy(false);
    }
  }

  function copyShareUrl() {
    if (!shareUrl) return;
    void navigator.clipboard
      .writeText(shareUrl)
      .then(() => setCopied(true))
      .catch(() => setShareError("Couldn't copy — select the link and copy it manually."));
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#fff7fb] via-[#ffeaf3] to-[#ffdcea] px-4 py-10 sm:py-14">
      {/* Drifting hearts — decorative only. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {HEARTS.map((h, i) => (
          <span
            key={i}
            className="absolute bottom-[-3rem]"
            style={{
              left: h.left,
              fontSize: h.size,
              animation: `keepsake-heart-drift ${h.duration} linear ${h.delay} infinite`,
            }}
          >
            {h.emoji}
          </span>
        ))}
      </div>

      <div className="relative mx-auto max-w-xl">
        {/* Outer frame */}
        <div className="rounded-[34px] border-2 border-[#ffd6e8] bg-white/85 p-2 shadow-[0_18px_50px_rgba(255,122,170,0.22)] backdrop-blur-sm">
          {/* Inner dashed mat */}
          <div className="relative rounded-[28px] border-2 border-dashed border-[#ffc3dd] bg-gradient-to-b from-white via-[#fff7fb] to-[#fff0f6] px-5 py-9 sm:px-9">
            {/* Corner foliage/heart accents */}
            <span aria-hidden className="absolute left-3 top-2 text-xl">🌸</span>
            <span aria-hidden className="absolute right-3 top-2 text-xl">🌿</span>
            <span aria-hidden className="absolute bottom-2 left-3 text-xl">🌿</span>
            <span aria-hidden className="absolute bottom-2 right-3 text-xl">💮</span>

            {/* Header */}
            <header className="text-center">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#c0a0b0]">
                A keepsake from
              </p>
              <h1 className={`${serifClass} mt-2 text-3xl text-[#3a2530] sm:text-4xl`}>
                {title}
              </h1>
              {dateLabel && (
                <p className="mt-2 text-sm font-black text-[#ff7aaa]">💌 {dateLabel}</p>
              )}
            </header>

            {/* Poem centerpiece */}
            {poem && (
              <div
                className="mt-8"
                style={{ animation: "keepsake-fade-up 1.4s ease-out both" }}
              >
                <div aria-hidden className="mx-auto mb-4 h-px w-24 bg-gradient-to-r from-transparent via-[#ffaccd] to-transparent" />
                <p
                  className={`${serifClass} whitespace-pre-line text-center text-lg italic leading-loose text-[#3a2530] sm:text-xl`}
                >
                  {poem}
                </p>
                <div aria-hidden className="mx-auto mt-4 h-px w-24 bg-gradient-to-r from-transparent via-[#ffaccd] to-transparent" />
              </div>
            )}

            {/* Photo slideshow (0 photos → skipped; 1 photo → static) */}
            {photos.length > 0 && (
              <div className="relative mt-8 aspect-[4/3] overflow-hidden rounded-[22px] border-2 border-[#ffd6e8] bg-[#fff0f6]">
                {photos.map((p, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={p.publicId}
                    src={slideUrl(p.url)}
                    alt=""
                    className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ease-in-out ${
                      i === slide ? "opacity-100" : "opacity-0"
                    }`}
                  />
                ))}
              </div>
            )}

            {/* Gallery strip — clicking a thumb jumps the slideshow there. */}
            {photos.length > 1 && (
              <div className="mt-3 flex justify-center gap-2 overflow-x-auto pb-1">
                {photos.map((p, i) => (
                  <button
                    key={p.publicId}
                    type="button"
                    onClick={() => setSlide(i)}
                    aria-label={`Show photo ${i + 1}`}
                    aria-current={i === slide}
                    className={`h-14 w-14 shrink-0 overflow-hidden rounded-xl border-2 transition ${
                      i === slide
                        ? "border-[#ff7aaa] shadow-[0_4px_12px_rgba(255,122,170,0.35)]"
                        : "border-[#ffd6e8] opacity-70 hover:opacity-100"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={thumbUrl(p.url)} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            {/* The author's notes, smaller, below the poem/photos. */}
            {notes && (
              <div className="mt-8 rounded-2xl border-2 border-[#ffe2ee] bg-white/70 p-4">
                <p className="mb-1 text-center text-[10px] font-black uppercase tracking-[0.2em] text-[#c0a0b0]">
                  How we remember it
                </p>
                <p className="whitespace-pre-line text-center text-sm leading-relaxed text-[#8a6a78]">
                  {notes}
                </p>
              </div>
            )}

            {/* Music — tap-to-play loop, never autoplay. */}
            <div className="mt-8 rounded-2xl border-2 border-[#ffe2ee] bg-white/70 p-4">
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={togglePlay}
                  aria-pressed={playing}
                  aria-label={playing ? "Pause music" : "Play music"}
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#ff7aaa] text-xl font-black text-white shadow-[0_8px_20px_rgba(255,122,170,0.4)] transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#ffd6e8]"
                >
                  {playing ? "⏸" : "♪"}
                </button>
                <div>
                  <p className="text-sm font-black text-[#3a2530]">
                    {playing ? "Now playing…" : "Tap for a little music"}
                  </p>
                  <p className="text-xs text-[#8a6a78]">{track.label}</p>
                </div>
              </div>

              {canPickTrack && (
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  {MUSIC_TRACKS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => pickTrack(t.id)}
                      aria-pressed={t.id === trackId}
                      className={`rounded-full border-2 px-3 py-1 text-xs font-black transition ${
                        t.id === trackId
                          ? "border-[#ff7aaa] bg-[#fff0f6] text-[#ff5f99]"
                          : "border-[#ffd6e8] text-[#8a6a78] hover:bg-[#fff7fb]"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              )}

              <p className="mt-3 text-center text-[10px] leading-snug text-[#c0a0b0]">
                {track.attribution}
              </p>
              <audio ref={audioRef} src={track.src} loop preload="none" />
            </div>

            {/* Share link (author only) — send the card like a postcard. */}
            {canShare && (
              <div className="mt-4 rounded-2xl border-2 border-[#ffe2ee] bg-white/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-[#3a2530]">Share this keepsake 💌</p>
                    <p className="text-xs text-[#8a6a78]">
                      {shareToken
                        ? "Anyone with this link can view your keepsake — no account needed."
                        : "Make a link you can send like a card."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void setSharing(!shareToken)}
                    disabled={shareBusy}
                    aria-pressed={!!shareToken}
                    className={`shrink-0 rounded-full border-2 px-4 py-2 text-xs font-black transition disabled:opacity-60 ${
                      shareToken
                        ? "border-[#ff7aaa] bg-[#fff0f6] text-[#ff5f99] hover:bg-[#ffe2ee]"
                        : "border-[#ffd6e8] text-[#8a6a78] hover:bg-[#fff7fb]"
                    }`}
                  >
                    {shareBusy ? "…" : shareToken ? "Turn off link" : "Create link 🔗"}
                  </button>
                </div>

                {shareUrl && (
                  <div className="mt-3 flex gap-2">
                    <input
                      readOnly
                      value={shareUrl}
                      onFocus={(e) => e.currentTarget.select()}
                      aria-label="Share link"
                      className="w-full min-w-0 rounded-xl border-2 border-[#ffd6e8] bg-[#fff7fb] px-3 py-2 text-xs text-[#8a6a78] outline-none focus:border-[#ff9dc0]"
                    />
                    <button
                      type="button"
                      onClick={copyShareUrl}
                      className="shrink-0 rounded-xl bg-[#ff7aaa] px-3 py-2 text-xs font-black text-white shadow-[0_4px_12px_rgba(255,122,170,0.35)] transition hover:brightness-105"
                    >
                      {copied ? "Copied! 💗" : "Copy"}
                    </button>
                  </div>
                )}

                {shareError && (
                  <p className="mt-2 text-center text-xs text-red-500">{shareError}</p>
                )}
              </div>
            )}

            <p className="mt-8 text-center">
              <Link
                href={`/plan/${planId}`}
                className="text-sm font-black text-[#ff7aaa] underline decoration-[#ffd6e8] decoration-2 underline-offset-4 hover:text-[#ff5f99]"
              >
                ← Back to the plan
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
