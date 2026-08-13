import type { Metadata } from "next";
import { GrandPasGameV2 } from "./GrandPasGameV2";

const title = "Élyra — Chroniques du Grand Pas";
const description = "Une aventure de marche pixel-art à travers sept univers vivants.";

export const metadataV2: Metadata = {
  metadataBase: new URL("https://elyra-grand-pas.vercel.app"),
  alternates: { canonical: "/" },
  title,
  description,
  openGraph: {
    title,
    description,
    type: "website",
    locale: "fr_FR",
    images: [{ url: "/og.png", alt: "Élyra, Chroniques du Grand Pas" }],
  },
  twitter: { card: "summary_large_image", title, description, images: ["/og.png"] },
};

export function HomeV2() {
  return <GrandPasGameV2 />;
}
