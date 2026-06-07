import { formatTime } from "@/lib/datetime";

type ItineraryStop = {
  startMinutes: number;
  icon: string;
  label: string;
  venue: { name: string } | null;
};

// Plain-text version of the whole lineup, for calendar event descriptions.
export function buildItineraryText(timeline: ItineraryStop[], planLink: string): string {
  const lines = timeline
    .filter((s) => s.venue)
    .map((s) => `${formatTime(s.startMinutes)} — ${s.icon} ${s.label} @ ${s.venue!.name}`);
  return ["Your date plan 💕", ...lines, "", `Full plan: ${planLink}`].join("\n");
}

// Escape a value for an iCalendar text field.
export function icsEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export function buildGCalLink(
  title: string,
  startMinutes: number,
  endMinutes: number,
  location: string,
  selectedDate: string | null,
  details: string,
): string {
  const base = "https://calendar.google.com/calendar/render?action=TEMPLATE";
  const text = encodeURIComponent(title);
  const loc = encodeURIComponent(location);
  const det = encodeURIComponent(details);

  if (!selectedDate) {
    return `${base}&text=${text}&location=${loc}&details=${det}`;
  }

  const datePart = selectedDate.replace(/-/g, "");
  const startH = Math.floor(startMinutes / 60) % 24;
  const startM = startMinutes % 60;
  const endH = Math.floor(endMinutes / 60) % 24;
  const endM = endMinutes % 60;
  const start = `${datePart}T${startH.toString().padStart(2, "0")}${startM.toString().padStart(2, "0")}00`;
  const end = `${datePart}T${endH.toString().padStart(2, "0")}${endM.toString().padStart(2, "0")}00`;

  return `${base}&text=${text}&dates=${start}/${end}&location=${loc}&details=${det}`;
}
