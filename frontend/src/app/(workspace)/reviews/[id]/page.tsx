import { ReviewRunner } from "@/components/review-runner";

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReviewRunner key={id} id={id} />;
}
