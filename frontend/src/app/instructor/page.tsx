"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { apiRequest, getErrorMessage } from "@/lib/api";
import { getSupabase } from "@/lib/supabase";
import { InstructorShadowAnalytics } from "@/components/instructor-shadow-analytics";
import { InstructorHints } from "@/components/instructor-hints";
import type { Profile, ProgrammingLanguage } from "@/lib/types";

type TestCase = {
  order_index: number;
  stdin: string;
  expected_stdout: string;
  time_limit_ms: number;
  memory_limit_kb: number;
  is_hidden: boolean;
  weight: number;
};

type WorkspaceDocument = {
  document_id: string;
  document_family_id: string;
  version_number: number;
  supersedes_document_id: string | null;
  is_current: boolean;
  archived_at: string | null;
  sha256: string | null;
  file_size_bytes: number | null;
  title: string;
  description: string | null;
  language: ProgrammingLanguage;
  topic_concept: string | null;
  processing_status: string;
  total_chunks: number;
  created_at: string;
};

type WorkspaceActivity = {
  activity_id: string;
  source_document_id: string | null;
  source_document_title: string | null;
  activity_type: "challenge" | "quiz";
  title: string | null;
  language: ProgrammingLanguage;
  topic_concept: string;
  difficulty_level: number;
  xp_reward: number;
  test_case_count: number;
  quiz_question_count: number;
  judge0_verified: boolean;
  review_status: string;
  created_at: string;
};

type Challenge = {
  activity_id: string;
  activity_type: "challenge";
  source_document_id: string | null;
  title: string;
  language: ProgrammingLanguage;
  topic_concept: string;
  problem_statement: string;
  starter_code: string;
  reference_solution_code: string;
  difficulty_level: number;
  xp_reward: number;
  test_cases: TestCase[];
  judge0_verified: boolean;
  verification_log: { passed_test_cases?: number; total_test_cases?: number; error?: string; reason?: string };
  review_status: string;
  reviewed_by: string | null;
  created_at: string;
};

type QuizQuestion = {
  id: string;
  prompt: string;
  options: { key: string; text: string }[];
  correct_answer: string;
};

type ConceptualQuiz = {
  activity_id: string;
  activity_type: "quiz";
  source_document_id: string | null;
  title: string;
  language: ProgrammingLanguage;
  topic_concept: string;
  problem_statement: string;
  difficulty_level: number;
  xp_reward: number;
  quiz_questions_json: { questions: QuizQuestion[] };
  review_status: string;
  reviewed_by: string | null;
  created_at: string;
};

type Workspace = { documents: WorkspaceDocument[]; activities: WorkspaceActivity[] };
type BusyAction = "upload" | "version" | "generate" | "load" | "save" | "verify" | "review" | "publish" | "archive" | "restore" | "reprocess" | "download" | "metadata" | "";

const emptyWorkspace: Workspace = { documents: [], activities: [] };
const languageName: Record<ProgrammingLanguage, string> = { cpp: "C++", python: "Python", java: "Java" };

function newTestCase(orderIndex: number): TestCase {
  return { order_index: orderIndex, stdin: "", expected_stdout: "", time_limit_ms: 2000, memory_limit_kb: 256000, is_hidden: true, weight: 1 };
}

export default function InstructorPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [workspace, setWorkspace] = useState<Workspace>(emptyWorkspace);
  const [selectedDocument, setSelectedDocument] = useState("");
  const selectedDocumentRef = useRef("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [documentTitle, setDocumentTitle] = useState("");
  const [documentDescription, setDocumentDescription] = useState("");
  const [language, setLanguage] = useState<ProgrammingLanguage>("python");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState(2);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [challengeDirty, setChallengeDirty] = useState(false);
  const [quiz, setQuiz] = useState<ConceptualQuiz | null>(null);
  const [quizDirty, setQuizDirty] = useState(false);
  const [busy, setBusy] = useState<BusyAction>("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadWorkspace = useCallback(async (preferredDocumentId?: string): Promise<Workspace> => {
    const result = await apiRequest<Workspace>("/instructor/workspace");
    setWorkspace(result);
    const current = selectedDocumentRef.current;
    const selectable = result.documents.filter(
      (item) => item.processing_status === "completed" && item.is_current && !item.archived_at,
    );
    const selected = selectable.find((item) => item.document_id === preferredDocumentId)
      || selectable.find((item) => item.document_id === current)
      || selectable[0];
    const selectedId = selected?.document_id || "";
    selectedDocumentRef.current = selectedId;
    setSelectedDocument(selectedId);

    if (!selected) {
      setDocumentTitle("");
      setDocumentDescription("");
      setTopic("");
    } else if (selected.document_id !== current) {
      setDocumentTitle(selected.title);
      setDocumentDescription(selected.description || "");
      setLanguage(selected.language);
      setTopic(selected.topic_concept || "");
    }
    return result;
  }, []);

  function selectDocument(document: WorkspaceDocument) {
    if (document.document_id !== selectedDocument) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      setFile(null);
    }
    selectedDocumentRef.current = document.document_id;
    setSelectedDocument(document.document_id);
    setDocumentTitle(document.title);
    setDocumentDescription(document.description || "");
    setLanguage(document.language);
    setTopic(document.topic_concept || "");
  }

  useEffect(() => {
    let active = true;
    const supabase = getSupabase();
    void supabase.auth.getSession().then(async ({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError || !data.session) {
        setError(sessionError?.message || "Sign in to open the instructor workspace.");
        setCheckingAccess(false);
        return;
      }
      try {
        const currentProfile = await apiRequest<Profile>("/profile/me");
        if (!active) return;
        setProfile(currentProfile);
        if (currentProfile.role === "instructor" || currentProfile.role === "admin") await loadWorkspace();
      } catch (caught) {
        if (active) setError(getErrorMessage(caught));
      } finally {
        if (active) setCheckingAccess(false);
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) { setProfile(null); setWorkspace(emptyWorkspace); }
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, [loadWorkspace]);

  async function refreshWorkspace() {
    setBusy("load");
    try { await loadWorkspace(); }
    catch (caught) { setError(getErrorMessage(caught)); }
    finally { setBusy(""); }
  }

  async function uploadDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) { setError("Choose a PDF file first."); return; }
    setBusy("upload"); setError(""); setMessage("");
    try {
      const data = new FormData();
      data.append("file", file);
      data.append("title", documentTitle.trim());
      if (documentDescription.trim()) data.append("description", documentDescription.trim());
      data.append("language_tag", language);
      if (topic.trim()) data.append("topic_concept", topic.trim());
      const result = await apiRequest<{ document_id: string; title: string }>("/instructor/documents/upload", { method: "POST", body: data });
      await loadWorkspace(result.document_id);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setMessage(`Saved “${result.title}”. You can generate a challenge from it now.`);
    } catch (caught) { setError(getErrorMessage(caught)); }
    finally { setBusy(""); }
  }

  async function uploadDocumentVersion() {
    if (!selectedDocument || !file) { setError("Choose the current source document and corrected PDF first."); return; }
    const current = workspace.documents.find((document) => document.document_id === selectedDocument);
    if (!current?.is_current || current.archived_at) { setError("Select the active document version before replacing it."); return; }
    setBusy("version"); setError(""); setMessage("");
    try {
      const data = new FormData();
      data.append("file", file);
      data.append("title", documentTitle.trim() || current.title);
      if (documentDescription.trim()) data.append("description", documentDescription.trim());
      data.append("language_tag", language);
      if (topic.trim()) data.append("topic_concept", topic.trim());
      const result = await apiRequest<{ document_id: string; title: string; version_number: number }>(`/instructor/documents/${selectedDocument}/versions`, { method: "POST", body: data });
      await loadWorkspace(result.document_id);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setMessage(`Saved “${result.title}” as version ${result.version_number}. The previous PDF and linked activities remain available.`);
    } catch (caught) { setError(getErrorMessage(caught)); }
    finally { setBusy(""); }
  }

  async function updateDocumentMetadata(document: WorkspaceDocument) {
    setBusy("metadata"); setError(""); setMessage("");
    try {
      await apiRequest(`/instructor/documents/${document.document_id}`, {
        method: "PATCH",
        body: JSON.stringify({ title: documentTitle.trim(), description: documentDescription.trim() || null, language_tag: language, topic_concept: topic.trim() || null }),
      });
      await loadWorkspace(document.document_id);
      setMessage("Document details saved. Its PDF and version history are unchanged.");
    } catch (caught) { setError(getErrorMessage(caught)); }
    finally { setBusy(""); }
  }

  async function archiveDocument(document: WorkspaceDocument) {
    if (!window.confirm(`Archive “${document.title}” version ${document.version_number}? It will be hidden from new challenge generation, while its PDF, history, and existing activities are kept.`)) return;
    setBusy("archive"); setError(""); setMessage("");
    try {
      await apiRequest(`/instructor/documents/${document.document_id}/archive`, { method: "POST" });
      await loadWorkspace();
      setMessage("Document archived. Its stored PDF and existing challenges are preserved.");
    } catch (caught) { setError(getErrorMessage(caught)); }
    finally { setBusy(""); }
  }

  async function restoreDocument(document: WorkspaceDocument) {
    setBusy("restore"); setError(""); setMessage("");
    try {
      await apiRequest(`/instructor/documents/${document.document_id}/restore`, { method: "POST" });
      const refreshedWorkspace = await loadWorkspace(document.document_id);
      const restored = refreshedWorkspace.documents.find((version) => version.document_id === document.document_id);
      if (restored) selectDocument(restored);
      setMessage(`Restored “${document.title}” version ${document.version_number} as the active version.`);
    } catch (caught) { setError(getErrorMessage(caught)); }
    finally { setBusy(""); }
  }

  async function reprocessDocument(document: WorkspaceDocument) {
    setBusy("reprocess"); setError(""); setMessage("");
    try {
      await apiRequest(`/instructor/documents/${document.document_id}/reprocess`, { method: "POST" });
      await loadWorkspace(document.document_id);
      setMessage(`Rebuilt the search index for “${document.title}”.`);
    } catch (caught) { setError(getErrorMessage(caught)); }
    finally { setBusy(""); }
  }

  async function downloadDocument(document: WorkspaceDocument) {
    setBusy("download"); setError(""); setMessage("");
    try {
      const result = await apiRequest<{ download_url: string }>(`/instructor/documents/${document.document_id}/download`);
      window.location.assign(result.download_url);
    } catch (caught) { setError(getErrorMessage(caught)); setBusy(""); }
  }

  async function generateChallenge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedDocument) { setError("Select a processed course document first."); return; }
    setBusy("generate"); setError(""); setMessage("");
    try {
      const data = new FormData();
      data.append("topic_query", topic.trim()); data.append("language", language); data.append("difficulty", String(difficulty));
      const result = await apiRequest<Challenge>(`/instructor/documents/${selectedDocument}/generate-challenge`, { method: "POST", body: data });
      setChallenge(result); setChallengeDirty(false); setQuiz(null); setQuizDirty(false); await loadWorkspace();
      setMessage(result.judge0_verified ? "Draft generated and its reference solution passed Judge0. Review it before publishing." : "Draft generated. Judge0 verification is pending; review the content and retry verification.");
    } catch (caught) { setError(getErrorMessage(caught)); }
    finally { setBusy(""); }
  }

  async function generateQuiz() {
    if (!selectedDocument) { setError("Select a processed course document first."); return; }
    setBusy("generate"); setError(""); setMessage(""); setChallenge(null); setQuiz(null);
    try {
      const data = new FormData();
      data.append("topic_query", topic.trim()); data.append("language", language); data.append("difficulty", String(difficulty));
      const result = await apiRequest<ConceptualQuiz>(`/instructor/documents/${selectedDocument}/generate-quiz`, { method: "POST", body: data });
      setQuiz(result); setQuizDirty(false); setChallenge(null); setChallengeDirty(false); await loadWorkspace();
      setMessage("A private quiz draft is ready. Review every question and answer before publishing.");
    } catch (caught) { setError(getErrorMessage(caught)); }
    finally { setBusy(""); }
  }

  async function openChallenge(id: string) {
    setBusy("load"); setError(""); setMessage("");
    try {
      const result = await apiRequest<Challenge | ConceptualQuiz>(`/instructor/activities/${id}`);
      if (result.activity_type === "quiz") { setQuiz(result); setQuizDirty(false); setChallenge(null); setChallengeDirty(false); }
      else { setChallenge(result); setChallengeDirty(false); setQuiz(null); setQuizDirty(false); }
    }
    catch (caught) { setError(getErrorMessage(caught)); }
    finally { setBusy(""); }
  }

  function updateChallenge(patch: Partial<Challenge>) {
    setChallenge((current) => current ? { ...current, ...patch, reviewed_by: null } : current);
    setChallengeDirty(true);
  }

  function updateTestCase(index: number, patch: Partial<TestCase>) {
    setChallenge((current) => current ? { ...current, test_cases: current.test_cases.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) } : current);
    setChallengeDirty(true);
  }

  async function saveDraft() {
    if (!challenge) return;
    setBusy("save"); setError(""); setMessage("");
    try {
      const saved = await apiRequest<Challenge>(`/instructor/activities/${challenge.activity_id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: challenge.title, topic_concept: challenge.topic_concept, problem_statement: challenge.problem_statement,
          starter_code: challenge.starter_code, reference_solution_code: challenge.reference_solution_code,
          difficulty_level: Number(challenge.difficulty_level), xp_reward: Number(challenge.xp_reward),
          test_cases: challenge.test_cases.map((testCase, index) => ({ ...testCase, order_index: index })),
        }),
      });
      setChallenge(saved); setChallengeDirty(false); await loadWorkspace();
      setMessage(saved.judge0_verified ? "Draft saved and revalidated successfully. It is ready to publish." : `Draft saved, but Judge0 could not verify it: ${saved.verification_log.error || saved.verification_log.reason || "reference solution failed validation"}`);
    } catch (caught) { setError(getErrorMessage(caught)); }
    finally { setBusy(""); }
  }

  async function verifyDraft() {
    if (!challenge) return;
    if (challengeDirty) { setError("Save and revalidate your edits before retrying verification."); return; }
    setBusy("verify"); setError(""); setMessage("");
    try {
      const updated = await apiRequest<Challenge>(`/instructor/activities/${challenge.activity_id}/verify`, { method: "POST" });
      setChallenge(updated); await loadWorkspace();
      setMessage(updated.judge0_verified ? "Judge0 verification passed. The draft can now be published." : `Verification did not pass: ${updated.verification_log.error || "check the reference solution and test cases"}`);
    } catch (caught) { setError(getErrorMessage(caught)); }
    finally { setBusy(""); }
  }

  async function publishDraft() {
    if (!challenge || !challenge.judge0_verified || !challenge.reviewed_by || challengeDirty) return;
    setBusy("publish"); setError(""); setMessage("");
    try {
      const updated = await apiRequest<Challenge>(`/instructor/activities/${challenge.activity_id}/publish`, { method: "PATCH" });
      setChallenge(updated); await loadWorkspace(); setMessage("Challenge published to its student language track.");
    } catch (caught) { setError(getErrorMessage(caught)); }
    finally { setBusy(""); }
  }

  function updateQuiz(patch: Partial<ConceptualQuiz>) {
    setQuiz((current) => current ? { ...current, ...patch, reviewed_by: null } : current);
    setQuizDirty(true);
  }

  async function setActivityReviewed(activityId: string, reviewed: boolean, activityType: "challenge" | "quiz") {
    setBusy("review"); setError(""); setMessage("");
    try {
      const updated = await apiRequest<Challenge | ConceptualQuiz>(`/instructor/activities/${activityId}/review`, {
        method: "PATCH", body: JSON.stringify({ reviewed }),
      });
      if (activityType === "challenge" && updated.activity_type === "challenge") setChallenge(updated);
      if (activityType === "quiz" && updated.activity_type === "quiz") setQuiz(updated);
      setMessage(reviewed ? "Review confirmation saved. Publishing is now available." : "Review confirmation cleared. Review the saved draft again before publishing.");
    } catch (caught) { setError(getErrorMessage(caught)); }
    finally { setBusy(""); }
  }

  async function saveQuizDraft() {
    if (!quiz) return;
    setBusy("save"); setError(""); setMessage("");
    try {
      const saved = await apiRequest<ConceptualQuiz>(`/instructor/activities/${quiz.activity_id}/quiz`, {
        method: "PATCH",
        body: JSON.stringify({ title: quiz.title, topic_concept: quiz.topic_concept, problem_statement: quiz.problem_statement, difficulty_level: Number(quiz.difficulty_level), xp_reward: Number(quiz.xp_reward), quiz_questions_json: quiz.quiz_questions_json }),
      });
      setQuiz(saved); setQuizDirty(false); await loadWorkspace();
      setMessage("Quiz edits saved. Review it again before publishing.");
    } catch (caught) { setError(getErrorMessage(caught)); }
    finally { setBusy(""); }
  }

  async function publishQuiz() {
    if (!quiz || !quiz.reviewed_by || quizDirty) return;
    setBusy("publish"); setError(""); setMessage("");
    try {
      const published = await apiRequest<ConceptualQuiz>(`/instructor/activities/${quiz.activity_id}/publish`, { method: "PATCH" });
      setQuiz(published); setQuizDirty(false); await loadWorkspace();
      setMessage("Reviewed quiz published to its student language track.");
    } catch (caught) { setError(getErrorMessage(caught)); }
    finally { setBusy(""); }
  }

  const editable = challenge?.review_status === "draft";
  const editableQuiz = quiz?.review_status === "draft";
  const anyBusy = busy !== "";

  return (
    <div className="page-shell">
      <div className="page-heading">
        <div>
          <div className="eyebrow-row">
            <p className="eyebrow-label">INSTRUCTOR WORKSPACE</p>
            <span className="role-pill">{profile?.role || "instructor"}</span>
          </div>
          <h1>Build a coding quest</h1>
          <div className="form-actions">
            <Link className="button button-primary" href="/faculty">Open the faculty workspace →</Link>
            <Link className="button button-outline" href="/instructor/exams">Build and manage exams</Link>
          </div>
          <p>Upload course material, generate a challenge, then review and validate the saved draft.</p>
        </div>
      </div>
      {checkingAccess ? <div className="panel" role="status">Loading your instructor workspace…</div> : profile && profile.role !== "instructor" && profile.role !== "admin" ? (
        <section className="panel instructor-access-card">
          <p className="eyebrow-label">SIGNED IN AS {profile.role.toUpperCase()}</p>
          <h2>Instructor access is not enabled for this account yet</h2>
          <p>Signing in and instructor access are separate: new accounts start as students. For this local ByteQuest workspace, you can grant instructor access to this account with the setup command below.</p>
          <div className="local-setup-command">
            <span>Run this in PowerShell from the ByteQuest project folder</span>
            <code> .\infra\grant-local-instructor.ps1 -Email &apos;EMAIL_USED_TO_SIGN_IN&apos;</code>
          </div>
          <p>Then sign out and sign back in so the app refreshes your access. This local setup command only changes the local Supabase database.</p>
          <div className="form-actions">
            <Link className="button secondary" href="/onboarding?mode=instructor">Switch to an instructor account</Link>
            <Link className="button quiet" href="/quests">Go to Quest Map</Link>
          </div>
        </section>
      ) : !profile ? (
        <section className="panel instructor-access-card">
          <p className="eyebrow-label">INSTRUCTOR SIGN IN</p>
          <h2>Sign in with an instructor account</h2>
          <p>{error || "Use your existing instructor account, or create an account and enable instructor access for this local workspace."}</p>
          <div className="instructor-signin-action-box">
            <Link className="button button-primary button-full instructor-signin-btn" href="/onboarding?mode=instructor">
              Continue to instructor sign in →
            </Link>
          </div>
          <p className="muted-copy">Creating an account alone does not make it an instructor account. New accounts start as students for safety.</p>
        </section>
      ) : (
        <>
          {(message || error) && <div className={`workspace-notice${error ? " error" : ""}`} role={error ? "alert" : "status"}>{error || message}</div>}
          <div className="instructor-layout">
            <div className="instructor-sidebar">
              <section className="panel stack">
                <div><p className="eyebrow-label">STEP 1</p><h2 className="panel-title">Course material</h2><p className="panel-subtitle">Upload a text-based PDF to use as challenge context.</p></div>
                <form className="stack" onSubmit={uploadDocument}>
                  <div className="field"><label htmlFor="doc-title">Document title</label><input id="doc-title" required minLength={2} maxLength={255} value={documentTitle} onChange={(event) => setDocumentTitle(event.target.value)} /></div>
                  <div className="field"><label htmlFor="doc-file">PDF file</label><input ref={fileInputRef} id="doc-file" name="pdf" type="file" accept="application/pdf,.pdf" required onChange={(event) => setFile(event.target.files?.[0] || null)} /></div>
                  <div className="field"><label htmlFor="doc-description">Short description <span className="optional-label">optional</span></label><textarea id="doc-description" rows={3} maxLength={4000} value={documentDescription} onChange={(event) => setDocumentDescription(event.target.value)} /></div>
                  <button className="button secondary" type="submit" disabled={anyBusy || !file}>{busy === "upload" ? "Processing PDF…" : "Upload as a new document"}</button>
                </form>
                {selectedDocument && <div className="document-management-actions">
                  <button className="button" type="button" disabled={anyBusy || !file || !workspace.documents.some((document) => document.document_id === selectedDocument && document.is_current && !document.archived_at)} onClick={() => void uploadDocumentVersion()}>{busy === "version" ? "Saving new version…" : "Upload as next version"}</button>
                  <button className="button quiet" type="button" disabled={anyBusy || !workspace.documents.some((document) => document.document_id === selectedDocument && document.is_current && !document.archived_at)} onClick={() => { const selected = workspace.documents.find((document) => document.document_id === selectedDocument); if (selected) void updateDocumentMetadata(selected); }}>{busy === "metadata" ? "Saving details…" : "Save document details"}</button>
                </div>}
              </section>

              <section className="panel stack">
                <div><p className="eyebrow-label">STEP 2</p><h2 className="panel-title">Generate learning activities</h2><p className="panel-subtitle">Activities stay private until reviewed; code challenges also need Judge0 validation.</p></div>
                <form className="stack" onSubmit={generateChallenge}>
                  <div className="field"><label htmlFor="source-document">Source document</label><select id="source-document" required value={selectedDocument} onChange={(event) => { const selected = workspace.documents.find((document) => document.document_id === event.target.value); if (selected) selectDocument(selected); else { selectedDocumentRef.current = ""; setSelectedDocument(""); } }}><option value="">Choose active, processed material</option>{workspace.documents.filter((document) => document.processing_status === "completed" && document.is_current && !document.archived_at).map((document) => <option key={document.document_id} value={document.document_id}>{document.title} · v{document.version_number}</option>)}{workspace.documents.some((document) => document.document_id === selectedDocument && (!document.is_current || document.archived_at)) && <option value={selectedDocument}>{workspace.documents.find((document) => document.document_id === selectedDocument)?.title} · v{workspace.documents.find((document) => document.document_id === selectedDocument)?.version_number} · restore to generate</option>}</select></div>
                  <div className="field"><label htmlFor="challenge-topic">Topic or concept</label><input id="challenge-topic" required minLength={2} maxLength={100} value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="For example, loops" /></div>
                  <div className="form-grid">
                    <div className="field"><label htmlFor="challenge-language">Language</label><select id="challenge-language" value={language} onChange={(event) => setLanguage(event.target.value as ProgrammingLanguage)}>{Object.entries(languageName).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
                    <div className="field"><label htmlFor="challenge-difficulty">Difficulty</label><select id="challenge-difficulty" value={difficulty} onChange={(event) => setDifficulty(Number(event.target.value))}>{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>Level {value}</option>)}</select></div>
                  </div>
                  <button className="button" type="submit" disabled={anyBusy || !workspace.documents.some((document) => document.document_id === selectedDocument && document.processing_status === "completed" && document.is_current && !document.archived_at)}>{busy === "generate" ? "Generating and checking…" : "Generate challenge draft"}</button>
                  <button className="button secondary" type="button" disabled={anyBusy || !workspace.documents.some((document) => document.document_id === selectedDocument && document.processing_status === "completed" && document.is_current && !document.archived_at)} onClick={() => void generateQuiz()}>{busy === "generate" ? "Generating…" : "Generate quiz draft"}</button>
                </form>
              </section>
            </div>

            <section className="panel workspace-library">
              <div className="workspace-library-heading"><div><p className="eyebrow-label">SAVED WORK</p><h2 className="panel-title">Your workspace</h2></div><button className="button quiet small" type="button" disabled={anyBusy} onClick={() => void refreshWorkspace()}>{busy === "load" ? "Refreshing…" : "Refresh"}</button></div>
              <h3 className="library-subheading">Course documents <span>{workspace.documents.length}</span></h3>
              {workspace.documents.length ? <div className="workspace-list">{workspace.documents.map((document) => <div className={`workspace-list-row document-row${selectedDocument === document.document_id ? " selected" : ""}`} key={document.document_id}>
                <div className="document-row-main"><button className="document-select" type="button" onClick={() => selectDocument(document)} aria-pressed={selectedDocument === document.document_id}><strong>{document.title}</strong><span>{languageName[document.language]} · {document.topic_concept || "No topic"} · v{document.version_number} · {document.total_chunks} sections · {document.file_size_bytes ? `${Math.ceil(document.file_size_bytes / 1024)} KB retained` : "PDF not retained"}</span></button>
                  <div className="document-actions">
                    {document.file_size_bytes ? <button className="text-button" type="button" disabled={anyBusy} onClick={() => void downloadDocument(document)}>{busy === "download" ? "Preparing…" : "Download PDF"}</button> : null}
                    {document.is_current && !document.archived_at && document.file_size_bytes ? <button className="text-button" type="button" disabled={anyBusy} onClick={() => void reprocessDocument(document)}>{busy === "reprocess" ? "Reprocessing…" : "Reprocess"}</button> : null}
                    {!document.is_current || document.archived_at ? <button className="text-button" type="button" disabled={anyBusy} onClick={() => void restoreDocument(document)}>{busy === "restore" ? "Restoring…" : "Restore version"}</button> : <button className="text-button remove-case" type="button" disabled={anyBusy} onClick={() => void archiveDocument(document)}>{busy === "archive" ? "Archiving…" : "Archive"}</button>}
                  </div>
                </div>
                <span className={`status-pill ${document.archived_at ? "pending" : document.is_current && document.processing_status === "completed" ? "good" : "pending"}`}>{document.archived_at ? "archived" : document.is_current ? document.processing_status : "superseded"}</span>
              </div>)}</div> : <p className="muted-copy">Uploaded documents will appear here and remain available after you return.</p>}
              <h3 className="library-subheading">Challenges <span>{workspace.activities.length}</span></h3>
              {workspace.activities.length ? <div className="workspace-list">{workspace.activities.map((activity) => <button className={`workspace-list-row challenge-row${(challenge?.activity_id === activity.activity_id || quiz?.activity_id === activity.activity_id) ? " selected" : ""}`} type="button" key={activity.activity_id} onClick={() => void openChallenge(activity.activity_id)} disabled={anyBusy}><span className="challenge-row-copy"><strong>{activity.title || "Untitled activity"}</strong><span>{activity.activity_type === "quiz" ? `Quiz · ${activity.quiz_question_count} questions` : `Code challenge · ${activity.test_case_count} cases`} · ${languageName[activity.language]} · ${activity.topic_concept} · Level ${activity.difficulty_level}</span></span><span className="challenge-row-status"><span className={`status-pill ${activity.review_status === "published" ? "good" : "pending"}`}>{activity.review_status}</span>{activity.activity_type === "challenge" && <span className={`verification-dot${activity.judge0_verified ? " verified" : ""}`}>{activity.judge0_verified ? "Judge0 passed" : "Needs verification"}</span>}</span></button>)}</div> : <p className="muted-copy">Generated drafts and published activities will appear here for review.</p>}
            </section>
          </div>

          <InstructorShadowAnalytics />

          {challenge && <section className="panel challenge-editor-panel">
            <div className="challenge-editor-heading"><div><p className="eyebrow-label">CHALLENGE REVIEW</p><h2 className="panel-title">{challenge.title || "Challenge draft"}</h2><p className="panel-subtitle">{languageName[challenge.language]} · {challenge.review_status === "published" ? "Published" : "Unpublished draft"}</p></div><span className={`status-pill ${challenge.judge0_verified ? "good" : "pending"}`}>{challenge.judge0_verified ? "Reference solution verified" : "Verification required"}</span></div>
            {challenge.review_status === "published" && <p className="workspace-notice">Published challenges are read-only. To change one, create a new draft so students’ active content remains stable.</p>}
            <div className="draft-edit-grid">
              <div className="field"><label htmlFor="edit-title">Title</label><input id="edit-title" disabled={!editable || anyBusy} minLength={3} maxLength={255} value={challenge.title} onChange={(event) => updateChallenge({ title: event.target.value })} /></div>
              <div className="field"><label htmlFor="edit-topic">Topic concept</label><input id="edit-topic" disabled={!editable || anyBusy} minLength={2} maxLength={100} value={challenge.topic_concept} onChange={(event) => updateChallenge({ topic_concept: event.target.value })} /></div>
              <div className="field full"><label htmlFor="edit-problem">Student problem statement</label><textarea id="edit-problem" disabled={!editable || anyBusy} rows={8} minLength={20} maxLength={20000} value={challenge.problem_statement} onChange={(event) => updateChallenge({ problem_statement: event.target.value })} /></div>
              <div className="field"><label htmlFor="edit-starter">Starter code</label><textarea id="edit-starter" className="code-input" disabled={!editable || anyBusy} rows={10} maxLength={50000} value={challenge.starter_code} onChange={(event) => updateChallenge({ starter_code: event.target.value })} /></div>
              <div className="field"><label htmlFor="edit-reference">Reference solution (instructor only)</label><textarea id="edit-reference" className="code-input" disabled={!editable || anyBusy} rows={10} maxLength={50000} value={challenge.reference_solution_code} onChange={(event) => updateChallenge({ reference_solution_code: event.target.value })} /></div>
              <div className="form-grid full">
                <div className="field"><label htmlFor="edit-difficulty">Difficulty level</label><select id="edit-difficulty" disabled={!editable || anyBusy} value={challenge.difficulty_level} onChange={(event) => updateChallenge({ difficulty_level: Number(event.target.value) })}>{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>Level {value}</option>)}</select></div>
                <div className="field"><label htmlFor="edit-xp">XP reward</label><input id="edit-xp" type="number" min={10} max={10000} disabled={!editable || anyBusy} value={challenge.xp_reward} onChange={(event) => updateChallenge({ xp_reward: Number(event.target.value) })} /></div>
              </div>
            </div>
            <div className="test-case-section"><div className="workspace-library-heading"><div><h3 className="library-subheading">Grading cases <span>{challenge.test_cases.length}</span></h3><p className="muted-copy">Expected outputs and hidden-case inputs stay visible only in this instructor workspace.</p></div>{editable && <button className="button quiet small" type="button" disabled={anyBusy || challenge.test_cases.length >= 20} onClick={() => updateChallenge({ test_cases: [...challenge.test_cases, newTestCase(challenge.test_cases.reduce((max, item) => Math.max(max, item.order_index), -1) + 1)] })}>Add case</button>}</div>
              <div className="test-case-editor-list">{challenge.test_cases.map((testCase, index) => <fieldset className="test-case-editor" key={`${challenge.activity_id}-${index}`} disabled={!editable || anyBusy}><legend>Case {index + 1}</legend><div className="test-case-fields"><label>Input<textarea rows={3} value={testCase.stdin} onChange={(event) => updateTestCase(index, { stdin: event.target.value })} /></label><label>Expected output<textarea rows={3} required value={testCase.expected_stdout} onChange={(event) => updateTestCase(index, { expected_stdout: event.target.value })} /></label><label className="case-check"><input type="checkbox" checked={testCase.is_hidden} onChange={(event) => updateTestCase(index, { is_hidden: event.target.checked })} /> Hidden from students</label><label>Time limit (ms)<input type="number" min={250} max={15000} value={testCase.time_limit_ms} onChange={(event) => updateTestCase(index, { time_limit_ms: Number(event.target.value) })} /></label><label>Memory (KB)<input type="number" min={32000} max={1048576} value={testCase.memory_limit_kb} onChange={(event) => updateTestCase(index, { memory_limit_kb: Number(event.target.value) })} /></label><label>Weight<input type="number" min={0.01} max={100} step={0.1} value={testCase.weight} onChange={(event) => updateTestCase(index, { weight: Number(event.target.value) })} /></label></div>{editable && challenge.test_cases.length > 3 && <button className="text-button remove-case" type="button" disabled={anyBusy} onClick={() => updateChallenge({ test_cases: challenge.test_cases.filter((_, itemIndex) => itemIndex !== index) })}>Remove case</button>}</fieldset>)}</div>
            </div>
            {challenge.verification_log.error && !challenge.judge0_verified && <p className="verification-status failed">Judge0: {challenge.verification_log.error}</p>}
            <InstructorHints activityId={challenge.activity_id} editable={editable} />
            {challenge.verification_log.reason && !challenge.judge0_verified && <p className="verification-status failed">{challenge.verification_log.reason}</p>}
            {editable && <label className="quiz-review-confirm"><input type="checkbox" checked={Boolean(challenge.reviewed_by) && !challengeDirty} disabled={anyBusy || challengeDirty || !challenge.judge0_verified} onChange={(event) => void setActivityReviewed(challenge.activity_id, event.target.checked, "challenge")} /><span>I reviewed the student instructions, starter code, reference solution, and grading cases in this saved draft.</span></label>}
            {editable && challengeDirty && <p className="verification-status failed">Save and pass Judge0 validation on your latest edits before confirming review.</p>}
            <div className="editor-actions">
              {editable && <button className="button secondary" type="button" onClick={() => void saveDraft()} disabled={anyBusy}>{busy === "save" ? "Saving and validating…" : challengeDirty ? "Save edits and revalidate" : "Save and revalidate"}</button>}
              {editable && !challenge.judge0_verified && <button className="button quiet" type="button" onClick={() => void verifyDraft()} disabled={anyBusy || challengeDirty}>{busy === "verify" ? "Checking Judge0…" : "Retry Judge0 validation"}</button>}
              {editable && <button className="button" type="button" onClick={() => void publishDraft()} disabled={anyBusy || !challenge.judge0_verified || !challenge.reviewed_by || challengeDirty}>{busy === "publish" ? "Publishing…" : "Publish challenge"}</button>}
            </div>
            {editable && <p className="muted-copy">{challengeDirty ? "Unsaved changes must be saved and pass Judge0 before publishing." : !challenge.judge0_verified ? "Publishing stays locked until the saved reference solution passes Judge0." : !challenge.reviewed_by ? "Review the saved instructions, reference solution, and grading cases, then check the confirmation before publishing." : "The saved, Judge0-verified challenge has been reviewed and is ready to publish."}</p>}
          </section>}

          {quiz && <section className="panel challenge-editor-panel quiz-editor-panel">
            <div className="challenge-editor-heading"><div><p className="eyebrow-label">QUIZ REVIEW</p><h2 className="panel-title">{quiz.title || "Quiz draft"}</h2><p className="panel-subtitle">{languageName[quiz.language]} · {quiz.review_status === "published" ? "Published" : "Unpublished draft"} · {quiz.quiz_questions_json.questions.length} questions</p></div><span className={`status-pill ${quiz.review_status === "published" ? "good" : "pending"}`}>{quiz.review_status}</span></div>
            {quiz.review_status === "published" && <p className="workspace-notice">Published quizzes are read-only. Create a new activity draft if you need to change this assessment.</p>}
            <div className="draft-edit-grid">
              <div className="field"><label htmlFor="quiz-title">Title</label><input id="quiz-title" disabled={!editableQuiz || anyBusy} minLength={3} maxLength={255} value={quiz.title} onChange={(event) => updateQuiz({ title: event.target.value })} /></div>
              <div className="field"><label htmlFor="quiz-topic">Topic concept</label><input id="quiz-topic" disabled={!editableQuiz || anyBusy} minLength={2} maxLength={100} value={quiz.topic_concept} onChange={(event) => updateQuiz({ topic_concept: event.target.value })} /></div>
              <div className="field full"><label htmlFor="quiz-description">Student instructions</label><textarea id="quiz-description" disabled={!editableQuiz || anyBusy} rows={3} maxLength={2000} value={quiz.problem_statement} onChange={(event) => updateQuiz({ problem_statement: event.target.value })} /></div>
              <div className="field"><label htmlFor="quiz-difficulty">Difficulty</label><select id="quiz-difficulty" disabled={!editableQuiz || anyBusy} value={quiz.difficulty_level} onChange={(event) => updateQuiz({ difficulty_level: Number(event.target.value) })}>{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>Level {value}</option>)}</select></div>
              <div className="field"><label htmlFor="quiz-xp">XP reward</label><input id="quiz-xp" type="number" min={10} max={10000} disabled={!editableQuiz || anyBusy} value={quiz.xp_reward} onChange={(event) => updateQuiz({ xp_reward: Number(event.target.value) })} /></div>
            </div>
            <div className="test-case-section">
              <div><h3 className="library-subheading">Questions and answer keys</h3><p className="muted-copy">Correct answers are private in this instructor review and are never returned in the Quest Map.</p></div>
              <div className="test-case-editor-list">{quiz.quiz_questions_json.questions.map((question, questionIndex) => <fieldset className="test-case-editor quiz-question-editor" key={question.id} disabled={!editableQuiz || anyBusy}>
                <legend>Question {questionIndex + 1}</legend>
                <label>Question text<textarea rows={3} maxLength={2000} required value={question.prompt} onChange={(event) => updateQuiz({ quiz_questions_json: { questions: quiz.quiz_questions_json.questions.map((item, index) => index === questionIndex ? { ...item, prompt: event.target.value } : item) } })} /></label>
                <div className="quiz-answer-options">{question.options.map((option, optionIndex) => <label key={option.key}><span>Option {option.key}</span><input maxLength={500} required value={option.text} onChange={(event) => updateQuiz({ quiz_questions_json: { questions: quiz.quiz_questions_json.questions.map((item, index) => index === questionIndex ? { ...item, options: item.options.map((choice, choiceIndex) => choiceIndex === optionIndex ? { ...choice, text: event.target.value } : choice) } : item) } })} /></label>)}</div>
                <label>Correct answer<select required value={question.correct_answer} onChange={(event) => updateQuiz({ quiz_questions_json: { questions: quiz.quiz_questions_json.questions.map((item, index) => index === questionIndex ? { ...item, correct_answer: event.target.value } : item) } })}>{question.options.map((option) => <option key={option.key} value={option.key}>{option.key}</option>)}</select></label>
              </fieldset>)}</div>
            </div>
            {editableQuiz && <label className="quiz-review-confirm"><input type="checkbox" checked={Boolean(quiz.reviewed_by) && !quizDirty} disabled={anyBusy || quizDirty} onChange={(event) => void setActivityReviewed(quiz.activity_id, event.target.checked, "quiz")} /><span>I reviewed the student instructions, every question, and each correct answer in the saved draft.</span></label>}
            {editableQuiz && quizDirty && <p className="verification-status failed">Save your latest edits before marking this quiz reviewed.</p>}
            <div className="editor-actions">
              {editableQuiz && <button className="button secondary" type="button" onClick={() => void saveQuizDraft()} disabled={anyBusy}>{busy === "save" ? "Saving…" : quizDirty ? "Save quiz edits" : "Save quiz draft"}</button>}
              {editableQuiz && <button className="button" type="button" onClick={() => void publishQuiz()} disabled={anyBusy || quizDirty || !quiz.reviewed_by}>{busy === "publish" ? "Publishing…" : "Publish reviewed quiz"}</button>}
            </div>
            {editableQuiz && <p className="muted-copy">A quiz can be published only after its saved content has been reviewed. Published quizzes cannot be edited.</p>}
          </section>}
        </>
      )}
    </div>
  );
}
