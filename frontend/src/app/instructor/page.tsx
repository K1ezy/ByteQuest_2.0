"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { apiRequest, getErrorMessage } from "@/lib/api";
import { getSupabase } from "@/lib/supabase";
import type { Profile, ProgrammingLanguage } from "@/lib/types";

interface UploadResponse { document_id: string; title: string; total_chunks: number; status: string }
interface ChallengeResponse { activity_id: string; title: string; judge0_verified: boolean; verification_log: unknown; review_status: string; message: string }

export default function InstructorPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [topic, setTopic] = useState("");
  const [language, setLanguage] = useState<ProgrammingLanguage>("python");
  const [difficulty, setDifficulty] = useState("2");
  const [documentId, setDocumentId] = useState("");
  const [uploaded, setUploaded] = useState<UploadResponse | null>(null);
  const [challenge, setChallenge] = useState<ChallengeResponse | null>(null);
  const [busy, setBusy] = useState<"upload" | "generate" | "publish" | "" > ("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let active = true;
    void getSupabase().auth.getSession().then(({ data }) => {
      if (!data.session) { if (active) setLoading(false); return; }
      return apiRequest<Profile>("/profile/me").then((value) => { if (active) setProfile(value); }).catch((error: unknown) => { if (active) { setIsError(true); setMessage(getErrorMessage(error)); } }).finally(() => { if (active) setLoading(false); });
    });
    return () => { active = false; };
  }, []);

  async function uploadPdf(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) { setIsError(true); setMessage("Choose a PDF to upload."); return; }
    if (file.size > 10 * 1024 * 1024) { setIsError(true); setMessage("PDF files must be 10 MiB or smaller."); return; }
    setBusy("upload"); setMessage(""); setIsError(false); setChallenge(null);
    try {
      const form = new FormData();
      form.set("file", file); form.set("title", title.trim()); form.set("description", description.trim()); form.set("language_tag", language); form.set("topic_concept", topic.trim());
      const result = await apiRequest<UploadResponse>("/instructor/documents/upload", { method: "POST", body: form });
      setUploaded(result); setDocumentId(result.document_id); setMessage(`PDF processed into ${result.total_chunks} lesson chunks.`);
    } catch (error) { setIsError(true); setMessage(getErrorMessage(error)); }
    finally { setBusy(""); }
  }

  async function generateChallenge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!documentId) { setIsError(true); setMessage("Upload and process a PDF before generating a challenge."); return; }
    setBusy("generate"); setMessage(""); setIsError(false); setChallenge(null);
    try {
      const form = new FormData(); form.set("topic_query", topic.trim()); form.set("language", language); form.set("difficulty", difficulty);
      const result = await apiRequest<ChallengeResponse>(`/instructor/documents/${documentId}/generate-challenge`, { method: "POST", body: form });
      setChallenge(result);
      setMessage(result.judge0_verified ? "Reference solution passed Judge0 validation. Review the challenge, then publish it." : "Challenge was generated, but Judge0 did not verify its reference solution. Publishing stays disabled.");
      setIsError(!result.judge0_verified);
    } catch (error) { setIsError(true); setMessage(getErrorMessage(error)); }
    finally { setBusy(""); }
  }

  async function publishChallenge() {
    if (!challenge?.judge0_verified) return;
    setBusy("publish"); setMessage(""); setIsError(false);
    try {
      await apiRequest(`/instructor/activities/${challenge.activity_id}/publish`, { method: "PATCH" });
      setMessage("Challenge published to the student quest map.");
      setChallenge({ ...challenge, review_status: "published" });
    } catch (error) { setIsError(true); setMessage(getErrorMessage(error)); }
    finally { setBusy(""); }
  }

  return (
    <div className="page-shell">
      <div className="page-heading"><div><p className="eyebrow-label">INSTRUCTOR STUDIO</p><h1>Turn a lesson into a quest</h1><p>Upload a lesson PDF, generate a coding challenge from its content, and publish it after automated solution checks.</p></div>{profile && <span className="role-pill">{profile.role}</span>}</div>
      {loading ? <section className="panel">Checking your instructor account…</section> : !profile ? <section className="panel"><h2>Sign in to continue</h2><p className="panel-subtitle">Use your local ByteQuest account to open the instructor studio.</p><Link className="button button-primary" href="/onboarding">Sign in</Link>{message && <p className={`notice ${isError ? "error" : ""}`} role="status">{message}</p>}</section> : profile.role === "student" ? <section className="panel"><h2>Instructor access required</h2><p className="panel-subtitle">This account is currently a student. For local E2E setup, promote a dedicated test account from Supabase Studio. Do not promote a public account through this app.</p><Link href="/quests" className="button button-outline">Return to quest map</Link></section> : (
        <div className="two-column">
          <div className="stack">
            <section className="panel">
              <div className="step-line"><span>1</span> LESSON PDF</div><h2>Upload course material</h2><p className="panel-subtitle">Text is extracted and embedded for lesson-grounded generation. PDF limit: 10 MiB.</p>
              <form onSubmit={uploadPdf}>
                <div className="form-grid">
                  <div className="field full"><label htmlFor="pdf">PDF file</label><input id="pdf" type="file" accept="application/pdf,.pdf" required onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
                  <div className="field full"><label htmlFor="doc-title">Lesson title</label><input id="doc-title" required maxLength={255} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Introduction to loops" /></div>
                  <div className="field full"><label htmlFor="description">Short description (optional)</label><textarea id="description" maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What should learners take away?" /></div>
                  <div className="field"><label htmlFor="topic">Topic concept</label><input id="topic" required maxLength={100} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="for loops" /></div>
                  <div className="field"><label htmlFor="language">Challenge language</label><select id="language" value={language} onChange={(e) => setLanguage(e.target.value as ProgrammingLanguage)}><option value="python">Python</option><option value="cpp">C++</option><option value="java">Java</option></select></div>
                </div>
                <div className="form-actions"><button className="button button-primary" type="submit" disabled={busy !== ""}>{busy === "upload" ? "Processing PDF…" : "Upload and process"}</button>{uploaded && <span className="completion">{uploaded.total_chunks} chunks ready</span>}</div>
              </form>
            </section>
            <section className="panel">
              <div className="step-line"><span>2</span> CHALLENGE GENERATION</div><h2>Generate a coding challenge</h2><p className="panel-subtitle">RAG uses the uploaded lesson, then Judge0 checks the reference solution against each generated test case.</p>
              <form onSubmit={generateChallenge}>
                <div className="form-grid"><div className="field full"><label htmlFor="topic-query">Concept to assess</label><input id="topic-query" required minLength={2} maxLength={100} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="for loops and running totals" /></div><div className="field"><label htmlFor="difficulty">Difficulty</label><select id="difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>{[1,2,3,4,5].map((value) => <option key={value} value={value}>Level {value}</option>)}</select></div><div className="field"><label htmlFor="source-document">Source document</label><select id="source-document" value={documentId} onChange={(e) => { setDocumentId(e.target.value); setUploaded(null); setChallenge(null); }}><option value="">Upload a lesson first</option>{uploaded && <option value={uploaded.document_id}>{uploaded.title}</option>}</select></div></div>
                <div className="form-actions"><button className="button button-dark" type="submit" disabled={busy !== "" || !documentId}>{busy === "generate" ? "Generating and validating…" : "Generate challenge"}</button></div>
              </form>
            </section>
          </div>
          <aside className="stack">
            <div className="callout"><h3>Publish gate</h3><p>Challenge publishing requires a successful Judge0 reference-solution check. The API enforces this rule too.</p></div>
            {challenge && <section className="panel"><div className="step-line"><span>3</span> REVIEW</div><h2>{challenge.title}</h2><p className="panel-subtitle">Activity <span className="mono">{challenge.activity_id}</span></p><div className={`role-pill ${challenge.judge0_verified ? "" : ""}`}>{challenge.judge0_verified ? "✓ Judge0 verified" : "! Verification failed"}</div><pre className="result-box">{JSON.stringify(challenge.verification_log, null, 2)}</pre><div className="form-actions"><button className="button button-primary" type="button" onClick={publishChallenge} disabled={busy !== "" || !challenge.judge0_verified || challenge.review_status === "published"}>{busy === "publish" ? "Publishing…" : challenge.review_status === "published" ? "Published" : "Publish challenge"}</button>{challenge.review_status === "published" && <Link className="button button-outline" href="/quests">View quest map</Link>}</div></section>}
            {message && <p className={`notice ${isError ? "error" : ""}`} role="status">{message}</p>}
          </aside>
        </div>
      )}
    </div>
  );
}
