"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { useWorkspace, WorkspaceSuspense } from "@/components/workspace/workspace-provider";
import { Button, PageHeading, SelectField, Toolbar } from "@/components/workspace/ui";
import { formatDateTime } from "@/lib/workspace";
import LearnerInsights from "./insights";
import ModelEvaluation from "./evaluation";
import { PERIODS, Period, isPeriod } from "./types";

const TABS = [
  { id: "insights", label: "Learner insights" },
  { id: "evaluation", label: "Model evaluation" },
] as const;

function MachineLearningWorkspace({ courseId }: { courseId: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [refreshToken, setRefreshToken] = useState(0);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const tabParam = searchParams.get("tab");
  const tab = TABS.some((item) => item.id === tabParam) ? tabParam : "insights";
  const periodParam = searchParams.get("period");
  const period: Period = isPeriod(periodParam) ? periodParam : "all";

  // Only the keys this page owns are rewritten, so the selected course and any
  // other workspace parameter survive a tab or period change.
  function updateParams(patch: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) params.set(key, value);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const onLoaded = useCallback((at: Date) => setLastRefresh(at), []);

  return (
    <>
      <PageHeading
        eyebrow="FACULTY WORKSPACE"
        title="Machine Learning"
        description="Review learner progress and advisory forecasts for the next activity."
        actions={
          <Button variant="outline" onClick={() => setRefreshToken((token) => token + 1)}>
            Refresh
          </Button>
        }
      />
      <p className="ws-row-meta">
        {lastRefresh
          ? `Last successful refresh ${formatDateTime(lastRefresh.toISOString())}`
          : "Not refreshed yet"}
        . Refreshing retrieves saved data; it never trains a model or creates a forecast.
      </p>

      <div className="ml-tabs" role="tablist" aria-label="Machine Learning views">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`ml-tab-${item.id}`}
            aria-selected={tab === item.id}
            aria-controls={`ml-panel-${item.id}`}
            className={`ml-tab${tab === item.id ? " is-active" : ""}`}
            onClick={() => updateParams({ tab: item.id })}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "insights" ? (
        <div role="tabpanel" id="ml-panel-insights" aria-labelledby="ml-tab-insights">
          <Toolbar label="Period filter">
            <SelectField
              label="Historical period"
              value={period}
              onChange={(value) => updateParams({ period: value })}
              options={PERIODS.map((item) => ({ value: item.value, label: item.label }))}
            />
          </Toolbar>
          <p className="ws-muted">
            The historical period changes reported history only. It never changes model inputs, the
            next activity, or whether a forecast is available.
          </p>
          <LearnerInsights
            courseId={courseId}
            period={period}
            refreshToken={refreshToken}
            onLoaded={onLoaded}
          />
        </div>
      ) : (
        <div role="tabpanel" id="ml-panel-evaluation" aria-labelledby="ml-tab-evaluation">
          <ModelEvaluation courseId={courseId} refreshToken={refreshToken} onLoaded={onLoaded} />
        </div>
      )}
    </>
  );
}

export default function Page() {
  return (
    <WorkspaceSuspense label="Machine Learning">
      <CourseWorkspace />
    </WorkspaceSuspense>
  );
}

function CourseWorkspace() {
  const { courseId } = useWorkspace();
  // Remounting on a course change drops any learner detail and in-flight state
  // from the previous course.
  return <MachineLearningWorkspace key={courseId || "no-course"} courseId={courseId} />;
}
