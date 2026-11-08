"use client";

import Link from "next/link";
import { useEffect } from "react";
import EdgePage, { primaryAction, secondaryAction } from "@/components/EdgePage";
import { reportError } from "@/lib/error-reporting";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => reportError(error), [error]);

  return (
    <EdgePage
      emoji="🥀"
      label="Something went wrong"
      title="This page didn't load."
      actions={
        <>
          <button type="button" onClick={reset} className={primaryAction}>
            Try again
          </button>
          <Link href="/" className={secondaryAction}>
            Go home
          </Link>
        </>
      }
    >
      That one is on us, and we have been told. Your plans and invites are safe.
    </EdgePage>
  );
}
