import { db } from "@/lib/db";
import { userSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { DEFAULT_SETTINGS, type UserSettings } from "@/lib/settings";

/**
 * B4: read a user's settings. No row (or any read failure) means defaults —
 * the row is only created on first save.
 */
export async function getUserSettings(userId: string): Promise<UserSettings> {
  try {
    const rows = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);
    const row = rows[0];
    if (!row) return DEFAULT_SETTINGS;
    return {
      defaultRadiusMi: row.defaultRadiusMi,
      radiusMinMi: row.radiusMinMi,
      radiusMaxMi: row.radiusMaxMi,
      mapZoomMode: row.mapZoomMode,
      calendarMode: row.calendarMode,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
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
