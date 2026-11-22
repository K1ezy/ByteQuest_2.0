import Arena from "@/components/arena";

export default async function ArenaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Arena key={id} activityId={id} />;
}
