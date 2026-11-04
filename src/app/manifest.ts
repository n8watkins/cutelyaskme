import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cutely Ask Me",
    short_name: "Cutely Ask Me",
    description: "Plan the perfect date and keep the memory.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#fff7fb",
    theme_color: "#ff7aaa",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
