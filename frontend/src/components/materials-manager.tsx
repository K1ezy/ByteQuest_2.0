"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { getErrorMessage } from "@/lib/api";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/instructor/course-ui";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  FieldError,
  LoadingPanel,
  Notice,
  PageHeading,
  SearchField,
  SelectField,
  StatusChip,
  Toolbar,
  useApi,
} from "@/components/workspace/ui";
import {
  archiveMaterial,
  formatDateTime,
  getMaterialDownload,
  materialStateLabel,
  restoreMaterial,
  retryMaterial,
  updateMaterial,
  uploadMaterial,
  type AdminMaterialList,
  type MaterialList,
  type MaterialScope,
  type MaterialSummary,
} from "@/lib/workspace";

const LANGUAGE_OPTIONS = [
  { value: "python", label: "Python" },
  { value: "cpp", label: "C++" },
  { value: "java", label: "Java" },
];

const STATUS_OPTIONS = [
  { value: "", label: "All materials" },
  { value: "attention", label: "Needs attention" },
  { value: "ready", label: "Ready" },
  { value: "processing", label: "Processing" },
  { value: "needs_review", label: "Needs review" },
  { value: "failed", label: "Failed" },
  { value: "archived", label: "Archived" },
];

type UploadState = {
  course: string;
  title: string;
  description: string;
  language: string;
  topic: string;
  file: File | null;
};

const EMPTY_UPLOAD: UploadState = { course: "", title: "", description: "", language: "python", topic: "", file: null };

/**
 * One materials library for both roles. Faculty work inside the selected course
 * and can replace versions and generate drafts; administrators work across
 * courses on operational fixes only (academic review stays with faculty).
 */
export function MaterialsManager({ scope }: { scope: MaterialScope }) {
  const { courseId, courses, refreshCourses, courseHref } = useWorkspace();
  const admin = scope === "admin";
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const focusedMaterial = searchParams.get("material");
  const replaceRequested = searchParams.get("replace") === "1";
  const status = searchParams.get("status") || "";
  const appliedSearch = searchParams.get("q") || "";
  const courseFilter = admin ? searchParams.get("course") || "" : courseId || "";
  const [search, setSearch] = useState(appliedSearch);
  const [notice, setNotice] = useState<{ tone: "success" | "error" | "info" | "warning"; text: string } | null>(null);
  const [busy, setBusy] = useState<"upload" | "archive" | "restore" | "retry" | "edit" | "download" | "">("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploadOpen, setUploadOpen] = useState(false);
  const [upload, setUpload] = useState<UploadState>(EMPTY_UPLOAD);
  const [replaceTarget, setReplaceTarget] = useState<MaterialSummary | null>(null);
  const [editing, setEditing] = useState<MaterialSummary | null>(null);
  const [editForm, setEditForm] = useState({ title: "", description: "", language: "python", topic: "" });
  const [archiveTarget, setArchiveTarget] = useState<MaterialSummary | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadButton = useRef<HTMLButtonElement>(null);
  const openedReplacement = useRef<string | null>(null);

  const path = useMemo(
    () =>
      admin || courseFilter
        ? `/${scope}/materials?${new URLSearchParams({
            ...(courseFilter ? { course_id: courseFilter } : {}),
            ...(status ? { status } : {}),
            ...(appliedSearch ? { search: appliedSearch } : {}),
          }).toString()}`
        : null,
    [admin, appliedSearch, courseFilter, scope, status],
  );
  const { data, error, loading, reload } = useApi<MaterialList | AdminMaterialList>(path);
  const maxUploadBytes = data?.max_upload_bytes;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearch(appliedSearch);
  }, [appliedSearch]);

  useEffect(() => {
    if (!focusedMaterial || !data || replaceRequested) return;
    const element = document.getElementById(`material-${focusedMaterial}`);
    element?.scrollIntoView({ block: "center", behavior: "smooth" });
    element?.focus({ preventScroll: true });
  }, [data, focusedMaterial, replaceRequested]);

  function updateQuery(patch: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (!value) next.delete(key);
      else next.set(key, value);
    }
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  function openUpload(target: MaterialSummary | null) {
    setReplaceTarget(target);
    setUpload({
      course: upload.course,
      title: target?.title || "",
      description: target?.description || "",
      language: target?.language || "python",
      topic: target?.topic_concept || "",
      file: null,
    });
    setErrors({});
    setUploadOpen(true);
    setEditing(null);
    window.requestAnimationFrame(() => fileRef.current?.focus());
  }

  useEffect(() => {
    if (admin || !replaceRequested || !focusedMaterial || !data || !("course" in data) || data.course.id !== courseId) return;
    const target = data.items.find((item) => item.document_id === focusedMaterial && !item.archived_at);
    if (!target || openedReplacement.current === target.document_id) return;
    openedReplacement.current = target.document_id;
    // The dashboard deep link opens the existing replacement form once per material.
    openUpload(target);
  }, [admin, courseId, data, focusedMaterial, replaceRequested]);

  function startEdit(material: MaterialSummary) {
    setEditing(material);
    setEditForm({
      title: material.title,
      description: material.description || "",
      language: material.language || "python",
      topic: material.topic_concept || "",
    });
    setUploadOpen(false);
    setErrors({});
  }

  async function submitUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const uploadCourse = admin ? upload.course : courseId;
    const found: Record<string, string> = {};
    if (!uploadCourse) found.course = "Choose a course.";
    if (upload.title.trim().length < 2) found.title = "Enter a title of at least 2 characters.";
    if (!upload.file) found.file = "Choose a PDF file.";
    else if (!upload.file.name.toLowerCase().endsWith(".pdf")) found.file = "Only PDF files are supported.";
    else if (maxUploadBytes && upload.file.size > maxUploadBytes) {
      found.file = `The PDF must be ${maxUploadBytes / 1024 ** 2} MiB or smaller.`;
    }
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    if (!upload.file || !uploadCourse) return;

    const formData = new FormData();
    formData.append("course_id", uploadCourse);
    formData.append("title", upload.title.trim());
    formData.append("language_tag", upload.language);
    formData.append("file", upload.file);
    if (upload.description.trim()) formData.append("description", upload.description.trim());
    if (upload.topic.trim()) formData.append("topic_concept", upload.topic.trim());

    setBusy("upload");
    setNotice(null);
    try {
      const result = await uploadMaterial(scope, formData, replaceTarget?.document_id);
      setNotice({
        tone: result.material.state === "ready" ? "success" : "warning",
        text: result.message,
      });
      setUploadOpen(false);
      setReplaceTarget(null);
      setUpload({ ...EMPTY_UPLOAD, course: upload.course });
      if (fileRef.current) fileRef.current.value = "";
      reload();
      await refreshCourses();
    } catch (caught) {
      setNotice({ tone: "error", text: `${getErrorMessage(caught)} Nothing was changed; your form values are still here.` });
    } finally {
      setBusy("");
    }
  }

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    if (editForm.title.trim().length < 2) {
      setErrors({ title: "Enter a title of at least 2 characters." });
      return;
    }
    setBusy("edit");
    setNotice(null);
    try {
      const result = await updateMaterial(scope, editing.document_id, {
        title: editForm.title.trim(),
        description: editForm.description.trim() || null,
        ...(admin ? {} : { language_tag: editForm.language }),
        topic_concept: editForm.topic.trim() || null,
      });
      setNotice({ tone: "success", text: result.message });
      setEditing(null);
      reload();
    } catch (caught) {
      setNotice({ tone: "error", text: getErrorMessage(caught) });
    } finally {
      setBusy("");
    }
  }

  async function confirmArchive() {
    if (!archiveTarget) return;
    setBusy("archive");
    try {
      const result = await archiveMaterial(scope, archiveTarget.document_id);
      setNotice({ tone: "success", text: result.message });
      setArchiveTarget(null);
      reload();
      await refreshCourses();
    } catch (caught) {
      setNotice({ tone: "error", text: getErrorMessage(caught) });
    } finally {
      setBusy("");
    }
  }

  async function doRestore(material: MaterialSummary) {
    setBusy("restore");
    try {
      const result = await restoreMaterial(scope, material.document_id);
      setNotice({ tone: "success", text: result.message });
      reload();
      await refreshCourses();
    } catch (caught) {
      setNotice({ tone: "error", text: getErrorMessage(caught) });
    } finally {
      setBusy("");
    }
  }

  async function doRetry(material: MaterialSummary) {
    setBusy("retry");
    setNotice(null);
    try {
      const result = await retryMaterial(scope, material.document_id);
      setNotice({ tone: result.material.state === "ready" ? "success" : "error", text: result.message });
      reload();
      await refreshCourses();
    } catch (caught) {
      setNotice({ tone: "error", text: getErrorMessage(caught) });
    } finally {
      setBusy("");
    }
  }

  async function doDownload(material: MaterialSummary) {
    setBusy("download");
    try {
      const result = await getMaterialDownload(scope, material.document_id);
      window.location.assign(result.download_url);
    } catch (caught) {
      setNotice({ tone: "error", text: getErrorMessage(caught) });
    } finally {
      setBusy("");
    }
  }

  const items = data?.items || [];

  return (
    <>
      {admin ? (
        <PageHeading
          eyebrow="ADMINISTRATION"
          title="Materials"
          description="Operational status across courses. Administrators upload, edit details, retry safe failures and archive; academic review stays with instructors."
          status={data ? <StatusChip state="active" label={`${data.total} in this view`} /> : undefined}
          actions={<Button variant="primary" onClick={() => openUpload(null)}>Upload PDF</Button>}
        />
      ) : (
        <PageHeader
          title="Materials"
          subtitle="Course PDFs become the citable evidence for generated drafts."
          actions={!uploadOpen ? (
            <button ref={uploadButton} type="button" className="ic-button ic-primary" onClick={() => openUpload(null)}>Upload PDF</button>
          ) : undefined}
        />
      )}

      {notice ? (
        <Notice tone={notice.tone === "success" ? "success" : notice.tone === "error" ? "error" : notice.tone === "warning" ? "warning" : "info"} onDismiss={() => setNotice(null)}>
          {notice.text}
        </Notice>
      ) : null}

      {uploadOpen ? (
        <section className="ws-panel ws-upload-panel" aria-labelledby="upload-title">
          <div className="ws-panel-head">
            <div>
              <p className="eyebrow-label">{replaceTarget ? "REPLACE SOURCE" : "NEW MATERIAL"}</p>
              <h2 id="upload-title">{replaceTarget ? `Replace version of ${replaceTarget.title}` : "Upload a course PDF"}</h2>
            </div>
            <button
              type="button"
              className="ws-inline-link"
              onClick={() => {
                setUploadOpen(false);
                setReplaceTarget(null);
                if (!admin && !replaceTarget) requestAnimationFrame(() => uploadButton.current?.focus());
              }}
            >
              Cancel
            </button>
          </div>
          <form className="ws-form-grid" onSubmit={(event) => void submitUpload(event)}>
            {admin ? (
              <div className="ws-field">
                <label htmlFor="material-course">Course</label>
                <select id="material-course" value={upload.course} onChange={(event) => setUpload({ ...upload, course: event.target.value })} aria-invalid={Boolean(errors.course)}>
                  <option value="">Choose a course</option>
                  {courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
                </select>
                <FieldError>{errors.course}</FieldError>
              </div>
            ) : null}
            <div className="ws-field">
              <label htmlFor="material-title">Title</label>
              <input
                id="material-title"
                value={upload.title}
                minLength={2}
                maxLength={255}
                onChange={(event) => setUpload({ ...upload, title: event.target.value })}
                aria-invalid={Boolean(errors.title)}
              />
              <FieldError>{errors.title}</FieldError>
            </div>
            <div className="ws-field">
              <label htmlFor="material-file">PDF file</label>
              <input
                ref={fileRef}
                id="material-file"
                type="file"
                accept="application/pdf,.pdf"
                onChange={(event) => setUpload({ ...upload, file: event.target.files?.[0] || null })}
                aria-invalid={Boolean(errors.file)}
                aria-describedby="material-file-help"
              />
              <FieldError>{errors.file}</FieldError>
              <p className="ws-muted" id="material-file-help">
                {maxUploadBytes ? `Up to ${maxUploadBytes / 1024 ** 2} MiB. ` : ""}Use a PDF with selectable text.
              </p>
            </div>
            <div className="ws-field">
              <label htmlFor="material-language">Language track</label>
              <select id="material-language" value={upload.language} onChange={(event) => setUpload({ ...upload, language: event.target.value })}>
                {LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="ws-field">
              <label htmlFor="material-topic">Topic (optional)</label>
              <input id="material-topic" maxLength={100} value={upload.topic} onChange={(event) => setUpload({ ...upload, topic: event.target.value })} />
            </div>
            <div className="ws-field full">
              <label htmlFor="material-description">Description (optional)</label>
              <textarea
                id="material-description"
                rows={2}
                maxLength={4000}
                value={upload.description}
                onChange={(event) => setUpload({ ...upload, description: event.target.value })}
              />
            </div>
            <div className="ws-inline-actions full">
              <Button variant="primary" type="submit" disabled={busy !== ""} aria-busy={busy === "upload"}>
                {busy === "upload" ? "Uploading and indexing…" : replaceTarget ? "Save new version" : "Upload and index"}
              </Button>
              <span className="ws-muted">The file is validated before processing; failures keep a visible record.</span>
            </div>
          </form>
        </section>
      ) : null}

      {editing ? (
        <section className="ws-panel ws-upload-panel" aria-labelledby="edit-material-title">
          <div className="ws-panel-head">
            <div>
              <p className="eyebrow-label">MATERIAL DETAILS</p>
              <h2 id="edit-material-title">Edit {editing.title}</h2>
            </div>
            <button type="button" className="ws-inline-link" onClick={() => setEditing(null)}>
              Cancel
            </button>
          </div>
          <form className="ws-form-grid" onSubmit={(event) => void submitEdit(event)}>
            <div className="ws-field">
              <label htmlFor="edit-title">Title</label>
              <input id="edit-title" value={editForm.title} minLength={2} maxLength={255} onChange={(event) => setEditForm({ ...editForm, title: event.target.value })} aria-invalid={Boolean(errors.title)} />
              <FieldError>{errors.title}</FieldError>
            </div>
            {admin ? null : (
              <div className="ws-field">
                <label htmlFor="edit-language">Language track</label>
                <select id="edit-language" value={editForm.language} onChange={(event) => setEditForm({ ...editForm, language: event.target.value })}>
                  {LANGUAGE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="ws-field">
              <label htmlFor="edit-topic">Topic (optional)</label>
              <input id="edit-topic" value={editForm.topic} maxLength={100} onChange={(event) => setEditForm({ ...editForm, topic: event.target.value })} />
            </div>
            <div className="ws-field full">
              <label htmlFor="edit-description">Description (optional)</label>
              <textarea id="edit-description" rows={2} maxLength={4000} value={editForm.description} onChange={(event) => setEditForm({ ...editForm, description: event.target.value })} />
            </div>
            <div className="ws-inline-actions full">
              <Button variant="primary" type="submit" disabled={busy !== ""}>
                {busy === "edit" ? "Saving…" : "Save details"}
              </Button>
              <span className="ws-muted">The stored PDF and version history are unchanged.</span>
            </div>
          </form>
        </section>
      ) : null}

      <Toolbar label="Material filters">
        <SearchField
          value={search}
          onChange={setSearch}
          onSubmit={() => updateQuery({ q: search || null })}
          placeholder="Search materials"
          label="Search materials"
        />
        {admin ? (
          <SelectField label="Course" value={courseFilter} onChange={(value) => updateQuery({ course: value || null })} options={courses.map((course) => ({ value: course.id, label: course.title }))} includeAll allLabel="All courses" />
        ) : null}
        <SelectField label="Processing state" value={status} onChange={(value) => updateQuery({ status: value || null })} options={STATUS_OPTIONS.slice(1)} includeAll allLabel="All materials" />
        {status || appliedSearch || (admin && courseFilter) ? (
          <Button variant="quiet" onClick={() => { setSearch(""); updateQuery({ status: null, q: null, course: null }); }}>
            Clear filters
          </Button>
        ) : null}
      </Toolbar>

      {error ? (
        <Notice tone="error">
          Materials could not load. {error}{" "}
          <button type="button" className="ws-inline-link" onClick={reload}>
            Retry
          </button>
        </Notice>
      ) : null}
      {loading && !data ? <LoadingPanel label="Loading course materials…" /> : null}

      {!loading && data && items.length === 0 ? (
        <EmptyState
          title={status || appliedSearch ? "No materials match these filters" : "No course material yet"}
          action={admin ? (
            <div className="ws-inline-actions">
              <Button variant="primary" onClick={() => openUpload(null)}>
                Upload PDF
              </Button>
              {(status || appliedSearch) && (
                <Button variant="outline" onClick={() => updateQuery({ status: null, q: null })}>
                  Clear filters
                </Button>
              )}
            </div>
          ) : undefined}
        >
          {status || appliedSearch
            ? "Try another processing state or search term. Your filters stay visible until you clear them."
            : "Upload a searchable PDF to give generated drafts citable source pages."}
        </EmptyState>
      ) : null}

      {items.length > 0 ? (
        <ul className="ws-list">
          {items.map((material) => {
            const highlighted = focusedMaterial === material.document_id;
            return (
              <li
                className={`ws-row ws-material${highlighted ? " is-focused" : ""}`}
                key={material.document_id}
                id={`material-${material.document_id}`}
                tabIndex={-1}
              >
                <div className="ws-row-main">
                  <div className="ws-row-heading">
                    <strong>{material.title}</strong>
                    {material.topic_concept ? (
                      <span className="ws-tag" data-tooltip="Topic this material covers"><span className="sr-only">Topic: </span>{material.topic_concept}</span>
                    ) : null}
                  </div>
                  <p>
                    {material.filename || "Stored PDF"} · version {material.version_number} ·{" "}
                    {material.file_size_bytes ? `${Math.ceil(material.file_size_bytes / 1024)} KB` : "size unknown"} ·{" "}
                    {material.total_chunks} indexed {material.total_chunks === 1 ? "passage" : "passages"}
                  </p>
                  {admin ? (
                    <span className="ws-row-meta">
                      {material.course?.title || "Unassigned course"}{material.uploaded_by ? ` · uploaded by ${material.uploaded_by}` : ""}
                    </span>
                  ) : null}
                  <span className="ws-row-meta">
                    Uploaded {formatDateTime(material.created_at)} · {material.draft_count} linked draft
                    {material.draft_count === 1 ? "" : "s"}
                  </span>
                  {material.processing_error ? (
                    <p className="ws-row-note">
                      <strong>Processing note:</strong> {material.processing_error}{" "}
                      {material.can_retry ? "You can retry this transient failure." : "Replace the PDF with a searchable copy to continue."}
                    </p>
                  ) : null}
                  {material.versions && material.versions.length > 1 ? (
                    <details className="ws-versions">
                      <summary>{material.versions.length} versions</summary>
                      <ul>
                        {material.versions.map((version) => (
                          <li key={version.document_id}>
                            v{version.version_number} · {version.state} · {formatDateTime(version.created_at)}
                            {version.is_current ? " · current" : ""}
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </div>
                <div className="ws-row-actions ws-material-actions">
                  <StatusChip state={material.state} label={materialStateLabel[material.state]} />
                  <div className="ws-action-grid">
                    {!admin && material.state === "ready" && material.is_current && !material.archived_at && (
                      <Link className="button button-outline" href={courseHref(`/instructor/activities/new?method=gemini&document=${material.document_id}`)}>
                        Use this PDF
                      </Link>
                    )}
                    <Button variant="primary" disabled={busy !== ""} data-tooltip="Download the stored PDF for this version" onClick={() => void doDownload(material)}>
                      {busy === "download" ? "Preparing…" : "Download PDF"}
                    </Button>
                    {material.state === "failed" && material.can_retry ? (
                      <Button variant="outline" disabled={busy !== ""} data-tooltip="Retry indexing this PDF after a transient failure" onClick={() => void doRetry(material)}>
                        {busy === "retry" ? "Retrying…" : "Retry processing"}
                      </Button>
                    ) : null}
                    {!admin && !material.archived_at ? (
                      <Button variant="outline" disabled={busy !== ""} data-tooltip="Upload a new PDF as the next version, keeping citation history" onClick={() => openUpload(material)}>
                        Replace version
                      </Button>
                    ) : null}
                    <Button variant="quiet" disabled={busy !== ""} data-tooltip="Edit the title, topic and metadata for this material" onClick={() => startEdit(material)}>
                      Edit details
                    </Button>
                    {material.archived_at ? (
                      <Button variant="quiet" disabled={busy !== ""} data-tooltip="Restore this material so it can be cited again" onClick={() => void doRestore(material)}>
                        {busy === "restore" ? "Restoring…" : "Restore"}
                      </Button>
                    ) : (
                      <Button variant="danger" disabled={busy !== ""} data-tooltip="Archive this material; historical citations stay intact" onClick={() => setArchiveTarget(material)}>
                        Archive
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      <p className="ws-footnote">
        Scanned PDFs without searchable text are marked Needs review and cannot be cited. Archiving keeps every historical
        citation intact.{admin ? " Administrators do not approve drafts, edit quiz keys, edit hidden tests or change grades." : ""}
      </p>

      <ConfirmDialog
        open={Boolean(archiveTarget)}
        title="Archive this material"
        confirmLabel="Archive material"
        tone="danger"
        busy={busy === "archive"}
        onCancel={() => setArchiveTarget(null)}
        onConfirm={() => void confirmArchive()}
      >
        {archiveTarget ? (
          <>
            <p>
              <strong>{archiveTarget.title}</strong> version {archiveTarget.version_number} stops being available for new
              generations.
            </p>
            <ul className="ws-plain-list">
              <li>{archiveTarget.draft_count} linked draft(s) keep their cited pages.</li>
              <li>The stored PDF and every version stay available for download.</li>
              <li>You can restore it later; existing activities are unaffected.</li>
            </ul>
          </>
        ) : null}
      </ConfirmDialog>
    </>
  );
}
