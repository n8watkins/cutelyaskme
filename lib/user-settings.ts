import { db } from "@/lib/db";
import { userSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { DEFAULT_SETTINGS, type UserSettings } from "@/lib/settings";

/**
 * B4: read a user's settings plus whether a row actually exists. No row (or
 * any read failure) means defaults — the row is only created on first save.
 * `persisted: false` tells the planner the user has never saved settings, so
 * legacy `ca:` localStorage prefs may still be migrated up (Task B).
 */
export async function getUserSettingsState(
  userId: string,
): Promise<{ settings: UserSettings; persisted: boolean }> {
  try {
    const rows = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);
    const row = rows[0];
    if (!row) return { settings: DEFAULT_SETTINGS, persisted: false };
    return {
      settings: {
        defaultRadiusMi: row.defaultRadiusMi,
        radiusMinMi: row.radiusMinMi,
        radiusMaxMi: row.radiusMaxMi,
        mapZoomMode: row.mapZoomMode,
        calendarMode: row.calendarMode,
      },
      persisted: true,
    };
  } catch {
    // Treat a read failure as "row may exist" — never trigger a migration
    // PATCH that could overwrite real saved settings.
    return { settings: DEFAULT_SETTINGS, persisted: true };
  }
}

/** B4: read a user's settings (defaults when no row). */
export async function getUserSettings(userId: string): Promise<UserSettings> {
  return (await getUserSettingsState(userId)).settings;
}

/** Upsert the full (already validated/merged) settings row. */
export async function saveUserSettings(userId: string, settings: UserSettings): Promise<void> {
  const updatedAt = new Date().toISOString();
  await db
    .insert(userSettings)
    .values({ userId, ...settings, updatedAt })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: { ...settings, updatedAt },
    });
}
