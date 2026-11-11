// Links the landing page (src/app/page.tsx) points at.

/**
 * The waitlist lives on n8builds.dev, shared by every project's landing page
 * (Turnstile, double opt-in, unsubscribe). `cutelyaskme` is its public slug
 * there, so never rename it.
 */
export const WAITLIST_URL = "https://n8builds.dev/upcoming?interest=cutelyaskme#cutelyaskme";

/** A sample invite anyone can open: a name slug, so nothing is stored or sent.
 * The dash makes it read "Your Name..." (formatRecipientName title-cases words). */
export const DEMO_ASK_PATH = "/invite/Your-Name";

export const BUILDER_URL = "https://n8builds.dev";
export const PORTFOLIO_URL = "https://portfolio.n8builds.dev";
