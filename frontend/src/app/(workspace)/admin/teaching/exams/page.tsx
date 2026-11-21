import InstructorExamsPage from "@/components/instructor-exams";

export default async function ExamsPage({ searchParams }: { searchParams: Promise<{ workshop?: string | string[] }> }) {
  const { workshop } = await searchParams;
  const id = typeof workshop === "string" ? workshop : undefined;
  return <InstructorExamsPage key={id} defaultWorkshopId={id} />;
}
