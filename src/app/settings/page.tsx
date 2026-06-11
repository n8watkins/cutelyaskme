import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { savedAddresses } from "@/lib/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import Link from "next/link";
import { SavedAddresses, type SavedAddress, type AddressKind } from "@/components/SavedAddresses";
import { SettingsView } from "@/components/SettingsView";
import { getUserSettings } from "@/lib/user-settings";

/** B4: auth-gated user settings — search defaults, map, calendar, usage, addresses. */
export default async function SettingsPage() {
  const { userId } = await auth();
  if (!userId) return null;

  const [settings, addressRows] = await Promise.all([
    getUserSettings(userId),
    db
      .select()
      .from(savedAddresses)
      .where(eq(savedAddresses.userId, userId))
      .orderBy(
        sql`case ${savedAddresses.kind} when 'home' then 0 when 'pickup' then 1 else 2 end`,
        desc(savedAddresses.createdAt),
      ),
  ]);

  const myAddresses: SavedAddress[] = addressRows.map((a) => ({
    id: a.id,
    label: a.label,
    kind: a.kind as AddressKind,
    address: a.address,
    lat: a.lat,
    lng: a.lng,
  }));

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <div className="mb-2">
        <Link href="/dashboard" className="text-xs font-black text-[#c0a0b0] hover:text-[#8a6a78]">
          ← Your dates
        </Link>
      </div>
      <h1 className="mb-6 text-3xl font-black text-[#3a2530]">Settings ⚙️</h1>

      <SettingsView initial={settings} />

      {/* Address book — re-homed here from the dashboard (F5) */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-black uppercase tracking-widest text-[#c0a0b0]">
          🏠 Address book
        </h2>
        <p className="mb-3 text-xs text-[#c0a0b0]">
          Saved places show up as quick picks when you set a date&apos;s start or pickup spot.
        </p>
        <SavedAddresses initial={myAddresses} />
      </section>

      {/* Future hooks (B4): theme/style switcher + notification prefs land here later. */}
      <p className="text-center text-[11px] font-black text-[#c0a0b0]">
        🎨 Themes &amp; 🔔 notification preferences — coming soon
      </p>
    </main>
  );
}
