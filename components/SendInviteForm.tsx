"use client";

import { useState } from "react";

type Stage = "form" | "sent";

export function SendInviteForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("form");
  const [token, setToken] = useState<string | null>(null);

  const siteUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const inviteLink = token ? `${siteUrl}/invite/${token}` : "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipientName: name, recipientEmail: email, location: location.trim() || null }),
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
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Brooklyn, NY"
          className="w-full rounded-2xl border-2 border-[#ffd6e8] bg-white px-4 py-3 font-black text-[#3a2530] placeholder:font-normal placeholder:text-[#c0a0b0] focus:border-[#ff7aaa] focus:outline-none"
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
