"use client";

import { useWorkspace, WorkspaceSuspense } from "@/components/workspace/workspace-provider";
import { Button, Notice, PageHeading, useApi } from "@/components/workspace/ui";
import { GamificationInsightsView, type GamificationInsightsData } from "@/components/instructor/gamification-insights";
import { formatDateTime } from "@/lib/workspace";

function Insights({ courseId }: { courseId: string | null }) {
  const path = courseId ? `/faculty/gamification-insights?${new URLSearchParams({ course_id: courseId })}` : null;
  const { data, error, loading, reload } = useApi<GamificationInsightsData>(path);

  return (
    <>
      <PageHeading
        eyebrow="INSTRUCTOR WORKSPACE"
        title="Gamification Insights"
        description="How your class engages with points, stars, the Codex and Mastery Memory. Class totals only, never individual learners."
        actions={<Button variant="outline" onClick={reload} disabled={loading}>Refresh</Button>}
      />
      {!courseId ? <Notice tone="info">Choose a course to see its insights.</Notice> : null}
      {loading && !data ? (
        <div role="status" aria-label="Loading gamification insights">
          <div className="ws-stat-grid">{[0, 1, 2, 3].map((index) => <span key={index} className="ws-skeleton" style={{ height: 96 }} />)}</div>
          <span className="ws-skeleton insights-skeleton-chart" />
        </div>
      ) : null}
      {error ? (
        <section className="ws-panel">
          <Notice tone="error">{error}</Notice>
          <Button variant="outline" onClick={reload}>Try again</Button>
        </section>
      ) : null}
      {data && !error ? (
        data.enrolled === 0 ? (
          <section className="ws-panel empty-state">
            <h2>No students enrolled yet</h2>
            <p>Insights appear once students are assigned to {data.course_title} and start practising.</p>
          </section>
        ) : (
          <>
            <p className="ws-row-meta">{data.course_code} · {data.course_title} · updated {formatDateTime(data.generated_at)}</p>
            <GamificationInsightsView data={data} />
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

export default function Page() {
  return (
    <WorkspaceSuspense label="Gamification Insights">
      <CourseInsights />
    </WorkspaceSuspense>
  );
}
