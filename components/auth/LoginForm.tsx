"use client";

import { createClient } from "@/lib/supabase/client";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

type Stage = "email" | "otp";

export function LoginForm() {
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/dashboard";

  const [stage, setStage] = useState<Stage>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });

    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setStage("otp");
    }
  }

  async function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: "email",
    });

    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      window.location.href = redirect;
    }
  }

  async function handleGoogleSignIn() {
    setError(null);
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(redirect)}`,
      },
    });
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={handleGoogleSignIn}
        className="flex w-full items-center justify-center gap-3 rounded-full border-2 border-[#ffd6e8] bg-white px-5 py-3 font-black text-[#3a2530] shadow-sm transition hover:bg-[#fff7fb] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#ffd6e8]"
      >
        <GoogleLogo />
        Continue with Google
      </button>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-[#ffd6e8]" />
        <span className="text-xs font-black uppercase tracking-widest text-[#c0a0b0]">
          or
        </span>
        <div className="h-px flex-1 bg-[#ffd6e8]" />
      </div>

      {stage === "email" ? (
        <form onSubmit={handleEmailSubmit} className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            className="w-full rounded-2xl border-2 border-[#ffd6e8] bg-white px-4 py-3 font-black text-[#3a2530] placeholder:font-normal placeholder:text-[#c0a0b0] focus:border-[#ff7aaa] focus:outline-none"
          />
          {error && (
            <p className="text-center text-sm text-red-500">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-[#ff7aaa] py-3 font-black text-white shadow-[0_8px_20px_rgba(255,122,170,0.32)] transition disabled:opacity-60 hover:brightness-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#ffd6e8]"
          >
            {loading ? "Sending code…" : "Send me a code"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleOtpSubmit} className="space-y-3">
          <p className="text-center text-sm text-[#8a6a78]">
            We sent a 6-digit code to <strong>{email}</strong>
          </p>
          <input
            type="text"
            inputMode="numeric"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="123456"
            required
            className="w-full rounded-2xl border-2 border-[#ffd6e8] bg-white px-4 py-3 text-center text-2xl font-black tracking-widest text-[#3a2530] placeholder:text-[#c0a0b0] focus:border-[#ff7aaa] focus:outline-none"
          />
          {error && (
            <p className="text-center text-sm text-red-500">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading || otp.length !== 6}
            className="w-full rounded-full bg-[#ff7aaa] py-3 font-black text-white shadow-[0_8px_20px_rgba(255,122,170,0.32)] transition disabled:opacity-60 hover:brightness-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#ffd6e8]"
          >
            {loading ? "Verifying…" : "Sign in"}
          </button>
          <button
            type="button"
            onClick={() => setStage("email")}
            className="w-full text-center text-sm text-[#c0a0b0] underline"
          >
            Use a different email
          </button>
        </form>
      )}
    </div>
  );
}

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </svg>
  );
}
