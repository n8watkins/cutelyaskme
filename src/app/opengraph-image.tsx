import { ImageResponse } from "next/og";

// Site-wide default Open Graph card — pure JSX/CSS (no remote fetches, no
// font files), so it stays fast and dependency-free. Route-specific cards
// (e.g. /invite) override this one.

export const alt = "CutelyAsk — plan the perfect date";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

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

export default function Image() {
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
          background: "linear-gradient(135deg, #fff0f6 0%, #ffd6e8 50%, #ffb7d3 100%)",
        }}
      >
        {/* Scattered background hearts */}
        <Heart x={90} y={80} s={64} color="#ff9ec0" opacity={0.55} tilt={-14} />
        <Heart x={1040} y={110} s={80} color="#ff8ab4" opacity={0.5} tilt={12} />
        <Heart x={180} y={460} s={52} color="#ff8ab4" opacity={0.45} tilt={10} />
        <Heart x={980} y={440} s={60} color="#ff9ec0" opacity={0.55} tilt={-10} />
        <Heart x={560} y={60} s={40} color="#ffffff" opacity={0.6} tilt={6} />
        <Heart x={300} y={180} s={30} color="#ffffff" opacity={0.5} tilt={-8} />
        <Heart x={860} y={250} s={34} color="#ffffff" opacity={0.5} tilt={8} />

        {/* Center card */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            backgroundColor: "rgba(255,255,255,0.82)",
            borderRadius: 48,
            border: "5px solid #ffd6e8",
            padding: "60px 96px",
            boxShadow: "0 20px 60px rgba(255,122,170,0.35)",
          }}
        >
          {/* Inline heart "logo" above the wordmark */}
          <div style={{ position: "relative", display: "flex", width: 72, height: 72 }}>
            <Heart x={10} y={14} s={48} color="#ff7aaa" />
          </div>
          <div
            style={{
              fontSize: 104,
              color: "#3a2530",
              fontWeight: 700,
              letterSpacing: -2,
              marginTop: 8,
              display: "flex",
            }}
          >
            CutelyAsk
          </div>
          <div
            style={{
              fontSize: 34,
              color: "#7c3653",
              marginTop: 14,
              display: "flex",
            }}
          >
            Plan the perfect date — and keep the memory
          </div>
        </div>
      </div>
    ),
    size,
  );
}
