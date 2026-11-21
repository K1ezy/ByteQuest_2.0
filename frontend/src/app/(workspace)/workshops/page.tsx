import { redirect } from "next/navigation";
import { WorkshopHome } from "@/components/workshops/workshop-home";

export default async function WorkshopsPage({ searchParams }: { searchParams: Promise<{ group?: string | string[] }> }) {
  const { group } = await searchParams;
  if (typeof group === "string" && group) redirect(`/workshops/${encodeURIComponent(group)}`);
  return <WorkshopHome />;
}
