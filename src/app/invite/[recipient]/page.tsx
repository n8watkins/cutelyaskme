import type { Metadata } from "next";
import { DatePlanner } from "@/components/date-planner/DatePlanner";
import { db } from "@/lib/db";
import { invites } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { formatRecipientName } from "@/lib/planner-copy";

type InvitePageProps = {
  params: Promise<{ recipient: string }>;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Unfurl copy for shared invite links. Name slugs are public (they're in the
// URL), so we personalize those; opaque UUID tokens stay generic — no DB hit
// for crawler/preview-bot requests.
export async function generateMetadata({
  params,
}: InvitePageProps): Promise<Metadata> {
  const { recipient } = await params;

  let name: string | null = null;
  if (!UUID_RE.test(recipient)) {
    try {
      const formatted = formatRecipientName(recipient);
      if (formatted !== "Hey") name = formatted;
    } catch {
      // Malformed percent-encoding — keep the generic copy.
    }
  }

  const title = name
    ? `${name}, you're invited on a date 💌`
    : "You're invited on a date 💌";
  const description =
    "Someone special planned something cute for you. Open the invite to answer.";

  return {
    title: `${title} — CutelyAsk`,
    description,
    openGraph: { title, description },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { recipient } = await params;

  if (UUID_RE.test(recipient)) {
    const [invite] = await db
      .select({ recipientName: invites.recipientName, status: invites.status, token: invites.token, location: invites.location, senderAvatarSrc: invites.senderAvatarSrc })
      .from(invites)
      .where(eq(invites.token, recipient))
      .limit(1);

    if (!invite) {
      return (
        <main className="flex min-h-svh items-center justify-center px-4">
          <div className="text-center">
            <div className="mb-4 text-5xl">🔍</div>
            <h1 className="text-2xl font-black text-[#3a2530]">
              Invite not found
            </h1>
            <p className="mt-2 text-[#8a6a78]">
              This link may have expired or been removed.
            </p>
          </div>
        </main>
      );
    }

    if (invite.status === "completed") {
      return (
        <main className="flex min-h-svh items-center justify-center px-4">
          <div className="text-center">
            <div className="mb-4 text-5xl">💌</div>
            <h1 className="text-2xl font-black text-[#3a2530]">
              Already completed!
            </h1>
            <p className="mt-2 text-[#8a6a78]">
              This date has already been planned.
            </p>
            <a
              href={`/api/invites/redeem?token=${encodeURIComponent(invite.token)}`}
              className="mt-6 inline-block rounded-full bg-[#ff7aaa] px-6 py-3 font-black text-white"
            >
              View your plan
            </a>
          </div>
        </main>
      );
    }

    return (
      <DatePlanner
        recipientName={formatRecipientName(invite.recipientName)}
        inviteToken={invite.token}
        location={invite.location ?? null}
        avatarSrc={invite.senderAvatarSrc ?? null}
      />
    );
  }

  return <DatePlanner recipientName={formatRecipientName(recipient)} />;
}
