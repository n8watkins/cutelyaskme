import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  // Absolute base so OG/twitter image URLs resolve correctly in unfurls.
  metadataBase: new URL("https://date-planner-mini-site.vercel.app"),
  title: "Cutely Ask — Date Night",
  description: "Plan the perfect date and keep the memory.",
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "Cutely Ask",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#ff7aaa",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${nunito.variable} h-full antialiased`}>
        <body className="min-h-full flex flex-col">{children}</body>
      </html>
    </ClerkProvider>
  );
}
