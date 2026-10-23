import Arena from "@/components/arena";

export default async function ArenaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Arena activityId={id} />;
}
