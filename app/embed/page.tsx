import type { Metadata } from "next";
import EmbedShell from "@/components/EmbedShell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "WindTide 予報",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <EmbedShell />;
}
