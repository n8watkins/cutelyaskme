"use client";

import { useAuth, useClerk } from "@clerk/nextjs";
import { useCallback, useEffect, useRef } from "react";

/**
 * Sign-in is a modal over the page the visitor asked for, never a separate
 * page. src/proxy.ts renders this (through /login) in place of a protected
 * page for signed-out visitors, so the address bar keeps their URL; /login
 * and /sign-up are only fallbacks for old links, opening the same modal. Once signed in, a full reload of
 * `returnTo` lets the proxy serve the real page.
 */
export function SignInGate({
  returnTo,
  mode = "signIn",
}: {
  returnTo: string;
  mode?: "signIn" | "signUp";
}) {
  const clerk = useClerk();
  const { isLoaded, isSignedIn } = useAuth();
  const opened = useRef(false);

  const openSignIn = useCallback(() => {
    if (mode === "signUp") {
      clerk.openSignUp({ forceRedirectUrl: returnTo, signInForceRedirectUrl: returnTo });
    } else {
      clerk.openSignIn({
        withSignUp: true,
        forceRedirectUrl: returnTo,
        signUpForceRedirectUrl: returnTo,
      });
    }
  }, [clerk, mode, returnTo]);

  useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn) {
      window.location.replace(returnTo);
      return;
    }
    if (opened.current) return;
    opened.current = true;
    openSignIn();
  }, [isLoaded, isSignedIn, openSignIn, returnTo]);

  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-4 py-12 text-center">
      <div className="mb-4 text-6xl" aria-hidden>
        💌
      </div>
      <h1 className="text-4xl font-black text-[#3a2530]">Sign in to keep going</h1>
      <p className="mt-2 max-w-xs text-[#8a6a78]">
        Plan a date, send an invite, and let them pick what sounds good.
      </p>
      <button
        type="button"
        onClick={openSignIn}
        disabled={!isLoaded}
        className="mt-8 rounded-full bg-[#ff7aaa] px-6 py-3 font-black text-white shadow-[0_8px_20px_rgba(255,122,170,0.32)] hover:brightness-105 disabled:opacity-60"
      >
        {mode === "signUp" ? "Create your account" : "Sign in"}
      </button>
    </main>
  );
}
