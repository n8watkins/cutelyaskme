# Outstanding Launch Items

Last verified: July 15, 2026.

## Completed

- The release-hardening pull request is merged into `main`.
- The GitHub repository is named `n8watkins/cutelyaskme`.
- Production is deployed and publicly reachable at <https://cutelyaskme.vercel.app>.
- `PLAN_CAPABILITY_SECRET` is configured as an encrypted Vercel Production variable.
- `CRON_SECRET` is configured as an encrypted Vercel Production variable.
- Production was redeployed after both secrets were added.
- The public home page returns HTTP `200`.
- The notification reconciliation endpoint is configured and rejects unauthenticated requests with HTTP `401`.
- The merged review branch was removed locally and from GitHub.
- The local checkout is current and on `main`.

## Requires Nathan

### 0. Finish the move to `cutelyaskme.n8builds.dev`

The app now lives at <https://cutelyaskme.n8builds.dev>, a Workers custom domain set in `wrangler.jsonc`.
`cutelyaskme.vercel.app` still serves the old Vercel deployment, and the Vercel project is no longer connected to this repository, so pushes do not reach it.

1. GitHub, Settings, Secrets and variables, Actions: add the `CLOUDFLARE_API_TOKEN` secret so pushes to `main` deploy on their own.
   Create it from the "Edit Cloudflare Workers" token template, with the Cloudflare account and the `n8builds.dev` zone included, because the deploy manages the custom domain.
2. Google Cloud Console, APIs and Services, Credentials, the browser key in `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`: if it has website restrictions, add `https://cutelyaskme.n8builds.dev/*`.
   Keep the `vercel.app` and `workers.dev` entries until those addresses are retired.
3. Clerk, development instance: nothing is required, because development instances accept any origin.
   If Configure, Paths or a redirect allowlist names the old address, change it to `https://cutelyaskme.n8builds.dev`.
4. Vercel: approve replacing the old deployment with a redirect, so `cutelyaskme.vercel.app` sends visitors to the new address.
   That is a one-time `vercel deploy --prod` of a folder holding only a `vercel.json` with a permanent redirect of `/(.*)` to `https://cutelyaskme.n8builds.dev/$1`.
   It also stops the Vercel Cron and Queue, which the Worker's Cron Trigger and Queue already replace.
   Deleting the Vercel project afterwards is a separate decision.

When the app moves to a Clerk production instance or verifies a Resend sending domain, use `cutelyaskme.n8builds.dev` (or `cutelyask.me` if it is bought) in steps 2 and 3 below.

### 1. Acquire and connect `cutelyask.me`

The custom domain does not currently resolve in DNS.
Purchase or otherwise gain control of `cutelyask.me`, then add it to the `cutelyaskme` Vercel project and apply the DNS records Vercel provides.
The detailed domain procedure is in [`docs/LAUNCH.md`](./LAUNCH.md).

After the domain resolves, update the Vercel Production value of `NEXT_PUBLIC_SITE_URL` to `https://cutelyask.me` and redeploy.
An agent can perform this final environment update and verification once the domain is under your control.

### 2. Verify the sending domain in Resend

Add the Resend-provided DNS records for `cutelyask.me` or a dedicated sending subdomain.
Confirm the domain is verified in Resend, then choose the final sender address such as `invites@cutelyask.me`.
An agent can update `EMAIL_FROM`, redeploy, and run a delivery check after you confirm the verified address.

### 3. Confirm the Clerk production domain

Configure `cutelyask.me` as the Clerk production domain and add Clerk's DNS records.
Confirm the Google OAuth redirect URI shown by Clerk is registered with the Google OAuth client.
Verify that signing in at `https://cutelyask.me/login` has no development banner after DNS is active.

### 4. Perform real-device launch checks

Send one invitation to an external email address and complete the recipient flow in a private browser session.
Install the application on a real phone, grant notification permission, and verify one push notification.
These checks require your provider accounts, inbox, and physical device.

## Optional

- Add `STATIC_MAPS_EMAIL_KEY` if emails should contain signed static maps.
- Add DMARC after the sending domain is stable.
- Configure `support@cutelyask.me` in Clerk.
- Review Vercel logs and service quotas after the first real invitations are sent.

## Current Engineering Status

There are no known outstanding code, feature, E2E, or security findings.
GitHub has no open pull requests or issues for this repository.
