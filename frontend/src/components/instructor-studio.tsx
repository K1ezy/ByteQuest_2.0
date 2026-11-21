"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { apiRequest, getErrorMessage } from "@/lib/api";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { Notice } from "@/components/workspace/ui";
import { DataRow, InlineEmpty, PageHeader, RowSkeleton, Section, StatusBadge } from "@/components/instructor/course-ui";
import type { ProgrammingLanguage } from "@/lib/types";

type WorkspaceDocument = {
  document_id: string;
  version_number: number;
  is_current: boolean;
  archived_at: string | null;
  title: string;
  language: ProgrammingLanguage;
  topic_concept: string | null;
  processing_status: string;
};

type WorkspaceActivity = {
  activity_id: string;
  source_document_id: string | null;
  source_document_title: string | null;
  activity_type: "challenge" | "quiz";
  title: string | null;
  language: ProgrammingLanguage;
  topic_concept: string;
  judge0_verified: boolean;
  review_status: string;
};

type Workspace = { documents: WorkspaceDocument[]; activities: WorkspaceActivity[] };
type GeneratedDraft = { activity_id: string; activity_type: "challenge" | "quiz"; judge0_verified?: boolean };

const languageName: Record<ProgrammingLanguage, string> = { cpp: "C++", python: "Python", java: "Java" };
const ready = (document: WorkspaceDocument) =>
  document.processing_status === "completed" && document.is_current && !document.archived_at;

/** Generates private drafts from course PDFs. Review, verification and publication happen in Review drafts. */
export default function InstructorStudio() {
  const { courseHref } = useWorkspace();
  const documentParam = useSearchParams().get("document");
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [documentId, setDocumentId] = useState("");
  const [language, setLanguage] = useState<ProgrammingLanguage>("python");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState(2);
  const [busy, setBusy] = useState<"" | "challenge" | "quiz">("");
  const [generated, setGenerated] = useState<GeneratedDraft | null>(null);
  const [error, setError] = useState("");

  const choose = useCallback((document: WorkspaceDocument | undefined) => {
    setDocumentId(document?.document_id ?? "");
    if (document) {
      setLanguage(document.language);
      setTopic(document.topic_concept || "");
    }
  }, []);

  const load = useCallback(async () => {
    const result = await apiRequest<Workspace>("/instructor/workspace");
    setWorkspace(result);
    return result;
  }, []);

  useEffect(() => {
    let active = true;
    // The state updates follow the asynchronous workspace request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
      .then((result) => {
        if (!active) return;
        const usable = result.documents.filter(ready);
        choose(usable.find((item) => item.document_id === documentParam) || usable[0]);
      })
      .catch((caught) => { if (active) setError(getErrorMessage(caught)); });
    return () => { active = false; };
  }, [choose, documentParam, load]);

  async function generate(kind: "challenge" | "quiz", event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!documentId) { setError("Choose a processed course PDF first."); return; }
    setBusy(kind); setError(""); setGenerated(null);
    try {
      const data = new FormData();
      data.append("topic_query", topic.trim());
      data.append("language", language);
      data.append("difficulty", String(difficulty));
      setGenerated(await apiRequest<GeneratedDraft>(`/instructor/documents/${documentId}/generate-${kind}`, { method: "POST", body: data }));
      await load();
    } catch (caught) { setError(getErrorMessage(caught)); }
    finally { setBusy(""); }
  }

  const documents = workspace?.documents.filter(ready) ?? [];
  const drafts = workspace?.activities.filter((activity) => activity.source_document_id) ?? [];
  const reviewHref = (activity: { activity_id: string; review_status?: string }) =>
    courseHref(activity.review_status && activity.review_status !== "draft"
      ? `/instructor/activities/${activity.activity_id}`
      : `/instructor/review/${activity.activity_id}`);

  return <>
    <PageHeader title="Generate from materials"
      subtitle="Create a private challenge or quiz draft from a course PDF. You review, verify and publish it in Review drafts."
      actions={<Link className="ic-button" href={courseHref("/instructor/materials")}>Materials library</Link>} />

    {error ? <Notice tone="error" onDismiss={() => setError("")}>{error}</Notice> : null}
    {generated ? <Notice tone="success">
      {generated.activity_type === "quiz"
        ? "Your quiz draft is ready. Check every question and answer before publishing."
        : generated.judge0_verified
          ? "Your challenge draft is ready and its reference solution passed Judge0."
          : "Your challenge draft is ready. Judge0 has not verified it yet; retry verification while reviewing."}{" "}
      <Link href={reviewHref(generated)}>Review this draft</Link>
    </Notice> : null}

    <Section title="New draft">
      {workspace === null ? <RowSkeleton /> : documents.length === 0 ? <InlineEmpty>
        No processed PDFs yet. <Link href={courseHref("/instructor/materials")}>Upload one in Materials</Link>.
      </InlineEmpty> : <form className="ws-form-grid" onSubmit={(event) => void generate("challenge", event)}>
        <div className="ws-field full">
          <label htmlFor="studio-document">Course PDF</label>
          <select id="studio-document" required value={documentId}
            onChange={(event) => choose(documents.find((item) => item.document_id === event.target.value))}>
            {documents.map((document) => <option key={document.document_id} value={document.document_id}>
              {document.title} · v{document.version_number}
            </option>)}
          </select>
        </div>
        <div className="ws-field full">
          <label htmlFor="studio-topic">Topic or concept</label>
          <input id="studio-topic" required minLength={2} maxLength={100} value={topic}
            onChange={(event) => setTopic(event.target.value)} placeholder="For example, loops" />
        </div>
        <div className="ws-field">
          <label htmlFor="studio-language">Language</label>
          <select id="studio-language" value={language} onChange={(event) => setLanguage(event.target.value as ProgrammingLanguage)}>
            {Object.entries(languageName).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div className="ws-field">
          <label htmlFor="studio-difficulty">Difficulty</label>
          <select id="studio-difficulty" value={difficulty} onChange={(event) => setDifficulty(Number(event.target.value))}>
            {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>Level {value}</option>)}
          </select>
        </div>
        <div className="ws-inline-actions full">
          <button className="ic-button ic-primary" type="submit" disabled={busy !== ""}>
            {busy === "challenge" ? "Generating and checking…" : "Generate challenge draft"}
          </button>
          <button className="ic-button" type="button" disabled={busy !== ""} onClick={() => void generate("quiz")}>
            {busy === "quiz" ? "Generating…" : "Generate quiz draft"}
          </button>
        </div>
      </form>}
    </Section>

    <Section title="Generated from your materials" action={<Link href={courseHref("/instructor/review")}>Review drafts</Link>}>
      {workspace === null ? <RowSkeleton /> : drafts.length === 0
        ? <InlineEmpty>Drafts you generate appear here until you publish them.</InlineEmpty>
        : <ul className="ic-list">{drafts.map((activity) => <DataRow key={activity.activity_id}
            title={activity.title || "Untitled draft"} href={reviewHref(activity)}
            description={`${activity.activity_type === "quiz" ? "Quiz" : "Coding challenge"} · ${languageName[activity.language]} · ${activity.topic_concept}${activity.source_document_title ? ` · from ${activity.source_document_title}` : ""}`}
            action={<StatusBadge tone={activity.review_status === "draft" ? "warning" : "dot"}>
              {activity.review_status === "draft" ? "Draft" : "Published"}
            </StatusBadge>} />)}</ul>}
    </Section>
  </>;
}
