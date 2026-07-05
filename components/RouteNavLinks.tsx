import { buildLegNavUrl, buildRouteNavUrl, navTravelMode, type NavStop } from "@/lib/nav-links";

export type RouteNavStop = NavStop & {
  /** Route node id ("pickup", activity keys, "__entree__") - keys into legModes. */
  id: string;
  name: string;
};

/**
 * "Getting around" card: one Navigate pill per travel leg plus a button for
 * the whole route, all free Google Maps deep links (no API calls). Renders
 * nothing until there are at least two points to route between.
 */
export function RouteNavLinks({
  stops,
  legModes,
}: {
  stops: RouteNavStop[];
  legModes: Record<string, "drive" | "walk">;
}) {
  if (stops.length < 2) return null;

  const routeUrl = buildRouteNavUrl(stops);
  const legs = stops.slice(1).map((to, i) => {
    const from = stops[i];
    const key = `${from.id}→${to.id}`;
    const mode = legModes[key] === "walk" ? "walk" : "drive";
    return { key, from, to, mode, url: buildLegNavUrl(from, to, navTravelMode(mode)) };
  });

  return (
    <div className="mb-6 rounded-[24px] border-2 border-[#ffd6e8] bg-white p-5">
      <h2 className="mb-3 font-black text-[#3a2530]">Getting around 🧭</h2>
      <div className="flex flex-wrap gap-2">
        {legs.map((leg) => (
          <a
            key={leg.key}
            href={leg.url}
            target="_blank"
            rel="noopener noreferrer"
            title={`Navigate from ${leg.from.name} to ${leg.to.name}`}
            className="flex max-w-full items-center gap-1 rounded-full border border-[#ffd6e8] px-2.5 py-1 text-[11px] font-black text-[#8a6a78] transition hover:bg-[#fff7fb]"
          >
            <span>{leg.mode === "walk" ? "🚶" : "🚗"}</span>
            <span className="truncate">{leg.from.name}</span>
            <span>→</span>
            <span className="truncate">{leg.to.name}</span>
          </a>
        ))}
      </div>
      {routeUrl && (
        <a
          href={routeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border-2 border-[#c7a6ff] py-2.5 text-sm font-black text-[#7c5aa0] transition hover:bg-[#f5f0ff]"
        >
          🧭 Navigate the whole route
        </a>
      )}
    </div>
  );
}
