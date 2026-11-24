import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { getErrorMessage } from "@/lib/api";
import type { ProgrammingLanguage } from "@/lib/types";
import { activityListHref } from "@/lib/instructor-activity";
import { createActivity, type ActivityList } from "@/lib/workspace";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { Button, FieldError, Notice, useApi } from "@/components/workspace/ui";

export function ManualActivityForm({ courseId }: { courseId: string }) {
  const router = useRouter();
  const { profile, refreshCourses, setUnsaved } = useWorkspace();
  const { data } = useApi<ActivityList>(`/faculty/activities?course_id=${encodeURIComponent(courseId)}`, true);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const active = useRef(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState({
    activity_type: "quiz",
    // Null until the instructor picks one: then the class's language is shown (see createLanguage).
    language: null as ProgrammingLanguage | null,
    title: "",
    topic_concept: "",
    problem_statement: "",
    difficulty_level: 2,
    xp_reward: 30,
    reference_solution_code: "",
    starter_code: "",
    exam_only: false,
  });

  const createLanguage = draft.language ?? data?.items.find((row) => row.language)?.language
    ?? profile.enrolled_language ?? "python";
  const dirty = Boolean(draft.title || draft.topic_concept || draft.problem_statement
    || draft.reference_solution_code || draft.starter_code || draft.language || draft.exam_only
    || draft.activity_type !== "quiz" || draft.difficulty_level !== 2);

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  useEffect(() => {
    setUnsaved(dirty || busy, "You have activity details in progress. Leave this form?");
    return () => setUnsaved(false);
  }, [busy, dirty, setUnsaved]);

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!courseId || busy) return;
    const found: Record<string, string> = {};
    if (draft.title.trim().length < 3) found.title = "Enter a title of at least 3 characters.";
    if (draft.topic_concept.trim().length < 2) found.topic_concept = "Enter the topic or concept.";
    if (draft.problem_statement.trim().length < 20) found.problem_statement = "Write at least 20 characters of student instructions.";
    if (draft.activity_type === "challenge" && !draft.reference_solution_code.trim()) {
      found.reference_solution_code = "Add the reference solution so grading can be validated.";
    }
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    setNotice("");
    try {
      const body: Record<string, unknown> = {
        course_id: courseId,
        activity_type: draft.activity_type,
        exam_only: draft.exam_only,
        language: createLanguage,
        title: draft.title.trim(),
        topic_concept: draft.topic_concept.trim(),
        problem_statement: draft.problem_statement.trim(),
        difficulty_level: draft.difficulty_level,
        xp_reward: draft.xp_reward,
      };
      if (draft.activity_type === "challenge") {
        body.starter_code = draft.starter_code;
        body.reference_solution_code = draft.reference_solution_code;
      }
      const result = await createActivity(body);
      if (!active.current) return;
      setUnsaved(false);
      router.replace(activityListHref(courseId, result.activity.activity_id));
      void refreshCourses();
    } catch (caught) {
      setNotice(getErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {notice ? <Notice tone="error">{notice}</Notice> : null}
      <section className="ws-panel" aria-labelledby="create-activity-title">
        <div className="ws-panel-head">
          <h2 id="create-activity-title">Activity details</h2>
        </div>
        <form className="ws-form-grid" onSubmit={(event) => void submitCreate(event)}>
          <div className="ws-field">
            <label htmlFor="create-type">Type</label>
            <select id="create-type" value={draft.activity_type} onChange={(event) => setDraft({ ...draft, activity_type: event.target.value })}>
              <option value="quiz">Quiz / review lesson</option>
              <option value="challenge">Coding challenge</option>
            </select>
          </div>
          <div className="ws-field">
            <label htmlFor="create-language">Language</label>
            <select id="create-language" value={createLanguage} onChange={(event) => setDraft({ ...draft, language: event.target.value as ProgrammingLanguage })}>
              <option value="python">Python</option>
              <option value="cpp">C++</option>
              <option value="java">Java</option>
            </select>
          </div>
          <div className="ws-field">
            <label htmlFor="create-title">Title</label>
            <input id="create-title" value={draft.title} maxLength={255} onChange={(event) => setDraft({ ...draft, title: event.target.value })} aria-invalid={Boolean(errors.title)} />
            <FieldError>{errors.title}</FieldError>
          </div>
          <label className="ws-checkbox-row">
            <input type="checkbox" checked={draft.exam_only} onChange={(event) => setDraft({ ...draft, exam_only: event.target.checked })} />
            Exam-only activity for a restricted assessment
          </label>
          <div className="ws-field">
            <label htmlFor="create-topic">Topic or concept</label>
            <input id="create-topic" value={draft.topic_concept} maxLength={100} onChange={(event) => setDraft({ ...draft, topic_concept: event.target.value })} aria-invalid={Boolean(errors.topic_concept)} />
            <FieldError>{errors.topic_concept}</FieldError>
          </div>
          <div className="ws-field">
            <label htmlFor="create-difficulty">Difficulty</label>
            <select id="create-difficulty" value={draft.difficulty_level} onChange={(event) => setDraft({ ...draft, difficulty_level: Number(event.target.value) })}>
              {[1, 2, 3, 4, 5].map((value) => (
                <option key={value} value={value}>
                  Level {value}
                </option>
              ))}
            </select>
          </div>
          <div className="ws-field full">
            <label htmlFor="create-problem">Student instructions</label>
            <textarea id="create-problem" rows={4} maxLength={20000} value={draft.problem_statement} onChange={(event) => setDraft({ ...draft, problem_statement: event.target.value })} aria-invalid={Boolean(errors.problem_statement)} />
            <FieldError>{errors.problem_statement}</FieldError>
          </div>
          {draft.activity_type === "challenge" ? (
            <>
              <div className="ws-field">
                <label htmlFor="create-starter">Starter code</label>
                <textarea id="create-starter" className="ws-code-input" rows={5} maxLength={50000} value={draft.starter_code} onChange={(event) => setDraft({ ...draft, starter_code: event.target.value })} />
              </div>
              <div className="ws-field">
                <label htmlFor="create-reference">Reference solution (instructors only)</label>
                <textarea id="create-reference" className="ws-code-input" rows={5} maxLength={50000} value={draft.reference_solution_code} onChange={(event) => setDraft({ ...draft, reference_solution_code: event.target.value })} aria-invalid={Boolean(errors.reference_solution_code)} />
                <FieldError>{errors.reference_solution_code}</FieldError>
              </div>
            </>
          ) : null}
          <div className="ws-inline-actions full">
            <Button variant="primary" type="submit" disabled={busy}>
              {busy ? "Creating activity…" : "Create activity"}
            </Button>
            <span className="ws-muted">The activity stays private until you preview and publish it.</span>
          </div>
        </form>
      </section>
    </>
  );
}
