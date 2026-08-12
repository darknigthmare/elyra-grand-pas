import type { Metadata } from "next";
import { headers } from "next/headers";
import { GrandPasGame } from "./GrandPasGame";

const title = "Élyra — Le monde avance avec vous";
const description =
  "Une aventure pixel-art bienveillante où vos pas réels font voyager votre avatar.";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "localhost";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const imageUrl = `${protocol}://${host}/og.png`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      locale: "fr_FR",
      images: [{ url: imageUrl, alt: "Élyra, le monde avance avec vous" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default function Home() {
  return <GrandPasGame />;
}
