import type { Metadata } from "next";
import { HomeV2, metadataV2 } from "./homeV2";

export const metadata: Metadata = metadataV2;

export default function Home() {
  return <HomeV2 />;
}
