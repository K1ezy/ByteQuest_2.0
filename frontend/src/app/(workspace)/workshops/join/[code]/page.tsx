import Link from "next/link";
import { JoinWorkshopForm } from "@/components/workshops/workshop-home";

export default async function WorkshopInvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <div className="workshop-page workshop-join-page">
    <Link href="/workshops" className="workshop-text-link">All workshops</Link>
    <section className="workshop-panel">
      <h1>Join Workshop</h1>
      <JoinWorkshopForm code={code} />
    </section>
  </div>;
}
