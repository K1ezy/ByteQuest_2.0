"use client";

import { useSearchParams } from "next/navigation";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { useApi } from "@/components/workspace/ui";
import { GamificationInsightsView, type GamificationInsightsData } from "@/components/instructor/gamification-insights";
import { InlineEmpty, InlineError, PageHeader, RowSkeleton, Section, StatSkeleton } from "@/components/instructor/course-ui";
import { UpdatedAt } from "@/components/insights/ui";

function Insights({ courseId }: { courseId: string | null }) {
  const path = courseId ? `/faculty/gamification-insights?${new URLSearchParams({ course_id: courseId })}` : null;
  const { data, error, loading, reload } = useApi<GamificationInsightsData>(path, true);
  const topic = useSearchParams()?.get("topic");

  return (
    <>
      <PageHeader
        title="Gamification Insights"
        subtitle="How your class engages with points, stars, the Codex and Mastery Memory."
        actions={<button type="button" className="ic-button" onClick={reload} disabled={loading || !courseId}>Refresh</button>}
      />
      {!courseId ? <InlineEmpty>Choose a course to see its insights.</InlineEmpty> : null}
      {loading && !data ? (
        <div role="status" aria-label="Loading gamification insights">
          <StatSkeleton />
          <RowSkeleton />
        </div>
      ) : null}
      {error ? <InlineError onRetry={reload} /> : null}
      {data && !error ? (
        data.enrolled === 0 ? (
          <Section title="No students enrolled yet">
            <InlineEmpty>Insights appear once students are assigned to {data.course_title} and start practising.</InlineEmpty>
          </Section>
        ) : (
          <>
            <GamificationInsightsView data={data} topic={topic} />
            <UpdatedAt at={data.generated_at}/>
          </>
        )
      ) : null}
    </>
  );
}

function CourseInsights() {
  const { courseId } = useWorkspace();
  // Remounting on a course change drops the previous course's figures immediately.
  return <Insights key={courseId || "no-course"} courseId={courseId} />;
}

export default CourseInsights;
