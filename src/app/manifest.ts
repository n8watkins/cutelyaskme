import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cutely Ask — Date Night",
    short_name: "Cutely Ask",
    description: "Plan the perfect date and keep the memory.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#fff7fb",
    theme_color: "#ff7aaa",
    icons: [
      {
        src: "/assets/heart-envelope.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
