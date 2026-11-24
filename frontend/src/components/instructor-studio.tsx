"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, getErrorMessage } from "@/lib/api";
import { activityListHref } from "@/lib/instructor-activity";
import type { ProgrammingLanguage } from "@/lib/types";
import { retryMaterial, uploadMaterial, type MaterialList, type MaterialSummary } from "@/lib/workspace";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { Button, Notice, StatusChip, useApi } from "@/components/workspace/ui";

const languages: Record<ProgrammingLanguage, string> = { python: "Python", cpp: "C++", java: "Java" };

function ready(material: MaterialSummary) {
  return material.state === "ready" && material.is_current && !material.archived_at;
}

export function GeminiActivityForm({ courseId, preselectedId }: { courseId: string; preselectedId: string | null }) {
  const router = useRouter();
  const { profile, setUnsaved, refreshCourses } = useWorkspace();
  const { data, setData, error: loadError, loading, reload } = useApi<MaterialList>(
    `/faculty/materials?course_id=${encodeURIComponent(courseId)}`, true,
  );
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<"quiz" | "challenge">("quiz");
  const [language, setLanguage] = useState<ProgrammingLanguage | null>(null);
  const [topic, setTopic] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState(2);
  const [instructions, setInstructions] = useState("");
  const [busy, setBusy] = useState<"" | "upload" | "retry" | "generate">("");
  const [error, setError] = useState("");
  const active = useRef(true);
  const uploadButton = useRef<HTMLButtonElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const items = data?.items ?? [];
  const sourceId = pickedId ?? preselectedId ?? "";
  const source = items.find((item) => item.document_id === sourceId);
  const sourceReady = Boolean(source && ready(source));
  const effectiveLanguage = language ?? source?.language ?? profile.enrolled_language ?? "python";
  const effectiveTopic = topic ?? source?.topic_concept ?? "";
  const dirty = Boolean(file || title || topic !== null || language || instructions || kind !== "quiz" || difficulty !== 2);

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  useEffect(() => {
    setUnsaved(dirty || Boolean(busy), "You have an activity form in progress. Leave this form?");
    return () => setUnsaved(false);
  }, [busy, dirty, setUnsaved]);

  useEffect(() => {
    if (source?.state !== "processing" || loading || loadError) return;
    const timer = window.setTimeout(reload, 2000);
    return () => window.clearTimeout(timer);
  }, [loadError, loading, reload, source?.state]);

  function acceptMaterial(material: MaterialSummary) {
    setData((current) => current
      ? { ...current, items: [material, ...current.items.filter((item) => item.document_id !== material.document_id)] }
      : current);
    setPickedId(material.document_id);
  }

  async function submitUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || !data || busy) return;
    if (title.trim().length < 2) {
      setError("Enter a PDF title of at least 2 characters.");
      return;
    }
    if (!file.name.toLowerCase().endsWith(".pdf") || file.size > data.max_upload_bytes) {
      setError(`Choose a PDF up to ${data.max_upload_bytes / 1024 ** 2} MiB.`);
      return;
    }
    const form = new FormData();
    form.set("course_id", courseId);
    form.set("title", title.trim());
    form.set("language_tag", effectiveLanguage);
    if (effectiveTopic.trim()) form.set("topic_concept", effectiveTopic.trim());
    form.set("file", file);
    setBusy("upload");
    setError("");
    try {
      const result = await uploadMaterial("faculty", form);
      if (!active.current) return;
      acceptMaterial(result.material);
      setUploadOpen(false);
      setFile(null);
      setTitle("");
      void refreshCourses();
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setBusy("");
    }
  }

  async function retryIndexing() {
    if (!source?.can_retry || busy) return;
    setBusy("retry");
    setError("");
    try {
      const result = await retryMaterial("faculty", source.document_id);
      if (active.current) acceptMaterial(result.material);
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setBusy("");
    }
  }

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sourceReady || uploadOpen || busy) return;
    if (effectiveTopic.trim().length < 2) {
      setError("Enter a topic of at least 2 characters.");
      return;
    }
    const form = new FormData();
    form.set("topic_query", effectiveTopic.trim());
    form.set("language", effectiveLanguage);
    form.set("difficulty", String(difficulty));
    if (instructions.trim()) form.set("instructor_instructions", instructions);
    setBusy("generate");
    setError("");
    try {
      const result = await apiRequest<{ activity_id: string }>(
        `/instructor/documents/${sourceId}/generate-${kind}`,
        { method: "POST", body: form },
      );
      if (!active.current) return;
      setUnsaved(false);
      router.replace(activityListHref(courseId, result.activity_id));
      void refreshCourses();
      return;
    } catch (caught) {
      setError(getErrorMessage(caught));
      setBusy("");
    }
  }

  return (
    <>
      {error ? <Notice tone="error" onDismiss={() => setError("")}>{error}</Notice> : null}
      <section className="ws-panel ic-authoring-source" aria-labelledby="gemini-source-heading">
        <div className="ws-panel-head"><h2 id="gemini-source-heading">Source PDF</h2></div>
        <div className="ws-field">
          <label htmlFor="gemini-document">Course PDF</label>
          <select id="gemini-document" value={sourceReady ? sourceId : ""} disabled={Boolean(busy) || !data}
            onChange={(event) => {
              setPickedId(event.target.value);
              setError("");
            }}>
            <option value="">Choose a ready PDF</option>
            {items.filter(ready).map((item) => <option key={item.document_id} value={item.document_id}>{item.title}</option>)}
          </select>
          {!data && loading ? <p role="status" className="ws-muted">Loading course PDFs…</p> : null}
          {source ? (
            <div className="ws-stack" role="status">
              <p><strong>{source.title}</strong> <StatusChip state={source.state} /></p>
              {source.state === "processing" ? <p className="ws-muted">Indexing the PDF. You can fill in the activity while you wait.</p> : null}
              {!sourceReady && source.processing_error ? <p>{source.processing_error}</p> : null}
            </div>
          ) : sourceId && data && !loading ? <p role="status">This PDF is unavailable. Choose or upload a ready PDF for this course.</p> : null}
        </div>
        {loadError ? <Notice tone="warning">{loadError} <Button onClick={reload}>Retry loading PDFs</Button></Notice> : null}
        <div className="ws-inline-actions">
          {!uploadOpen ? <button type="button" className="button button-outline" ref={uploadButton} onClick={() => {
            setUploadOpen(true);
            setError("");
            window.requestAnimationFrame(() => fileInput.current?.focus());
          }} disabled={!data || Boolean(busy)}>Upload PDF</button> : null}
          {source?.can_retry ? <Button onClick={() => void retryIndexing()} disabled={Boolean(busy)}>
            {busy === "retry" ? "Retrying…" : "Retry indexing"}
          </Button> : null}
        </div>
        {uploadOpen ? (
          <form className="ws-form-grid" onSubmit={(event) => void submitUpload(event)}>
            <div className="ws-field">
              <label htmlFor="gemini-file">PDF file</label>
              <input ref={fileInput} id="gemini-file" type="file" accept=".pdf,application/pdf" required disabled={Boolean(busy)}
                onChange={(event) => {
                  const next = event.target.files?.[0] ?? null;
                  setFile(next);
                  if (next && !title) setTitle(next.name.replace(/\.pdf$/i, "").slice(0, 255));
                }} />
              <p className="ws-muted">Use a PDF with selectable text. Uploaded PDFs are saved in Materials.</p>
            </div>
            <div className="ws-field">
              <label htmlFor="gemini-file-title">PDF title</label>
              <input id="gemini-file-title" value={title} minLength={2} maxLength={255} required
                onChange={(event) => setTitle(event.target.value)} disabled={Boolean(busy)} />
            </div>
            <div className="ws-inline-actions full">
              <Button type="submit" variant="primary" disabled={Boolean(busy) || !file}>
                {busy === "upload" ? "Uploading and indexing…" : "Upload and index"}
              </Button>
              <Button onClick={() => {
                setUploadOpen(false);
                setFile(null);
                setTitle("");
                setError("");
                window.requestAnimationFrame(() => uploadButton.current?.focus());
              }} disabled={Boolean(busy)}>Cancel upload</Button>
            </div>
          </form>
        ) : null}
      </section>
      <section className="ws-panel" aria-labelledby="gemini-details-heading">
        <div className="ws-panel-head"><h2 id="gemini-details-heading">Activity details</h2></div>
        <form className="ws-form-grid" onSubmit={(event) => void generate(event)}>
          <div className="ws-field">
            <label htmlFor="gemini-type">Type</label>
            <select id="gemini-type" value={kind} onChange={(event) => setKind(event.target.value as typeof kind)} disabled={busy === "generate"}>
              <option value="quiz">Quiz</option>
              <option value="challenge">Coding challenge</option>
            </select>
          </div>
          <div className="ws-field">
            <label htmlFor="gemini-topic">Topic or concept</label>
            <input id="gemini-topic" value={effectiveTopic} onChange={(event) => setTopic(event.target.value)}
              required minLength={2} maxLength={100} disabled={busy === "generate"} />
          </div>
          <div className="ws-field">
            <label htmlFor="gemini-language">Language</label>
            <select id="gemini-language" value={effectiveLanguage} onChange={(event) => setLanguage(event.target.value as ProgrammingLanguage)} disabled={busy === "generate"}>
              {Object.entries(languages).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <div className="ws-field">
            <label htmlFor="gemini-difficulty">Difficulty</label>
            <select id="gemini-difficulty" value={difficulty} onChange={(event) => setDifficulty(Number(event.target.value))} disabled={busy === "generate"}>
              {[1, 2, 3, 4, 5].map((level) => <option key={level} value={level}>Level {level}</option>)}
            </select>
          </div>
          <div className="ws-field full">
            <label htmlFor="gemini-instructions">Instructions for Gemini (optional)</label>
            <textarea id="gemini-instructions" rows={5} maxLength={4000} value={instructions}
              placeholder={kind === "quiz" ? "For example, write six questions on tracing a loop." : "For example, ask students to solve the task with one loop."}
              onChange={(event) => setInstructions(event.target.value)} disabled={busy === "generate"} />
          </div>
          <div className="ws-inline-actions full">
            <Button type="submit" variant="primary" disabled={!sourceReady || uploadOpen || Boolean(busy)}>
              {busy === "generate" ? "Generating draft…" : "Generate draft"}
            </Button>
            <span className="ws-muted" role="status">
              {busy === "generate" ? "Gemini is creating your private draft." : "You can edit the draft before publishing."}
            </span>
          </div>
        </form>
      </section>
    </>
  );
}
