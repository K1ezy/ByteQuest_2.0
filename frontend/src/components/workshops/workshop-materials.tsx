"use client";

import Link from "next/link";
import { useState } from "react";
import { useShellProfile } from "@/components/app-shell";
import { Button, useApi } from "@/components/workspace/ui";
import { downloadApiPdf, getErrorMessage } from "@/lib/api";
import type { WorkshopLesson } from "@/lib/types";
import { useWorkshop } from "./workshop-layout";
import { WorkshopError } from "./workshop-ui";

export function WorkshopMaterials() {
  const { workshop } = useWorkshop();
  const { role } = useShellProfile();
  const base = `/workshops/${workshop.id}/materials`;
  const { data, loading, error, reload } = useApi<WorkshopLesson[]>(workshop.archived ? null : base, true);
  const [downloading, setDownloading] = useState("");
  const [downloadError, setDownloadError] = useState("");

  async function download(lesson: WorkshopLesson) {
    setDownloading(lesson.document_id);
    setDownloadError("");
    try {
      const file = await downloadApiPdf(`${base}/${lesson.document_id}/download`);
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${lesson.title}.pdf`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (caught) {
      setDownloadError(getErrorMessage(caught));
    } finally {
      setDownloading("");
    }
  }

  return <section className="workshop-panel workshop-materials" aria-labelledby="workshop-materials-title">
    <h2 id="workshop-materials-title">Study materials</h2>
    {workshop.owned_by_me && !workshop.archived && role === "instructor" &&
      <Link className="button button-primary" href={`/instructor/materials?workshop=${workshop.id}`}>Upload a lesson PDF</Link>}
    {workshop.archived ? <p>Study materials are unavailable while this workshop is archived.</p>
      : loading ? <p role="status">Loading study materials…</p>
      : error ? <WorkshopError message={error} retry={reload} />
      : !data?.length ? <p>No lessons have been shared in this workshop yet.</p>
      : <ul>
        {data.map((lesson) => <li key={lesson.document_id} className="workshop-lesson">
          <h3>{lesson.title}</h3>
          {lesson.description && <p>{lesson.description}</p>}
          <div className="workshop-lesson-actions">
            <Button type="button" variant="outline" onClick={() => void download(lesson)} disabled={Boolean(downloading)}
              aria-busy={downloading === lesson.document_id}>
              {downloading === lesson.document_id ? "Downloading…" : "Download PDF"}
            </Button>
            {role === "student" && lesson.practice_status === "ready" && (
              <Link className="button button-primary" href={`/chat?workshop=${workshop.id}&lesson=${lesson.document_id}`}>Practice with Chat Assistant</Link>
            )}
          </div>
          {lesson.practice_status === "indexing" && <p>Preparing the lesson for Chat Assistant.</p>}
          {lesson.practice_status === "unavailable" && <p>Chat practice is unavailable for this PDF.</p>}
        </li>)}
      </ul>}
    {downloadError && <p role="alert">{downloadError}</p>}
  </section>;
}
