import { ImageResponse } from "next/og";
import { formatRecipientName } from "@/lib/planner-copy";

// OG card for invite links so they unfurl cutely in texts/socials.
// The [recipient] param is either an opaque invite token (UUID) or a plain
// name slug. A name slug is already public — it's in the URL itself — so
// personalizing with it leaks nothing. For tokens we stay generic and never
// touch the DB (an unfurl bot shouldn't trigger queries).

export const alt = "You're invited on a date — CutelyAsk";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Satori has no emoji font by default, so hearts are drawn in CSS: a 45°-
// rotated square with two circles for the lobes (the classic CSS heart).
function Heart({
  x,
  y,
  s,
  color,
  opacity = 1,
  tilt = 0,
}: {
  x: number;
  y: number;
  s: number;
  color: string;
  opacity?: number;
  tilt?: number;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: s,
        height: s,
        transform: `rotate(${45 + tilt}deg)`,
        opacity,
        display: "flex",
      }}
    >
      <div
        style={{ position: "absolute", left: 0, top: 0, width: s, height: s, backgroundColor: color }}
      />
      <div
        style={{
          position: "absolute",
          left: -s / 2,
          top: 0,
          width: s,
          height: s,
          backgroundColor: color,
          borderRadius: 9999,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          top: -s / 2,
          width: s,
          height: s,
          backgroundColor: color,
          borderRadius: 9999,
        }}
      />
    </div>
  );
}

export default async function Image({
  params,
}: {
  params: Promise<{ recipient: string }>;
}) {
  const { recipient } = await params;

  let name: string | null = null;
  if (!UUID_RE.test(recipient)) {
    try {
      const formatted = formatRecipientName(recipient);
      if (formatted !== "Hey") name = formatted;
    } catch {
      // Malformed percent-encoding — fall back to the generic card.
    }
  }

  const headline = name ? `${name}, you're invited` : "You're invited";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #ffe1ee 0%, #ffc1da 50%, #ffafcf 100%)",
        }}
      >
        {/* Scattered background hearts */}
        <Heart x={80} y={90} s={70} color="#ff8ab4" opacity={0.55} tilt={-12} />
        <Heart x={1050} y={100} s={84} color="#ff7aaa" opacity={0.45} tilt={14} />
        <Heart x={150} y={450} s={54} color="#ffffff" opacity={0.55} tilt={8} />
        <Heart x={1000} y={430} s={64} color="#ff8ab4" opacity={0.5} tilt={-10} />
        <Heart x={540} y={48} s={38} color="#ffffff" opacity={0.6} tilt={-6} />
        <Heart x={330} y={210} s={28} color="#ffffff" opacity={0.5} tilt={10} />
        <Heart x={840} y={260} s={32} color="#ffffff" opacity={0.5} tilt={-8} />

        {/* Center card */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            backgroundColor: "rgba(255,255,255,0.85)",
            borderRadius: 48,
            border: "5px solid #ffd6e8",
            padding: "56px 90px",
            boxShadow: "0 20px 60px rgba(255,122,170,0.4)",
          }}
        >
          {/* Big heart "envelope seal" */}
          <div style={{ position: "relative", display: "flex", width: 84, height: 84 }}>
            <Heart x={14} y={18} s={54} color="#ff7aaa" />
          </div>
          <div
            style={{
              fontSize: 84,
              color: "#3a2530",
              fontWeight: 700,
              letterSpacing: -2,
              marginTop: 10,
              textAlign: "center",
              display: "flex",
            }}
          >
            {headline}
          </div>
          <div
            style={{
              fontSize: 44,
              color: "#d3406f",
              marginTop: 6,
              display: "flex",
            }}
          >
            on a date
          </div>
          <div
            style={{
              fontSize: 28,
              color: "#8a6a78",
              marginTop: 26,
              display: "flex",
            }}
          >
            CutelyAsk · open the link to answer
          </div>
        </div>
      </div>
    ),
    size,
  );
}
