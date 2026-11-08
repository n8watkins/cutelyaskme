"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/error-reporting";

// Shown only when the root layout itself fails, so it carries its own markup
// and styles (the home page's colors, inlined).
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => reportError(error), [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#fff7fb", color: "#3a2530", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" }}>
        <main style={{ minHeight: "100svh", padding: "48px 16px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
          <div aria-hidden="true" style={{ fontSize: 60 }}>
            💌
          </div>
          <h1 style={{ fontSize: 30, fontWeight: 900, margin: "16px 0 0" }}>Cutely Ask Me didn&apos;t load.</h1>
          <p style={{ maxWidth: 320, color: "#7a5a68", lineHeight: 1.5, margin: "12px 0 0" }}>
            That one is on us, and we have been told. Your plans and invites are safe.
          </p>
          <button type="button" onClick={reset} style={{ marginTop: 32, padding: "12px 24px", border: 0, borderRadius: 999, background: "#ff7aaa", color: "#fff", fontWeight: 900, fontSize: 16, cursor: "pointer" }}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
