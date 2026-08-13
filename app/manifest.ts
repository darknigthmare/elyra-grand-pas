import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Élyra — Chroniques du Grand Pas",
    short_name: "Élyra",
    description: "Marchez à travers sept univers pixel-art, vivez leurs rencontres et bâtissez un refuge entre les mondes.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#08111f",
    theme_color: "#6f52ff",
    orientation: "portrait",
    lang: "fr-FR",
    categories: ["games", "health", "lifestyle"],
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
