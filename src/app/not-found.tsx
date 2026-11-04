import type { Metadata } from "next";
import Link from "next/link";
import EdgePage, { primaryAction, secondaryAction } from "@/components/EdgePage";

export const metadata: Metadata = {
  title: "Page not found - Date Night",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <EdgePage
      emoji="📭"
      label="404 - page not found"
      title="This page got lost in the mail."
      actions={
        <>
          <Link href="/" className={primaryAction}>
            Go home
          </Link>
          <Link href="/send" className={secondaryAction}>
            Plan a date
          </Link>
        </>
      }
    >
      The link may be old or mistyped. If someone sent you an invite, open their link again.
    </EdgePage>
  );
}
