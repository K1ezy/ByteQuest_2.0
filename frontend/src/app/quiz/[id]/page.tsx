import QuizView from "@/components/quiz-view";

export default async function QuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <QuizView activityId={id} />;
}
