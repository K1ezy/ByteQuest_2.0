"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useApi } from "@/components/workspace/ui";
import type { Quest } from "@/lib/types";

const tracks = [["python", "Python"], ["cpp", "C++"], ["java", "Java"]] as const;

export function StudentPreview() {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const track = tracks.find(([value]) => value === params.get("track"))?.[0] ?? "python";
  const { data, loading, error, reload } = useApi<Quest[]>("/quests");
  const visible = (data ?? []).filter((item) => item.language === track);
  const back = pathname.startsWith("/admin/") ? "/admin/teaching" : "/instructor";
  return <section className="page-shell">
    <h1>Student Preview</h1>
    <p>Browse the published catalog by language. Workshop membership and student progress are specific to each student.</p>
    <Link className="button button-outline" href={back}>Back to workspace</Link>
    <div className="quest-toolbar">
      <label htmlFor="preview-track">Programming language</label>
      <select id="preview-track" value={track} onChange={(event) => {
        const query = new URLSearchParams(params);
        query.set("track", event.target.value);
        router.push(pathname + "?" + query, { scroll: false });
      }}>
        {tracks.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
      </select>
    </div>
    {loading ? <p role="status">Loading published activities…</p> : error ?
      <div><p role="alert">{error}</p><button type="button" className="button button-outline" onClick={reload}>Retry</button></div> :
      visible.length ? <div className="quest-grid">{visible.map((item) => <article className="panel" key={item.id}>
        <h2>{item.title || item.topic_concept}</h2>
        <p>{item.activity_type === "challenge" ? "Code challenge" : "Concept check"} · Difficulty {item.difficulty_level} · {item.xp_reward} XP</p>
        {item.problem_statement && <details><summary>Read activity</summary><p style={{ whiteSpace: "pre-wrap" }}>{item.problem_statement}</p></details>}
        {item.quiz_questions?.length ? <details><summary>Preview concept questions</summary>
          <ol>{item.quiz_questions.map((question) => <li key={question.id}>{question.prompt}
            <ul>{question.options.map((option) => <li key={option.key}>{option.text}</li>)}</ul>
          </li>)}</ol>
        </details> : null}
      </article>)}</div> : <p>No published activities in this language.</p>}
  </section>;
}
