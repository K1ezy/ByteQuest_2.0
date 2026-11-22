"use client";

import Link from "next/link";
import { useState } from "react";
import { useApi, StatusChip, EmptyState, Notice } from "@/components/workspace/ui";
import { MeasureDefinitions, UpdatedAt, NotEnoughData } from "@/components/insights/ui";
import { metrics } from "@/lib/insight-metrics";
import { READINESS_MESSAGES } from "@/app/(workspace)/instructor/ml/types";

export interface CourseHealthRow {
  id:string; code:string; title:string; course_status:string; status:string;
  instructor_count:number; instructors:string[]; enrolled:number; published_activities:number;
  active_7d:number|null; not_started:number|null; activities_passed:number|null; research_consent:number|null;
  /** Null while the study is closed or the course is too small to report. */
  research_consent_unanswered:number|null;
}
export function healthAction(row: CourseHealthRow) {
  if (row.course_status === "archived") return null;
  const course = encodeURIComponent(row.id);
  if (!row.instructor_count) return {label:"Assign instructor",href:"/admin/assignments?course="+course};
  if (!row.enrolled) return {label:"Enrol students",href:"/admin/assignments?enroll=1&course="+course};
  if (!row.published_activities) return {label:"Check activity availability",href:"/admin/activities?status=attention&course="+course};
  if (row.not_started !== null && row.not_started >= row.enrolled / 2) return {label:"Review student accounts",href:"/admin/accounts?status=attention"};
  return null;
}
export function CourseHealth() {
  const { data, error, loading, reload } = useApi<{courses:CourseHealthRow[];generated_at:string;forecast_status:string}>("/admin/course-health");
  const [showArchived, setShowArchived] = useState(false);
  const archivedCount = (data?.courses ?? []).filter(row => row.course_status === "archived").length;
  const rows = (data?.courses ?? []).filter(row => showArchived || row.course_status !== "archived").map(row => ({row,action:healthAction(row)}))
    .sort((a,b) => Number(Boolean(b.action))-Number(Boolean(a.action)) || a.row.code.localeCompare(b.row.code));
  return <section className="ws-panel" aria-labelledby="course-health-title"><h2 id="course-health-title">Course health</h2>
    {archivedCount ? <label className="ws-check"><input type="checkbox" checked={showArchived} onChange={event => setShowArchived(event.target.checked)} /> Show archived ({archivedCount})</label> : null}
    {loading && !data && <div className="ws-skeleton" role="status" aria-label="Loading course health"/>}
    {error && <Notice tone="error">{error} <button className="ws-inline-link" onClick={reload}>Retry</button></Notice>}
    {data && <><p>Platform forecasts · {data.forecast_status === "ready" ? "Forecast scoring is available." : READINESS_MESSAGES[data.forecast_status] || READINESS_MESSAGES.unavailable}</p>
    {rows.length ? <div className="ws-table-wrap" tabIndex={0} aria-label="Course health table"><table className="ws-table analysis-table">
      <caption className="sr-only">Course health and next actions</caption><thead><tr>{["Course","Instructor","Enrolled",metrics.active_7d.label,metrics.not_started.label,"Published",metrics.activities_passed.label,metrics.consent_coverage.label,"Action"].map(t => <th key={t} scope="col">{t}</th>)}</tr></thead>
      <tbody>{rows.map(({row,action}) => <tr key={row.id}>
        <th scope="row">{row.code} · {row.title} <StatusChip state={row.course_status}/></th><td>{row.instructors.join(", ") || "Unassigned"}</td>
        <td>{row.enrolled}</td><td>{row.active_7d ?? <NotEnoughData/>}</td><td>{row.not_started ?? <NotEnoughData/>}</td>
        <td>{row.published_activities}</td><td>{row.activities_passed === null ? <NotEnoughData/> : row.activities_passed+"%"}</td>
        <td>{row.research_consent === null ? <NotEnoughData/> : row.research_consent+" of "+row.enrolled}
          {row.research_consent_unanswered ? <span className="ws-muted"> · {row.research_consent_unanswered} not answered</span> : null}</td>
        <td>{action ? <Link className="ws-touch-action" href={action.href}>{action.label}</Link> : <span className="ws-muted">No action needed</span>}</td>
      </tr>)}</tbody></table></div> : <EmptyState title="No courses yet" action={<Link href="/admin/courses">Create course</Link>}>Create a course to see its health.</EmptyState>}
      <MeasureDefinitions names={["active_7d","not_started","activities_passed","consent_coverage"]}/><UpdatedAt at={data.generated_at}/>
    </>}
  </section>;
}
