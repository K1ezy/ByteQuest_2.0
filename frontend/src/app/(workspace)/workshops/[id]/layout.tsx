import { WorkshopLayout } from "@/components/workshops/workshop-layout";

export default async function WorkshopDetailLayout({ children, params }: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <WorkshopLayout key={id} id={id}>{children}</WorkshopLayout>;
}
