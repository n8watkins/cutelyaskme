// Minute-of-day helpers shared by the planner timeline and sun calculations.

export function parseTimeToMinutes(t: string | null): number {
  if (!t) return 19 * 60; // default 7pm
  const parts = t.split(":");
  return parseInt(parts[0] ?? "19", 10) * 60 + parseInt(parts[1] ?? "0", 10);
}

export function formatTime(minutes: number): string {
  const totalMins = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const displayH = h % 12 || 12;
  return `${displayH}:${m.toString().padStart(2, "0")} ${ampm}`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
