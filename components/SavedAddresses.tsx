"use client";

import { useState } from "react";

export type AddressKind = "home" | "pickup" | "custom";

export type SavedAddress = {
  id: string;
  label: string;
  kind: AddressKind;
  address: string;
  lat: number | null;
  lng: number | null;
};

export const KIND_ICONS: Record<AddressKind, string> = {
  home: "🏠",
  pickup: "💕",
  custom: "📍",
};

export function SavedAddresses({ initial }: { initial: SavedAddress[] }) {
  const [addresses, setAddresses] = useState<SavedAddress[]>(initial);
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<AddressKind>("custom");
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function useMyLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Location isn't available on this device.");
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setCoords({ lat: latitude, lng: longitude });
        try {
          const res = await fetch(`/api/geocode?lat=${latitude}&lng=${longitude}`);
          const data = (await res.json()) as { label: string | null };
          if (data.label) setAddress(data.label);
        } catch {}
        setLocating(false);
      },
      () => {
        setError("Couldn't get your location.");
        setLocating(false);
      },
      { timeout: 10000 },
    );
  }

  async function save() {
    if (!label.trim() || !address.trim()) return;
    setBusy(true);
    setError(null);
    try {
      let c = coords;
      if (!c) {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(address)}`);
        const data = (await res.json()) as { lat: number | null; lng: number | null };
        if (data.lat != null && data.lng != null) c = { lat: data.lat, lng: data.lng };
      }
      const res = await fetch("/api/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, kind, address, lat: c?.lat ?? null, lng: c?.lng ?? null }),
      });
      if (!res.ok) {
        setError("Couldn't save. Try again.");
        return;
      }
      const data = (await res.json()) as { address: SavedAddress };
      // Home/pickup are singletons server-side — drop any replaced row locally too.
      setAddresses((p) => [
        data.address,
        ...p.filter((a) => !(kind !== "custom" && a.kind === kind)),
      ]);
      setLabel("");
      setKind("custom");
      setAddress("");
      setCoords(null);
      setOpen(false);
    } catch {
      setError("Couldn't save. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setAddresses((p) => p.filter((a) => a.id !== id));
    await fetch(`/api/addresses?id=${id}`, { method: "DELETE" }).catch(() => {});
  }

  return (
    <div>
      {addresses.length > 0 && (
        <div className="mb-3 grid gap-2">
          {addresses.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-3 rounded-2xl border-2 border-[#ffd6e8] bg-white p-3"
            >
              <span className="text-lg">{KIND_ICONS[a.kind] ?? "📍"}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-black text-[#3a2530]">{a.label}</p>
                <p className="truncate text-xs text-[#8a6a78]">{a.address}</p>
              </div>
              <button
                type="button"
                onClick={() => void remove(a.id)}
                aria-label={`Delete ${a.label}`}
                className="shrink-0 px-2 text-xs font-black text-[#c0a0b0] transition hover:text-[#d32323]"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {open ? (
        <div className="rounded-2xl border-2 border-[#e7d9ff] bg-[#faf7ff] p-3">
          {/* Kind — home/pickup get an icon + replace the previous one */}
          <div className="mb-2 flex gap-1.5">
            {(["home", "pickup", "custom"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setKind(k);
                  if (k === "home" && !label.trim()) setLabel("Home");
                  if (k === "pickup" && !label.trim()) setLabel("Pickup spot");
                }}
                aria-pressed={kind === k}
                className={`rounded-full px-2.5 py-1 text-xs font-black transition ${
                  kind === k
                    ? "bg-[#c7a6ff] text-white"
                    : "border border-[#e7d9ff] text-[#8a6a78] hover:bg-white"
                }`}
              >
                {KIND_ICONS[k]} {k === "home" ? "Home" : k === "pickup" ? "Pickup" : "Other"}
              </button>
            ))}
          </div>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label — Home, Alex's place…"
            className="mb-2 w-full rounded-xl border-2 border-[#e7d9ff] bg-white px-3 py-2 text-sm font-black text-[#3a2530] placeholder:font-normal placeholder:text-[#c0a0b0] outline-none focus:border-[#c7a6ff]"
          />
          <div className="flex gap-2">
            <input
              value={address}
              onChange={(e) => {
                setAddress(e.target.value);
                setCoords(null);
              }}
              placeholder="Address, city, or zip"
              className="flex-1 rounded-xl border-2 border-[#e7d9ff] bg-white px-3 py-2 text-sm text-[#3a2530] placeholder:text-[#c0a0b0] outline-none focus:border-[#c7a6ff]"
            />
            <button
              type="button"
              onClick={useMyLocation}
              disabled={locating}
              title="Use my current location"
              className="shrink-0 rounded-xl border-2 border-[#c7a6ff] px-3 text-sm font-black text-[#7c5aa0] transition hover:bg-[#f5f0ff] disabled:opacity-60"
            >
              {locating ? "…" : "📍"}
            </button>
          </div>
          {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => void save()}
              disabled={busy || !label.trim() || !address.trim()}
              className="flex-1 rounded-full bg-[#c7a6ff] py-2 text-sm font-black text-white shadow-sm transition hover:brightness-105 disabled:opacity-60"
            >
              {busy ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
              className="rounded-full border-2 border-[#ffd6e8] px-4 py-2 text-sm font-black text-[#8a6a78]"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full rounded-full border-2 border-dashed border-[#c7a6ff] py-2 text-sm font-black text-[#7c5aa0] transition hover:bg-[#f5f0ff]"
        >
          + Add an address
        </button>
      )}
    </div>
  );
}
