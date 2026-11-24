"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { InstructorIcon, PageHeader } from "@/components/instructor/course-ui";
import { GeminiActivityForm } from "@/components/instructor-studio";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { LoadingPanel } from "@/components/workspace/ui";
import { ManualActivityForm } from "./manual-activity-form";

function NewActivity() {
  const search = useSearchParams();
  const { activeCourse, courseHref, hasUnsaved } = useWorkspace();
  const method = search.get("method");
  const documentId = search.get("document");
  const choosing = method !== "gemini" && method !== "manual";
  if (!activeCourse) return null;

  return (
    <div className="ic-activity-shell ic-new-activity">
      <PageHeader
        title={method === "gemini" ? "Generate with Gemini" : method === "manual" ? "Create manually" : "New Activity"}
        subtitle={activeCourse.title}
        actions={
          <Link className="ic-button" href={courseHref(choosing ? "/instructor/activities" : "/instructor/activities/new")}
            onNavigate={(event) => {
              if (hasUnsaved && !window.confirm("Leave this form and discard your unsaved changes?")) event.preventDefault();
            }}>
            {choosing ? "Back to activities" : "Back to choices"}
          </Link>
        }
      />
      {choosing ? (
        <div className="ic-authoring-choices" aria-label="Activity creation methods">
          <section className="ws-panel">
            <InstructorIcon name="file" />
            <h2>Generate with Gemini</h2>
            <p>Use a course PDF and your instructions to create an editable draft with Gemini 3.5 Flash-Lite.</p>
            <Link className="ic-button" href={courseHref("/instructor/activities/new?method=gemini")}>
              Generate with Gemini
            </Link>
          </section>
          <section className="ws-panel">
            <InstructorIcon name="clipboard" />
            <h2>Create manually</h2>
            <p>Write your own quiz or coding challenge and publish it after reviewing the student preview.</p>
            <Link className="ic-button" href={courseHref("/instructor/activities/new?method=manual")}>Create manually</Link>
          </section>
        </div>
      ) : method === "manual" ? (
        <ManualActivityForm key={activeCourse.id} courseId={activeCourse.id} />
      ) : (
        <GeminiActivityForm key={`${activeCourse.id}:${documentId ?? ""}`} courseId={activeCourse.id} preselectedId={documentId} />
      )}
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={<LoadingPanel label="Loading activity creation…" />}><NewActivity /></Suspense>;
}
