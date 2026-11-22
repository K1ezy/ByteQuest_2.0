"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useWorkspace, WorkspaceSuspense } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/instructor/course-ui";
import { UpdatedAt } from "@/components/insights/ui";
import ModelEvaluation from "./evaluation";

function CourseWorkspace() {
  const {courseId} = useWorkspace();
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params.get("tab") === "insights";
  const [refresh, setRefresh] = useState(0);
  const [at, setAt] = useState<Date | null>(null);
  useEffect(() => {
    if (!redirect) return;
    const query = new URLSearchParams(params.toString());
    query.delete("tab");
    if (courseId) query.set("course", courseId);
    router.replace("/instructor/performance?" + query, { scroll: false });
  }, [courseId, params, redirect, router]);
  if (redirect) return null;
  return <><PageHeader title="Model evaluation" actions={<button type="button" className="ic-button" onClick={() => setRefresh(n => n+1)}>Refresh</button>}/>
    {at && <UpdatedAt at={at.toISOString()}/>}
    <ModelEvaluation key={courseId} courseId={courseId} refreshToken={refresh} onLoaded={setAt}/>
  </>;
}
export default function Page() {
  return <WorkspaceSuspense label="Model evaluation"><CourseWorkspace/></WorkspaceSuspense>;
}
