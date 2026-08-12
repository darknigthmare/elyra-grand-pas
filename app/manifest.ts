import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Élyra — Aventure de marche",
    short_name: "Élyra",
    description: "Chaque pas réel fait avancer votre aventure pixel-art.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5ead0",
    theme_color: "#17251f",
    orientation: "portrait",
    icons: [
      {
        src: "/favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
