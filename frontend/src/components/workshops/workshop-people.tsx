"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useShellProfile } from "@/components/app-shell";
import { Button, useApi } from "@/components/workspace/ui";
import { apiRequest } from "@/lib/api";
import { useWorkshop } from "./workshop-layout";
import { WorkshopDialog, WorkshopError, WorkshopForm } from "./workshop-ui";

type StudentAlias = { username: string };
type ManagedStudent = StudentAlias & {
  id: string;
  display_name: string | null;
  school_id: string | null;
  year_level: number;
  block_section: string | null;
};
type People = { instructor: StudentAlias; students: (StudentAlias | ManagedStudent)[] };

export function WorkshopPeople() {
  const { workshop, setWorkshop } = useWorkshop();
  const { role } = useShellProfile();
  const router = useRouter();
  const path = `/workshops/${workshop.id}`;
  const { data, loading, error, reload, setData } = useApi<People>(`${path}/people`, true);
  const [selection, setSelection] = useState<ManagedStudent | "leave" | null>(null);
  const [notice, setNotice] = useState("");
  const managing = workshop.is_owner && !workshop.archived;
  const canLeave = role === "student" && !workshop.archived;

  async function confirm() {
    if (!selection) return;
    if (selection === "leave") {
      await apiRequest<void>(`${path}/membership`, { method: "DELETE" });
      router.replace("/workshops");
      return;
    }
    await apiRequest<void>(`${path}/members/${selection.id}`, { method: "DELETE" });
    setData((current) => current && { ...current, students: current.students.filter((student) => !("id" in student) || student.id !== selection.id) });
    setWorkshop({ ...workshop, member_count: Math.max(0, workshop.member_count - 1) });
    setNotice(`@${selection.username} was removed from the workshop.`);
    setSelection(null);
  }

  return <div className="workshop-stack">
    <div className="workshop-heading">
      <h2 tabIndex={-1} data-workshop-focus>People</h2>
      {canLeave && <Button onClick={() => setSelection("leave")}>Leave workshop</Button>}
    </div>
    {notice && <p role="status">{notice}</p>}
    {loading ? <p role="status">Loading people…</p> : error ? <WorkshopError message={error} retry={reload} /> : data && <>
      <section className="workshop-panel">
        <h3>Instructor</h3>
        <p><strong>{workshop.owner_name}</strong> <span className="workshop-muted">@{data.instructor.username}</span></p>
      </section>
      <section className="workshop-panel">
        <header className="workshop-heading">
          <h3>Students ({data.students.length})</h3>
          {managing && workshop.joining_enabled && <Link className="button button-outline" href={`${path}#workshop-invitation`}>Invite students</Link>}
          {managing && !workshop.joining_enabled && <Link className="button button-outline" href={`${path}/settings`}>Invitation settings</Link>}
        </header>
        {data.students.length === 0 ? <p>No students have joined yet.</p> : <ul className="workshop-people-list">
          {data.students.map((student) => <li key={student.username}>
            <div>
              {"id" in student && student.display_name && <strong>{student.display_name}</strong>}
              <p>@{student.username}</p>
              {"id" in student && <p className="workshop-muted">
                {student.school_id && <span>School ID {student.school_id} · </span>}
                Year {student.year_level}{student.block_section && ` · Block ${student.block_section}`}
              </p>}
            </div>
            {managing && "id" in student && <Button aria-label={`Remove @${student.username}`} onClick={() => setSelection(student)}>Remove</Button>}
          </li>)}
        </ul>}
      </section>
    </>}
    {selection && !workshop.archived && <WorkshopDialog title={selection === "leave" ? "Leave workshop?" : "Remove student?"} close={() => setSelection(null)}>
      <WorkshopForm submitLabel={selection === "leave" ? "Leave workshop" : "Remove student"}
        close={() => setSelection(null)} onSubmit={confirm} danger>
        <p>{selection === "leave"
          ? "You’ll lose workshop access. Your attempts and rewards stay with your account."
          : `@${selection.username} will lose workshop access. Their attempts and rewards stay with their account.`}</p>
      </WorkshopForm>
    </WorkshopDialog>}
  </div>;
}
