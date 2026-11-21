"use client";

import { useState } from "react";
import { Button } from "@/components/workspace/ui";
import { apiRequest } from "@/lib/api";
import type { Workshop } from "@/lib/types";
import { readClassroomDetails, WorkshopClassroomFields } from "./workshop-classroom-details";
import { useWorkshop } from "./workshop-layout";
import { WorkshopDialog, WorkshopForm, WorkshopInvite } from "./workshop-ui";

const confirmations = {
  code: {
    title: "Reset workshop code?",
    text: "The previous code and invite link will stop working. Current members keep their access.",
    action: "Reset code",
    notice: "Workshop code reset.",
  },
  archive: {
    title: "Archive workshop?",
    text: "The workshop moves to the Archived list and becomes read-only. Members can still open its shared activities.",
    action: "Archive workshop",
    notice: "Workshop archived.",
  },
  restore: {
    title: "Restore workshop?",
    text: "The workshop returns to the active list with its previous joining setting.",
    action: "Restore workshop",
    notice: "Workshop restored.",
  },
} as const;

export function WorkshopSettings() {
  const { workshop, setWorkshop } = useWorkshop();
  const [selection, setSelection] = useState<keyof typeof confirmations | null>(null);
  const [notice, setNotice] = useState("");
  const [name, setName] = useState(workshop.name);
  const [description, setDescription] = useState(workshop.description ?? "");
  const base = `/workshops/${workshop.id}`;
  const confirmation = selection ? confirmations[selection] : null;

  async function patch(body: object, message: string) {
    setNotice("");
    const updated = await apiRequest<Workshop>(base, { method: "PATCH", body: JSON.stringify(body) });
    setWorkshop(updated);
    setNotice(message);
    return updated;
  }

  return <div className="workshop-stack workshop-settings-page">
    <h2 tabIndex={-1} data-workshop-focus>Settings</h2>
    {notice && <p role="status">{notice}</p>}
    {!workshop.archived && <>
      <section className="workshop-panel">
        <h3>Workshop details</h3>
        <WorkshopForm submitLabel="Save details" onSubmit={async (fields) => {
          const updated = await patch({ name, description, ...readClassroomDetails(fields) }, "Workshop details saved.");
          setName(updated.name);
          setDescription(updated.description ?? "");
        }}>
          <label>Workshop name
            <input name="name" value={name} onChange={(event) => setName(event.target.value)} required minLength={3} maxLength={80} />
          </label>
          <WorkshopClassroomFields details={workshop} />
          <label>Description (optional)
            <textarea name="description" value={description} onChange={(event) => setDescription(event.target.value)} rows={3} maxLength={500} />
          </label>
        </WorkshopForm>
      </section>
    </>}
    <section className="workshop-panel workshop-joining-settings">
      <h3>Invitations</h3>
      {!workshop.archived && <>
        <p>{workshop.joining_enabled ? "New members can join with the code or link." : "Joining is off. Current members still have access."}</p>
        <WorkshopForm submitLabel={workshop.joining_enabled ? "Disable joining" : "Enable joining"}
          onSubmit={async () => {
            const enabled = !workshop.joining_enabled;
            await patch({ joining_enabled: enabled }, enabled ? "Joining enabled." : "Joining disabled.");
          }}>
          <p>Changing this setting keeps the current code and existing memberships.</p>
        </WorkshopForm>
        <Button variant="quiet" onClick={() => setSelection("code")}>Reset code</Button>
      </>}
      <WorkshopInvite key={workshop.join_code} workshop={workshop} showTitle={false} />
    </section>
    <section className="workshop-panel">
      <h3>Archive</h3>
      <p>{workshop.archived ? "Restore this workshop to make changes again." : "Archived workshops stay available to existing members."}</p>
      <Button variant={workshop.archived ? "outline" : "danger"} onClick={() => setSelection(workshop.archived ? "restore" : "archive")}>
        {workshop.archived ? "Restore workshop" : "Archive workshop"}
      </Button>
    </section>
    {selection && confirmation && <WorkshopDialog title={confirmation.title} close={() => setSelection(null)}>
      <WorkshopForm submitLabel={confirmation.action} close={() => setSelection(null)} danger={selection !== "restore"}
        onSubmit={async () => {
          setNotice("");
          const updated = await apiRequest<Workshop>(`${base}/${selection}`, { method: "POST" });
          setWorkshop(updated);
          setNotice(confirmation.notice);
          setSelection(null);
        }}>
        <p>{confirmation.text}</p>
      </WorkshopForm>
    </WorkshopDialog>}
  </div>;
}
