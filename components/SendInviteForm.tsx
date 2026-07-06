"use client";

import { useRef, useState } from "react";
import { LocationAutocomplete } from "@/components/LocationAutocomplete";

type Stage = "form" | "sent";

function resizeImageToDataUrl(file: File, size = 120): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("canvas")); return; }
      const minDim = Math.min(img.width, img.height);
      const sx = (img.width - minDim) / 2;
      const sy = (img.height - minDim) / 2;
      ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = reject;
    img.src = url;
  });
}

export function SendInviteForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [location, setLocation] = useState("");
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("form");
  const [token, setToken] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const siteUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const inviteLink = token ? `${siteUrl}/invite/${token}` : "";

  async function handleAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    try {
      const src = await resizeImageToDataUrl(file);
      setAvatarSrc(src);
    } catch {
      // ignore resize errors silently
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipientName: name,
        recipientEmail: email,
        location: location.trim() || null,
        senderAvatarSrc: avatarSrc,
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.message ?? "Something went wrong.");
      return;
    }

    const data = await res.json();
    setToken(data.token);
    setStage("sent");
  }

  async function handleCopyLink() {
    await navigator.clipboard.writeText(inviteLink).catch(() => null);
  }

  if (stage === "sent") {
    return (
      <div className="space-y-5 text-center">
        <div className="text-5xl">💌</div>
        <div>
          <p className="text-xl font-black text-[#3a2530]">Invite sent!</p>
          <p className="mt-1 text-sm text-[#8a6a78]">
            An email is on its way to {email}. You can also share this link
            directly:
          </p>
        </div>
        <div className="rounded-2xl border-2 border-[#ffd6e8] bg-white px-4 py-3 text-left text-sm text-[#8a6a78] break-all">
          {inviteLink}
        </div>
        <div className="grid gap-3">
          <button
            type="button"
            onClick={handleCopyLink}
            className="w-full rounded-full bg-[#ff7aaa] py-3 font-black text-white shadow-[0_8px_20px_rgba(255,122,170,0.32)] hover:brightness-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#ffd6e8]"
          >
            Copy link
          </button>
          <a
            href="/dashboard"
            className="block w-full rounded-full border-2 border-[#ffd6e8] bg-white py-3 text-center font-black text-[#8a6a78] hover:bg-[#fff7fb] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#ffd6e8]"
          >
            View all invites
          </a>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Avatar picker */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="group relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-[#ffd6e8] bg-[#fff3d6] text-3xl shadow-sm outline-none transition focus-visible:ring-4 focus-visible:ring-[#ffd6e8] hover:border-[#ff7aaa]"
          aria-label="Upload your photo"
        >
          {avatarSrc
            // eslint-disable-next-line @next/next/no-img-element -- data-URL avatar, next/image can't optimize it
            ? <img src={avatarSrc} alt="Your avatar" className="h-full w-full object-cover" />
            : <span>🙂</span>
          }
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/25 text-[10px] font-black text-white opacity-0 transition-opacity group-hover:opacity-100">
            {avatarSrc ? "change" : "upload"}
          </span>
        </button>
        <div>
          <p className="text-sm font-black text-[#8a6a78]">Your photo</p>
          <p className="text-xs text-[#c0a0b0]">Shows as the emoji cursor in their invite experience</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleAvatarFile}
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-black text-[#8a6a78]">
          Their name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Alex"
          required
          className="w-full rounded-2xl border-2 border-[#ffd6e8] bg-white px-4 py-3 font-black text-[#3a2530] placeholder:font-normal placeholder:text-[#c0a0b0] focus:border-[#ff7aaa] focus:outline-none"
        />
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-black text-[#8a6a78]">
          Their email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="alex@email.com"
          required
          className="w-full rounded-2xl border-2 border-[#ffd6e8] bg-white px-4 py-3 font-black text-[#3a2530] placeholder:font-normal placeholder:text-[#c0a0b0] focus:border-[#ff7aaa] focus:outline-none"
        />
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-black text-[#8a6a78]">
          Where are you thinking?
        </label>
        <LocationAutocomplete
          value={location}
          onChange={setLocation}
          onSelect={(geo) => setLocation(geo.label)}
          placeholder="Brooklyn, NY"
          inputClassName="rounded-2xl border-2 border-[#ffd6e8] bg-white px-4 py-3 font-black text-[#3a2530] placeholder:font-normal placeholder:text-[#c0a0b0] focus:border-[#ff7aaa] focus:outline-none"
        />
      </div>
      {error && <p className="text-center text-sm text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-full bg-[#ff7aaa] py-3 font-black text-white shadow-[0_8px_20px_rgba(255,122,170,0.32)] transition disabled:opacity-60 hover:brightness-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#ffd6e8]"
      >
        {loading ? "Sending…" : "Send invite 💌"}
      </button>
    </form>
  );
}
