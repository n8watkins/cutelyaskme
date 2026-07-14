import { htmlEscape } from "@/lib/html";

/** Escape untrusted text before inserting it into an HTML email. */
export function emailText(value: unknown): string {
  return htmlEscape(String(value ?? ""));
}

/**
 * Escape a URL for a double-quoted email attribute after restricting it to
 * schemes that email clients can safely navigate to.
 */
export function emailUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Email URLs must use HTTP or HTTPS");
  }
  return htmlEscape(url.toString());
}

/** Build an application URL without allowing path data to change its shape. */
export function emailAppUrl(siteUrl: string, ...pathSegments: string[]): string {
  const base = new URL(siteUrl);
  const basePath = base.pathname.replace(/\/$/, "");
  const path = pathSegments.map((segment) => encodeURIComponent(segment)).join("/");
  base.pathname = `${basePath}/${path}`;
  base.search = "";
  base.hash = "";
  return base.toString();
}

/** Keep user-controlled values from introducing mail header line breaks. */
export function emailSubject(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}
