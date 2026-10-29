import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal-document";

export const metadata: Metadata = { title: "Terms of Service | ByteQuest" };

export default function Page() {
  return <main className="mx-auto max-w-3xl px-5 py-12"><LegalDocument kind="terms" /></main>;
}
