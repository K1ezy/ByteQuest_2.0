"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Button, useApi } from "@/components/workspace/ui";
import { apiRequest, getErrorMessage } from "@/lib/api";
import { useWorkshop } from "./workshop-layout";
import { WorkshopDialog, WorkshopError, WorkshopForm, WorkshopInvite, workshopDateTime } from "./workshop-ui";

type Announcement = { id: string; body: string; pinned: boolean; created_at: string; updated_at: string };
type Upcoming = { id: string; title: string; kind: "quiz" | "challenge"; closes_at: string };
type AnnouncementDialog = { mode: "post" } | { mode: "edit" | "delete"; item: Announcement };

function UpcomingItems() {
  const { workshop } = useWorkshop();
  const path = `/workshops/${workshop.id}`;
  const { data, loading, error, reload } = useApi<Upcoming[]>(`${path}/upcoming`, true);
  return <section className="workshop-panel workshop-upcoming">
    <h2>Upcoming</h2>
    <p className="workshop-muted">Times are shown in Asia/Manila.</p>
    {loading ? <p role="status">Loading upcoming items…</p> : error ? <>
      <p className="notice error" role="alert">{error}</p>
      <Button onClick={reload}>Retry</Button>
    </> : data?.length ? <ul>
      {data.map((item) => {
        return <li key={`${item.kind}-${item.id}`}>
          <Link className="workshop-text-link" href={`${path}/activities`}>{item.title}</Link>
          <span className="workshop-muted">{item.kind === "quiz" ? "Concept check" : "Code challenge"}</span>
          <span>Closes <time dateTime={item.closes_at}>{workshopDateTime(item.closes_at)}</time></span>
        </li>;
      })}
    </ul> : <p>Nothing is due in the next seven days.</p>}
  </section>;
}

function Announcements() {
  const { workshop } = useWorkshop();
  const path = `/workshops/${workshop.id}/announcements`;
  const { data, loading, error, reload, setData } = useApi<Announcement[]>(path, true);
  const [dialog, setDialog] = useState<AnnouncementDialog | null>(null);
  const [notice, setNotice] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinning, setPinning] = useState(false);
  const inFlight = useRef(false);
  const manage = workshop.is_owner && !workshop.archived;
  const canPost = manage && workshop.owned_by_me;

  function merge(updated: Announcement) {
    setData((current) => [updated, ...(current ?? []).filter((item) => item.id !== updated.id)]);
  }

  async function save(fields: FormData) {
    if (!dialog) return;
    setNotice("");
    setPinError("");
    if (dialog.mode === "delete") {
      await apiRequest<void>(`${path}/${dialog.item.id}`, { method: "DELETE" });
      setData((current) => current?.filter((item) => item.id !== dialog.item.id) ?? []);
      setNotice("Announcement deleted.");
    } else {
      const created = dialog.mode === "post";
      const updated = await apiRequest<Announcement>(created ? path : `${path}/${dialog.item.id}`, {
        method: created ? "POST" : "PATCH", body: JSON.stringify({ body: fields.get("body") }),
      });
      merge(updated);
      setNotice(created ? "Announcement posted." : "Announcement updated.");
    }
    setDialog(null);
  }

  async function pin(item: Announcement) {
    if (inFlight.current) return;
    inFlight.current = true;
    setPinning(true);
    setPinError("");
    setNotice("");
    try {
      merge(await apiRequest<Announcement>(`${path}/${item.id}`, {
        method: "PATCH", body: JSON.stringify({ pinned: !item.pinned }),
      }));
      setNotice(item.pinned ? "Announcement unpinned." : "Announcement pinned.");
    } catch (cause) {
      setPinError(getErrorMessage(cause));
    } finally {
      inFlight.current = false;
      setPinning(false);
    }
  }

  const items = [...(data ?? [])].sort((left, right) => Number(right.pinned) - Number(left.pinned)
    || right.created_at.localeCompare(left.created_at) || right.id.localeCompare(left.id));
  return <section className="workshop-stack" aria-labelledby="workshop-announcements">
    <header className="workshop-heading">
      <h2 id="workshop-announcements" tabIndex={-1} data-workshop-focus>Announcements</h2>
      {canPost && <Button variant="primary" onClick={() => setDialog({ mode: "post" })}>Post announcement</Button>}
    </header>
    {notice && <p role="status">{notice}</p>}
    {pinError && <p className="notice error" role="alert">{pinError}</p>}
    {loading ? <p role="status">Loading announcements…</p> : error ? <WorkshopError message={error} retry={reload} />
      : items.length === 0 ? <div className="workshop-panel workshop-board-empty">
        <h3>No announcements yet.</h3>
        {canPost && <p>Use Post announcement to share a welcome message or practice instructions.</p>}
      </div>
      : items.map((item) => <article className="workshop-panel workshop-announcement" key={item.id}>
        <header className="workshop-heading">
          <span><strong>{workshop.owner_name}</strong> <time className="workshop-muted" dateTime={item.created_at}>{workshopDateTime(item.created_at)}</time></span>
          {item.pinned && <strong className="workshop-pinned">Pinned</strong>}
        </header>
        <p className="workshop-description">{item.body}</p>
        {manage && <div className="workshop-actions">
          <Button onClick={() => setDialog({ mode: "edit", item })}>Edit</Button>
          <Button aria-disabled={pinning} onClick={() => void pin(item)}>{item.pinned ? "Unpin" : "Pin"}</Button>
          <Button onClick={() => setDialog({ mode: "delete", item })}>Delete</Button>
        </div>}
      </article>)}
    {dialog && manage && <WorkshopDialog title={{ post: "Post announcement", edit: "Edit announcement", delete: "Delete announcement?" }[dialog.mode]}
      close={() => setDialog(null)}>
      <WorkshopForm submitLabel={{ post: "Post", edit: "Save changes", delete: "Delete announcement" }[dialog.mode]}
        close={() => setDialog(null)} onSubmit={save} danger={dialog.mode === "delete"}>
        {dialog.mode === "delete" ? <p>Delete this announcement from the Board?</p> : <label>Announcement
          <textarea name="body" data-initial-focus rows={5} maxLength={2000} required
            defaultValue={dialog.mode === "edit" ? dialog.item.body : ""} />
        </label>}
      </WorkshopForm>
    </WorkshopDialog>}
  </section>;
}

export function WorkshopBoard() {
  const { workshop } = useWorkshop();
  return <div className="workshop-stack">
    <h2 className="sr-only">Board</h2>
    {workshop.description && <p className="workshop-description">{workshop.description}</p>}
    <div className="workshop-board">
      <aside className="workshop-stack" aria-label="Workshop schedule and invitation">
        {workshop.is_owner && <WorkshopInvite key={workshop.join_code} workshop={workshop} />}
        <UpcomingItems />
      </aside>
      <Announcements />
    </div>
  </div>;
}
