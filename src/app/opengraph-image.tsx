import { OG_SIZE, dataUrl, shareCard } from "@/lib/og-card";
import { readPublicFile } from "@/lib/publicFile";

// Site-wide share card (Open Graph and Twitter): the n8builds family layout in
// Cutely Ask Me's pinks, with the invite card on the right. Route-specific cards
// (e.g. /invite) override this one.

export const alt = "Cutely Ask Me: plan a date, send a cute invite, and keep the memory.";
export const size = OG_SIZE;
export const contentType = "image/png";

const ink = "#3b1d2e";

export default async function Image() {
  // Nunito (OFL, public/og/Nunito-LICENSE.txt) and the marks, from public/.
  const [semiBold, extraBold, mark, n8] = await Promise.all([
    readPublicFile("/og/Nunito-SemiBold.ttf"),
    readPublicFile("/og/Nunito-ExtraBold.ttf"),
    readPublicFile("/og/invite-mark.png"),
    readPublicFile("/og/n8-icon.png"),
  ]);
  const markUrl = dataUrl(mark, "image/png");

  return shareCard({
    colors: {
      bg: "#fff7fb",
      bgImage: "linear-gradient(135deg, #fff7fb 0%, #ffe3ef 55%, #ffc9df 100%)",
      ink,
      muted: "#a0647f",
      body: "#7a4a60",
      accent: "#ff7aaa",
    },
    font: "Nunito",
    fonts: [
      { name: "Nunito", data: semiBold, weight: 500 },
      { name: "Nunito", data: extraBold, weight: 800 },
    ],
    logo: markUrl,
    logoStyle: { background: "#ffffff" },
    n8Icon: dataUrl(n8, "image/png"),
    host: "cutelyaskme.n8builds.dev",
    name: "Cutely Ask Me",
    nameSize: 70,
    nameTracking: -1.5,
    tagline: "Plan a date, send a cute invite, and keep the memory.",
    visual: <InviteCard mark={markUrl} />,
  });
}

/** The invite a date receives: the envelope, the question and the two buttons. */
function InviteCard({ mark }: { mark: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        position: "absolute",
        left: 676,
        top: 70,
        width: 460,
        height: 600,
        padding: "54px 40px",
        borderRadius: 36,
        background: "rgba(255,255,255,0.88)",
        border: "2px solid #ffd6e8",
        boxShadow: "0 30px 70px rgba(255,122,170,0.30)",
      }}
    >
      <img src={mark} width={112} height={112} alt="" />
      <div style={{ display: "flex", marginTop: 22, fontSize: 17, fontWeight: 800, letterSpacing: 3, color: "#c0607f" }}>
        TINY DATE DELIVERY
      </div>
      <div style={{ display: "flex", marginTop: 10, fontSize: 48, fontWeight: 800, color: ink }}>Sam...</div>
      <div style={{ display: "flex", marginTop: 4, fontSize: 21, color: "#8a5a70" }}>I made you a tiny little invitation.</div>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          marginTop: 30,
          width: 340,
          fontSize: 34,
          fontWeight: 800,
          color: ink,
          textAlign: "center",
          lineHeight: 1.25,
        }}
      >
        Will you go on a date with me?
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 22, marginTop: 34 }}>
        <div
          style={{
            display: "flex",
            padding: "10px 20px",
            borderRadius: 999,
            border: "1.5px solid #f3c5d8",
            fontSize: 19,
            color: "#a07888",
            background: "#ffffff",
          }}
        >
          No
        </div>
        <div
          style={{
            display: "flex",
            padding: "18px 54px",
            borderRadius: 999,
            fontSize: 28,
            fontWeight: 800,
            color: "#ffffff",
            background: "linear-gradient(180deg, #ff7aaa, #ff5c95)",
            boxShadow: "0 12px 28px rgba(255,92,149,0.45)",
          }}
        >
          Yes!
        </div>
      </div>
    </div>
  );
}
