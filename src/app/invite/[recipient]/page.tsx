import { DatePlanner } from "@/components/date-planner/DatePlanner";
import { formatRecipientName } from "@/lib/planner-copy";

type InvitePageProps = {
  params: Promise<{
    recipient: string;
  }>;
};

export default async function InvitePage({ params }: InvitePageProps) {
  const { recipient } = await params;

  return <DatePlanner recipientName={formatRecipientName(recipient)} />;
}
