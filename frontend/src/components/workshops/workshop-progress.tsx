"use client";

import Link from "next/link";
import { useApi } from "@/components/workspace/ui";
import { useWorkshop } from "./workshop-layout";
import { WorkshopError } from "./workshop-ui";

type Status = "solved" | "attempted" | "not_started";
type LearnerProgress = {
  id: string;
  username: string;
  display_name: string | null;
  completion_percent: number;
  states: Record<string, Status>;
};
type Progress = { activities: { id: string; title: string }[]; students: LearnerProgress[] };

const labels: Record<Status, string> = {
  solved: "Solved",
  attempted: "Attempted",
  not_started: "Not started",
};

function ProgressStatus({ state = "not_started" }: { state?: Status }) {
  return <span className="workshop-progress-status" data-state={state}>{labels[state]}</span>;
}

function StudentName({ student }: { student: LearnerProgress }) {
  return <span className="workshop-progress-name">
    {student.display_name && <strong>{student.display_name}</strong>}
    <span>@{student.username}</span>
  </span>;
}

export function WorkshopProgress() {
  const { workshop } = useWorkshop();
  const { data, loading, error, reload } = useApi<Progress>(`/workshops/${workshop.id}/progress`, true);
  return <div className="workshop-stack">
    <h2>Progress</h2>
    {loading ? <p role="status">Loading progress…</p>
      : error ? <WorkshopError message={error} retry={reload} />
      : data && (!data.students.length || !data.activities.length ? <div className="workshop-panel">
        <h3>{data.students.length ? "Add practice activities" : "No students have joined yet"}</h3>
        <p>{data.students.length ? "Share a published activity to see student progress." : "Progress appears when students join the workshop."}</p>
        <Link className="workshop-text-link" href={`/workshops/${workshop.id}/${data.students.length ? "activities" : "people"}`}>
          {data.students.length ? "Open Activities" : "Open People"}
        </Link>
      </div> : <>
        <div className="workshop-progress-table-scroll" tabIndex={0} role="region" aria-label="Workshop activity progress">
          <table className="workshop-progress-table">
            <caption className="sr-only">Practice activity progress by student</caption>
            <thead>
              <tr>
                <th scope="col">Student</th>
                <th scope="col">Completion</th>
                {data.activities.map((item) => <th key={item.id} scope="col">{item.title}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.students.map((student) => <tr key={student.id}>
                <th scope="row"><StudentName student={student} /></th>
                <td>{student.completion_percent}%</td>
                {data.activities.map((item) => <td key={item.id}><ProgressStatus state={student.states[item.id]} /></td>)}
              </tr>)}
            </tbody>
          </table>
        </div>
        <div className="workshop-progress-phone">
          {data.students.map((student) => <details key={student.id} className="workshop-panel">
            <summary>
              <StudentName student={student} />
              <strong>{student.completion_percent}% complete</strong>
            </summary>
            <dl>
              {data.activities.map((item) => <div key={item.id}>
                <dt>{item.title}</dt>
                <dd><ProgressStatus state={student.states[item.id]} /></dd>
              </div>)}
            </dl>
          </details>)}
        </div>
      </>)}
  </div>;
}
