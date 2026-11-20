"use client";

import Link from "next/link";
import { useId, useRef, useState, type FormEvent } from "react";
import { ApiError, getErrorMessage } from "@/lib/api";
import { formatManilaDateTime, fromManilaDateTimeInput, toManilaDateTimeInput } from "@/lib/activity-date";
import { Button, ConfirmDialog, FieldError, LoadingPanel, Notice, StatusChip, useApi } from "@/components/workspace/ui";
import { SaveConflict } from "./save-conflict";
import { useToast } from "@/components/toast";
import {
  courseAnnouncementsPath, deleteCourseAnnouncement, postCourseAnnouncement, updateCourseAnnouncement,
  type AnnouncementInput, type CourseAnnouncement,
} from "@/lib/workspace";

const PREVIEW_SIZE = 4;
const TITLE_LIMIT = 120;
const BODY_LIMIT = 2000;
const fields = ["title", "body", "expires_at"] as const;
type Field = typeof fields[number];
type Errors = Partial<Record<Field, string>>;
type Draft = Omit<AnnouncementInput, "expires_at"> & { expires_at: string };
type Editor = { mode: "new" } | { mode: "edit" | "delete"; item: CourseAnnouncement };

function draftFor(item?: CourseAnnouncement): Draft {
  return { title: item?.title ?? "", body: item?.body ?? "", pinned: item?.pinned ?? false, expires_at: toManilaDateTimeInput(item?.expires_at) };
}

function fieldErrors(error: unknown): Errors {
  if (!(error instanceof ApiError) || error.status !== 422) return {};
  const detail = (error.details as { detail?: unknown } | null)?.detail;
  if (!Array.isArray(detail)) return {};
  const errors: Errors = {};
  for (const field of fields) {
    const violation = detail.find((entry) => Array.isArray(entry?.loc) && entry.loc.at(-1) === field);
    if (typeof violation?.msg === "string") errors[field] = violation.msg.replace(/^Value error, /, "");
  }
  return errors;
}

function AnnouncementDialog({ editor, courseId, onClose, onReload, onSaved, manageHref }: {
  editor: Editor;
  courseId: string;
  onClose: () => void;
  onReload: () => void;
  onSaved: (message: string) => void;
  manageHref?: string;
}) {
  const item = editor.mode === "new" ? undefined : editor.item;
  const deleting = editor.mode === "delete";
  const [initial] = useState(() => draftFor(item));
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState("");
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const formId = useId();

  function editField(field: Field, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function markErrors(form: HTMLFormElement, found: Errors) {
    setErrors(found);
    const first = fields.find((field) => found[field]);
    if (first) (form.elements.namedItem(first) as HTMLElement | null)?.focus();
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const form = event.currentTarget;
    setMessage("");
    const title = draft.title.trim();
    const body = draft.body.trim();
    const expires_at = fromManilaDateTimeInput(draft.expires_at);
    const expiryChanged = !item || draft.expires_at !== initial.expires_at;
    const found: Errors = {};
    if (!title || [...title].length > TITLE_LIMIT) found.title = "Enter a title from 1 to 120 characters.";
    if (!body || [...body].length > BODY_LIMIT) found.body = "Enter a message from 1 to 2,000 characters.";
    if (expiryChanged && draft.expires_at && (!expires_at || Date.parse(expires_at) <= Date.now())) {
      found.expires_at = "Choose a date and time in the future.";
    }
    markErrors(form, found);
    if (Object.keys(found).length) return;

    pending.current = true;
    setBusy(true);
    try {
      if (item) {
        const changes: Partial<AnnouncementInput> = {};
        if (title !== initial.title) changes.title = title;
        if (body !== initial.body) changes.body = body;
        if (draft.pinned !== initial.pinned) changes.pinned = draft.pinned;
        if (expiryChanged) changes.expires_at = expires_at;
        if (!Object.keys(changes).length) { onClose(); return; }
        await updateCourseAnnouncement(item.id, changes, item.updated_at);
      } else {
        await postCourseAnnouncement(courseId, { title, body, pinned: draft.pinned, expires_at });
      }
      onSaved(item ? "Announcement updated." : "Announcement posted.");
    } catch (error) {
      if (error instanceof ApiError && error.code === "version_conflict") {
        setConflict(true);
        return;
      }
      const found = fieldErrors(error);
      if (Object.keys(found).length) markErrors(form, found);
      else setMessage(getErrorMessage(error));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  async function remove() {
    if (!item || pending.current) return;
    pending.current = true;
    setBusy(true);
    setMessage("");
    try {
      await deleteCourseAnnouncement(item.id);
      onSaved("Announcement deleted.");
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <ConfirmDialog
      open
      title={deleting ? "Delete announcement?" : item ? "Edit announcement" : "New announcement"}
      confirmLabel={deleting ? "Delete announcement" : item ? "Save changes" : "Post announcement"}
      confirmForm={deleting ? undefined : formId}
      tone={deleting ? "danger" : "primary"}
      busy={busy}
      onCancel={() => { if (!pending.current) onClose(); }}
      onConfirm={deleting ? () => void remove() : undefined}
    >
      {conflict ? <SaveConflict changes={draft} onReload={onReload} /> : null}
      {message ? <Notice tone="error">{message}</Notice> : null}
      {manageHref ? <p className="ws-muted"><Link className="ws-text-link" href={manageHref} onClick={onClose}>Manage announcements</Link></p> : null}
      {deleting ? <p className="announcement-copy announcement-delete-copy">“{item?.title}” will be removed from student dashboards.</p> : (
        <form className="announcement-form" id={formId} noValidate onSubmit={(event) => void save(event)}>
          <div className="ws-field">
            <label htmlFor={`${formId}-title`}>Title</label>
            <input
              id={`${formId}-title`} name="title" required maxLength={TITLE_LIMIT * 2} disabled={busy} value={draft.title}
              onChange={(event) => editField("title", event.target.value)}
              aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? `${formId}-title-error` : undefined}
            />
            <FieldError id={`${formId}-title-error`}>{errors.title}</FieldError>
          </div>
          <div className="ws-field">
            <label htmlFor={`${formId}-body`}>Message</label>
            <textarea
              id={`${formId}-body`} name="body" rows={5} required maxLength={BODY_LIMIT * 2} disabled={busy} value={draft.body}
              onChange={(event) => editField("body", event.target.value)}
              aria-invalid={Boolean(errors.body)}
              aria-describedby={errors.body ? `${formId}-count ${formId}-body-error` : `${formId}-count`}
            />
            <p id={`${formId}-count`} className="ws-muted">{[...draft.body.trim()].length} / {BODY_LIMIT.toLocaleString()} characters</p>
            <FieldError id={`${formId}-body-error`}>{errors.body}</FieldError>
          </div>
          <div className="ws-field">
            <label htmlFor={`${formId}-expiry`}>Expires at (optional)</label>
            <input
              id={`${formId}-expiry`} name="expires_at" type="datetime-local" disabled={busy} value={draft.expires_at}
              onChange={(event) => editField("expires_at", event.target.value)}
              aria-invalid={Boolean(errors.expires_at)}
              aria-describedby={errors.expires_at ? `${formId}-expiry-error` : `${formId}-expiry-help`}
            />
            <p id={`${formId}-expiry-help`} className="ws-muted">Uses Asia/Manila time. Leave blank to keep the notice up.</p>
            <FieldError id={`${formId}-expiry-error`}>{errors.expires_at}</FieldError>
          </div>
          <label className="announcement-pin">
            <input type="checkbox" checked={draft.pinned} disabled={busy} onChange={(event) => setDraft({ ...draft, pinned: event.target.checked })} />
            Pin to the top
          </label>
        </form>
      )}
    </ConfirmDialog>
  );
}

export function AnnounceButton({ courseId, manageHref }: { courseId: string; manageHref: string }) {
  const [open, setOpen] = useState(false);
  const toast = useToast();
  return <>
    <button type="button" className="ic-button" onClick={() => setOpen(true)}>Announce</button>
    {open ? <AnnouncementDialog editor={{ mode: "new" }} courseId={courseId} manageHref={manageHref}
      onClose={() => setOpen(false)} onReload={() => setOpen(false)} onSaved={(message) => {
        toast.show(message, "success");
        setOpen(false);
      }} /> : null}
  </>;
}

export function CourseAnnouncements({ courseId }: { courseId: string }) {
  const { data, loading, error, reload, setData } = useApi<{ items: CourseAnnouncement[]; limit: number }>(courseAnnouncementsPath(courseId));
  const [editor, setEditor] = useState<Editor | null>(null);
  const [status, setStatus] = useState("");
  const [expanded, setExpanded] = useState(false);
  const headingId = useId();
  const listId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const items = data?.items ?? [];

  return (
    <section className="ws-panel course-announcements" aria-labelledby={headingId}>
      <div className="ws-panel-head">
        <div>
          <h2 id={headingId} tabIndex={-1} ref={heading}>Announcements</h2>
          <p className="ws-muted">Post a notice to this course’s student dashboards.</p>
        </div>
        <Button className="ws-touch-action" variant="primary" onClick={() => { setStatus(""); setEditor({ mode: "new" }); }}>
          New announcement
        </Button>
      </div>
      {status ? <Notice tone="success">{status}</Notice> : null}
      {error ? <Notice tone="error">{error} <Button className="ws-touch-action" onClick={reload}>Retry</Button></Notice> : null}
      {loading && !data ? <LoadingPanel label="Loading course announcements…" /> : null}
      {data && items.length === 0 ? <p className="ws-muted">No announcements yet.</p> : null}
      {items.length ? (
        <ul className="ws-list announcement-list" id={listId}>
          {(expanded ? items : items.slice(0, PREVIEW_SIZE)).map((item) => (
            <li className="ws-row" key={item.id}>
              <div className="ws-row-main">
                <div className="ws-row-heading">
                  <strong className="announcement-copy">{item.title}</strong>
                  {item.pinned ? <StatusChip state="active" label="Pinned" /> : null}
                  {item.expired ? <StatusChip state="closed" label="Expired" /> : null}
                </div>
                <p className="announcement-copy">{item.body}</p>
                <p className="ws-row-meta">
                  Posted {formatManilaDateTime(item.created_at)}
                  {item.expires_at ? ` · ${item.expired ? "Expired" : "Expires"} ${formatManilaDateTime(item.expires_at)}` : ""}
                </p>
              </div>
              <div className="ws-row-actions">
                <Button className="ws-touch-action" onClick={() => { setStatus(""); setEditor({ mode: "edit", item }); }} aria-label={`Edit ${item.title}`}>Edit</Button>
                <Button className="ws-touch-action" variant="quiet" onClick={() => { setStatus(""); setEditor({ mode: "delete", item }); }} aria-label={`Delete ${item.title}`}>Delete</Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {items.length > PREVIEW_SIZE ? (
        <Button className="ws-touch-action" variant="quiet" aria-expanded={expanded} aria-controls={listId} onClick={() => setExpanded(!expanded)}>
          {expanded ? "Show fewer announcements" : `Show all ${items.length} announcements`}
        </Button>
      ) : null}
      {data && items.length >= data.limit ? <p className="ws-muted">This course has reached its {data.limit}-announcement limit. Delete a notice to free a slot.</p> : null}
      {editor ? (
        <AnnouncementDialog
          editor={editor} courseId={courseId} onClose={() => setEditor(null)}
          onReload={() => { setEditor(null); reload(); }}
          onSaved={(message) => {
            if (editor.mode === "delete" && data) {
              setData({ ...data, items: data.items.filter((item) => item.id !== editor.item.id) });
              heading.current?.focus();
            }
            setEditor(null);
            setStatus(message);
            reload();
          }}
        />
      ) : null}
    </section>
  );
}
