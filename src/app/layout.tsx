import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { SIGN_IN_PATH, SIGN_UP_PATH } from "@/lib/auth-routes";
import { headers } from "next/headers";
import { connection } from "next/server";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  // Absolute base so OG/twitter image URLs resolve correctly in unfurls. It
  // follows the deployment's public origin, wherever the app is hosted.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://cutelyaskme.vercel.app"),
  title: "Cutely Ask — Date Night",
  description: "Plan the perfect date and keep the memory.",
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
  // Large image cards on X; the image itself is app/twitter-image.tsx.
  twitter: { card: "summary_large_image" },
  appleWebApp: {
    capable: true,
    title: "Cutely Ask",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#ff7aaa",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // A per-request CSP nonce is only safe when the complete document is rendered
  // for that request. This also lets Next apply the nonce to framework assets.
  await connection();
  // Clerk's UI injects its own <style> tags at runtime. Handing it the request
  // nonce (set by src/proxy.ts) lets those styles pass the nonce-based
  // style-src without loosening the policy to 'unsafe-inline'.
  const nonce = (await headers()).get("X-Nonce") ?? undefined;

  const document = (
    <html lang="en" className={`${nunito.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );

  return process.env.PLAYWRIGHT_E2E === "1" ? (
    document
  ) : (
    <ClerkProvider
      dynamic
      nonce={nonce}
      signInUrl={SIGN_IN_PATH}
      signUpUrl={SIGN_UP_PATH}
    >
      {document}
    </ClerkProvider>
  );
}
