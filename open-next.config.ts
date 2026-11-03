import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Every page renders per request (the root layout awaits connection() for its
// CSP nonce) and nothing uses ISR, revalidateTag or "use cache", so the default
// no-op incremental cache is right.
export default defineCloudflareConfig();
