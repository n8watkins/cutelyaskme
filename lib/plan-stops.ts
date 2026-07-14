import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { planStops } from "./db/schema";
import type { ItineraryStopInput } from "./itinerary";
import type { Venue } from "./venues";
import { DEFAULT_STOP_DURATIONS } from "./venues";

export const ENTREE_STOP_KEY = "__entree__";

export type PlanStop = InferSelectModel<typeof planStops>;
export type NewPlanStop = InferInsertModel<typeof planStops>;

export type LegacyPlanStopSource = {
  id: string;
  selectedEntree: string | null;
  selectedActivities: string | null;
  selectedEntreeVenue: string | null;
  selectedActivityVenues: string | null;
};

export type PlanStopSelection = {
  selectedActivities: string[];
  selectedEntree: string | null;
  selectedActivityVenues?: Record<string, Venue>;
  selectedEntreeVenue?: Venue | null;
  /** Full lineup order. Use __entree__ for the meal stop. */
  stopOrder?: string[];
  stopDurations?: Record<string, number>;
  stopTravelMinutes?: Record<string, number>;
  /** Legacy route keys use "fromId→toId" and name the destination stop. */
  legModes?: Record<string, unknown>;
};

export type LegacyStopColumns = {
  selectedActivities: string;
  selectedActivityVenues: string;
  selectedEntreeVenue: string | null;
};

/**
 * Build the normalized rows for a plan while retaining ids for unchanged stops.
 * This is pure so creation and update routes can run it inside their own transaction.
 */
export function buildPlanStopRows(
  planId: string,
  selection: PlanStopSelection,
  existing: readonly PlanStop[] = [],
  idFactory: () => string = () => crypto.randomUUID(),
): NewPlanStop[] {
  const activities = uniqueNonEmptyStrings(selection.selectedActivities);
  const entree = normalizedEntree(selection.selectedEntree);
  const order = normalizedOrder(selection.stopOrder, activities, entree !== null);
  const existingByIdentity = new Map<string, PlanStop[]>();

  for (const stop of existing) {
    const identity = stopIdentity(stop.kind, stop.activity);
    const matches = existingByIdentity.get(identity) ?? [];
    matches.push(stop);
    existingByIdentity.set(identity, matches);
  }

  return order.map((key, position) => {
    const kind = key === ENTREE_STOP_KEY ? "entree" : "activity";
    const activity = kind === "entree" ? entree! : key;
    const matches = existingByIdentity.get(stopIdentity(kind, activity));
    const previous = matches?.shift();
    const durationKey = kind === "entree" ? ENTREE_STOP_KEY : activity;
    const venue =
      kind === "entree"
        ? (selection.selectedEntreeVenue ?? null)
        : (selection.selectedActivityVenues?.[activity] ?? null);

    return {
      id: previous?.id ?? idFactory(),
      planId,
      position,
      kind,
      activity,
      durationMinutes: normalizeDuration(
        selection.stopDurations?.[durationKey],
        previous?.durationMinutes ?? DEFAULT_STOP_DURATIONS[durationKey] ?? 60,
      ),
      travelMinutes: normalizeTravelMinutes(
        selection.stopTravelMinutes?.[durationKey],
        previous?.travelMinutes ?? 0,
      ),
      venue: venue ? JSON.stringify(venue) : null,
      legMode: incomingLegMode(selection.legModes, durationKey) ?? previous?.legMode ?? "drive",
      createdAt: previous?.createdAt,
      updatedAt: previous ? new Date().toISOString() : undefined,
    };
  });
}

/** Use normalized rows when present, otherwise adapt the legacy JSON columns. */
export function readPlanStops(
  plan: LegacyPlanStopSource,
  normalized: readonly PlanStop[],
): PlanStop[] {
  if (normalized.length > 0) {
    return [...normalized].sort((a, b) => a.position - b.position);
  }

  const activities = uniqueNonEmptyStrings(
    safeParse<unknown[]>(plan.selectedActivities, []).filter(
      (value): value is string => typeof value === "string",
    ),
  );
  const activityVenues = safeParse<Record<string, Venue>>(plan.selectedActivityVenues, {});
  const entreeVenue = safeParse<Venue | null>(plan.selectedEntreeVenue, null);

  return buildPlanStopRows(
    plan.id,
    {
      selectedActivities: activities,
      selectedEntree: plan.selectedEntree,
      selectedActivityVenues: activityVenues,
      selectedEntreeVenue: entreeVenue,
    },
    [],
    legacyIdFactory(plan.id),
  ).map((stop) => ({
    id: stop.id,
    planId: stop.planId,
    position: stop.position,
    kind: stop.kind,
    activity: stop.activity,
    durationMinutes: stop.durationMinutes ?? 60,
    travelMinutes: stop.travelMinutes ?? 0,
    venue: stop.venue ?? null,
    legMode: stop.legMode ?? "drive",
    createdAt: stop.createdAt ?? "",
    updatedAt: stop.updatedAt ?? "",
  }));
}

/** Mirror normalized rows into the legacy columns during the rollout. */
export function legacyStopColumns(
  stops: readonly {
    kind: "activity" | "entree";
    activity: string;
    venue?: string | null;
    position: number;
  }[],
): LegacyStopColumns {
  const ordered = [...stops].sort((a, b) => a.position - b.position);
  const activities: string[] = [];
  const activityVenues: Record<string, Venue> = {};
  let entreeVenue: Venue | null = null;

  for (const stop of ordered) {
    const venue = safeParse<Venue | null>(stop.venue ?? null, null);
    if (stop.kind === "entree") {
      entreeVenue = venue;
    } else {
      activities.push(stop.activity);
      if (venue) activityVenues[stop.activity] = venue;
    }
  }

  return {
    selectedActivities: JSON.stringify(activities),
    selectedActivityVenues: JSON.stringify(activityVenues),
    selectedEntreeVenue: entreeVenue ? JSON.stringify(entreeVenue) : null,
  };
}

export function stopDurationsByKey(
  stops: readonly Pick<PlanStop, "kind" | "activity" | "durationMinutes">[],
): Record<string, number> {
  return Object.fromEntries(
    stops.map((stop) => [
      stop.kind === "entree" ? ENTREE_STOP_KEY : stop.activity,
      stop.durationMinutes,
    ]),
  );
}

export function stopTravelMinutesByKey(
  stops: readonly Pick<PlanStop, "kind" | "activity" | "travelMinutes">[],
): Record<string, number> {
  return Object.fromEntries(
    stops.map((stop) => [
      stop.kind === "entree" ? ENTREE_STOP_KEY : stop.activity,
      stop.travelMinutes,
    ]),
  );
}

export function itineraryStopsFromPlanStops(
  stops: readonly {
    kind: "activity" | "entree";
    activity: string;
    durationMinutes?: number;
    venue?: string | null;
    position: number;
  }[],
): ItineraryStopInput[] {
  return [...stops]
    .sort((a, b) => a.position - b.position)
    .map((stop) => ({
      key: stop.kind === "entree" ? ENTREE_STOP_KEY : stop.activity,
      label: stop.activity,
      durationMinutes:
        stop.durationMinutes ??
        DEFAULT_STOP_DURATIONS[stop.kind === "entree" ? ENTREE_STOP_KEY : stop.activity] ??
        60,
      venue: safeParse<Venue | null>(stop.venue ?? null, null),
    }));
}

function normalizedOrder(
  requested: string[] | undefined,
  activities: string[],
  hasEntree: boolean,
): string[] {
  const available = new Set(activities);
  if (hasEntree) available.add(ENTREE_STOP_KEY);

  const ordered = uniqueNonEmptyStrings(requested ?? []).filter((key) => available.delete(key));
  for (const activity of activities) {
    if (available.delete(activity)) ordered.push(activity);
  }
  if (available.delete(ENTREE_STOP_KEY)) ordered.push(ENTREE_STOP_KEY);
  return ordered;
}

function normalizedEntree(value: string | null): string | null {
  const entree = value?.trim();
  return entree && entree !== "Surprise me" ? entree : null;
}

function uniqueNonEmptyStrings(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

function normalizeDuration(value: number | undefined, fallback: number): number {
  return Number.isInteger(value) && value! >= 15 && value! <= 720 ? value! : fallback;
}

function normalizeTravelMinutes(value: number | undefined, fallback: number): number {
  return Number.isInteger(value) && value! >= 0 && value! <= 720 ? value! : fallback;
}

function incomingLegMode(
  modes: Record<string, unknown> | undefined,
  destination: string,
): "drive" | "walk" | null {
  if (!modes) return null;
  const suffix = `→${destination}`;
  const entry = Object.entries(modes).find(
    ([key, value]) => key.endsWith(suffix) && (value === "drive" || value === "walk"),
  );
  return (entry?.[1] as "drive" | "walk" | undefined) ?? null;
}

function stopIdentity(kind: "activity" | "entree", activity: string): string {
  return `${kind}\u0000${activity}`;
}

function legacyIdFactory(planId: string): () => string {
  let position = 0;
  return () => `${planId}:legacy:${position++}`;
}

function safeParse<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}
