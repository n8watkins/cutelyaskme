"use client";

import { useEffect, useState } from "react";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

type State = "unsupported" | "loading" | "default" | "enabled" | "denied" | "error";

export function EnableNotifications() {
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      const supported =
        typeof window !== "undefined" &&
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        !!VAPID_PUBLIC_KEY;
      if (!supported) {
        if (active) setState("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        if (active) setState("denied");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager.getSubscription();
        if (active) setState(sub ? "enabled" : "default");
      } catch {
        if (active) setState("default");
      }
    });
    return () => {
      active = false;
    };
  }, []);

  async function enable() {
    setState("loading");
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "default");
        return;
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!) as BufferSource,
      });

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub),
      });
      setState(res.ok ? "enabled" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "unsupported" || state === "enabled") {
    return state === "enabled" ? (
      <p className="text-xs font-black text-[#7c5aa0]">🔔 Notifications on</p>
    ) : null;
  }

  return (
    <div className="rounded-[20px] border-2 border-[#e7d9ff] bg-[#faf7ff] p-4">
      <p className="text-sm font-black text-[#3a2530]">Get notified about your dates 🔔</p>
      <p className="mb-3 text-xs text-[#8a6a78]">
        We&apos;ll ping you when a date is set. On iPhone, add this to your Home Screen first.
      </p>
      {state === "denied" ? (
        <p className="text-xs font-black text-[#c0a0b0]">
          Notifications are blocked — enable them in your browser settings.
        </p>
      ) : (
        <button
          type="button"
          onClick={() => void enable()}
          disabled={state === "loading"}
          className="rounded-full bg-[#c7a6ff] px-4 py-2 text-sm font-black text-white shadow-sm transition hover:brightness-105 disabled:opacity-60"
        >
          {state === "loading" ? "…" : state === "error" ? "Try again" : "Enable notifications"}
        </button>
      )}
    </div>
  );
}
